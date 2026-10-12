"use client";
import {useEffect,useRef} from "react";
type Props={state:string;signal:{current:{level:number}};phaseLabel:string};
type Edge={i:number;j:number;alpha:number;target:number};
export default function VoiceGarden({state,signal,phaseLabel}:Props){const canvasRef=useRef<HTMLCanvasElement>(null),live=useRef(state),wakeRef=useRef<(()=>void)|null>(null);useEffect(()=>{live.current=state;wakeRef.current?.();},[state]);
useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const context=canvas.getContext("2d");if(!context)return;const c=canvas,ctx=context,N=132,TAU=Math.PI*2;
const motion=matchMedia("(prefers-reduced-motion: reduce)");let reduced=motion.matches;
const nodes=Array.from({length:N},(_,i)=>({x:.05+((i*.61803398875)%1)*.9,y:.08+((i*.41421356237)%1)*.84,vx:Math.cos(i*2.39996)*(.018+(i%5)*.004),vy:Math.sin(i*2.39996)*(.014+(i%7)*.003),phase:i*2.39996}));
const px=new Float32Array(N),py=new Float32Array(N),edges=new Map<number,Edge>(),buckets:Array<number[]>=Array.from({length:96},()=>[]),backbone:Array<[number,number]>=[];
for(let i=0;i<N;i++)backbone.push([i,(i+17)%N],[i,(i+47)%N]);
const angles=Array.from({length:97},(_,i)=>({a:i/96*TAU,x:Math.cos(i/96*TAU),y:Math.sin(i/96*TAU)}));
const sprite=(rgb:string)=>{const s=document.createElement("canvas");s.width=s.height=48;const q=s.getContext("2d");if(q){const g=q.createRadialGradient(24,24,0,24,24,24);g.addColorStop(0,`rgba(${rgb},.95)`);g.addColorStop(.2,`rgba(${rgb},.4)`);g.addColorStop(1,`rgba(${rgb},0)`);q.fillStyle=g;q.fillRect(0,0,48,48);}return s;};
const glows=[sprite("75,142,225"),sprite("102,213,224"),sprite("180,222,198"),sprite("168,122,224")],gold=sprite("255,226,155");
let frame=0,last=0,w=0,h=0,dirty=true,disposed=false,paused=document.hidden,inView=true,previous=live.current,endingAt=performance.now(),elapsed=0,audio=0,nextLinks=0;
let gradient:CanvasGradient|null=null;
function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
function schedule(){if(!disposed&&!paused&&inView&&!frame)frame=requestAnimationFrame(draw);}
function draw(now:number){frame=0;if(disposed||paused||!inView)return;if(previous!==live.current){previous=live.current;endingAt=now;last=0;}const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!reduced)elapsed+=dt;const t=elapsed;
if(dirty){const box=c.getBoundingClientRect();w=box.width;h=box.height;dirty=false;if(w>0&&h>0){const d=Math.min(devicePixelRatio||1,1.25);c.width=Math.max(1,Math.round(w*d));c.height=Math.max(1,Math.round(h*d));ctx.setTransform(d,0,0,d,0,0);gradient=ctx.createLinearGradient(0,h,w,0);gradient.addColorStop(0,"rgb(75,142,225)");gradient.addColorStop(.3,"rgb(102,213,224)");gradient.addColorStop(.55,"rgb(232,196,110)");gradient.addColorStop(.72,"rgb(180,222,198)");gradient.addColorStop(1,"rgb(168,122,224)");nextLinks=0;}}
if(w<1||h<1){last=0;return;}
const listening=live.current==="listening",ending=live.current==="ending",stopped=live.current==="stopped",raw=signal.current.level,target=(listening||ending)&&Number.isFinite(raw)?Math.max(0,Math.min(1,raw*4.1-.015)):0;
audio+=(target-audio)*(1-Math.exp(-dt*(target>audio?22:5.5)));const collapse=stopped?1:ending?(reduced?1:Math.min(1,(now-endingAt)/1350)):0,visibility=1-collapse;
ctx.clearRect(0,0,w,h);if(visibility<=.001){last=0;return;}
const cx=w/2,cy=h/2,shrink=visibility*visibility,spin=collapse*TAU*3,cs=Math.cos(spin),sn=Math.sin(spin);
for(let i=0;i<N;i++){const n=nodes[i];if(!reduced){n.vx+=Math.sin(t*.7+n.phase+n.y*6)*dt*.003;n.vy+=Math.cos(t*.53+n.phase+n.x*6)*dt*.003;const speed2=n.vx*n.vx+n.vy*n.vy;if(speed2>.004225){const f=.065/Math.sqrt(speed2);n.vx*=f;n.vy*=f;}n.x+=n.vx*dt*(1+audio*2.5);n.y+=n.vy*dt*(1+audio*2.5);if(n.x<.035){n.x=.035;n.vx=Math.abs(n.vx);}if(n.x>.965){n.x=.965;n.vx=-Math.abs(n.vx);}if(n.y<.055){n.y=.055;n.vy=Math.abs(n.vy);}if(n.y>.945){n.y=.945;n.vy=-Math.abs(n.vy);}}const x=(n.x-.5)*w,y=(n.y-.5)*h;px[i]=cx+(x*cs-y*sn)*shrink;py[i]=cy+(x*sn+y*cs)*shrink;}
if(now>=nextLinks){nextLinks=now+200;for(const e of edges.values())e.target=0;for(const b of buckets)b.length=0;for(let i=0;i<N;i++){const n=nodes[i];buckets[Math.min(7,Math.floor(n.y*8))*12+Math.min(11,Math.floor(n.x*12))].push(i);}
for(let i=0;i<N;i++){const n=nodes[i],gx=Math.min(11,Math.floor(n.x*12)),gy=Math.min(7,Math.floor(n.y*8));let best=-1,distance=Infinity;for(let y=Math.max(0,gy-1);y<=Math.min(7,gy+1);y++)for(let x=Math.max(0,gx-1);x<=Math.min(11,gx+1);x++)for(const j of buckets[y*12+x]){if(j===i)continue;const dx=(n.x-nodes[j].x)*w,dy=(n.y-nodes[j].y)*h,d=dx*dx+dy*dy;if(d<distance){distance=d;best=j;}}if(best>=0){const a=Math.min(i,best),b=Math.max(i,best),key=a*N+b,e=edges.get(key);if(e)e.target=1;else edges.set(key,{i:a,j:b,alpha:0,target:1});}}}
ctx.globalCompositeOperation="screen";ctx.strokeStyle=gradient||"rgb(102,213,224)";ctx.lineCap="round";
const midY=(i:number,j:number)=>(py[i]+py[j])/2+Math.sin(t*.6+i+j)*h*(.025+audio*.035)*shrink;
ctx.beginPath();for(const [i,j] of backbone){ctx.moveTo(px[i],py[i]);ctx.quadraticCurveTo((px[i]+px[j])/2,midY(i,j),px[j],py[j]);}ctx.globalAlpha=(.055+audio*.08)*visibility;ctx.lineWidth=4+audio*3;ctx.stroke();ctx.globalAlpha=(.16+audio*.2)*visibility;ctx.lineWidth=.95+audio*1.1;ctx.stroke();
const fade=reduced?1:1-Math.exp(-dt*8);ctx.lineWidth=.8+audio;for(const [key,e] of edges){e.alpha+=(e.target-e.alpha)*fade;if(e.target===0&&e.alpha<.01){edges.delete(key);continue;}ctx.globalAlpha=e.alpha*(.18+audio*.2)*visibility;ctx.beginPath();ctx.moveTo(px[e.i],py[e.i]);ctx.quadraticCurveTo((px[e.i]+px[e.j])/2,midY(e.i,e.j),px[e.j],py[e.j]);ctx.stroke();}
ctx.save();ctx.translate(cx,cy);ctx.rotate(spin+t*.12);const radius=Math.min(w,h)*.22*(.96+.04*Math.sin(t*1.4)+audio*.26)*visibility;
ctx.globalAlpha=(.5+audio*.25)*visibility;ctx.drawImage(glows[1],-radius*1.45,-radius*1.45,radius*2.9,radius*2.9);ctx.drawImage(glows[3],-radius,-radius,radius*2,radius*2);
const cycle=t%9/3,mode=Math.floor(cycle),f=Math.max(0,Math.min(1,(cycle-mode-.18)/.7)),mix=f*f*(3-2*f);
const profile=(kind:number,a:number,k:number)=>kind===0?1+.08*Math.sin(a*7+t*.5+k)*Math.cos(a*3-t*.3):kind===1?.8+.35*Math.pow(.5+.5*Math.cos(a*13+t*.2),6):.76+.36*Math.pow(.5+.5*Math.cos(a*6-t*.2),3);
for(let ring=0;ring<12;ring++){const k=ring/11,scale=.2+.8*k,tilt=.55+.4*Math.sin(t*.35+ring*.2)**2;ctx.beginPath();for(let i=0;i<angles.length;i++){const p=angles[i],r=radius*scale*(profile(mode,p.a,ring)*(1-mix)+profile((mode+1)%3,p.a,ring)*mix),x=p.x*r,y=p.y*r*tilt+Math.sin(p.a*3+t+ring*.5)*radius*.025;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.globalAlpha=(.16+.32*k+audio*.2)*visibility;ctx.strokeStyle=gradient||"rgb(102,213,224)";ctx.lineWidth=.7+audio*1.3;ctx.stroke();}
ctx.globalAlpha=(.7+audio*.25)*visibility;const core=radius*(.22+audio*.08);ctx.drawImage(gold,-core,-core,core*2,core*2);ctx.restore();
ctx.globalAlpha=visibility;for(let k=0;k<24;k++){const [i,j]=backbone[k*11%backbone.length],f=reduced?.5:(t*(.17+audio*.35)+i*.173+j*.07)%1,q=1-f,x=q*q*px[i]+q*f*(px[i]+px[j])+f*f*px[j],y=q*q*py[i]+2*q*f*midY(i,j)+f*f*py[j],r=7+audio*7;ctx.drawImage(gold,x-r,y-r,r*2,r*2);}
for(let i=0;i<N;i++){const n=nodes[i],r=8+audio*8;ctx.globalAlpha=(.7+.3*Math.sin(t*1.1+n.phase)**2)*visibility;ctx.drawImage(glows[Math.min(3,Math.floor((.65*n.x+.35*n.y)*4))],px[i]-r,py[i]-r,r*2,r*2);}ctx.globalAlpha=(.8+audio*.18)*visibility;ctx.fillStyle="rgb(235,248,255)";ctx.beginPath();for(let i=0;i<N;i++){ctx.moveTo(px[i]+1.4+audio,py[i]);ctx.arc(px[i],py[i],1.4+audio,0,TAU);}ctx.fill();ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
if(ending){ctx.beginPath();ctx.arc(cx,cy,Math.max(5,Math.min(w,h)*.25*visibility),0,TAU);ctx.strokeStyle="rgba(255,192,95,.9)";ctx.lineWidth=3+collapse*4;ctx.stroke();}
if(!reduced||listening||ending)schedule();else last=0;}
const resize=new ResizeObserver(()=>{dirty=true;schedule();});resize.observe(c);const intersection=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;if(inView){last=0;schedule();}else stop();});intersection.observe(c);
const hidden=()=>{paused=document.hidden;if(paused)stop();else schedule();};const preference=()=>{reduced=motion.matches;last=0;schedule();};document.addEventListener("visibilitychange",hidden);motion.addEventListener("change",preference);wakeRef.current=schedule;schedule();
return()=>{disposed=true;wakeRef.current=null;stop();resize.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",hidden);motion.removeEventListener("change",preference);};
},[signal]);
return <div className="voice-garden" aria-hidden="true"><canvas ref={canvasRef} className="voice-garden-effects" style={{zIndex:2,pointerEvents:"none"}}/><div className="voice-garden-status" data-state={state} style={{zIndex:3}}><span className="voice-garden-status-core"><i/><i/><i/>{state==="stopped"?<b>✓</b>:null}</span><strong>{phaseLabel}</strong></div></div>;
}
