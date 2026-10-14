import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { Problem, normalizePrompt, ensureOwnership } from './domain.mjs';
export { env, Problem, normalizePrompt, ensureOwnership };
export async function userId() {
 const u = await getChatGPTUser();
 if (!u) throw new Problem('Войдите в аккаунт, чтобы открыть библиотеку.', 401);
 return u.userId;
}
export function json(value: unknown, status=200) {
 return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
}
export async function api(fn: () => Promise<Response>) {
 try { return await fn(); } catch(e) {
 if (e instanceof Problem) return json({error:e.message},e.status);
 console.error('Library request failed', e instanceof Error ? e.message : 'Unknown error');
 return json({error:'Не удалось выполнить действие. Попробуйте ещё раз.'},500);
 }
}
export function sameOrigin(request: Request) {
 const origin = request.headers.get('origin');
 if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new Problem('Недопустимый источник запроса.',403);
}
export async function body(request: Request) {
 sameOrigin(request);
 if (Number(request.headers.get('content-length')) > 2_000_000) throw new Problem('Слишком большой файл данных.',413);
 const raw = await request.text();
 if (raw.length > 2_000_000) throw new Problem('Слишком большой файл данных.',413);
 try { return JSON.parse(raw); } catch { throw new Problem('Не удалось прочитать данные.'); }
}
export function rowPrompt(row:any) {
 return {...JSON.parse(row.data),id:row.id,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at};
}
export async function ownedPrompt(owner:string,id:string) {
 const row=await env.DB.prepare('SELECT * FROM prompts WHERE id = ? AND owner = ?').bind(id,owner).first();
 if(!row) throw new Problem('Промпт не найден.',404);
 return row as any;
}
export async function validateRelations(owner:string,data:any) {
 const [a,c]=await Promise.all([
 env.DB.prepare('SELECT id FROM assets WHERE owner = ?').bind(owner).all(),
 env.DB.prepare('SELECT id FROM collections WHERE owner = ?').bind(owner).all()]);
 ensureOwnership(data,new Set(a.results.map((r:any)=>r.id)),new Set(c.results.map((r:any)=>r.id)));
}
