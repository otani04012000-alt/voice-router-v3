import assert from "node:assert/strict";
import { voiceMotion } from "../components/translator/voice-router-core";
let checks=0;function check(f: () => void){f();checks++;}
check(()=>assert.equal(voiceMotion("ending",0).scale,1));
check(()=>assert.equal(voiceMotion("ending",1350).scale,0));
check(()=>assert.equal(voiceMotion("ending",1350).opacity,0));
check(()=>assert.equal(voiceMotion("ending",3000).scale,0));
check(()=>assert.equal(voiceMotion("stopped",0).opacity,0));
check(()=>assert.ok(voiceMotion("listening",0,1).scale>voiceMotion("listening",0,0).scale));
check(()=>{let previous=1;for(let t=0;t<=1350;t+=50){const m=voiceMotion("ending",t);assert.ok(m.scale<=previous);previous=m.scale;}});
check(()=>assert.equal(voiceMotion("speaking",650).opacity,1));
check(()=>assert.ok(voiceMotion("speaking",650).scale>voiceMotion("speaking",0).scale));
check(()=>assert.ok(voiceMotion("translating",1000).scale<0.15));
check(()=>assert.equal(voiceMotion("ending",-100).scale,1));
check(()=>assert.ok(voiceMotion("listening",0,100).scale<=1.18));
console.log(JSON.stringify({checks,status:"passed"}));
