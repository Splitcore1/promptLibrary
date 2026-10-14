import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrompt, ensureOwnership, validateImage, filterPrompts } from '../lib/domain.mjs';
const draft={title:'Каталог украшений',description:'Мягкий свет',model:'Nano Banana',prompt:'A jewellery photograph',coverId:'cover-1',referenceIds:['ref-1'],collectionIds:['col-1'],tags:['продукт'],parameters:'4:5',negative:'watermark'};
test('A saved prompt requires a generation cover, name, model and text',()=>{
 for(const key of ['title','model','prompt','coverId'])assert.throws(()=>normalizePrompt({...draft,[key]:''}));
 assert.equal(normalizePrompt({...draft,title:'  Каталог  '}).title,'Каталог');
 assert.throws(()=>normalizePrompt({...draft,prompt:'a'.repeat(30001)}));
});
test('References remain optional and are bounded to eight unique images',()=>{
 assert.deepEqual(normalizePrompt({...draft,referenceIds:undefined}).referenceIds,[]);
 assert.deepEqual(normalizePrompt({...draft,referenceIds:['a','a']}).referenceIds,['a']);
 assert.throws(()=>normalizePrompt({...draft,referenceIds:Array.from({length:9},(_,i)=>String(i))}));
});
test('Saving rejects image and collection IDs owned by another user',()=>{
 const d=normalizePrompt(draft);ensureOwnership(d,new Set(['cover-1','ref-1']),new Set(['col-1']));
 assert.throws(()=>ensureOwnership(d,new Set(['ref-1']),new Set(['col-1'])));
 assert.throws(()=>ensureOwnership(d,new Set(['cover-1','ref-1']),new Set()));
});
test('Only raster image payloads with matching signatures may be uploaded',()=>{
 validateImage(new Uint8Array([137,80,78,71,13,10,26,10]).buffer,'image/png');
 validateImage(new Uint8Array([255,216,255,0]).buffer,'image/jpeg');
 assert.throws(()=>validateImage(new TextEncoder().encode('<script>alert(1)</script>').buffer,'image/png'));
 assert.throws(()=>validateImage(new TextEncoder().encode('<svg/>').buffer,'image/svg+xml'));
});
test('Search covers Russian text, parameters, model and tags; filters combine',()=>{
 const all=[{...draft,id:'1',createdAt:'2026-01-01',updatedAt:'2026-01-02',favorite:true},{...draft,id:'2',title:'Портрет',model:'Midjourney',collectionIds:[],tags:['студия'],createdAt:'2026-01-03',updatedAt:'2026-01-03',favorite:false}];
 assert.deepEqual(filterPrompts(all,{search:'  КАТАЛОГ  ',model:'Nano Banana',collection:'col-1',favorite:true}).map(p=>p.id),['1']);
 assert.equal(filterPrompts(all,{search:'4:5'}).length,2);
 assert.equal(filterPrompts(all,{search:'студия'})[0].id,'2');
 assert.equal(filterPrompts(all,{model:'FLUX'}).length,0);
 assert.deepEqual(filterPrompts(all,{}).map(p=>p.id),['2','1']);
 assert.deepEqual(filterPrompts(all,{sort:'oldest'}).map(p=>p.id),['1','2']);
 assert.deepEqual(all.map(p=>p.id),['1','2']);
});
