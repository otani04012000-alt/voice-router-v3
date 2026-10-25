"use client";
import {useEffect,useRef} from 'react';
import {initialConvergence,advanceConvergence} from './mic-convergence';
type Props={state:string;signal:{current:{level:number;updatedAt?:number}};phaseLabel:string};
export default function VoiceGarden({state,signal,phaseLabel}:Props){
const ref=useRef<HTMLCanvasElement>(null);
useEffect(()=>{
const canvas=ref.current,root=canvas?.closest<HTMLElement>('.honyaku'),garden=canvas?.parentElement;
if(!canvas||!root||!garden)return;
const ctx=canvas.getContext('2d');if(!ctx)return;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const mask=document.createElement('canvas');mask.width=mask.height=220;
const m=mask.getContext('2d'),dots:Array<{x:number;y:number;part:number}>=[];
if(m){m.fillStyle='white';m.beginPath();m.moveTo(74,57);for(const [x,y] of [[61,21],[95,45],[125,45],[159,21],[146,57],[149,96],[131,113],[143,164],[161,190],[124,181],[110,158],[96,181],[59,190],[77,164],[89,113],[71,96]])m.lineTo(x,y);m.closePath();m.fill();m.fillRect(44,108,26,48);m.fillRect(150,108,26,48);m.clearRect(80,72,20,8);m.clearRect(120,72,20,8);const pixels=m.getImageData(0,0,220,220).data;for(let y=5;y<215;y+=3)for(let x=5;x<215;x+=3)if(pixels[(y*220+x)*4+3]>100)dots.push({x:(x-110)/110,y:(y-110)/110,part:x<71&&y>=108&&y<158?1:x>=150&&y>=108&&y<158?2:0});}
const nodes=Array.from({length:132},(_,i)=>({x:.05+(i*.61803398875%1)*.9,y:.08+(i*.41421356237%1)*.84,vx:Math.cos(i*2.39996)*.025,vy:Math.sin(i*2.39996)*.02})),px=new Float32Array(132),py=new Float32Array(132);
let w=0,h=0,dirty=true,frame=0,last=0,lastPaint=-Infinity,time=0,energy=0,disposed=false,gradient:CanvasGradient|null=null,timeline=initialConvergence(performance.now());
function wake(){if(!disposed&&!document.hidden&&!frame){last=0;lastPaint=-Infinity;timeline={...timeline,last:performance.now()};frame=requestAnimationFrame(draw);}}
function draw(now:number){frame=0;if(disposed||document.hidden)return;if(!dirty&&now-lastPaint<1000/30-.1){frame=requestAnimationFrame(draw);return;}lastPaint=now;const elapsed=last?Math.max(0,(now-last)/1000):0,dt=Math.min(.05,elapsed);last=now;const reduced=motion.matches;if(!reduced)time+=elapsed;
if(dirty){const bounds=garden!.getBoundingClientRect();w=bounds.width;h=bounds.height;dirty=false;if(w>0&&h>0){const d=Math.min(Math.max(.1,devicePixelRatio||1),1,512/Math.max(w,h),Math.sqrt(98304/(w*h)));canvas!.width=Math.max(1,Math.floor(w*d));canvas!.height=Math.max(1,Math.floor(h*d));ctx!.setTransform(d,0,0,d,0,0);gradient=ctx!.createLinearGradient(0,h,w,0);gradient.addColorStop(0,'#4b8ee1');gradient.addColorStop(.35,'#66d5e0');gradient.addColorStop(.6,'#dab55b');gradient.addColorStop(1,'#a87ae0');}}
if(w<1||h<1)return;
const mic=root!.dataset.micPhase||'off',input=signal.current,fresh=input.updatedAt!==undefined&&Date.now()-input.updatedAt<650,raw=fresh&&Number.isFinite(input.level)?Math.max(0,Math.min(1,input.level)):0,accepting=['listening','speech','ending'].includes(mic);
timeline=advanceConvergence(timeline,now,mic,fresh?raw:null);
const p=timeline.progress,scale=reduced?1:1-.86*p,angle=reduced?0:p*Math.PI*2,cx=w/2,cy=h/2,cs=Math.cos(angle),sn=Math.sin(angle),opacity=1-.7*p;
energy+=((accepting?raw:0)-energy)*(1-Math.exp(-elapsed*9));
garden!.dataset.convergence=p.toFixed(3);garden!.dataset.mic=mic;garden!.dataset.frameTime=now.toFixed(0);garden!.dataset.audioFresh=String(fresh);garden!.dataset.motion=reduced?'reduced':'full';garden!.dataset.acceptanceEnded=String(['off','stopped','error'].includes(mic));
ctx!.clearRect(0,0,w,h);
for(let i=0;i<nodes.length;i++){const n=nodes[i];if(!reduced){n.x+=n.vx*dt*(1+energy*4);n.y+=n.vy*dt*(1+energy*4);if(n.x<.04||n.x>.96)n.vx=-n.vx;if(n.y<.06||n.y>.94)n.vy=-n.vy;n.x=Math.max(.04,Math.min(.96,n.x));n.y=Math.max(.06,Math.min(.94,n.y));}const x=(n.x-.5)*w,y=(n.y-.5)*h;px[i]=cx+(x*cs-y*sn)*scale;py[i]=cy+(x*sn+y*cs)*scale;}
ctx!.globalCompositeOperation='screen';ctx!.strokeStyle=gradient!;ctx!.globalAlpha=opacity*(.3+energy*.3);ctx!.lineWidth=1.3+energy;ctx!.beginPath();for(let i=0;i<nodes.length;i++)for(const gap of [17,47]){const j=(i+gap)%nodes.length;ctx!.moveTo(px[i],py[i]);ctx!.quadraticCurveTo((px[i]+px[j])/2,(py[i]+py[j])/2+Math.sin(time+i)*8*scale,px[j],py[j]);}ctx!.stroke();ctx!.globalAlpha=opacity;
const radius=2+energy*2;for(let color=0;color<3;color++){ctx!.fillStyle=['#ffeeb5','#66d5e0','#b4dec6'][color];ctx!.beginPath();for(let i=color;i<nodes.length;i+=3){ctx!.moveTo(px[i]+radius,py[i]);ctx!.arc(px[i],py[i],radius,0,Math.PI*2);}ctx!.fill();}
ctx!.save();ctx!.translate(cx,cy);ctx!.rotate(angle);ctx!.scale(scale,scale);ctx!.fillStyle='#bdeeff';const base=Math.min(w*.23,h*.32);ctx!.beginPath();for(let i=0;i<dots.length;i++){const d=dots[i];let x=d.x,y=d.y;if(d.part){const side=d.part===1?-1:1,a=side*p*2.6,dx=x-side*.36,dy=y+.018;x=side*.36+dx*Math.cos(a)-dy*Math.sin(a);y=-.018+dx*Math.sin(a)+dy*Math.cos(a);}const flutter=reduced?0:Math.sin(time*2+i*.17)*(.006+energy*.012);ctx!.rect((x+flutter)*base,y*base,1.6,1.6);}ctx!.fill();ctx!.restore();ctx!.globalAlpha=1;ctx!.globalCompositeOperation='source-over';ctx!.strokeStyle=['stopped','off'].includes(mic)?'#a4ffd0':'#efcf83';ctx!.lineWidth=2;ctx!.beginPath();ctx!.arc(cx,cy,Math.max(5,Math.min(w,h)*.22*scale),0,Math.PI*2);ctx!.stroke();
const resting=energy<=.001&&((mic==='off'&&timeline.closingAt===null&&Math.abs(p-.85)<.001)||(['off','stopped','error'].includes(mic)&&p>=.999));if(!resting)frame=requestAnimationFrame(draw);
}
const resize=new ResizeObserver(()=>{dirty=true;wake();});resize.observe(garden);
const phases=new MutationObserver(wake);phases.observe(root,{attributes:true,attributeFilter:['data-mic-phase']});
const visibility=()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}else wake();};
document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',wake);wake();
return()=>{disposed=true;if(frame)cancelAnimationFrame(frame);resize.disconnect();phases.disconnect();document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',wake);};
},[signal]);
return <div className='voice-garden' data-renderer='2d' aria-hidden='true'><style>{`.honyaku.honyaku .voice-router-core--landscape .voice-garden>canvas{transform:none!important;opacity:1!important;animation:none!important;transition:none!important}.honyaku.honyaku .voice-router-core--landscape .voice-garden::before,.honyaku.honyaku .voice-router-core--landscape .voice-garden::after{display:none!important}`}</style><canvas ref={ref} className='voice-garden-effects' style={{zIndex:2,pointerEvents:'none'}}/><div className='voice-garden-status' data-state={state}><strong>{phaseLabel}</strong></div></div>;
}
