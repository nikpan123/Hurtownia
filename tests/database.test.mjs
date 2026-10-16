import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareDatabase,databaseQueries,decimalMilli,decodeDatabaseNames} from '../api-tests/database.mjs';
const order={id:5998,number:'30001604',currencyCode:'PLN',paymentCode:'payment_timely',total:7200,itemsTotal:900,shippingTotal:6300,shippingTotalNet:6000,shippingTaxRate:0.05,shippingCode:'testwys',shipmentPackageQuantity:6,items:[{code:'D087',quantity:1,unitPrice:1000,originalUnitPrice:1000,total:900,unitPriceNet:952,discountedUnitPrice:900,discountedUnitPriceNet:857,rebatePercent:10,productName:'Kuka Muka'}]};
const details=JSON.stringify({shippingMethodCode:'testwys',packageQuantity:6,singlePackagePrice:1000,priceIsNet:true});
const fixture=()=>({order:[{id:'5998',number:'30001604',state:'placed',items_total:'900',total:'7200',currency_code:'PLN'}],items:[{code:'D087',quantity:'1',unit_price:'1000',original_unit_price:'1000',total:'900',product_name:'Kuka Muka'}],adjustments:[{type:'shipping',amount:'6300'}],payments:[{code:'payment_timely',amount:'7200',currency_code:'PLN'}],shipment:[{code:'testwys',adjustments_total:'6300',details_length:String(details.length),...Object.fromEntries(Array.from({length:10},(_,i)=>['part'+i,details.slice(i*40,i*40+40)]))}],transfer:[{nOrderID:'30001604',nIsWholesale:'1',cCurrencyCode:'PLN',dPrice:'72.000'}],transferItems:[{vcIDT:'D087',nAmount:'1',dRebatePercent:'10.00',dPrice:'10.000',dPriceNetto:'9.520',dPriceWithRebate:'9.000',dPriceNettoWithRebate:'8.570'},{vcIDT:'KWys',dVATPercent:'0.05',nAmount:'6',dPriceWithRebate:'10.500',dPriceNettoWithRebate:'10.000'}]});
test('Porównanie wiąże API id z numerem Sylius i nOrderID transferu; kontroluje KWys i szczegóły paczek',()=>{const checks=compareDatabase(order,fixture());assert(!checks.some(c=>c.status==='FAIL'),JSON.stringify(checks));assert(checks.some(c=>c.name==='KWys: netto dostawy bez opłaty płatności'&&c.status==='PASS'));assert(!checks.some(c=>c.status==='SKIP')); });

test('Transfer może rozbić ilość na rekordy, ale musi zachować ilość i wartość pozycji',()=>{
  const api=structuredClone(order);api.items[0].quantity=2;api.items[0].total=1800;
  const db=fixture();db.items[0].quantity='2';db.items[0].total='1800';db.transferItems.splice(1,0,{...db.transferItems[0]});
  const good=compareDatabase(api,db);assert(!good.some(c=>c.status==='FAIL'),JSON.stringify(good));
  db.transferItems[1].dPriceWithRebate='9.010';const bad=compareDatabase(api,db);assert(bad.some(c=>c.name.includes('suma brutto w transferze')&&c.status==='FAIL'));
  db.transferItems[1].dPriceWithRebate='9.000';db.transferItems.push({...db.transferItems[0]});assert(compareDatabase(api,db).some(c=>c.name==='D087: ilość w transferze'&&c.status==='FAIL'));
});
test('DECIMAL zachowuje trzecią cyfrę, a błędna kwota, ilość lub duplikat dają FAIL',()=>{
  assert.equal(decimalMilli('72.001'),72001);assert.throws(()=>decimalMilli('NaN'));
  for(const mutate of [d=>d.transfer[0].dPrice='72.001',d=>d.transfer[0].nOrderID='5998',d=>d.transferItems[1].nAmount='5',d=>d.order.push(d.order[0]),d=>d.items[0].quantity='2']){const db=fixture();mutate(db);assert(compareDatabase(order,db).some(c=>c.status==='FAIL'));}
});
test('Zapytania są stałymi SELECT dla liczbowego id; odrzucają SQL injection',()=>{for(const value of ['5998','5998 OR 1=1',-1,0,1.5])assert.throws(()=>databaseQueries(value));for(const sql of Object.values(databaseQueries(5998))){assert(sql.startsWith('SELECT '));assert(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(sql));assert(sql.includes('5998'));}assert(databaseQueries(5998).transfer.includes('CAST(o.number AS UNSIGNED)'));});

test('KWys zawiera sam koszt przesyłki, a API shippingTotal także opłatę płatności',()=>{const api=structuredClone(order);api.total+=1000;api.shippingTotal+=1000;api.shippingTotalNet+=952;const db=fixture();db.order[0].total='8200';db.payments[0].amount='8200';db.transfer[0].dPrice='82.000';db.adjustments.push({type:'payment',amount:'1000'});const checks=compareDatabase(api,db);assert(!checks.some(c=>c.status==='FAIL'),JSON.stringify(checks));});

test('Długie nazwy są odczytywane w całości, bez skrótów i zamiany spacji przez phpMyAdmin',()=>{
  const name='Ortografia dla szkoły podstawowej i gimnazjum.  Pisownia wyrazów z ó i u — żółć '.repeat(2);const encoded=Buffer.from(name).toString('base64');const row={code:'POP1',product_name_length:String(Array.from(name).length),...Object.fromEntries(Array.from({length:36},(_,i)=>['pn'+i,encoded.slice(i*40,i*40+40)]))};const decoded=decodeDatabaseNames([row])[0];assert.equal(decoded.product_name,name);assert(!Object.hasOwn(decoded,'pn0'));assert.throws(()=>decodeDatabaseNames([{...row,pn1:'skrot...'}]));assert.throws(()=>decodeDatabaseNames([{...row,product_name_length:'999'}]));
});
