import http from 'node:http';

// Wyłącznie lokalny model kontraktu, nigdy dane z rzeczywistego API.
export async function startMock({brokenTotal=false,redirect=false,acceptForbidden=false,badPdf=false,completeTimeout=false,quoteNet=false,directShippingArray=false,rejectBulk=false,itemRebatePercent=25,paymentRebatePercent=25,shippingByPayment=false,emptyPayments=false,emptyShipping=false,omitState=false,netUnitRoundingOffset=0}={}) {
  let quantity=2, payment, shipping, completed=false;
  const requests=[];
  function order() {
    const unit=payment?Math.round(10000*(1-itemRebatePercent/100)):10000;
    const total=unit*quantity;
    return {id:90001,tokenValue:'mock-order-token-private',currencyCode:'PLN',...(!omitState?{state:completed?'new':'cart'}:{}),
      itemsTotal:total,shippingTotal:shipping?1000:0,total:total+(shipping?1000:0)+(brokenTotal?1:0),totalNet:Math.round((total+(shipping?1000:0))/1.05),orderPromotionTotal:payment?-2500*quantity:0,
      shipmentPackageQuantity:shipping?1:0,
      items:[{id:1001,product:{code:'testhurtA',isbnNumber:'9780306406157'},productName:'Produkt demonstracyjny WHOLESALE',variantName:'Wersja A',quantity,unitPrice:10000,originalUnitPrice:10000,discountedUnitPrice:unit,unitPriceNet:9524,discountedUnitPriceNet:Math.round(unit/1.05)+netUnitRoundingOffset,totalNetSalesAfterDiscount:Math.round(total/1.05),rebatePercent:payment?itemRebatePercent:0,total}],
      payments:payment?[{method:{code:payment,name:'Płatność testowa'}}]:[],shipments:shipping?[{method:{code:shipping,name:'Kurier testowy'}}]:[],
      ...(completed?{pdfSummary:'/summary.pdf',paymentForm:'/payment.pdf',checkoutInformation:['shop_billing']}:{} )};
  }
  const server=http.createServer(async(req,res)=>{
    let raw='';for await (const part of req) raw+=part;
    const body=raw?JSON.parse(raw):null;
    requests.push({method:req.method,url:req.url,headers:req.headers,body});
    const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(data):data);};
    if (redirect) {res.writeHead(302,{Location:'https://gitlab.gwo.pl/users/sign_in'});return res.end();}
    if (req.method==='PATCH' && req.headers['content-type']!=='application/merge-patch+json') return send(415,{message:'Wymagany Content-Type: application/merge-patch+json'});
    if (req.url.endsWith('.pdf')) return send(200,badPdf?'not-pdf':Buffer.from('%PDF-1.4\n% mock document only\n%%EOF\n'),'application/pdf');
    if (req.url.endsWith('/authentication-token')) return send(200,{token:'mock-bearer-private'});
    if (req.url==='/api/v2/shop/orders'&&req.method==='POST') return send(201,order());
    if (req.url.endsWith('/items/bulk')) {
      if (rejectBulk) return send(422,{'hydra:description':'Produkt jest niedostępny',violations:[{propertyPath:'items[0].productVariant',message:'Nie można kupić tego wariantu'}],trace:'mock-password-private'});
      quantity=body.items.reduce((sum,p)=>sum+p.quantity,0);return send(200,order());
    }
    if (req.url.endsWith('/items/1001')) {quantity=body.quantity;return send(200,order());}
    if (req.url.endsWith('/payments')) {
      if (emptyPayments) return send(200,[]);
      const quoteTotal=quantity*Math.round(10000*(1-paymentRebatePercent/100));
      return send(200,[{id:1,code:'cash_on_delivery',name:'Przy odbiorze',rebatePercent:paymentRebatePercent,orderItemTotal:quoteNet?Math.round(quoteTotal/1.05):quoteTotal},{id:2,code:'bank_transfer_1_day',name:'Przelew',rebatePercent:paymentRebatePercent,orderItemTotal:quoteNet?Math.round(quoteTotal/1.05):quoteTotal}]);
    }
    if (req.url.endsWith('/payment-method')) {
      if (body.paymentMethodCode==='forbidden'&&!acceptForbidden) return send(422,{message:'Niedostępna płatność'});
      payment=body.paymentMethodCode;return send(200,order());
    }
    if (req.url.includes('/checkout-step-two/')) {
      if (req.method==='GET') {
        let methods=[{code:'inpost_kurier',name:'Kurier testowy'},{code:'pickup',name:'Odbiór testowy'}];
        if (shippingByPayment) methods=methods.filter(m=>m.code===(payment==='bank_transfer_1_day'?'pickup':'inpost_kurier'));
        if (emptyShipping) methods=[];
        return send(200,{shippingMethods:directShippingArray?methods:{'hydra:member':methods}});
      }
      shipping=body.shippingMethodCode;return send(200,order());
    }
    if (req.url.endsWith('/complete')) {completed=true;if(completeTimeout)return setTimeout(()=>send(200,order()),100);return send(200,order());}
    if (req.method==='GET'&&req.url.includes('/shop/orders/')) return send(200,order());
    send(404,{message:'Nieznana trasa mocka'});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {baseUrl:`http://127.0.0.1:${server.address().port}/api/v2`,requests,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
