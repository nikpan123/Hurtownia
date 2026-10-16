import { createHash } from 'node:crypto';

export function pickAvailableMethod(methods, seed, kind) {
  if (!Array.isArray(methods)||!methods.length) throw new Error('Brak dostępnych metod: '+kind);
  if (methods.some(m=>typeof m?.code!=='string'||!m.code.trim())||new Set(methods.map(m=>m.code)).size!==methods.length)
    throw new Error('Niepoprawne lub powtórzone kody metod: '+kind);
  // Oddzielne losowania dla płatności i dostawy; kolejność odpowiedzi API nie zmienia wyniku.
  const sorted=[...methods].sort((a,b)=>a.code<b.code?-1:a.code>b.code?1:0);
  const hash=createHash('sha256').update(JSON.stringify([String(seed),kind,sorted.map(m=>m.code)])).digest();
  return sorted[Math.floor(hash.readUInt32LE(0)/4294967296*sorted.length)];
}
