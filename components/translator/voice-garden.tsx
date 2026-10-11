"use client";

import { useEffect, useRef } from "react";

type VoiceGardenProps = {
  state: string;
  signal: { current: { level: number } };
  phaseLabel: string;
};

const VERTEX_SHADER = `
attribute vec2 position;
void main(){ gl_Position=vec4(position,0.0,1.0); }
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float audio;
uniform float collapse;

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}

float maze(vec3 p){
  vec3 q=p*8.4;
  q.xy*=rot(sin(time*.31)*.65);
  q.yz*=rot(time*.17);
  float a=sin(q.x+sin(q.y*1.18+time*1.15))*cos(q.z*.9-time*.72);
  float b=sin(q.y*1.12+sin(q.z+time*.83))*cos(q.x*1.07+time*.48);
  float c=sin((q.x+q.z)*.72-time*.91)*cos(q.y*.86+time*.67);
  return (a+b+c)/3.;
}

float shape(vec3 p){
  float vis=max(.035,1.-collapse*.965);
  p/=vis;
  p.xz*=rot(time*.24+collapse*18.85);
  p.xy*=rot(sin(time*.36)*.28);

  float breath=1.+sin(time*2.05)*.105+sin(time*.73)*.055+audio*.34;
  float morph=.5+.5*sin(time*.46);
  float morph2=.5+.5*sin(time*.31+2.1);
  vec3 stretch=vec3(
    breath*(1.+.28*morph+audio*.22),
    breath*(1.-.16*morph+.22*morph2),
    breath*(1.+.20*(1.-morph2))
  );
  vec3 q=p/stretch;

  float sphere=length(q)-.82;
  float lobes=length(q/vec3(1.+.16*sin(time*.57),.88+.13*cos(time*.43),1.05))-.78;
  float warped=smin(sphere,lobes,.24);
  float ridges=maze(normalize(q+vec3(.0001))*.82);
  float fine=sin(ridges*9.5+time*.75)*.018;
  float displacement=ridges*(.085+audio*.065)+fine;
  return (warped+displacement)*vis;
}

vec3 normalAt(vec3 p){
  float e=.0022;
  return normalize(vec3(
    shape(p+vec3(e,0,0))-shape(p-vec3(e,0,0)),
    shape(p+vec3(0,e,0))-shape(p-vec3(0,e,0)),
    shape(p+vec3(0,0,e))-shape(p-vec3(0,0,e))
  ));
}

vec3 palette(float t){
  vec3 blue=vec3(.035,.22,.48);
  vec3 cyan=vec3(.02,.68,.88);
  vec3 violet=vec3(.36,.10,.68);
  vec3 gold=vec3(.92,.56,.12);
  float a=.5+.5*sin(t*.53);
  float b=.5+.5*sin(t*.37+2.4);
  return mix(mix(blue,cyan,a),mix(violet,gold,b),.28+.32*b);
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
  vec3 ro=vec3(0.,0.,2.75);
  vec3 rd=normalize(vec3(uv,-1.62));
  float travel=0.;
  bool hit=false;
  vec3 p=ro;
  for(int i=0;i<96;i++){
    p=ro+rd*travel;
    float d=shape(p);
    if(d<.0017){hit=true;break;}
    travel+=max(.0014,d*.48);
    if(travel>5.3)break;
  }
  if(!hit){gl_FragColor=vec4(0.);return;}

  vec3 n=normalAt(p);
  vec3 l=normalize(vec3(.55,.82,.72));
  vec3 l2=normalize(vec3(-.72,.18,.52));
  float diff=max(dot(n,l),0.);
  float side=max(dot(n,l2),0.);
  float fres=pow(1.-max(dot(-rd,n),0.),2.15);
  float spec=pow(max(dot(reflect(rd,n),l),0.),28.);
  float m=maze(normalize(p+vec3(.0001))*.82);
  float band=1.-smoothstep(.16,.42,abs(sin(m*8.2+time*.58)));
  float groove=1.-smoothstep(.05,.28,abs(m));

  vec3 base=palette(time);
  vec3 dark=base*.16;
  vec3 col=mix(dark,base,clamp(.22+diff*.82+side*.24,0.,1.));
  col*=.76+band*.58;
  col-=groove*vec3(.08,.11,.14);
  col+=vec3(.78,.95,1.)*spec*(.85+audio*.65);
  col+=mix(vec3(.08,.55,.95),vec3(1.,.62,.18),.5+.5*sin(time*.41))*fres*.82;
  col+=vec3(.95,.78,.34)*band*(.08+audio*.16);
  col=col/(vec3(1.)+col*.18);
  float alpha=(.96+fres*.04)*(1.-collapse);
  gl_FragColor=vec4(col,alpha);
}`;

export default function VoiceGarden({ state, signal, phaseLabel }: VoiceGardenProps) {
  const shaderRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas=shaderRef.current;
    const effects=effectsRef.current;
    if(!canvas||!effects)return;
    const gl=canvas.getContext("webgl",{alpha:true,antialias:false});
    const ctx=effects.getContext("2d");
    if(!ctx)return;

    let program:WebGLProgram|null=null;
    let buffer:WebGLBuffer|null=null;
    const shaders:WebGLShader[]=[];
    if(gl){
      const compile=(type:number,source:string)=>{
        const shader=gl.createShader(type); if(!shader)throw new Error("shader allocation failed");
        shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||"shader compilation failed");
        return shader;
      };
      try{
        program=gl.createProgram(); if(!program)throw new Error("program allocation failed");
        gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX_SHADER));
        gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT_SHADER));
        gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error("shader link failed");
        gl.useProgram(program); buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
        const pos=gl.getAttribLocation(program,"position"); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      }catch(error){console.warn("Organic voice shader fallback",error); if(program)gl.deleteProgram(program); program=null;}
    }

    const uniforms=gl&&program?{
      resolution:gl.getUniformLocation(program,"resolution"),time:gl.getUniformLocation(program,"time"),
      audio:gl.getUniformLocation(program,"audio"),collapse:gl.getUniformLocation(program,"collapse")
    }:null;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame=0,last=performance.now(),started=last,previous=stateRef.current,audio=0;

    const draw=(now:number)=>{
      const rect=effects.getBoundingClientRect(),w=rect.width,h=rect.height;
      const dt=Math.min(.05,Math.max(0,(now-last)/1000)); last=now;
      if(previous!==stateRef.current){previous=stateRef.current;started=now;}
      if(w<1||h<1){frame=requestAnimationFrame(draw);return;}
      const density=Math.min(devicePixelRatio||1,1.5),pw=Math.round(w*density),ph=Math.round(h*density);
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=effects.width=pw;canvas.height=effects.height=ph;ctx.setTransform(density,0,0,density,0,0);gl?.viewport(0,0,pw,ph);}
      const listening=stateRef.current==="listening",ending=stateRef.current==="ending",stopped=stateRef.current==="stopped";
      const target=listening&&Number.isFinite(signal.current.level)?Math.max(.06,Math.min(1,signal.current.level*4.1)):0;
      audio+=(target-audio)*(1-Math.exp(-dt*(target>audio?22:5.5)));
      const collapse=ending?Math.min(1,(now-started)/1350):stopped?1:0;
      const t=reduced?0:now/1000;

      if(gl&&program&&uniforms){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform2f(uniforms.resolution,pw,ph);gl.uniform1f(uniforms.time,t);gl.uniform1f(uniforms.audio,audio);gl.uniform1f(uniforms.collapse,collapse);gl.drawArrays(gl.TRIANGLES,0,3);}

      ctx.clearRect(0,0,w,h);
      if(!stopped){
        const cx=w/2,cy=h/2,min=Math.min(w,h);
        const pulse=1+Math.sin(t*2.05)*.12+Math.sin(t*.73)*.055+audio*.28;
        const haloR=min*(.39+audio*.16)*pulse*(1-collapse*.9);
        const hue=.5+.5*Math.sin(t*.42);
        const r=Math.round(55+130*hue),g=Math.round(135+55*(1-hue)),b=Math.round(235-55*hue);
        const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(8,haloR));
        halo.addColorStop(0,`rgba(${r},${g},${b},${.16+audio*.18})`);halo.addColorStop(.48,`rgba(42,132,210,${.10+audio*.09})`);halo.addColorStop(1,"rgba(4,18,38,0)");
        ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
        const ringR=min*(.255+audio*.09)*pulse;
        for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cx,cy,ringR+i*10,ringR*(.86+.08*Math.sin(t*.9+i))+i*7,Math.sin(t*.37)*.18,0,Math.PI*2);ctx.strokeStyle=`rgba(${i===0?"225,248,255":"83,177,239"},${.36-i*.08+audio*.28})`;ctx.lineWidth=i===0?2.8:1.25;ctx.stroke();}
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}};
  },[signal]);

  return <div className="voice-garden" aria-hidden="true">
    <canvas ref={shaderRef} className="voice-garden-organic" />
    <canvas ref={effectsRef} className="voice-garden-effects" />
    <div className="voice-garden-status" data-state={state}><span className="voice-garden-status-core"><i/><i/><i/>{state==="stopped"?<b>✓</b>:null}</span><strong>{phaseLabel}</strong></div>
  </div>;
}
