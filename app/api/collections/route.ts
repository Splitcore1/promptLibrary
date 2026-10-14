import { api,json,userId,env,body,Problem } from '../../../lib/server';
import { COLORS } from '../../../lib/domain.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {return api(async()=>{
 const owner=await userId(),input=await body(request);
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name||name.length>80)throw new Problem('Название коллекции: от 1 до 80 символов.');
 const existing=await env.DB.prepare('SELECT name FROM collections WHERE owner=?').bind(owner).all();
 if(existing.results.some((c:any)=>c.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw new Problem('Коллекция с таким названием уже есть.');
 const id=crypto.randomUUID(),color=COLORS.includes(input.color)?input.color:COLORS[0];
 await env.DB.prepare('INSERT INTO collections (id,owner,name,color,created_at) VALUES (?,?,?,?,?)').bind(id,owner,name,color,new Date().toISOString()).run();
 return json({id,name,color},201);
});}
