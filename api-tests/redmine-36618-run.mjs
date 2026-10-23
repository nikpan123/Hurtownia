import {loadEnv, loadConfig, credentialsFor} from './config.mjs';
import {databaseVerifier} from './database.mjs';
import {packageCases} from './redmine-36618.mjs';
import {runConfiguredPackageRegression,restorePackageEnvironment} from './package-suite.mjs';
import {recoverPackageProducts} from './package-products.mjs';

try {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--complete', '--plan', '--restore', '--manual-products'].includes(arg))) throw new Error('Opcje: --plan, --complete, --restore, --manual-products');
  if (args.includes('--plan')) {
    for (const sample of packageCases) console.log(`${sample.id}: ${sample.name}`);
  } else {
    await loadEnv();
    const config = await loadConfig('config/dev.local.json');
    if(args.includes('--restore')){const recovery={vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json'};await restorePackageEnvironment(recovery);await recoverPackageProducts(recovery);console.log('Przywrócono odbiór własny i dostępność książek QA #36618.');process.exit(0);}
    const result = await runConfiguredPackageRegression(config, await credentialsFor(config), {
      vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',autoProducts:args.includes('--manual-products')?false:undefined,complete:args.includes('--complete'), onProgress:console.log,
      verifyDatabase:process.env.HURT_VERIFY_DATABASE === 'true'
        ? databaseVerifier({vars:process.env, sessionFile:config.sessionFile ?? '.auth/dev.json'}) : undefined
    });
    console.log(`${result.report.status} — ${result.directory}`);
    process.exitCode = ['PASS','NOT_APPLICABLE'].includes(result.report.status) ? 0 : 1;
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
