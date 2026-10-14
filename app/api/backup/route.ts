import { api,json,userId,env,body,normalizePrompt,ensureOwnership,Problem } from '../../../lib/server';
import { COLORS } from '../../../lib/domain.mjs';
export const dynamic='force-dynamic';
export async function GET(){return api(async()=>{
 const owner=await userId();
 const [p,c,r]=await Promise.all([
 env.DB.prepare('SELECT * FROM prompts WHERE owner=? ORDER BY created_at').bind(owner).all(),
 env.DB.prepare('SELECT id,name,color FROM collections WHERE owner=?').bind(owner).all(),
 env.DB.prepare('SELECT prompt_id,data,version,created_at FROM revisions WHERE owner=? ORDER BY version').bind(owner).all()]);
 return json({format:'promptfolio',formatVersion:1,exportedAt:new Date().toISOString(),collections:c.results,
 prompts:p.results.map((p:any)=>({id:p.id,data:JSON.parse(p.data),createdAt:p.created_at,history:r.results.filter((r:any)=>r.prompt_id===p.id).map((r:any)=>({data:JSON.parse(r.data),version:r.version,createdAt:r.created_at}))}))});
});}
export async function POST(request:Request){return api(async()=>{
 const owner=await userId(),input=await body(request);
 if(input.format!=='promptfolio'||input.formatVersion!==1||!Array.isArray(input.prompts)||input.prompts.length>100||!Array.isArray(input.collections)||input.collections.length>100)throw new Problem('Поддерживается резервная копия Promptfolio, до 100 промптов за один импорт.');
 const [assets,existing]=await Promise.all([
 env.DB.prepare('SELECT id FROM assets WHERE owner=?').bind(owner).all(),
 env.DB.prepare('SELECT id,name FROM collections WHERE owner=?').bind(owner).all()]);
 const ownedAssets=new Set(assets.results.map((r:any)=>r.id)),collectionMap=new Map<string,string>(),queries:D1PreparedStatement[]=[],now=new Date().toISOString();
 for(const c of input.collections){
 if(typeof c.id!=='string'||typeof c.name!=='string'||!c.name.trim()||c.name.length>80)throw new Problem('Некорректная коллекция в файле.');
 const match=existing.results.find((e:any)=>e.name.toLocaleLowerCase('ru')===c.name.trim().toLocaleLowerCase('ru')) as any;
 const id=match?.id||crypto.randomUUID();collectionMap.set(c.id,id);
 if(!match){queries.push(env.DB.prepare('INSERT INTO collections (id,owner,name,color,created_at) VALUES (?,?,?,?,?)').bind(id,owner,c.name.trim(),COLORS.includes(c.color)?c.color:COLORS[0],now));existing.results.push({id,name:c.name.trim()});}
 }
 const validCollections=new Set([...existing.results.map((c:any)=>c.id)]);
 const prepare=(value:any)=>{const d=normalizePrompt(value);d.collectionIds=d.collectionIds.map((id:string)=>collectionMap.get(id)||id).filter((id:string)=>validCollections.has(id));ensureOwnership(d,ownedAssets,validCollections);return d;};
 for(const p of input.prompts){
 const data=prepare(p.data),id=crypto.randomUUID(),history=Array.isArray(p.history)?p.history:[];
 if(history.length>100)throw new Problem('В одном промпте допускается до 100 версий при импорте.');
 const snapshots=history.map((r:any)=>({data:prepare(r.data),date:typeof r.createdAt==='string'&&!Number.isNaN(Date.parse(r.createdAt))?r.createdAt:now}));
 const comparable=(d:any)=>JSON.stringify({...d,favorite:false});
 if(!snapshots.length||comparable(snapshots.at(-1)?.data)!==comparable(data))snapshots.push({data,date:now});
 const created=typeof p.createdAt==='string'&&!Number.isNaN(Date.parse(p.createdAt))?p.createdAt:now;
 queries.push(env.DB.prepare('INSERT INTO prompts (id,owner,data,version,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id,owner,JSON.stringify(data),snapshots.length,created,now));
 snapshots.forEach((r:any,i:number)=>queries.push(env.DB.prepare('INSERT INTO revisions (id,prompt_id,owner,data,version,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,owner,JSON.stringify(r.data),i+1,r.date)));
 }
 if(queries.length>500)throw new Problem('Слишком много версий для одного импорта. Разделите файл на несколько частей.');
 if(queries.length)await env.DB.batch(queries);
 return json({imported:input.prompts.length});
});}
