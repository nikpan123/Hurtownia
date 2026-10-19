import assert from 'node:assert/strict';

export const courseScenarios=[
  {key:'closed',id:'DESC-018',endpoint:'academy/closed-courses'},
  {key:'paid',id:'DESC-019',endpoint:'academy/paid-courses'}
];
const at=(object,path)=>path.reduce((value,key)=>value!=null&&Object.hasOwn(value,key)?value[key]:undefined,object);
export function validateCourseFixture(fixture){
  assert(fixture&&typeof fixture==='object','Brak konfiguracji kursów');
  for(const field of ['itemsPath','identityPath','titlePath','slugPath']){
    assert(Array.isArray(fixture[field])&&fixture[field].every(k=>typeof k==='string'&&k.length>0&&!['__proto__','prototype','constructor'].includes(k)),field+': podaj ścieżkę jako tablicę kluczy JSON');
    if(field!=='itemsPath')assert(fixture[field].length>0,field+': ścieżka nie może być pusta');
  }
  assert(fixture.query&&typeof fixture.query==='object'&&!Array.isArray(fixture.query),'query: podaj parametry listy, ewentualnie {}');
  for(const [key,value]of Object.entries(fixture.query))assert(key.length>0&&['string','number','boolean'].includes(typeof value)&&String(value).length<=255,'Niepoprawny parametr query');
  assert(Array.isArray(fixture.expected)&&fixture.expected.length>0,'Brak niezależnych wzorców kursów');
  const ids=new Set();
  for(const course of fixture.expected){
    assert((typeof course.id==='string'&&course.id.length>0)||(typeof course.id==='number'&&Number.isSafeInteger(course.id)),'Wzorzec kursu wymaga id');
    assert(!ids.has(String(course.id)),'Powtórzone id kursu');ids.add(String(course.id));
    for(const key of ['title','slug'])assert(typeof course[key]==='string'&&course[key].trim().length>0,'Brak głównego tłumaczenia kursu: '+key);
  }
}
export function coursePages(fixture){
  const pages=fixture.pages??[{query:fixture.query,expected:fixture.expected}];
  assert(Array.isArray(pages)&&pages.length>0&&pages.length<=20,'pages: podaj od 1 do 20 stron');
  const queries=new Set(),ids=new Set();
  return pages.map(page=>{
    const merged={...fixture,...page};validateCourseFixture(merged);
    const query=JSON.stringify(Object.entries(merged.query).sort(([a],[b])=>a.localeCompare(b)));
    assert(!queries.has(query),'Powtórzona strona kursów');queries.add(query);
    for(const c of merged.expected){assert(!ids.has(String(c.id)),'Powtórzony wzorzec kursu między stronami');ids.add(String(c.id));}
    return merged;
  });
}
export function compareCourses(response,fixture){
  const items=at(response,fixture.itemsPath);
  assert(Array.isArray(items),'Odpowiedź nie zawiera tablicy pod skonfigurowaną itemsPath');
  return fixture.expected.map(expected=>{
    const matches=items.filter(item=>String(at(item,fixture.identityPath))===String(expected.id));
    assert.equal(matches.length,1,'Kurs '+expected.id+': oczekiwano dokładnie jednego rekordu na wskazanej stronie');
    const actual=matches[0],title=at(actual,fixture.titlePath),slug=at(actual,fixture.slugPath);
    assert.equal(title,expected.title,'Kurs '+expected.id+': title musi pochodzić z głównego tłumaczenia');
    assert.equal(slug,expected.slug,'Kurs '+expected.id+': slug musi pochodzić z głównego tłumaczenia');
    return [String(expected.id),expected.title,title,expected.slug,slug];
  });
}

export async function checkDescriptionCourses({fixtures={},test,skip,request,report}){
  const rows=[];report.tables.push({title:'Kursy ACADEMY — porównanie z niezależnymi wzorcami',headers:['Scenariusz','Kurs','Tytuł oczekiwany','Tytuł API','Slug oczekiwany','Slug API'],rows});
  for(const {key,id,endpoint}of courseScenarios){
    const fixture=fixtures[key];
    if(!fixture||!fixture.pages&&Array.isArray(fixture.expected)&&fixture.expected.length===0){
      skip(id+': '+endpoint,'Uzupełnij courses.'+key+' w config/catalog-fixtures.local.json: kurs dostępny dla konta, główny title/slug z CMS oraz ścieżki pól odpowiedzi. Nie wykonano żądania.',[id],'data_missing');continue;
    }
    let pages;const valid=await test(id+': konfiguracja stron i wzorców',()=>{pages=coursePages(fixture);return 'Potwierdzono '+pages.length+' różnych stron z niezależnymi wzorcami.';},[id]);
    if(valid===false)continue;
    const seen=new Set();
    for(const [index,page]of pages.entries())await test(id+': '+endpoint+' — główny tytuł i slug, strona '+(index+1),async()=>{
      const response=await request('GET',endpoint,{channel:'ACADEMY',query:page.query});
      const items=at(response,page.itemsPath);assert(Array.isArray(items),'Niepoprawna tablica kursów');
      const local=new Set();for(const item of items){const identity=at(item,page.identityPath);assert(identity!==undefined&&identity!==null,'Brak identyfikatora kursu w odpowiedzi');const value=String(identity);assert(!local.has(value)&&!seen.has(value),'Powtórzony kurs w wynikach stron: '+value);local.add(value);}
      rows.push(...compareCourses(response,page).map(row=>[id,...row]));for(const value of local)seen.add(value);
      return 'Porównano '+page.expected.length+' kursów; parametry '+JSON.stringify(page.query)+'. Bez kontroli nieskonfigurowanych stron i innych kont.';
    },[id]);
  }
}
