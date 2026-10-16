import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPaymentComparison,renderDiagnosticSummary} from '../api-tests/diagnostic-summary.mjs';

test('Raport pokazuje 10 gr różnicy netto D090 mimo zgodnego brutto, także dla starego przebiegu',()=>{
  const html=renderPaymentComparison({paymentQuoteTotalBasis:'net',selectedPayment:'bank_transfer_1_day',payments:[{code:'bank_transfer_1_day',orderItemTotal:204764}],snapshots:[{stage:'Po wyborze płatności',order:{items:[{code:'D090',quantity:10,rebatePercent:0,unitPrice:21300,discountedUnitPrice:21300,unitPriceNet:20286,discountedUnitPriceNet:20285,totalNetSalesAfterDiscount:202850},{code:'D087',quantity:2,rebatePercent:0,unitPrice:1000,discountedUnitPrice:1000,unitPriceNet:952,discountedUnitPriceNet:952,totalNetSalesAfterDiscount:1904}]}}]});
  const plain=html.replace(/\u00a0/g,' ');
  for(const text of ['2047,64 zł','2047,54 zł','-0,10 zł','202,86 zł','202,85 zł','× 10 szt.','Różnica brutto pozycji','unitPriceNet × quantity'])assert(plain.includes(text),text);
  assert(!html.includes('ZAPIS ZABLOKOWANY'));
});
test('Nie wylicza pozornego netto z brakujących pól i nie wykonuje HTML z API',()=>{
  assert.equal(renderPaymentComparison({paymentQuoteTotalBasis:'net',payments:[]}), '');
  const html=renderDiagnosticSummary({finalization:'zablokowana — błędne ceny',checks:[{name:'<script>bad</script>',status:'FAIL',type:'financial',stage:'Płatność',detail:'<img src=x>',comparison:{field:'total',expected:100,actual:90,unit:'minor'}}]});
  assert(html.includes('ZAPIS ZABLOKOWANY'));assert(html.includes('1,00 zł'));assert(html.includes('0,90 zł'));assert(!html.includes('<script>'));assert(!html.includes('<img src=x>'));
});
