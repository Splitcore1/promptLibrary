import { api,json,userId,env,ownedPrompt } from '../../../../../lib/server';
export const dynamic='force-dynamic';
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {return api(async()=>{
 const owner=await userId(),{id}=await ctx.params;await ownedPrompt(owner,id);
 const r=await env.DB.prepare('SELECT data,version,created_at FROM revisions WHERE prompt_id=? AND owner=? ORDER BY version DESC').bind(id,owner).all();
 return json(r.results.map((r:any)=>({data:JSON.parse(r.data),version:r.version,createdAt:r.created_at})));
});}
