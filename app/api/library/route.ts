import { api,json,userId,env,rowPrompt } from '../../../lib/server';
export const dynamic='force-dynamic';
export async function GET() { return api(async()=>{
 const owner=await userId();
 const [p,c]=await Promise.all([
 env.DB.prepare('SELECT * FROM prompts WHERE owner = ? ORDER BY updated_at DESC').bind(owner).all(),
 env.DB.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY created_at').bind(owner).all()]);
 return json({prompts:p.results.map(rowPrompt),collections:c.results.map((r:any)=>({id:r.id,name:r.name,color:r.color}))});
}); }
