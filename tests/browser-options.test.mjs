import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserLaunchOptions,validateBrowserPreview} from '../api-tests/browser-options.mjs';
test('Podgląd wymaga jawnego włączenia; opóźnienie działa tylko w widocznym oknie',()=>{
 assert.deepEqual(browserLaunchOptions({}),{channel:'msedge',headless:true,slowMo:0});
 assert.equal(browserLaunchOptions({HURT_BROWSER_PREVIEW:'false',HURT_BROWSER_SLOW_MO_MS:'750'}).slowMo,0);
 assert.deepEqual(browserLaunchOptions({HURT_BROWSER_PREVIEW:'true',HURT_BROWSER_SLOW_MO_MS:'750',BROWSER_CHANNEL:'chrome'}),{channel:'chrome',headless:false,slowMo:750});
 assert.equal(browserLaunchOptions({HURT_BROWSER_PREVIEW:'true',HURT_BROWSER_SLOW_MO_MS:'Infinity'}).slowMo,0);
 for(const value of [null,[],{enabled:'true',slowMoMs:250},{enabled:true,slowMoMs:-1},{enabled:true,slowMoMs:100000}])assert.throws(()=>validateBrowserPreview(value));
});
