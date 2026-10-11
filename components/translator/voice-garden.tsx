"use client";
import {useEffect,useRef} from "react";
const VS="attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS=`precision mediump float;uniform vec2 R;uniform float T,A;void main(){vec2 p=(gl_FragCoord.xy-.5*R)/R.y;float v=sin(p.x*9.+sin(p.y*6.-T*.2)*2.)+sin(p.y*11.+p.x*3.-T*.2);float ridge=pow(.5+.5*sin(v*3.+T*.2),12.);vec3 base=mix(vec3(.40,.72,.88),vec3(.65,.88,.96),smoothstep(-.3,.5,p.y));vec3 col=mix(base,vec3(.92,.98,1.),ridge*.85);gl_FragColor=vec4(col*(.16+ridge*.45+A*.25),(.12+ridge*.18+A*.12)*.75);}`;
export default function VoiceGarden({state,signal}:{state:string;signal:{current:{level:number}}}){
const net=useRef<HTMLCanvasElement>(null),field=useRef<HTMLCanvasElement>(null),live=useRef(state);
useEffect(()=>{live.current=state;},[state]);
useEffect(()=>{
const c=net.current,f=field.current;if(!c||!f)return;const ctx=c.getContext("2d");if(!ctx)return;
const gl=f.getContext("webgl",{alpha:true});let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;const shaders:WebGLShader[]=[];
if(gl)try{const compile=(type:number,src:string)=>{const sh=gl.createShader(type);if(!sh)throw Error("shader allocation");shaders.push(sh);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh)||"shader compile");return sh;};program=gl.createProgram();if(!program)throw Error("program allocation");gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("shader link");gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,"p");gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}catch(e){console.warn("Zero field fallback",e);if(program)gl.deleteProgram(program);program=null;}
const uniforms=gl&&program?{R:gl.getUniformLocation(program,"R"),T:gl.getUniformLocation(program,"T"),A:gl.getUniformLocation(program,"A")}:null;
const mask=document.createElement("canvas");mask.width=mask.height=220;const m=mask.getContext("2d");
if(!m){if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const sh of shaders)gl.deleteShader(sh);}return;}
const sample=(draw:(x:CanvasRenderingContext2D)=>void)=>{m.clearRect(0,0,220,220);m.fillStyle="white";draw(m);const pixels=m.getImageData(0,0,220,220).data;const pts:number[][]=[];for(let y=5;y<215;y+=3)for(let x=5;x<215;x+=3)if(pixels[(y*220+x)*4+3]>100)pts.push([(x-110)/110,(y-110)/110]);return pts;};
const robot=sample(x=>{x.beginPath();x.moveTo(74,57);x.lineTo(61,21);x.lineTo(95,45);x.lineTo(125,45);x.lineTo(159,21);x.lineTo(146,57);x.lineTo(149,96);x.lineTo(131,113);x.lineTo(143,164);x.lineTo(161,190);x.lineTo(124,181);x.lineTo(110,158);x.lineTo(96,181);x.lineTo(59,190);x.lineTo(77,164);x.lineTo(89,113);x.lineTo(71,96);x.closePath();x.fill();x.fillRect(44,108,26,48);x.fillRect(150,108,26,48);x.clearRect(80,72,20,8);x.clearRect(120,72,20,8);});
const glyph=sample(x=>{x.font='bold 182px "Hiragino Mincho ProN","Yu Mincho",serif';x.textAlign="center";x.textBaseline="middle";x.fillText("終",110,113);});
const points=Array.from({length:1000},(_,i)=>({a:robot[Math.floor(i*robot.length/1000)],b:glyph[Math.floor(i*glyph.length/1000)],phase:i*2.39996}));
const nodes=Array.from({length:64},(_,i)=>({x:(i*.618034)%1,y:(i*.414214)%1}));let id=0,last=performance.now(),energy=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const draw=(now:number)=>{const r=c.getBoundingClientRect(),w=r.width,h=r.height,dt=Math.min(.05,(now-last)/1000);last=now;if(w<1||h<1){id=requestAnimationFrame(draw);return;}const d=Math.min(devicePixelRatio||1,1.5);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=f.width=Math.round(w*d);c.height=f.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);if(gl)gl.viewport(0,0,f.width,f.height);}
const phase=live.current,listening=phase==="listening"||phase==="ending",ended=phase==="stopped";
const raw=signal.current.level;const measured=listening&&Number.isFinite(raw)?Math.max(0,Math.min(1,raw*2.4-.015)):0;
energy+=(measured-energy)*(1-Math.exp(-dt*(measured>energy?18:5)));ctx.clearRect(0,0,w,h);const time=reduced?0:now/1000;
const color=`${Math.round(102+energy*133)},${Math.round(184+energy*66)},${Math.round(224+energy*31)}`;
const positions=nodes.map((n,i)=>({x:w/2+(n.x-.5)*w*.9+(reduced?0:Math.sin(time+i)*3),y:h/2+(n.y-.5)*h*.8+(reduced?0:Math.cos(time+i)*3)}));
for(let i=0;i<positions.length;i++){const a=positions[i];for(let j=i+1;j<positions.length;j++){const b=positions[j],dist=Math.hypot(a.x-b.x,a.y-b.y);if(dist>80)continue;ctx.strokeStyle=`rgba(123,188,213,${(1-dist/80)*(.12+energy*.28)})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.fillStyle=`rgba(189,228,244,${.18+energy*.5})`;ctx.fillRect(a.x,a.y,2,2);}
const scale=Math.min(w*.25,h*.36)*(.7+energy*.65);ctx.fillStyle=`rgb(${color})`;ctx.shadowColor="rgba(189,228,244,.9)";ctx.shadowBlur=2+energy*16;
for(const p of points){const shape=ended?p.b:p.a;const flutter=reduced||ended?0:.01+energy*.015;const x=w/2+(shape[0]+Math.sin(time*2+p.phase)*flutter)*scale;const y=h/2+(shape[1]+Math.cos(time*1.7+p.phase)*flutter)*scale;ctx.globalAlpha=.22+energy*.7;ctx.fillRect(x,y,1.6,1.6);}ctx.globalAlpha=1;ctx.shadowBlur=0;
ctx.font='11px sans-serif';ctx.textAlign="center";ctx.fillStyle="#bde4f4";
const label=phase==="listening"?"● マイクON・入力受付中":phase==="ending"?"● 入力受付中・終了へ移行中":phase==="translating"?"翻訳中":phase==="speaking"?"読み上げ中":ended?"マイクOFF・終":phase==="delivered"?"翻訳完了":"0号機・待機";ctx.fillText(label,w/2,h-12);
if(gl&&program&&uniforms){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform2f(uniforms.R,f.width,f.height);gl.uniform1f(uniforms.T,time);gl.uniform1f(uniforms.A,energy);gl.drawArrays(gl.TRIANGLES,0,3);}id=requestAnimationFrame(draw);};id=requestAnimationFrame(draw);
return()=>{cancelAnimationFrame(id);if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const sh of shaders)gl.deleteShader(sh);}};
},[signal]);
return <div aria-hidden="true" style={{position:"absolute",inset:0,pointerEvents:"none"}}><style>{`.voice-router-core--landscape > canvas{visibility:hidden}`}</style><canvas ref={field} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/><canvas ref={net} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/></div>;
}
