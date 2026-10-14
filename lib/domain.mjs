export const MODELS = ['Nano Banana', 'ChatGPT', 'Midjourney', 'Stable Diffusion', 'FLUX', 'Другая модель'];
export const COLORS = ['#8871e5','#efa85e','#6aaca3','#dd879c','#76a0db','#a39281'];
export class Problem extends Error {
 constructor(message, status = 400) { super(message); this.status = status; }
}
function str(value, max, name, required = false) {
 if (typeof value !== 'string') { if (required) throw new Problem('Заполните поле «' + name + '».'); return ''; }
 const result = value.trim();
 if ((required && !result) || result.length > max) throw new Problem('Проверьте поле «' + name + '» (до ' + max + ' символов).');
 return result;
}
function ids(value, max) {
 if (!Array.isArray(value)) return [];
 if (value.length > max || value.some(v => typeof v !== 'string' || v.length > 100)) throw new Problem('Слишком много вложений или коллекций.');
 return [...new Set(value)];
}
export function normalizePrompt(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Problem('Некорректный промпт.');
 const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(t => str(t, 40, 'Тег', true)))].slice(0, 20) : [];
 const coverId = str(input.coverId, 100, 'Обложка', true);
 return {
 title:str(input.title, 120, 'Название', true), description:str(input.description, 2000, 'Описание'),
 model:str(input.model, 80, 'Нейросеть', true), prompt:str(input.prompt, 30000, 'Промпт', true),
 parameters:str(input.parameters, 5000, 'Параметры'), negative:str(input.negative, 5000, 'Негативный промпт'),
 coverId, referenceIds:ids(input.referenceIds, 8), collectionIds:ids(input.collectionIds, 20),
 tags, favorite:input.favorite === true,
 };
}
export function ensureOwnership(data, assetIds, collectionIds) {
 if (![data.coverId, ...data.referenceIds].every(id => assetIds.has(id))) throw new Problem('Обложка или референс недоступны. Загрузите изображение повторно.');
 if (!data.collectionIds.every(id => collectionIds.has(id))) throw new Problem('Одна из коллекций больше не существует.');
}
export function filterPrompts(prompts, {search='', model='', collection='', favorite=false, sort='newest'}) {
 const q = search.trim().toLocaleLowerCase('ru');
 const result = prompts.filter(p => (!model || p.model === model) && (!collection || p.collectionIds.includes(collection)) && (!favorite || p.favorite) &&
 (!q || [p.title,p.description,p.prompt,p.negative,p.parameters,p.model,...p.tags].join(' ').toLocaleLowerCase('ru').includes(q)));
 return result.sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title,'ru') : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
}
export function validateImage(bytes, mime) {
 const b = new Uint8Array(bytes);
 const matches = mime === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v) :
 mime === 'image/jpeg' ? b[0]===255 && b[1]===216 && b[2]===255 :
 mime === 'image/webp' ? String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP' :
 mime === 'image/gif' ? ['GIF87a','GIF89a'].includes(String.fromCharCode(...b.slice(0,6))) :
 mime === 'image/avif' ? String.fromCharCode(...b.slice(4,8))==='ftyp' && ['avif','avis'].includes(String.fromCharCode(...b.slice(8,12))) : false;
 if (!matches) throw new Problem('Поддерживаются изображения JPG, PNG, WebP, GIF и AVIF.');
}
