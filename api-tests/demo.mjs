import { readFile } from 'node:fs/promises';
import { startMock } from '../tests/mock-server.mjs';
import { runScenario } from './engine.mjs';
const mock=await startMock({quoteNet:true});
try {
  const config=JSON.parse(await readFile('config/dev.example.json','utf8'));
  config.baseUrl=mock.baseUrl;config.environment='DEMO — dane symulowane';
  config.scenario.randomProducts.enabled=false;
  config.scenario.randomCheckout={payment:false,shipping:false};
  config.scenario.shippingMethodCode='inpost_kurier';
  config.scenario.name='DEMO — lokalna symulacja, bez połączeń z GWO';
  const {report,directory}=await runScenario(config,{email:'demo@example.invalid',password:'demo-password',testsToken:'demo-tests-token'},{complete:false,allowLocal:true,directory:'raporty-api/przyklad'});
  console.log(report.status+' — '+directory+'/raport.html');
  process.exitCode=report.status==='PASS'?0:1;
} finally {await mock.close();}
