import { api,json,userId,env,body,normalizePrompt,validateRelations,rowPrompt } from '../../../lib/server';
export const dynamic='force-dynamic';
export async function POST(request:Request) { return api(async()=>{
 const owner=await userId(), data=normalizePrompt(await body(request));
 await validateRelations(owner,data);
 const id=crypto.randomUUID(),now=new Date().toISOString(),payload=JSON.stringify(data);
 await env.DB.batch([
 env.DB.prepare('INSERT INTO prompts (id,owner,data,version,created_at,updated_at) VALUES (?,?,?,1,?,?)').bind(id,owner,payload,now,now),
 env.DB.prepare('INSERT INTO revisions (id,prompt_id,owner,data,version,created_at) VALUES (?,?,?,?,1,?)').bind(crypto.randomUUID(),id,owner,payload,now)]);
 return json(rowPrompt({id,data:payload,version:1,created_at:now,updated_at:now}),201);
}); }
