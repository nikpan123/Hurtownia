let productPreviewReady=false,productJobId=null,productPreviewRevision=0,productPreviewInput=null;
function productInput(){return {code:$('new-code').value.trim(),variantCode:$('new-variant').value.trim(),name:$('new-name').value,slug:$('new-slug').value.trim(),channel:$('new-channel').value,price:$('new-price').value,originalPrice:$('new-original').value,minimumPrice:$('new-minimum').value};}
function productFeedback(message,error=false){$('product-feedback').textContent=message;$('product-feedback').classList.toggle('product-form-error',error);}
function invalidateProductPreview(message='Dane zmieniono. Kliknij „Sprawdź i pokaż dane”, aby odświeżyć podgląd.'){
 productPreviewRevision++;productPreviewReady=false;productPreviewInput=null;$('product-create').disabled=true;
 $('product-json').textContent='Brak aktualnego podglądu — dane nie zostały jeszcze sprawdzone.';
 for(const field of $('product-form').querySelectorAll('input,select'))field.removeAttribute('aria-invalid');
 productFeedback(message);
}
function generateProductCodes(){const code='qa-ui-'+Date.now()+'-'+crypto.randomUUID().slice(0,5);$('new-code').value=code;$('new-variant').value=code;$('new-slug').value=code;invalidateProductPreview('Wygenerowano nowe kody QA. Sprawdź dane przed utworzeniem książki.');}
generateProductCodes();
$('product-generate').addEventListener('click',generateProductCodes);
$('product-form').addEventListener('input',()=>invalidateProductPreview());
$('product-form').addEventListener('change',()=>invalidateProductPreview());
$('product-form').addEventListener('submit',async event=>{
  event.preventDefault();invalidateProductPreview('Sprawdzanie aktualnych danych…');
  const invalid=[...$('product-form').querySelectorAll('input,select')].find(field=>!field.checkValidity()||['new-code','new-variant'].includes(field.id)&&!/^qa-[A-Za-z0-9_-]{1,90}$/.test(field.value.trim()));
  if(invalid){
   const hints={'new-code':'Kod produktu musi zaczynać się od qa- i zawierać tylko litery, cyfry, myślniki lub podkreślenia. Nazwę produktu wpisz w polu „Nazwa produktu”.','new-variant':'Kod handlowy musi zaczynać się od qa- i zawierać tylko litery, cyfry, myślniki lub podkreślenia.','new-slug':'Slug może zawierać małe litery, cyfry i pojedyncze myślniki, np. qa-testowa-ksiazka.','new-name':'Nazwa produktu jest wymagana i musi mieć od 2 do 255 znaków.'};
   invalid.setAttribute('aria-invalid','true');productFeedback(hints[invalid.id]??invalid.validationMessage,true);invalid.focus();return;
  }
  const revision=productPreviewRevision,input=productInput(),snapshot=JSON.stringify(input);
  try{const payload=await post('/api/product/preview',{input});if(revision!==productPreviewRevision||snapshot!==JSON.stringify(productInput()))return;
   $('product-json').textContent=payload.method+' '+payload.endpoint+'\n'+payload.contentType+'\n\n'+JSON.stringify(payload,null,2);productPreviewReady=true;productPreviewInput=snapshot;$('product-create').disabled=!!state?.jobs.some(j=>j.status==='RUNNING');$('toast').hidden=true;productFeedback('Podgląd jest aktualny i odpowiada danym w formularzu.');
  }catch(e){if(revision===productPreviewRevision)productFeedback(e.message,true);}
});
$('product-create').addEventListener('click',async()=>{
  if(!productPreviewReady)return;if(productPreviewInput!==JSON.stringify(productInput())){invalidateProductPreview();return;}$('product-create').disabled=true;productPreviewReady=false;
  try{const job=await post('/api/run',{suite:'product-create',input:productInput()});productJobId=job.id;$('toast').hidden=true;await refresh();}catch(e){toast(e.message);}
});
function renderProductForm(){
  const running=state.jobs.some(j=>j.status==='RUNNING');$('product-create').disabled=!productPreviewReady||running;$('product-preview').disabled=running;$('product-generate').disabled=running;
  const job=state.jobs.find(j=>j.id===productJobId)??state.jobs.find(j=>j.suite==='product-create');if(!job)return;productJobId=job.id;
  const report=state.reports.find(r=>job.log.includes(r.id));
  $('product-result').innerHTML=badge(job.status)+`<pre>${esc(job.log)}</pre>${job.creation?.state==='product_created'?'<p>Produkt został utworzony, ale ponowny odczyt pól lub cennika nie został potwierdzony. Użyj zapisanego kodu do sprawdzenia rekordu; nie powtarzaj tworzenia tego produktu.</p>':''}${job.status==='PASS'?'<p>CMS potwierdził utworzenie książki i zapis jej pól oraz cen. Produkt pozostaje nieaktywny i ukryty.</p>':''}${report?`<button class="secondary" data-report="${esc(report.id)}">Raport samego tworzenia →</button>`:''}`;
  $('product-api-response').hidden=!job.lastResponse;if(job.lastResponse)$('product-api-response').textContent=JSON.stringify(job.lastResponse,null,2);
}
if(['wizard','create-product','documentation','scenarios'].includes(location.hash.slice(1)))setView(location.hash.slice(1));
refresh();setInterval(refresh,1800);
