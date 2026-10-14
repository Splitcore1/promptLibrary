"""Runs against the local Sites development server. Never use a hosted URL."""
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=")
FILE = {"name": "test.png", "mimeType": "image/png", "buffer": PNG}
OUT = Path("/tmp/promptfolio-qa")
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    anonymous = browser.new_context()
    assert anonymous.request.get(BASE + "/api/library").status == 401
    assert anonymous.request.post(BASE + "/api/prompts", data={}).status == 401
    anonymous.close()
    context = browser.new_context(viewport={"width": 1440, "height": 1050}, permissions=["clipboard-read", "clipboard-write"], accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/signin-with-chatgpt?return_to=/", wait_until="networkidle")
    api = context.request
    # Refuse to run against a populated local library. Never remove existing data.
    initial = api.get(BASE + "/api/library").json()
    assert initial["prompts"] == [] and initial["collections"] == [], "E2E requires an empty local fixture database; existing records are preserved."
    page.reload(wait_until="networkidle")
    assert page.locator(".prompt-card").count() == 6
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")

    page.get_by_role("button", name="Новая коллекция", exact=True).click()
    modal = page.get_by_role("dialog")
    modal.get_by_label("Название коллекции").fill("Тестовый проект")
    modal.get_by_role("button", name="Сохранить", exact=True).click()
    page.get_by_role("dialog").wait_for(state="hidden")
    page.get_by_role("button", name="Добавить промпт", exact=True).click()
    modal = page.get_by_role("dialog")
    modal.get_by_label("Название", exact=False).first.fill("Тестовая предметная съёмка")
    modal.get_by_label("Описание", exact=True).fill("Проверка сохранения на сервере")
    modal.get_by_label("Текст промпта", exact=False).fill("A precise studio product photo with soft light.")
    modal.get_by_label("Параметры генерации", exact=True).fill("Кадр: 4:5")
    modal.locator('input[type="file"]').first.set_input_files(FILE)
    modal.locator(".replace-cover").wait_for()
    modal.locator('input[type="file"]').nth(1).set_input_files(FILE)
    modal.locator(".reference-thumb").wait_for()
    modal.get_by_role("checkbox").check()
    modal.get_by_role("button", name="Сохранить промпт", exact=True).click()
    modal.wait_for(state="hidden")
    assert page.locator(".prompt-card").count() == 1
    saved = api.get(BASE + "/api/library").json()["prompts"][0]
    assert saved["referenceIds"] and saved["collectionIds"] and saved["version"] == 1
    assert api.get(BASE + "/api/assets/" + saved["coverId"]).body() == PNG
    assert api.post(BASE + "/api/assets", multipart={"file": {"name": "evil.png", "mimeType": "image/png", "buffer": b"<script>alert(1)</script>"}}).status == 400
    assert api.get(BASE + "/api/assets/not-my-image").status == 404

    page.get_by_role("button", name="В избранное", exact=True).click()
    page.get_by_role("button", name="Избранное", exact=False).first.click()
    assert page.locator(".prompt-card").count() == 1
    page.get_by_label("Поиск по тексту").fill("не существует")
    assert page.locator(".prompt-card").count() == 0
    page.get_by_role("button", name="Сбросить фильтры", exact=True).click()
    page.get_by_role("button", name="Midjourney", exact=True).click()
    assert page.locator(".prompt-card").count() == 0
    page.get_by_role("button", name="Все модели", exact=True).click()
    page.locator(".card-title").click()
    modal = page.get_by_role("dialog")
    modal.get_by_role("button", name="Копировать промпт", exact=True).click()
    assert page.evaluate("navigator.clipboard.readText()") == saved["prompt"]
    modal.get_by_role("button", name="Изменить", exact=True).click()
    modal = page.get_by_role("dialog")
    modal.get_by_label("Название", exact=False).first.fill("Обновлённая предметная съёмка")
    modal.get_by_role("button", name="Сохранить изменения", exact=True).click()
    modal.wait_for(state="hidden")
    updated = api.get(BASE + "/api/library").json()["prompts"][0]
    assert updated["title"].startswith("Обновлённая") and updated["favorite"] and updated["version"] == 2
    assert api.put(BASE + "/api/prompts/" + saved["id"], data=saved).status == 409
    revisions = api.get(BASE + "/api/prompts/" + saved["id"] + "/history").json()
    assert [r["version"] for r in revisions] == [2, 1]

    page.locator(".card-title").click()
    modal = page.get_by_role("dialog")
    modal.get_by_role("button", name="История", exact=True).click()
    modal.locator(".history-panel details").nth(1).locator("summary").click()
    modal.get_by_role("button", name="Восстановить эту версию", exact=True).click()
    modal.get_by_role("heading", name=saved["title"], exact=True).wait_for()
    restored = api.get(BASE + "/api/library").json()["prompts"][0]
    assert restored["version"] == 3 and restored["favorite"]
    modal.get_by_role("button", name="Поделиться", exact=True).click()
    share = page.get_by_role("dialog").last
    with page.expect_download() as download:
        share.get_by_role("button", name="Скачать карточку", exact=False).click()
    html = Path(download.value.path()).read_text()
    assert "data:image/png;base64," in html and saved["prompt"] in html and "Референсы" in html
    # Escape must close only the topmost dialog.
    page.keyboard.press("Escape")
    assert page.get_by_role("dialog").count() == 1
    page.get_by_role("dialog").get_by_role("button", name="Закрыть", exact=True).click()

    with page.expect_download() as download:
        page.get_by_role("button", name="Экспорт", exact=True).click()
    backup_path = OUT / "backup.json"
    download.value.save_as(backup_path)
    backup = json.loads(backup_path.read_text())
    assert backup["format"] == "promptfolio" and len(backup["prompts"][0]["history"]) == 3 and len(backup["assets"]) == 2
    assert api.delete(BASE + "/api/prompts/" + saved["id"]).ok
    page.reload(wait_until="networkidle")
    page.locator('input[accept=".json,application/json"]').set_input_files(backup_path)
    page.get_by_role("dialog").get_by_role("button", name="Импортировать", exact=True).click()
    page.get_by_role("dialog").wait_for(state="hidden")
    imported = api.get(BASE + "/api/library").json()
    assert len(imported["prompts"]) == 1 and len(imported["collections"]) == 1
    imported_prompt = imported["prompts"][0]
    assert imported_prompt["prompt"] == saved["prompt"] and imported_prompt["favorite"]
    assert imported_prompt["version"] == 3
    assert len(api.get(BASE + "/api/prompts/" + imported_prompt["id"] + "/history").json()) == 3
    assert api.get(BASE + "/api/assets/" + imported_prompt["coverId"]).body() == PNG
    assert api.delete(BASE + "/api/collections/" + imported["collections"][0]["id"]).ok
    assert not api.get(BASE + "/api/library").json()["prompts"][0]["collectionIds"]
    assert len(api.get(BASE + "/api/library").json()["prompts"]) == 1

    for width, height, name in [(1440, 1050, "desktop"), (834, 1112, "tablet"), (390, 844, "mobile"), (360, 800, "small-mobile")]:
        page.set_viewport_size({"width": width, "height": height})
        page.reload(wait_until="networkidle")
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), name + " has horizontal overflow"
        page.locator(".card-title").click()
        modal = page.get_by_role("dialog")
        assert modal.is_visible()
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        modal.get_by_role("button", name="Закрыть", exact=True).click()
        page.screenshot(path=str(OUT / (name + ".png")), full_page=True)
    assert not errors, errors
    assert api.delete(BASE + "/api/prompts/" + imported_prompt["id"]).ok
    browser.close()
    print("PASS: auth, upload validation, library CRUD, collections, search, filters, favorites, version conflicts, restoration, copy, sharing, image-backed export/import and 4 responsive sizes.")
