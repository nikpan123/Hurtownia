import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv, loadConfig, validateConfig } from './config.mjs';

await loadEnv();
const args=process.argv.slice(2);
const config = await loadConfig(args.includes('--config')?args[args.indexOf('--config')+1]:'config/dev.local.json');
validateConfig(config, {plan:true});
const isTest=config.environment==='test'||new URL(config.baseUrl).hostname.endsWith('.gwotest.pl');
if (isTest && (!args.includes('--allow-test') || config.enabled!==true)) throw new Error('Logowanie test jest wyłączone. Wymaga enabled=true i --allow-test po wdrożeniu zmian.');
const { chromium } = await import('playwright');
// Na tym komputerze dostępny jest Microsoft Edge — bez dodatkowego pobierania Chromium.
const browser = await chromium.launch({headless:false,channel:process.env.BROWSER_CHANNEL || 'msedge'});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(new URL('/',config.baseUrl).href);
  if (new URL(page.url()).hostname === 'gitlab.gwo.pl') {
    if (process.env.GITLAB_USERNAME && process.env.GITLAB_PASSWORD) {
      // Pola potwierdzone na formularzu gitlab.gwo.pl/users/sign_in.
      await page.locator('#user_login').fill(process.env.GITLAB_USERNAME);
      await page.locator('#user_password').fill(process.env.GITLAB_PASSWORD);
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
    }
    console.log('Dokończ logowanie GitLab w otwartym oknie, w tym 2FA i zgodę aplikacji, jeśli wystąpią.');
    await page.waitForURL(u=>u.hostname === new URL(config.baseUrl).hostname, {timeout:180000});
  }
  // Sprawdź też właściwą ścieżkę API; bramka może dotyczyć innego hosta niż strona.
  await page.goto(config.baseUrl+'/shop/products-dto');
  if (new URL(page.url()).hostname !== new URL(config.baseUrl).hostname) throw new Error('Brak powrotu z bramki do hosta API.');
  const probe = await context.request.get(config.baseUrl+'/shop/products-dto', {maxRedirects:0});
  if (probe.status() >= 300 && probe.status() < 400 || (probe.headers()['content-type']??'').includes('text/html'))
    throw new Error('Bramka API nadal zwraca przekierowanie lub HTML. Sesja nie została zapisana.');
  const sessionFile=config.sessionFile ?? (isTest?'.auth/test.json':'.auth/dev.json');
  await mkdir(path.dirname(sessionFile),{recursive:true});
  await context.storageState({path:sessionFile});
  console.log('Sesja GitLab zapisana lokalnie w '+sessionFile+'. Nie udostępniaj tego pliku.');
} finally { await browser.close(); }
