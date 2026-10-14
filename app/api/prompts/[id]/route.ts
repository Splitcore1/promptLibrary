import { api,json,userId,env,body,normalizePrompt,validateRelations,ownedPrompt,rowPrompt,Problem,sameOrigin } from '../../../../lib/server';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function PUT(request:Request,ctx:Context) { return api(async()=>{
 const owner=await userId(),{id}=await ctx.params, input=await body(request),row=await ownedPrompt(owner,id);
 if(input.version !== row.version) throw new Problem('Промпт изменился на другом устройстве. Обновите библиотеку перед сохранением.',409);
 const data=normalizePrompt(input);
 data.favorite=JSON.parse(row.data).favorite;
 await validateRelations(owner,data);
 const payload=JSON.stringify(data),now=new Date().toISOString(),version=row.version+1;
 const results=await env.DB.batch([
 env.DB.prepare('UPDATE prompts SET data=?,version=?,updated_at=? WHERE id=? AND owner=? AND version=?').bind(payload,version,now,id,owner,row.version),
 env.DB.prepare('INSERT INTO revisions (id,prompt_id,owner,data,version,created_at) SELECT ?,id,owner,?,?,? FROM prompts WHERE id=? AND owner=? AND version=? AND updated_at=? AND changes()=1').bind(crypto.randomUUID(),payload,version,now,id,owner,version,now)]);
 if(!results[0].meta.changes) throw new Problem('Промпт изменился на другом устройстве. Обновите библиотеку.',409);
 return json(rowPrompt({...row,data:payload,version,updated_at:now}));
}); }
export async function PATCH(request:Request,ctx:Context) { return api(async()=>{
 const owner=await userId(),{id}=await ctx.params,input=await body(request);
 if(typeof input.favorite!=='boolean') throw new Problem('Некорректное значение избранного.');
 await ownedPrompt(owner,id);
 await env.DB.prepare('UPDATE prompts SET data=json_set(data,\'$.favorite\',json(?)) WHERE id=? AND owner=?').bind(input.favorite?'true':'false',id,owner).run();
 return json({ok:true});
}); }
export async function DELETE(request:Request,ctx:Context) { return api(async()=>{
 sameOrigin(request);
 const owner=await userId(),{id}=await ctx.params;
 await ownedPrompt(owner,id);
 await env.DB.batch([
 env.DB.prepare('DELETE FROM revisions WHERE prompt_id=? AND owner=?').bind(id,owner),
 env.DB.prepare('DELETE FROM prompts WHERE id=? AND owner=?').bind(id,owner)]);
 return json({ok:true});
}); }
