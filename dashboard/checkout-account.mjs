import assert from 'node:assert/strict';
import {secondAccountFromEnv} from '../api-tests/second-account.mjs';

export function checkoutForAccount(config,primary,vars,account='primary',primaryRebates={},customProfile){
  assert(['primary','secondary','custom'].includes(account),'Wybierz konto 1, konto 2 albo użytkownika zdefiniowanego.');
  const copy=structuredClone(config),secondary=account==='secondary'?secondAccountFromEnv(vars,primary):undefined;
  const credentials=account==='custom'?{...primary,email:vars.HURT_CUSTOM_EMAIL}:account==='secondary'?secondary?.credentials:primary;
  assert(credentials?.email&&credentials?.password&&credentials?.testsToken,'Uzupełnij dane wybranego konta w .env.');
  const label=account==='custom'?'Użytkownik zdefiniowany':account==='secondary'?'Konto 2':'Konto 1';
  copy.scenario.account={id:account,label};copy.scenario.name=(copy.scenario.name??'Koszyk')+' — '+label;
  if(account==='secondary'||account==='custom'){
    const rebates=account==='custom'?customProfile?.rebates:secondary.rebates;
    assert(rebates,'Nie odczytano rabatów użytkownika z CMS.');
    const adamada=rebates.adamada;
    assert(Number.isFinite(adamada)&&adamada>=0&&adamada<=100,'Uzupełnij poprawny rabat Adamady drugiego konta.');
    // Specific totals, method availability and quotes from account 1 are not account 2's oracle.
    copy.scenario.expectations={...copy.scenario.expectations,availablePaymentCodes:null,availableShippingCodes:null,paymentQuotes:{},allPaymentRebatePercent:undefined,afterPayment:{},beforeComplete:{},groupRebatePercent:{adamada},paymentRebatePercentByCode:Object.fromEntries(Object.entries(rebates).filter(([k])=>k!=='adamada'))};
    if(account==='custom')copy.scenario.account.rebateReference=customProfile;
    copy.scenario.forbiddenPaymentCodes=[];
  }else copy.scenario.expectations={...copy.scenario.expectations,paymentRebatePercentByCode:primaryRebates};
  for(const n of Object.values(copy.scenario.expectations.paymentRebatePercentByCode))assert(Number.isFinite(n)&&n>=0&&n<=100,'Oczekiwany rabat musi być liczbą 0–100.');
  return {config:copy,credentials,label};
}
