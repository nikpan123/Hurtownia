const codes=['bank_transfer','cash_on_delivery','bank_transfer_1_day','payment_timely','adamada'];
const safeRebates=input=>Object.fromEntries(codes.filter(code=>Number.isFinite(input?.[code])&&input[code]>=0&&input[code]<=100).map(code=>[code,input[code]]));
export function accountSummaries(config,credentials,vars,reference={},custom){
  const secondary={};
  for(const code of codes){const value=vars['HURT_SECOND_REBATE_'+code.toUpperCase()];if(value?.trim())secondary[code]=Number(value.replace(',','.'));}
  return [
    {id:'primary',label:'Konto 1',email:credentials.email??'',source:'Wzorzec z lokalnej konfiguracji testów',rebates:safeRebates({...reference.paymentRebates,adamada:config.scenario?.expectations?.groupRebatePercent?.adamada})},
    {id:'secondary',label:'Konto 2',email:vars.HURT_SECOND_EMAIL??'',source:'Wzorzec z lokalnej konfiguracji drugiego konta',rebates:safeRebates(secondary)},
    {id:'custom',label:'Własny użytkownik',email:vars.HURT_CUSTOM_EMAIL??'',source:custom?.email===vars.HURT_CUSTOM_EMAIL?'Odczyt z Syliusa CMS':'Rabaty zostaną odczytane z CMS przed testem',rebates:safeRebates(custom?.email===vars.HURT_CUSTOM_EMAIL?custom.profile.rebates:{}),readAt:custom?.email===vars.HURT_CUSTOM_EMAIL?custom.profile.readAt:undefined}
  ];
}
