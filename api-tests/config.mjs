import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function redactText(input,secrets) {
  let value=String(input);
  for(const secret of secrets.filter(v=>typeof v==='string'&&v.length).sort((a,b)=>b.length-a.length)) {
    if(secret.length>=4)value=value.split(secret).join('[ukryto]');
    else {
      const escaped=secret.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      value=value.replace(new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','gu'),'[ukryto]');
    }
  }
  return value;
}

export async function loadEnv(file = '.env') {
  try { process.loadEnvFile(file); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
export async function loadConfig(file) {
  const config = JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  if (config.environment === 'dev' && process.env.HURT_DEV_BASE_URL) config.baseUrl = process.env.HURT_DEV_BASE_URL;
  config.baseUrl = config.baseUrl.replace(/\/$/,'');
  return config;
}
export function validateEnvironment(config, {plan=false, allowLocal=false, allowTest=false} = {}) {
  const base = new URL(config.baseUrl);
  if (!(allowLocal && base.hostname === '127.0.0.1') &&
      !(base.protocol === 'https:' && ['ksiegarnia.gwodev.pl','hurt.gwotest.pl','ksiegarnia.gwotest.pl'].includes(base.hostname)))
    throw new Error('Niedozwolony adres środowiska. Użyj hosta dev/test GWO.');
  if (base.username || base.password || base.search || base.hash) throw new Error('baseUrl nie może zawierać danych logowania ani parametrów.');
  if (!plan && !allowTest && (config.environment === 'test' || base.hostname.endsWith('.gwotest.pl')))
    throw new Error('Uruchamianie na gwotest jest zablokowane do czasu wdrożenia zmian i osobnej zgody.');
  if (!plan && config.enabled !== true) throw new Error('Środowisko jest wyłączone.');
}
export function validateConfig(config, options = {}) {
  validateEnvironment(config,options);
  const {plan=false}=options;
  if (plan) return;
  const s = config.scenario;
  if (!s?.products?.length) throw new Error('Uzupełnij produkty scenariusza.');
  for (const p of s.products) {
    if (!!p.productVariant === !!p.isbn || !Number.isSafeInteger(p.quantity) || p.quantity < 1 ||
        (p.newQuantity !== undefined && (!Number.isSafeInteger(p.newQuantity) || p.newQuantity < 1)))
      throw new Error('Produkt musi mieć kod lub ISBN oraz dodatnią całkowitą ilość.');
  }
  for (const [key,kind] of [['paymentMethodCode','payment'],['shippingMethodCode','shipping']]) {
    const random=s.randomCheckout?.[kind];
    if (random!==undefined&&typeof random!=='boolean') throw new Error('randomCheckout.'+kind+' musi być true albo false.');
    if (!random && (typeof s[key]!=='string'||!s[key].trim()||s[key].includes('UZUPELNIJ'))) throw new Error(`Uzupełnij ${key} albo włącz randomCheckout.${kind}.`);
  }
  if (!s.shippingAddress || !s.billingAddress) throw new Error('Uzupełnij adresy testowe.');
  const t = s.expectations?.lineRoundingToleranceMinor;
  for (const [group,percent] of Object.entries(s.expectations?.groupRebatePercent??{}))
    if (typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100) throw new Error('Niepoprawny oczekiwany rabat grupy '+group);
  if (t != null && (!Number.isSafeInteger(t) || t < 0)) throw new Error('Tolerancja zaokrągleń musi być nieujemną liczbą groszy.');
  if (config.pdfAttempts != null && (!Number.isInteger(config.pdfAttempts) || config.pdfAttempts < 1 || config.pdfAttempts > 10)) throw new Error('pdfAttempts: zakres 1–10.');
}
export async function credentialsFor(config,{requireShop=true}={}) {
  const refs = config.credentials ?? {};
  const result = {};
  for (const [key, envKey] of [['email','emailEnv'],['password','passwordEnv'],['testsToken','testsTokenEnv']]) {
    result[key] = process.env[refs[envKey]];
    if (!result[key]&&(requireShop||key==='testsToken')) throw new Error(`Uzupełnij ${refs[envKey] ?? envKey} w .env.`);
  }
  result.cookie = process.env[refs.cookieEnv] || '';
  if (!result.cookie) {
    try { result.cookies = JSON.parse(await readFile(path.resolve(config.sessionFile ?? (config.environment==='test'?'.auth/test.json':'.auth/dev.json')),'utf8')).cookies; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return result;
}

export function cookieHeader(cookies, target) {
  const url = new URL(target);
  return (cookies ?? []).filter(c => {
    const domain = c.domain.replace(/^\./,'');
    const domainMatches = c.domain.startsWith('.') ? url.hostname === domain || url.hostname.endsWith('.'+domain) : url.hostname === domain;
    const p = c.path || '/';
    return domainMatches && (url.pathname === p || url.pathname.startsWith(p.endsWith('/') ? p : p+'/')) &&
      (!c.secure || url.protocol === 'https:') && (!c.expires || c.expires < 0 || c.expires > Date.now()/1000);
  }).map(c=>`${c.name}=${c.value}`).join('; ');
}
