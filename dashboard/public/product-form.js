let productPreviewReady=false,productJobId=null;
function productInput(){return {code:$('new-code').value.trim(),variantCode:$('new-variant').value.trim(),name:$('new-name').value,slug:$('new-slug').value.trim(),channel:$('new-channel').value,price:$('new-price').value,originalPrice:$('new-original').value,minimumPrice:$('new-minimum').value};}
function generateProductCodes(){const code='qa-ui-'+Date.now()+'-'+crypto.randomUUID().slice(0,5);$('new-code').value=code;$('new-variant').value=code;$('new-slug').value=code;productPreviewReady=false;$('product-create').disabled=true;}
generateProductCodes();
$('product-generate').addEventListener('click',generateProductCodes);
$('product-form').addEventListener('input',()=>{productPreviewReady=false;$('product-create').disabled=true;});
$('product-form').addEventListener('change',()=>{productPreviewReady=false;$('product-create').disabled=true;});
$('product-form').addEventListener('submit',async event=>{
  event.preventDefault();try{const payload=await post('/api/product/preview',{input:productInput()});$('product-json').textContent='POST /api/v2/admin/products\n'+JSON.stringify(payload.product,null,2)+'\n\nPOST /api/v2/admin/product-variants\n'+JSON.stringify(payload.variant,null,2);productPreviewReady=true;$('product-create').disabled=!!state?.jobs.some(j=>j.status==='RUNNING');$('toast').hidden=true;}catch(e){toast(e.message);}
});
$('product-create').addEventListener('click',async()=>{
  if(!productPreviewReady)return;$('product-create').disabled=true;productPreviewReady=false;
  try{const job=await post('/api/run',{suite:'product-create',input:productInput()});productJobId=job.id;$('toast').hidden=true;await refresh();}catch(e){toast(e.message);}
});
function renderProductForm(){
  const running=state.jobs.some(j=>j.status==='RUNNING');$('product-create').disabled=!productPreviewReady||running;$('product-preview').disabled=running;$('product-generate').disabled=running;
  const job=state.jobs.find(j=>j.id===productJobId)??state.jobs.find(j=>j.suite==='product-create');if(!job)return;productJobId=job.id;
  const report=state.reports.find(r=>job.log.includes(r.id));
  $('product-result').innerHTML=badge(job.status)+`<pre>${esc(job.log)}</pre>${job.creation?.state==='product_created'?'<p>Produkt został utworzony, ale wariant lub cennik nie zostały potwierdzone. Użyj zapisanego kodu do sprawdzenia rekordu; nie powtarzaj tworzenia tego produktu.</p>':''}${job.status==='PASS'?'<p>Serwer potwierdził utworzenie produktu i wariantu z cennikiem. Aktywację i dostępność w sklepie sprawdź osobno w CMS.</p>':''}${report?`<button class="secondary" data-report="${esc(report.id)}">Raport samego tworzenia →</button>`:''}`;
  $('product-api-response').hidden=!job.lastResponse;if(job.lastResponse)$('product-api-response').textContent=JSON.stringify(job.lastResponse,null,2);
}
if(['wizard','create-product','documentation'].includes(location.hash.slice(1)))setView(location.hash.slice(1));
refresh();setInterval(refresh,1800);
