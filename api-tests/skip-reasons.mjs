export const skipReasonLabels={data_missing:'Brak danych testowych',not_automated:'Brak automatu',environment:'Ograniczenie środowiska lub dostępu',dependency:'Niepowodzenie wcześniejszego kroku',out_of_scope:'Inny zestaw testów',unspecified:'Pozostałe pominięcia'};
export function skipGroups(checks){
  return Object.entries(skipReasonLabels).map(([code,label])=>({code,label,count:checks.filter(c=>c.status==='SKIP'&&(Object.hasOwn(skipReasonLabels,c.skipReason)?c.skipReason:'unspecified')===code).length})).filter(g=>g.count>0);
}
