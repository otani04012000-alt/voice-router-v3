import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConvergence,advanceConvergence} from '../components/translator/mic-convergence';
test('speech expansion follows elapsed time when frames are dropped',()=>{const s={...initialConvergence(0),phase:'speech',progress:.85};const n=advanceConvergence(s,1000,'speech',true,true);assert.equal(n.progress,0);});
test('silence convergence follows elapsed time rather than frame count',()=>{const s={...initialConvergence(0),phase:'ending',progress:0,quietAt:0};let n=advanceConvergence(s,1000,'ending',false,true);assert.ok(Math.abs(n.progress-1000/2200*.7)<1e-9);n=advanceConvergence(n,2200,'ending',false,true);assert.ok(Math.abs(n.progress-.7)<1e-9);});
test('elapsed-time updates remain bounded after a long interruption',()=>{const s={...initialConvergence(0),phase:'ending',progress:.6,quietAt:0};const n=advanceConvergence(s,60000,'speech',true,true);assert.equal(n.progress,0);assert.equal(n.quietAt,null);});
test('backwards timestamps do not reverse convergence',()=>{const s={...initialConvergence(1000),phase:'speech',progress:.4};const n=advanceConvergence(s,900,'speech',true,true);assert.equal(n.last,1000);assert.equal(n.progress,.4);});
