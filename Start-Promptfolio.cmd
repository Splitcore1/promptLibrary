@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" "scripts\launch-local.mjs"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Download the Windows x64 ZIP from GitHub Releases.
    echo https://github.com/Splitcore1/promptLibrary/releases/latest
    pause
    exit /b 1
  )
  node "scripts\launch-local.mjs"
)
if errorlevel 1 (
  echo.
  echo Не удалось запустить приложение. Скопируйте сообщение об ошибке из этого окна.
  pause
  exit /b 1
)
