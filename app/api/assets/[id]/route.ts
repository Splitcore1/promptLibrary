import { api,json,userId,env,Problem } from '../../../../lib/server';
export const dynamic='force-dynamic';
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {return api(async()=>{
 const owner=await userId(),{id}=await ctx.params;
 const asset=await env.DB.prepare('SELECT * FROM assets WHERE id=? AND owner=?').bind(id,owner).first<any>();
 if(!asset)throw new Problem('Изображение не найдено.',404);
 const object=await env.BUCKET.get(asset.key);
 if(!object)throw new Problem('Изображение не найдено.',404);
 return new Response(object.body,{headers:{'Content-Type':asset.mime,'Cache-Control':'private,max-age=3600','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
});}
