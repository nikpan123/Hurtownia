import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCourseFixture,compareCourses,checkDescriptionCourses} from '../api-tests/description-courses.mjs';
const fixture={itemsPath:['data','courses'],identityPath:['product','code'],titlePath:['title'],slugPath:['slug'],query:{page:2,limit:50},expected:[{id:'course-qa',title:'Główny tytuł',slug:'glowny-slug'}]};
const response={data:{courses:[{product:{code:'course-qa'},title:'Główny tytuł',slug:'glowny-slug'}]}};
test('Kursy porównują tytuł i slug po niezależnym identyfikatorze, także w zagnieżdżonej odpowiedzi',()=>{
  validateCourseFixture(fixture);assert.equal(compareCourses(response,fixture).length,1);
  assert.equal(compareCourses(response.data.courses,{...fixture,itemsPath:[]}).length,1);
  for(const field of ['title','slug']){
    const wrong=structuredClone(response);wrong.data.courses[0][field]='Tłumaczenie WHOLESALE';assert.throws(()=>compareCourses(wrong,fixture),new RegExp(field));
  }
  assert.throws(()=>compareCourses({data:{courses:[]}},fixture),/dokładnie jednego/);
  assert.throws(()=>compareCourses({data:{courses:[...response.data.courses,...response.data.courses]}},fixture),/dokładnie jednego/);
  assert.throws(()=>compareCourses({data:[]},fixture),/itemsPath/);
});
test('Niepoprawne wzorce nie stają się prawidłowym wynikiem pustej listy',()=>{
  for(const change of [{expected:[]},{identityPath:[]},{titlePath:['__proto__']},{query:null},{expected:[{id:'course-qa',title:'',slug:'x'}]},{expected:[fixture.expected[0],fixture.expected[0]]}])assert.throws(()=>validateCourseFixture({...fixture,...change}));
});
async function run(fixtures,request){
  const report={tests:[],tables:[]};
  await checkDescriptionCourses({fixtures,request,report,skip:(name,detail,scenarioIds)=>report.tests.push({name,detail,scenarioIds,status:'SKIP'}),test:async(name,fn,scenarioIds)=>{try{const detail=await fn();report.tests.push({name,detail,scenarioIds,status:'PASS'});return true;}catch(e){report.tests.push({name,detail:e.message,scenarioIds,status:'FAIL'});return false;}}});
  return report;
}
test('Oba endpointy używają kanału ACADEMY, jawnej strony i właściwych identyfikatorów scenariuszy',async()=>{
  const calls=[];const report=await run({closed:fixture,paid:fixture},async(...args)=>{calls.push(args);return response;});
  assert.deepEqual(report.tests.map(t=>[t.scenarioIds[0],t.status]),[['DESC-018','PASS'],['DESC-018','PASS'],['DESC-019','PASS'],['DESC-019','PASS']]);
  assert.deepEqual(calls.map(c=>c[1]),['academy/closed-courses','academy/paid-courses']);
  assert(calls.every(([method,,args])=>method==='GET'&&args.channel==='ACADEMY'&&args.query.page===2));
  assert.equal(report.tables[0].rows.length,2);
});
test('Brak wzorców pomija żądanie; błąd jednego endpointu nie pomija drugiego',async()=>{
  const skipped=await run({closed:{...fixture,expected:[]}},()=>assert.fail('Nie wolno wysyłać bez wzorców'));
  assert.deepEqual(skipped.tests.map(t=>t.status),['SKIP','SKIP']);assert.match(skipped.tests[0].detail,/courses.closed/);
  const failed=await run({closed:fixture,paid:fixture},async(method,endpoint)=>{if(endpoint.endsWith('closed-courses'))throw new Error('HTTP 500');return response;});
  assert.deepEqual(failed.tests.map(t=>t.status),['PASS','FAIL','PASS','PASS']);assert.match(failed.tests[1].detail,/500/);
});

test('Wiele stron porównuje kilka wzorców i wykrywa powtórzone wyniki między stronami',async()=>{
  const second={id:'course-next',title:'Drugi kurs',slug:'drugi-kurs'};
  const multi={...fixture,pages:[{query:{page:1,limit:1},expected:fixture.expected},{query:{page:2,limit:1},expected:[second]}]};
  const correct=async(method,endpoint,args)=>({data:{courses:[args.query.page===1?response.data.courses[0]:{product:{code:second.id},title:second.title,slug:second.slug}]}});
  const passed=await run({closed:multi},correct);assert.equal(passed.tests.filter(t=>t.status==='PASS').length,3);assert.equal(passed.tables[0].rows.length,2);
  const repeated=await run({closed:multi},async()=>response);assert(repeated.tests.some(t=>t.status==='FAIL'&&t.detail.includes('Powtórzony kurs')));
  const duplicate=await run({closed:{...multi,pages:[multi.pages[0],multi.pages[0]]}},()=>assert.fail('Nie wysyłaj przy błędnej konfiguracji'));
  assert.equal(duplicate.tests[0].status,'FAIL');
});
