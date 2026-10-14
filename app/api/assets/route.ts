import { api,json,userId,env,Problem,sameOrigin } from '../../../lib/server';
import { validateImage } from '../../../lib/domain.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {return api(async()=>{
 sameOrigin(request);const owner=await userId();
 if(Number(request.headers.get('content-length'))>11*1024*1024)throw new Problem('Размер изображения не должен превышать 10 МБ.',413);
 const form=await request.formData(),file=form.get('file');
 if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw new Problem('Выберите изображение до 10 МБ.');
 const bytes=await file.arrayBuffer();validateImage(bytes,file.type);
 const id=crypto.randomUUID(),key=owner+'/'+id,name=file.name.slice(0,200);
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
 try {await env.DB.prepare('INSERT INTO assets (id,owner,key,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,owner,key,name,file.type,file.size,new Date().toISOString()).run();}
 catch(e){await env.BUCKET.delete(key);throw e;}
 return json({id,name,url:'/api/assets/'+id},201);
});}
