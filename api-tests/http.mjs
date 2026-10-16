import { cookieHeader, validateEnvironment } from './config.mjs';

export class ApiClient {
  constructor(config,credentials,{allowLocal=false,allowTest=false,fetchImpl=fetch,signal}={}) {
    validateEnvironment(config,{allowLocal,allowTest});
    this.config=config;this.credentials=credentials;this.fetch=fetchImpl;this.tokens={};this.requests=[];this.signal=signal;
    this.secrets=[credentials.email,credentials.password,credentials.testsToken,credentials.cookie,...(credentials.cookies??[]).map(c=>c.value)].filter(Boolean);
  }
  clean(value) {
    if (typeof value==='string') {
      for(const secret of [...this.secrets,...Object.values(this.tokens)].filter(Boolean).sort((a,b)=>b.length-a.length)) value=value.split(secret).join('[ukryto]');
      return value;
    }
    if (Array.isArray(value))return value.map(v=>this.clean(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,this.clean(v)]));
    return value;
  }
  async request(method,endpoint,{body,channel='WHOLESALE',token='shop',query={},headers:extra={}}={}) {
    this.signal?.throwIfAborted();
    const url=new URL(this.config.baseUrl.replace(/\/$/,'')+'/'+endpoint.replace(/^\//,''));
    for(const [key,value]of Object.entries(query))for(const v of Array.isArray(value)?value:[value])url.searchParams.append(key,String(v));
    const headers={Accept:'application/json', 'X-Tests-Token':this.credentials.testsToken,...extra};
    if(channel!==null)headers['X-Api-Channel']=channel;
    if(this.tokens[token])headers.Authorization='Bearer '+this.tokens[token];
    const cookie=this.credentials.cookie||cookieHeader(this.credentials.cookies,url);
    if(cookie)headers.Cookie=cookie;
    if(body!==undefined)headers['Content-Type']=method==='PATCH'?'application/merge-patch+json':'application/json';
    const start=performance.now();
    let response;
    try {response=await this.fetch(url,{method,headers,redirect:'manual',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(this.config.timeoutMs??30000),...(this.signal?[this.signal]:[])])});}
    catch {this.requests.push({method,endpoint:url.pathname,status:'NETWORK_ERROR'});throw new Error('Błąd połączenia lub timeout '+url.pathname);}
    const meta={method,endpoint:url.pathname+url.search,status:response.status,durationMs:Math.round(performance.now()-start)};
    this.requests.push(meta);
    const contentType=response.headers.get('content-type')??'';
    if(response.status>=300&&response.status<400)throw new Error('Przekierowanie do logowania: odśwież sesję GitLab.');
    if(contentType.toLowerCase().includes('text/html'))throw new Error('API zwróciło HTML zamiast JSON — sprawdź sesję GitLab.');
    const raw=await response.text();let data=null;
    try {data=raw.trim()?JSON.parse(raw):null;}catch {throw new Error('Niepoprawna odpowiedź JSON: '+url.pathname);}
    return {status:response.status,data,contentType,meta};
  }
  async loginShop() {
    const r=await this.request('POST','shop/authentication-token',{token:null,body:{email:this.credentials.email,apiPassword:this.credentials.password}});
    const b=r.data;
    const token=typeof b==='string'?b:b?.token??b?.accessToken??b?.bearerToken??b?.jwt??b?.data?.token;
    if(r.status!==200||!token)throw new Error('Logowanie hurtownika: HTTP '+r.status);
    this.tokens.shop=token;
  }
  async loginAdmin(email,password) {
    this.secrets.push(email,password);
    const r=await this.request('POST','admin/authentication-token',{token:null,body:{email,password}});
    if(r.status!==200||typeof r.data?.token!=='string')throw new Error('Logowanie administratora API: HTTP '+r.status);
    this.tokens.admin=r.data.token;
  }
}
