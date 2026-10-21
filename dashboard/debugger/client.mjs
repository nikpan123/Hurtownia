import {randomUUID} from 'node:crypto';
export async function debuggerStep(title,operation){
  if(process.env.QA_DEBUGGER!=='1')return operation();
  const url=new URL(process.env.QA_DEBUG_URL);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('Debugger wymaga lokalnego panelu.');
  const send=async(path,data)=>{const response=await fetch(new URL('/api/debugger/'+path,url),{method:'POST',headers:{'Content-Type':'application/json','x-debugger-key':process.env.QA_DEBUG_KEY},body:JSON.stringify({...data,runId:process.env.QA_DEBUG_RUN}),...(path==='wait'?{}:{signal:AbortSignal.timeout(10000)})});if(!response.ok)throw new Error('Debugger odrzucił polecenie.');return response.json();};
  const stepId=randomUUID();await send('event',{kind:'start',stepId,title});
  if(!(await send('wait',{stepId})).proceed)throw new Error('Debugger zatrzymany.');
  try{const value=await operation();await send('event',{kind:'finish',stepId,status:'passed'});return value;}
  catch(error){await send('event',{kind:'finish',stepId,status:'failed',error:error.message}).catch(()=>{});throw error;}
}
