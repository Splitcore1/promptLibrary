import { api,json,userId,env,body,Problem,sameOrigin } from '../../../../lib/server';
import { COLORS } from '../../../../lib/domain.mjs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function PUT(request:Request,ctx:Context) {return api(async()=>{
 const owner=await userId(),{id}=await ctx.params,input=await body(request);
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name||name.length>80)throw new Problem('Название коллекции: от 1 до 80 символов.');
 const all=await env.DB.prepare('SELECT id,name FROM collections WHERE owner=?').bind(owner).all();
 if(!all.results.some((c:any)=>c.id===id))throw new Problem('Коллекция не найдена.',404);
 if(all.results.some((c:any)=>c.id!==id && c.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw new Problem('Коллекция с таким названием уже есть.');
 await env.DB.prepare('UPDATE collections SET name=?,color=? WHERE id=? AND owner=?').bind(name,COLORS.includes(input.color)?input.color:COLORS[0],id,owner).run();
 return json({ok:true});
});}
export async function DELETE(request:Request,ctx:Context) {return api(async()=>{
 sameOrigin(request);const owner=await userId(),{id}=await ctx.params;
 const c=await env.DB.prepare('SELECT id FROM collections WHERE id=? AND owner=?').bind(id,owner).first();
 if(!c)throw new Problem('Коллекция не найдена.',404);
 await env.DB.batch([
 env.DB.prepare('UPDATE prompts SET data=json_set(data,\'$.collectionIds\',json((SELECT json_group_array(value) FROM json_each(prompts.data,\'$.collectionIds\') WHERE value<>?))) WHERE owner=?').bind(id,owner),
 env.DB.prepare('DELETE FROM collections WHERE id=? AND owner=?').bind(id,owner)]);
 return json({ok:true});
});}
