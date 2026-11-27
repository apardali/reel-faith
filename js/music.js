// Background music: soft Byzantine-style chant, synthesised live with Web Audio.
// A low ison (drone) of male voices under a slow first-mode melody, with church reverb.
// No audio files, so there is nothing to license. Soft by default.
const VOL = 0.16;
let ctx = null, master = null, mel = null, timer = null, nextT = 0;
let wanted = false, ducked = false, muted = false;
try { muted = localStorage.getItem("reelfaith-mute") === "1" } catch (e) { }

const VOW={a:[730,1090,2440],o:[570,840,2410],e:[530,1840,2480]};
const SC=[0,2,3,5,7,9,10,12,14],D3=146.83,hz=st=>D3*Math.pow(2,st/12);
function impulse(ctx,sec,decay){const r=ctx.sampleRate,l=Math.floor(r*sec),b=ctx.createBuffer(2,l,r);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<l;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/l,decay)}return b}
function chantVoice(ctx,dest,f,amt){
 const g=ctx.createGain();g.gain.value=0;const sum=ctx.createGain();sum.gain.value=.35;
 const oscs=[-7,0,6].map(dt=>{const o=ctx.createOscillator();o.type="sawtooth";o.frequency.value=f;o.detune.value=dt;o.connect(sum);o.start();return o});
 const vib=ctx.createOscillator();vib.frequency.value=4.8;const vg=ctx.createGain();vg.gain.value=amt;vib.connect(vg);oscs.forEach(o=>vg.connect(o.detune));vib.start();
 const fs=[0,1,2].map(i=>{const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.Q.value=[5,9,12][i];bp.frequency.value=VOW.a[i];const fg=ctx.createGain();fg.gain.value=[3,1.6,.5][i];sum.connect(bp);bp.connect(fg);fg.connect(g);return bp});
 g.connect(dest);
 return{set(fr,t,gl){oscs.forEach(o=>o.frequency.setTargetAtTime(fr,t,gl))},vowel(v,t){fs.forEach((b,i)=>b.frequency.setTargetAtTime(VOW[v][i],t,.09))},level(x,t,tc){g.gain.setTargetAtTime(x,t,tc)}};
}
let melDeg=2;
function chantPhrase(mel,t){
 const n=4+Math.floor(Math.random()*6);let tt=t;mel.level(.8,tt,.35);
 for(let i=0;i<n;i++){
  melDeg=Math.max(0,Math.min(SC.length-1,melDeg+[-1,1,1,-1,0,2,-2,1][Math.floor(Math.random()*8)]));
  if(i===n-1)melDeg=Math.random()<.65?0:4;
  mel.set(hz(SC[melDeg]),tt,.07);mel.vowel("aoea"[Math.floor(Math.random()*4)],tt);
  tt+=i===n-1?2.8:[.8,1.1,1.5,1.1][Math.floor(Math.random()*4)];
 }
 mel.level(0,tt-.5,.6);return tt+1.8+Math.random()*2.6;
}
function buildChant(ctx,dest){
 const dry=ctx.createGain();dry.gain.value=.55;const wet=ctx.createGain();wet.gain.value=.75;const cv=ctx.createConvolver();cv.buffer=impulse(ctx,4.5,2.6);
 const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=2600;
 lp.connect(dry);lp.connect(cv);cv.connect(wet);dry.connect(dest);wet.connect(dest);
 const isonLo=chantVoice(ctx,lp,D3/2,3),isonHi=chantVoice(ctx,lp,D3,4),mel=chantVoice(ctx,lp,hz(SC[2]),9);
 isonLo.vowel("o",0);isonHi.vowel("o",0);isonLo.level(.55,ctx.currentTime,1.5);isonHi.level(.28,ctx.currentTime,1.5);
 return{mel};
}

function tick() { if (ctx.currentTime > nextT - 1.5) nextT = chantPhrase(mel, Math.max(nextT, ctx.currentTime + .1)) }
function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  mel = buildChant(ctx, master).mel; nextT = ctx.currentTime + 2.5;
  return true;
}
function apply() {
  if (!ctx) return;
  const on = wanted && !ducked && !muted && !document.hidden, t = ctx.currentTime;
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
  if (on) {
    if (ctx.state === "suspended") ctx.resume();
    if (!timer) timer = setInterval(tick, 500);
    master.gain.linearRampToValueAtTime(VOL, t + 2.5);
  } else {
    master.gain.linearRampToValueAtTime(0, t + .6);
    if (timer) { const tm = timer; timer = null; setTimeout(() => clearInterval(tm), 700) }
  }
}
// Browsers only allow sound after the first tap or key press.
function unlock() { if (init()) { if (ctx.state === "suspended") ctx.resume(); apply() } }
["pointerdown", "keydown", "touchstart"].forEach(e => window.addEventListener(e, unlock, { capture: true, passive: true }));
document.addEventListener("visibilitychange", apply);

const listeners = new Set();
export const music = {
  // Should music be playing on this screen?
  want(on) { wanted = !!on; apply() },
  // Pause while a clip plays.
  duck(on) { ducked = !!on; apply() },
  isMuted: () => muted,
  setMuted(m) { muted = !!m; try { localStorage.setItem("reelfaith-mute", muted ? "1" : "0") } catch (e) { } listeners.forEach(f => f(muted)); if (!muted) unlock(); apply() },
  toggle() { music.setMuted(!muted) },
  onChange(f) { listeners.add(f) },
  state: () => ({ playing: !!timer, gain: master ? +master.gain.value.toFixed(3) : 0, wanted, ducked, muted, style: "chant" })
};
window.__music = music;
