export function validateBrowserPreview(value){
 if(value===undefined)return {enabled:false,slowMoMs:0};
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.enabled!=='boolean'||![0,250,750].includes(value.slowMoMs))throw Object.assign(new Error('Niepoprawne opcje podglądu przeglądarki.'),{status:400});
 return {enabled:value.enabled,slowMoMs:value.enabled?value.slowMoMs:0};
}
export function browserLaunchOptions(vars=process.env){
 const enabled=vars.HURT_BROWSER_PREVIEW==='true';
 const delay=Number(vars.HURT_BROWSER_SLOW_MO_MS??0);
 return {channel:vars.BROWSER_CHANNEL??'msedge',headless:!enabled,slowMo:enabled&&[0,250,750].includes(delay)?delay:0};
}
