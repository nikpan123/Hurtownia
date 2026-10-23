import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {connectDescriptionWeb} from './description-web.mjs';
import {minorUnits} from './features.mjs';
import {saveFeatureReport} from './feature-report.mjs';

const slots = [{name:'boundary', weightGrams:1}, {name:'retest', weightGrams:140}];
const identity = p => assert(Number.isSafeInteger(p?.id) && p.id > 0 && /^qa-36618-[a-f0-9-]+-(?:1|140)g$/.test(p.code), 'Nieprawidłowa tożsamość produktu QA #36618');
const ready = (state,product) => ({...state,enabled:true,visible:true,listed:false,tracked:false,activeChannels:['WHOLESALE'],merchandiseCode:'qa36618-'+product.id,prices:{price:'21,00',originalPrice:'21,00',minimumPrice:'0,00'}});

async function persist(file, manifest) { await writeFile(file, JSON.stringify(manifest, null, 2)); }
async function readManifest(file) {
  try { const manifest = JSON.parse(await readFile(file, 'utf8')); assert.equal(manifest.version, 1); assert(Array.isArray(manifest.products)); return manifest; }
  catch (e) { if (e.code === 'ENOENT') return {version:1, products:[]}; throw e; }
}

export async function restorePackageProducts(adapter, manifest, file) {
  for (const entry of manifest.products) {
    if (!entry.original) continue;
    identity(entry.product);
    const current = await adapter.packageBookState(entry.product);
    if (isDeepStrictEqual(current, entry.original)) continue;
    assert(isDeepStrictEqual(current, entry.active), 'Produkt QA zmieniony poza testem — nie nadpisuję; zachowano dziennik');
    await adapter.savePackageBook(entry.product, current, entry.original);
    assert.deepEqual(await adapter.packageBookState(entry.product), entry.original, 'Nie potwierdzono wyłączenia produktu QA');
  }
  for (const entry of manifest.products) delete entry.active;
  await persist(file, manifest);
}

export async function withPackageProducts(config, settings, options, run) {
  assert(options.allowLocal || config.environment === 'dev' && new URL(config.baseUrl).origin === 'https://ksiegarnia.gwodev.pl', 'Przygotowanie produktów QA tylko na dev');
  const file = options.productManifestFile ?? path.resolve('.auth/package-products-36618.json');
  await mkdir(path.dirname(file), {recursive:true});
  const lock = file + '.lock';
  try { await writeFile(lock, new Date().toISOString(), {flag:'wx'}); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Przygotowanie produktów #36618 już trwa lub zostało przerwane. Użyj npm run redmine:36618:restore.'); throw e; }
  let adapter, manifest, result, cleanupError;
  const requests = [];
  const cmsStep=(title,operation)=>options.debuggerSession?options.debuggerSession.operation(title,operation):operation();
  try {
    adapter = options.productAdapter ?? await connectDescriptionWeb({...options, onRequest:r => requests.push(r), onSecret:options.onSecret ?? (() => {})});
    manifest = await readManifest(file);
    // Stary dziennik jest również rejestrem tożsamości. Nie tworzymy produktu ponownie po niepewnym POST.
    for (const entry of manifest.products.filter(p => !p.product)) {
      const found = adapter.findPackageBook ? await adapter.findPackageBook(entry.intent.code) : null;
      assert(found, 'Niepewne utworzenie produktu QA. Odczyt nie potwierdził kodu intent.code z .auth/package-products-36618.json; nie ponawiam POST.');
      identity(found);assert.equal(found.code,entry.intent.code);
      entry.product=found;await persist(file,manifest);
    }
    await restorePackageProducts(adapter, manifest, file);
    for (const slot of slots) {
      options.signal?.throwIfAborted();
      let entry = manifest.products.find(p => p.slot === slot.name);
      if (!entry) await cmsStep(`CMS: utworzenie książki QA ${slot.weightGrams} g`,async()=>{
        const code = `qa-36618-${randomUUID()}-${slot.weightGrams}g`;
        entry = {slot:slot.name, intent:{code,merchandiseCode:'qa36618-'+randomUUID().replaceAll('-','').slice(0,10),weightGrams:slot.weightGrams,createdAt:new Date().toISOString()}};
        manifest.products.push(entry);
        await persist(file, manifest);
        options.onProgress?.(`CMS: tworzę książkę QA ${slot.weightGrams} g`);
        entry.product = await adapter.createSimpleBook({code,variantCode:entry.intent.merchandiseCode,slug:code,name:`QA #36618 — ${slot.weightGrams} g`,
          channel:'WHOLESALE', price:'21,00', originalPrice:'21,00', minimumPrice:'0,00', weightGrams:slot.weightGrams});
        identity(entry.product);
        await persist(file, manifest);
      });
      identity(entry.product);
      const actual = await adapter.packageBookState(entry.product);
      assert.equal(actual.weightGrams, slot.weightGrams, 'CMS: nieprawidłowa waga QA');
      assert(actual.merchandiseCode===entry.product.code||actual.merchandiseCode==='qa36618-'+entry.product.id||actual.merchandiseCode===entry.intent.merchandiseCode,'CMS: nieoczekiwany kod handlowy QA');
      assert.equal(minorUnits(actual.prices.price),minorUnits(actual.prices.originalPrice),'CMS: cena i oryginalna cena QA muszą być równe');
      assert([100,2100].includes(minorUnits(actual.prices.price)),'CMS: nieoczekiwana cena QA; nie nadpisuję');
      assert.equal(minorUnits(actual.prices.minimumPrice), 0, 'CMS: minimum price QA');
      assert(!actual.enabled && !actual.visible && !actual.listed, 'Produkt QA nie jest wyłączony przed próbą');
      assert.deepEqual(actual.activeChannels, ['WHOLESALE']);
      entry.original = actual; entry.active = ready(actual,entry.product);
      await persist(file, manifest); // Przed aktywacją: także timeout zapisu wymaga odtworzenia stanu.
      await cmsStep(`CMS: udostępnienie książki QA ${slot.weightGrams} g`,async()=>{
        await adapter.savePackageBook(entry.product, entry.original, entry.active);
        assert.deepEqual(await adapter.packageBookState(entry.product), entry.active, 'CMS nie potwierdził aktywacji QA');
      });
    }
    const product = slot => {
      const e = manifest.products.find(p => p.slot === slot.name);
      return {productVariant:e.product.code,merchandiseCode:'qa36618-'+e.product.id,unitWeightGrams:slot.weightGrams};
    };
    const prepared = structuredClone(settings);
    prepared.packages ??= {}; prepared.packages.product = product(slots[1]);
    prepared.packages.boundaryProduct = product(slots[0]);
    prepared.retest140g = {...prepared.retest140g, product:product(slots[1])};
    result = await run(prepared);
  } finally {
    try {
      if (adapter && manifest) {
        if(options.debuggerSession&&!options.debuggerSession.closed)
          await options.debuggerSession.operation('CMS: wyłączenie produktów QA po próbie',()=>restorePackageProducts(adapter,manifest,file),{automatic:true});
        else await restorePackageProducts(adapter, manifest, file);
      }
    } catch (e) { cleanupError = e; }
    try { await adapter?.close(); } finally { await unlink(lock); }
    if (result) {
      result.report.requests.unshift(...requests);
      result.report.scopeNote+=' Automat przygotował dwie własne książki QA WHOLESALE (1 g i 140 g); po próbie wyłącza ich dostępność. Rekordy pozostają do ponownego użycia.';
      result.report.productPreparation = {products:manifest.products.filter(p => p.product).map(p => ({...p.product,merchandiseCode:'qa36618-'+p.product.id,weightGrams:p.intent.weightGrams})),restoration:cleanupError?'FAIL':'PASS'};
      result.report.tests.push({name:'Produkty QA #36618: wyłączenie po próbie', status:cleanupError ? 'FAIL' : 'PASS', detail:cleanupError?.message ?? 'Odczyt CMS potwierdził powrót do nieaktywnych i ukrytych produktów.'});
      if (cleanupError) { result.report.status = 'FAIL'; result.report.restorationFailed = true; }
      await saveFeatureReport(result.report, result.directory);
    }
    if (cleanupError && !result) throw Object.assign(new Error('Nie udało się wyłączyć QA #36618: ' + cleanupError.message + '. Użyj npm run redmine:36618:restore.'), {restorationFailed:true});
  }
  return result;
}

export async function recoverPackageProducts(options = {}) {
  const file = options.productManifestFile ?? path.resolve('.auth/package-products-36618.json');
  const adapter = options.productAdapter ?? await connectDescriptionWeb(options);
  try {
    const manifest = await readManifest(file);
    await restorePackageProducts(adapter, manifest, file);
    // Ręczne polecenie odzyskiwania uruchamiaj po zakończeniu zatrzymanego procesu.
    await unlink(file + '.lock').catch(e => { if (e.code !== 'ENOENT') throw e; });
  } finally { await adapter.close(); }
}
