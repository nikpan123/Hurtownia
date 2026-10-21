import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {GuidedApiRun,safeGuidedValue} from './gate.mjs';

export class DebugSession extends GuidedApiRun {
  constructor({id=randomUUID(),title,mode,environment}) {
    super(id);this.id=id;this.title=title;this.mode=mode;this.environment=environment;
    this.status='RUNNING';this.startedAt=new Date().toISOString();this.logs=[];this.frame=null;
  }
  public() { return {...this.snapshot(),id:this.id,title:this.title,mode:this.mode,environment:this.environment,status:this.status,startedAt:this.startedAt,endedAt:this.endedAt,report:this.report,stepsFile:this.stepsFile,logs:this.logs,hasFrame:Boolean(this.frame)}; }
  log(value){this.logs.push(String(safeGuidedValue(value)).slice(0,4000));if(this.logs.length>300)this.logs.shift();}
  async operation(title,callback,{request,automatic=false,sanitize=value=>value}={}) {
    const stepId=randomUUID();this.event({kind:'start',stepId,title,automatic});
    if(request)this.steps.at(-1).planned=safeGuidedValue(request);
    if(!automatic&&!(await this.wait(stepId)).proceed)throw new Error('Debugger zatrzymany przed wykonaniem etapu.');
    try {
      const result=await callback();
      if(request)this.event({kind:'request',stepId,request:{...request,status:result.status,response:sanitize(result.data)}});
      this.event({kind:'finish',stepId,status:'passed'});return result;
    }catch(error){if(!this.closed)this.event({kind:'finish',stepId,status:'failed',error:error.message});throw error;}
  }
}

export class DebugHub {
  constructor({project,catalog,start,stop,environment=()=>''}){Object.assign(this,{project,catalog,start,stop,environment});this.token=randomBytes(24).toString('hex');this.last=null;}
  create(meta){if(this.last?.status==='RUNNING')throw new Error('Debugger już wykonuje test.');this.last=new DebugSession(meta);return this.last;}
  async finish(id,status,{directory,report,stepsFile}={}) {
    const session=this.last;if(!session||session.id!==id)return;
    session.status=session.stopRequested?'STOPPED':status;session.endedAt=new Date().toISOString();session.close();session.report=report;
    if(directory){await mkdir(directory,{recursive:true});await writeFile(directory+'/debugger-steps.json',JSON.stringify(session.public(),null,2));session.stepsFile=stepsFile;}
  }
  async handle(req,res,url) {
    if(!url.pathname.startsWith('/api/debugger/')&&!url.pathname.startsWith('/debugger/'))return false;
    const json=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    try {
      if(req.headers.host!==url.host)throw new Error('Niepoprawny adres panelu.');
      if(req.method==='GET'){
        if(url.pathname==='/api/debugger/catalog') {json(200,{project:this.project,environment:await this.environment(),catalog:await this.catalog(),token:this.token});return true;}
        if(url.pathname==='/api/debugger/state'){json(200,{run:this.last?.public()||null});return true;}
        if(url.pathname==='/api/debugger/frame'){
          if(req.headers['sec-fetch-site']==='cross-site'||this.last?.id!==url.searchParams.get('runId')||!this.last?.frame){res.writeHead(404);res.end();return true;}
          res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(this.last.frame);return true;
        }
        const asset={'/debugger/':'index.html','/debugger/index.html':'index.html','/debugger/app.js':'app.js','/debugger/style.css':'style.css'}[url.pathname];
        if(asset){const data=await readFile(new URL('./'+asset,import.meta.url));res.writeHead(200,{'Content-Type':asset.endsWith('.html')?'text/html; charset=utf-8':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/css','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; frame-ancestors 'self'; object-src 'none'; base-uri 'none'"});res.end(data);return true;}
        json(404,{error:'Nie znaleziono.'});return true;
      }
      if(req.method!=='POST'){json(405,{error:'Niedozwolona metoda.'});return true;}
      let raw='';for await(const part of req){raw+=part;if(raw.length>1000000)throw new Error('Za duże żądanie.');}
      const body=JSON.parse(raw||'{}');
      const callback=['/api/debugger/event','/api/debugger/wait','/api/debugger/frame'].includes(url.pathname);
      const session=this.last;
      if(callback){
        if(!session||session.closed||body.runId!==session.id||req.headers['x-debugger-key']!==session.key){json(403,{error:'Nieaktywna sesja.'});return true;}
        if(url.pathname.endsWith('/frame')){
          if(typeof body.image!=='string'||body.image.length>900000||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.image))throw new Error('Niepoprawny obraz.');
          const bytes=Buffer.from(body.image,'base64');if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('Oczekiwano JPEG.');session.frame=bytes;json(200,{accepted:true});
        }else if(url.pathname.endsWith('/wait'))json(200,await session.wait(body.stepId));
        else{session.event(body);json(200,{accepted:true});}
        return true;
      }
      if(req.headers.origin!==url.origin||req.headers['x-debugger-token']!==this.token||!req.headers['content-type']?.includes('application/json')){json(403,{error:'Odśwież lokalny panel.'});return true;}
      if(url.pathname.endsWith('/start')){
        const selected=(await this.catalog()).find(item=>item.id===body.id);
        if(!selected)throw new Error('Wybierz obsługiwany test z katalogu.');
        await this.start(selected);json(202,{run:this.last?.public()});return true;
      }
      if(!session||session.closed||session.id!==body.runId){json(409,{error:'Ta sesja jest zakończona.'});return true;}
      if(url.pathname.endsWith('/next'))session.next(body.stepId);
      else if(url.pathname.endsWith('/continue'))session.setContinuous(true);
      else if(url.pathname.endsWith('/pause'))session.setContinuous(false);
      else if(url.pathname.endsWith('/stop')){session.stopRequested=true;session.close();await this.stop(session.id);}
      else{json(404,{error:'Nieznana akcja.'});return true;}
      json(200,{accepted:true});return true;
    }catch(error){json(400,{error:String(safeGuidedValue(error.message))});return true;}
  }
}
