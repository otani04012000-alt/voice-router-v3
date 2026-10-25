import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConvergence,advanceConvergence,CLOSE_MS,EXPECT_MS,HOLD,type Convergence} from '../components/translator/mic-convergence';

// 16ms刻みで状態を進める
function run(s:Convergence,from:number,to:number,phase:string,level:number|null){for(let t=from+16;t<=to;t+=16)s=advanceConvergence(s,t,phase,level);return advanceConvergence(s,to,phase,level);}
const speaking=()=>run(advanceConvergence(initialConvergence(0),0,'starting',0),0,2000,'speech',.5);

test('受付開始後、話す前は集まらない（開いたまま待つ）',()=>{let s=advanceConvergence(initialConvergence(0),0,'starting',0);s=run(s,0,300,'starting',0);s=run(s,300,3000,'listening',.004);assert.ok(s.progress<.02,String(s.progress));});
test('話している間は開いている',()=>{assert.ok(speaking().progress<.01);});
test('話し終えると無音の長さに比例して集まり、切れる前にHOLD近くまで来る',()=>{let s=speaking();const a=run(s,2000,2000+EXPECT_MS/2,'speech',.004);assert.ok(a.progress>.25&&a.progress<.5,String(a.progress));const b=run(a,2000+EXPECT_MS/2,2000+EXPECT_MS+300,'speech',.004);assert.ok(Math.abs(b.progress-HOLD)<.03,String(b.progress));});
test('受付が続く限りHOLDを超えて閉じない',()=>{const s=run(speaking(),2000,9000,'speech',.004);assert.ok(Math.abs(s.progress-HOLD)<1e-3);});
test('停止通知で残りがCLOSE_MS以内に閉じ切る',()=>{let s=run(speaking(),2000,2900,'speech',.004);const at=s.progress;s=advanceConvergence(s,2900,'stopped',0);assert.equal(s.progress,at);s=advanceConvergence(s,2900+CLOSE_MS/2,'stopped',0);assert.ok(s.progress>at+(1-at)*.8);s=advanceConvergence(s,2900+CLOSE_MS,'off',null);assert.equal(s.progress,1);});
test('話し直すとその場から自然に開き直す',()=>{let s=run(speaking(),2000,2600,'speech',.004);const before=s.progress;s=advanceConvergence(s,2616,'speech',.5);assert.ok(s.progress<before&&s.progress>before*.7);s=run(s,2616,3000,'speech',.5);assert.ok(s.progress<.05);});
test('周囲が騒がしくても、話し声より十分小さければ無音扱い',()=>{let s=advanceConvergence(initialConvergence(0),0,'starting',.1);s=run(s,0,2000,'speech',.7);s=run(s,2000,3200,'speech',.1);assert.ok(s.progress>.6,String(s.progress));});
test('音量が取れない時は勝手にカウントダウンしない',()=>{let s=advanceConvergence(initialConvergence(0),0,'starting',null);s=run(s,0,3000,'speech',null);assert.ok(s.progress<.01);s=run(s,3000,3500,'ending',null);assert.ok(s.progress>.7);});
test('停止通知の重複で閉じる時計がやり直されない',()=>{let s=speaking();s=advanceConvergence(s,2050,'stopping',0);s=advanceConvergence(s,2200,'stopped',null);assert.equal(s.closingAt,2050);});
test('新しい受付で前回の閉じが解除される',()=>{let s=advanceConvergence(initialConvergence(0),100,'stopped',null);s=advanceConvergence(s,200,'starting',null);assert.equal(s.closingAt,null);assert.equal(s.spoke,false);});
test('描画が間引かれても経過時間どおりに進む',()=>{const fine=run(speaking(),2000,2700,'speech',.004);const coarse=advanceConvergence(advanceConvergence(speaking(),2350,'speech',.004),2700,'speech',.004);assert.ok(Math.abs(fine.progress-coarse.progress)<.12,`${fine.progress} ${coarse.progress}`);});
test('時刻が戻っても逆走しない',()=>{const s={...speaking(),progress:.4,last:1000};const n=advanceConvergence(s,900,'speech',.5);assert.equal(n.last,1000);assert.equal(n.progress,.4);});
test('カウントダウンは話す前と話している間は0、無音で伸び、停止後は0',async()=>{const {countdown}=await import('../components/translator/mic-convergence');let s=advanceConvergence(initialConvergence(0),0,'starting',0);s=run(s,0,1000,'listening',.004);assert.equal(countdown(s),0);s=run(s,1000,2000,'speech',.5);assert.equal(countdown(s),0);s=run(s,2000,2000+EXPECT_MS/2,'speech',.004);assert.ok(Math.abs(countdown(s)-.5)<.05);s=advanceConvergence(s,3000,'stopped',0);assert.equal(countdown(s),0);});
