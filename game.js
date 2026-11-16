(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    start: $('startReflex'), overlay: $('reflexOverlay'), overlayContent: $('overlayContent'),
    score: $('scoreStat'), reaction: $('reactionStat'), streak: $('streakStat'), round: $('roundStat'),
    gravity: $('gravitySlider'), friction: $('frictionSlider'), gravityValue: $('gravityValue'), frictionValue: $('frictionValue'),
    gravityCanvas: $('gravityCanvas'), sceneTag: $('sceneTag'), caption: $('simCaption'), hint: $('sandboxHint'),
    reflexPanel: $('reflexPanel'), sandboxPanel: $('sandboxPanel'), panelTitle: $('panelTitle'),
    npcCount: $('npcCount'), pause: $('pausePhysics'), addNpc: $('addNpc'), sound: $('soundToggle')
  };
  const state = {
    mode: 'reflex', signal: 'idle', active: false, round: 0, score: 0, streak: 0, bestStreak: 0,
    reactions: [], signalAt: 0, timeout: null, wrong: 0, gravity: 1.315, friction: .08,
    objects: [], selected: 'crate', paused: false, last: 0, elapsed: 0, sound: true, drag: null,
    w: 0, h: 0, dpr: 1, ground: 0, stars: [], particles: [], feedback: '', feedbackUntil: 0
  };
  let audio;
  function beep(freq=520, duration=.07, type='sine') {
    if (!state.sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o=audio.createOscillator(), g=audio.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration); } catch (_) {}
  }
  function size() {
    const r=canvas.getBoundingClientRect(); state.dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*state.dpr);canvas.height=Math.round(r.height*state.dpr);
    state.w=r.width;state.h=r.height;state.ground=state.h*.77;
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
    state.stars=Array.from({length:45},(_,i)=>({x:(i*83.37%1)*state.w,y:(i*41.51%1)*state.h*.58,r:(i%4)*.23+.35,a:.18+(i%5)*.11}));
  }
  function rounded(x,y,w,h,r,fill,stroke) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function drawBackground(t) {
    const w=state.w,h=state.h,g=state.ground;
    const sky=ctx.createLinearGradient(0,0,0,g);sky.addColorStop(0,'#101d2d');sky.addColorStop(.58,'#172a39');sky.addColorStop(1,'#426273');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    for(const s of state.stars){ctx.globalAlpha=s.a*(.78+.22*Math.sin(t*.001+s.x));ctx.fillStyle='#d5eff0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    // Jupiter over the icy horizon
    const jx=w*.78,jy=h*.22,jr=Math.min(w,h)*.15;
    const halo=ctx.createRadialGradient(jx,jy,jr*.7,jx,jy,jr*2.15);halo.addColorStop(0,'#d99b7355');halo.addColorStop(1,'#d99b7300');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(jx,jy,jr*2.15,0,Math.PI*2);ctx.fill();
    const j=ctx.createRadialGradient(jx-jr*.38,jy-jr*.45,2,jx,jy,jr);j.addColorStop(0,'#e6c49c');j.addColorStop(.52,'#b67e67');j.addColorStop(.86,'#755766');j.addColorStop(1,'#3f4d61');ctx.fillStyle=j;ctx.beginPath();ctx.arc(jx,jy,jr,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(jx,jy,jr,0,Math.PI*2);ctx.clip();for(let i=0;i<7;i++){const yy=jy-jr*.8+i*jr*.27;ctx.fillStyle=i%2?'#f1d0a52c':'#64475b42';ctx.fillRect(jx-jr,yy,jr*2,jr*.09)}ctx.restore();
    // Distant ice ridges
    ctx.beginPath();ctx.moveTo(0,g);for(let x=0;x<=w+10;x+=12){const peak=Math.sin(x*.021)*9+Math.sin(x*.055)*5;ctx.lineTo(x,g-29+peak)}ctx.lineTo(w,g+15);ctx.lineTo(0,g+15);ctx.closePath();ctx.fillStyle='#9bbec3';ctx.fill();
    // Station modules
    const bx=w*.12,by=g-75;ctx.fillStyle='#152a36';ctx.fillRect(bx,by+37,87,38);ctx.fillStyle='#a1c0c5';ctx.fillRect(bx+9,by+20,67,34);ctx.fillStyle='#3e626e';ctx.fillRect(bx+15,by+26,18,12);ctx.fillRect(bx+39,by+26,29,12);ctx.fillStyle='#d1e5d9';ctx.fillRect(bx+12,by+51,60,3);ctx.fillStyle='#749ca4';ctx.fillRect(bx+43,by-1,2,22);ctx.beginPath();ctx.arc(bx+44,by-3,4,0,Math.PI*2);ctx.fillStyle='#7bf0c5';ctx.fill();
    // Distant domes and antennas
    ctx.fillStyle='#294752';ctx.beginPath();ctx.ellipse(w*.88,g-19,37,18,0,Math.PI,0);ctx.fill();ctx.fillRect(w*.88-37,g-19,74,20);ctx.strokeStyle='#81afb144';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(w*.88,g-19,29,14,0,Math.PI,0);ctx.stroke();
    // Ground ice
    const floor=ctx.createLinearGradient(0,g-7,0,h);floor.addColorStop(0,'#a4c5c7');floor.addColorStop(.18,'#789ba4');floor.addColorStop(1,'#344e5b');ctx.fillStyle=floor;ctx.fillRect(0,g,w,h-g);
    ctx.strokeStyle='#daf6f044';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,g);for(let x=0;x<w;x+=20)ctx.lineTo(x,g+Math.sin(x*.035)*2);ctx.stroke();
    // Ice cracks / reflective streaks
    for(let i=0;i<12;i++){const x=(i*127+33)%w,y=g+10+(i*29%(Math.max(30,h-g-20)));ctx.strokeStyle=i%3?'#d9f4f014':'#e7ffff22';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10,y+3);ctx.lineTo(x+16,y-1);ctx.stroke()}
    // Pad markers
    for(let x=24;x<w;x+=75){ctx.strokeStyle='#d8eeee33';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,g+8);ctx.lineTo(x+8,g+8);ctx.stroke()}
    const vignette=ctx.createRadialGradient(w*.5,h*.45,h*.1,w*.5,h*.45,h*.85);vignette.addColorStop(.48,'#04101a00');vignette.addColorStop(1,'#04101a77');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
  function drawSignal(t) {
    const x=state.w*.52,y=state.h*.49;
    if(state.mode==='reflex'&&state.signal!=='idle'){
      const green=state.signal==='green',color=green?'#78f0bd':'#ff777e',pulse=1+Math.sin(t*.009)*.035;
      const glow=ctx.createRadialGradient(x,y,5,x,y,100);glow.addColorStop(0,green?'#45e9a426':'#ff59652b');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(x-110,y-110,220,220);
      ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,32+i*13,0,Math.PI*2);ctx.strokeStyle=color+(i===0?'cc':i===1?'55':'26');ctx.lineWidth=i===0?2:1;ctx.stroke()}
      ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fillStyle=green?'#153b36':'#43252e';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=color;ctx.font='bold 20px "DM Mono", monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(green?'!':'×',0,1);
      ctx.restore();
    }
    if(state.mode==='sandbox'&&state.drag){ctx.strokeStyle='#a2f5d477';ctx.setLineDash([4,5]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(state.drag.x,state.drag.y);ctx.lineTo(state.drag.cx,state.drag.cy);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(state.drag.x,state.drag.y,4,0,Math.PI*2);ctx.fillStyle='#9ef2d4';ctx.fill()}
  }
  function drawEntity(o) {
    const y=o.y, x=o.x;ctx.save();ctx.translate(x,y);
    ctx.globalAlpha=.3;ctx.fillStyle='#10212a';ctx.beginPath();ctx.ellipse(0,o.r*.65,o.r*1.1,o.r*.24,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    if(o.type==='crate'){
      const s=o.r*1.65;ctx.rotate(o.angle||0);const grd=ctx.createLinearGradient(-s/2,-s/2,s/2,s/2);grd.addColorStop(0,'#e5c992');grd.addColorStop(.5,'#a98755');grd.addColorStop(1,'#705a42');rounded(-s/2,-s/2,s,s,2,grd,'#f1dba0');ctx.strokeStyle='#695941';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-s*.34,-s*.34);ctx.lineTo(s*.34,s*.34);ctx.moveTo(s*.34,-s*.34);ctx.lineTo(-s*.34,s*.34);ctx.stroke();ctx.strokeStyle='#efd99a';ctx.lineWidth=1;ctx.strokeRect(-s*.32,-s*.32,s*.64,s*.64);
    } else if(o.type==='rock') {
      ctx.rotate(o.angle||0);ctx.beginPath();ctx.moveTo(-o.r*.85,-o.r*.35);ctx.lineTo(-o.r*.48,-o.r*.96);ctx.lineTo(o.r*.35,-o.r*.83);ctx.lineTo(o.r*.92,-o.r*.27);ctx.lineTo(o.r*.63,o.r*.7);ctx.lineTo(-o.r*.26,o.r*.91);ctx.lineTo(-o.r*.93,o.r*.39);ctx.closePath();const grd=ctx.createLinearGradient(-o.r,-o.r,o.r,o.r);grd.addColorStop(0,'#d4f1ed');grd.addColorStop(.45,'#85b9bb');grd.addColorStop(1,'#426d7b');ctx.fillStyle=grd;ctx.fill();ctx.strokeStyle='#d3ffff88';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.moveTo(-o.r*.4,-o.r*.4);ctx.lineTo(o.r*.1,-o.r*.55);ctx.lineTo(o.r*.43,-o.r*.12);ctx.strokeStyle='#f0ffff77';ctx.stroke();
    } else {
      // Small station explorer with helmet and suit
      const scale=o.r/15;ctx.scale(scale,scale);ctx.scale(o.dir||1,1);
      ctx.fillStyle='#172c36';ctx.fillRect(-8,7,6,12);ctx.fillRect(3,7,6,12);ctx.fillStyle='#d9e8dd';ctx.fillRect(-9,17,8,3);ctx.fillRect(2,17,8,3);
      rounded(-11,-1,22,17,5,'#d8e6d9','#f2f4d9');ctx.fillStyle='#77aaa9';ctx.fillRect(-11,3,22,4);ctx.fillStyle='#f0dfbd';ctx.beginPath();ctx.arc(0,-8,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8e9b';ctx.beginPath();ctx.arc(0,-8,6,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#77f0c3';ctx.fillRect(-2,1,4,4);ctx.strokeStyle='#bbd5d4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,1);ctx.lineTo(-14,10);ctx.moveTo(10,1);ctx.lineTo(14,8);ctx.stroke();ctx.fillStyle='#e2d4b8';ctx.beginPath();ctx.arc(-14,10,2,0,Math.PI*2);ctx.arc(14,8,2,0,Math.PI*2);ctx.fill();
      if(o.label){ctx.scale(o.dir||1,1);ctx.fillStyle='#d8eee8aa';ctx.font='7px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(o.label,0,-29)}
    }
    ctx.restore();
  }
  function draw(t) {
    ctx.clearRect(0,0,state.w,state.h);drawBackground(t);drawSignal(t);
    for(const o of state.objects)drawEntity(o);
    if(state.feedback&&t<state.feedbackUntil){ctx.save();ctx.globalAlpha=Math.min(1,(state.feedbackUntil-t)/350);ctx.textAlign='center';ctx.font='bold 11px "DM Mono", monospace';ctx.fillStyle=state.feedback.includes('+')?'#8cf2c4':'#ff9194';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=14;ctx.fillText(state.feedback,state.w*.52,state.h*.68);ctx.restore()}
  }
  function spawn(type,x,y,vx=0,vy=0) {
    if(state.objects.length>=35){state.feedback='SAHNE DOLU';state.feedbackUntil=performance.now()+800;return}
    const npcIndex=state.objects.filter(o=>o.type==='npc').length;
    state.objects.push({type,x,y,vx,vy,r:type==='rock'?15:type==='npc'?15:12,angle:Math.random()*.3,spin:(Math.random()-.5)*2,dir:Math.random()<.5?-1:1,brain:Math.random()*2,hop:Math.random()*2,label:type==='npc'?['NOVA','KAI','MIRA','SOL'][npcIndex%4]:''});
    updateNpcCount();
  }
  function updateNpcCount(){ui.npcCount.textContent=state.objects.filter(o=>o.type==='npc').length}
  function addNpcAt(x) {spawn('npc',x??(state.w*.25+Math.random()*state.w*.5),state.ground-18,(Math.random()-.5)*12,0)}
  function physics(dt) {
    const g=state.ground,fr=state.friction,grav=state.gravity;
    for(let i=0;i<state.objects.length;i++){
      const o=state.objects[i];
      if(o.type==='npc'){
        o.brain-=dt;if(o.brain<=0){o.brain=1+Math.random()*2;o.dir=Math.random()<.35?-o.dir:o.dir;if(Math.random()<.55&&Math.abs(o.y-(g-15))<3){o.vy=-(35+Math.random()*25)}}
        if(Math.abs(o.vx)<13)o.vx+=o.dir*8*dt;
      }
      o.vy+=grav*31*dt;o.vx+=((state.wind||0)*dt);o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;
      const rad=o.type==='npc'?14:o.r;
      if(o.y+rad>g){o.y=g-rad;if(o.vy>0){o.vy=-o.vy*(o.type==='npc'?.18:o.type==='rock'?.32:.42);if(Math.abs(o.vy)<8)o.vy=0}o.vx*=Math.max(0,1-fr*dt*5);if(o.type==='npc'&&Math.abs(o.vy)<2)o.angle=0;else o.spin*=.97}
      if(o.x<rad){o.x=rad;o.vx=Math.abs(o.vx)*.6;o.dir=1}if(o.x>state.w-rad){o.x=state.w-rad;o.vx=-Math.abs(o.vx)*.6;o.dir=-1}
    }
    // Simple, stable horizontal contact response between props.
    for(let i=0;i<state.objects.length;i++)for(let j=i+1;j<state.objects.length;j++){
      const a=state.objects[i],b=state.objects[j],ra=a.type==='npc'?14:a.r,rb=b.type==='npc'?14:b.r,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=ra+rb;
      if(dist>0&&dist<min&&Math.abs(dy)<min*.76){const overlap=min-dist,nx=dx/dist;a.x-=nx*overlap*.5;b.x+=nx*overlap*.5;const rel=(b.vx-a.vx)*nx;if(rel<0){a.vx+=rel*nx*.45;b.vx-=rel*nx*.45}}
    }
  }
  function frame(t) {if(!state.w)size();const dt=Math.min(.04,state.last?(t-state.last)/1000:0);state.last=t;state.elapsed+=dt;if(!state.paused&&state.mode==='sandbox')physics(dt);draw(t);requestAnimationFrame(frame)}
  function startRound() {
    clearTimeout(state.timeout);state.active=true;state.signal='idle';state.round=0;state.score=0;state.streak=0;state.bestStreak=0;state.reactions=[];state.wrong=0;updateStats();
    ui.overlay.classList.add('hidden');ui.start.textContent='YENİDEN BAŞLAT';
    setTimeout(nextSignal,650+Math.random()*550);
  }
  function nextSignal() {
    if(!state.active)return;
    if(state.round>=10){finishGame();return}
    state.round++;state.signal=Math.random()<.72?'green':'red';state.signalAt=performance.now();updateStats();
    if(state.signal==='green'){beep(640,.08);state.timeout=setTimeout(()=>{if(state.signal==='green'){state.signal='idle';state.streak=0;state.score=Math.max(0,state.score-25);state.feedback='KAÇTI  −25';state.feedbackUntil=performance.now()+900;updateStats();state.timeout=setTimeout(nextSignal,750)}},1550)}
    else{beep(260,.12,'triangle');state.timeout=setTimeout(()=>{if(state.signal==='red'){state.signal='idle';state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);state.score+=40;state.feedback='GÜZEL BEKLEDİN  +40';state.feedbackUntil=performance.now()+850;updateStats();state.timeout=setTimeout(nextSignal,700)}},1050)}
  }
  function finishGame(){state.active=false;state.signal='idle';const avg=state.reactions.length?Math.round(state.reactions.reduce((a,b)=>a+b,0)/state.reactions.length):null;ui.overlay.classList.remove('hidden');ui.overlayContent.innerHTML=`<div class="target-rings"><span></span><span></span><span>${avg&&avg<300?'✦':'✓'}</span></div><p class="overlay-kicker">EĞİTİM TAMAMLANDI</p><h2>${avg&&avg<300?'Harika iş,':'Test tamam.'}<br>Skorun <span style="color:#76f0c3">${String(state.score).padStart(4,'0')}</span></h2><p class="overlay-hint">${avg?`Ortalama tepki: ${avg} ms · En iyi seri: ${state.bestStreak}`:'Sinyalleri kaçırma; tekrar dene.'}</p><button class="primary-btn" id="againBtn"><span>TEKRAR DENE</span><b>→</b></button>`;document.getElementById('againBtn').onclick=startRound;beep(720,.13);setTimeout(()=>beep(920,.16),130)}
  function updateStats(){ui.score.textContent=String(state.score).padStart(4,'0');ui.round.innerHTML=`${state.round} <i>/ 10</i>`;ui.streak.textContent=String(state.bestStreak);ui.reaction.innerHTML=`${state.reactions.length?Math.round(state.reactions.reduce((a,b)=>a+b,0)/state.reactions.length):'—'}<small> ms</small>`}
  function miss(text='ERKEN DOKUNUŞ  −50') {state.score=Math.max(0,state.score-50);state.streak=0;state.wrong++;state.signal='idle';clearTimeout(state.timeout);state.feedback=text;state.feedbackUntil=performance.now()+900;updateStats();beep(180,.18,'sawtooth');if(state.active)state.timeout=setTimeout(nextSignal,800)}
  function hitSignal() {
    if(!state.active)return;
    if(state.signal==='green'){const ms=Math.round(performance.now()-state.signalAt);state.reactions.push(ms);const points=Math.max(20,Math.round(150-ms*.18));state.score+=points;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);state.feedback=`${ms} ms  +${points}`;state.feedbackUntil=performance.now()+850;state.signal='idle';clearTimeout(state.timeout);updateStats();beep(850,.07);state.timeout=setTimeout(nextSignal,650)}
    else if(state.signal==='red')miss('YANLIŞ SİNYAL  −50');
    else if(state.signal==='idle')miss();
  }
  function setMode(mode) {
    state.active=false;clearTimeout(state.timeout);state.signal='idle';state.mode=mode;
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    const sandbox=mode==='sandbox';ui.reflexPanel.classList.toggle('hidden',sandbox);ui.sandboxPanel.classList.toggle('hidden',!sandbox);ui.overlay.classList.toggle('hidden',sandbox);
    ui.sceneTag.textContent=sandbox?'FİZİK LABORATUVARI':'REFLEKS POLİGONU';ui.caption.textContent=sandbox?'NESNE OLUŞTUR / FIRLAT':'TIKLA VEYA DOKUN';ui.panelTitle.textContent=sandbox?'Sandbox simülatörü':'Refleks testi';ui.hint.classList.toggle('hidden',!sandbox);
    if(sandbox&&state.objects.length===0){addNpcAt(state.w*.3);addNpcAt(state.w*.68)}
  }
  function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  canvas.addEventListener('pointerdown',e=>{
    if(state.mode==='reflex'){hitSignal();return}
    e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=canvasPoint(e);state.drag={...p,cx:p.x,cy:p.y};
  });
  canvas.addEventListener('pointermove',e=>{if(state.drag){const p=canvasPoint(e);state.drag.cx=p.x;state.drag.cy=p.y}});
  canvas.addEventListener('pointerup',e=>{if(!state.drag)return;const d=state.drag,p=canvasPoint(e),dx=d.x-p.x,dy=d.y-p.y,m=Math.hypot(dx,dy);let v=m>8?Math.min(m*1.15,260):((Math.random()-.5)*30);let vx=m>8?dx/m*v: v,vy=m>8?dy/m*v:-12;const y=Math.min(p.y,state.ground-20);spawn(state.selected,p.x,Math.min(y,state.ground-(state.selected==='rock'?18:22)),vx,vy);state.drag=null;beep(350,.05)});
  canvas.addEventListener('pointercancel',()=>state.drag=null);
  document.querySelectorAll('.mode-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  ui.start.addEventListener('click',startRound);
  document.querySelectorAll('.spawn-tool').forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.spawn;document.querySelectorAll('.spawn-tool').forEach(x=>x.classList.toggle('selected',x===b))}));
  ui.gravity.addEventListener('input',()=>{state.gravity=Number(ui.gravity.value);const v=state.gravity.toFixed(3);ui.gravityValue.textContent=v;ui.gravityCanvas.textContent=v;ui.gravity.style.setProperty('--fill',`${state.gravity/9.81*100}%`)});
  ui.friction.addEventListener('input',()=>{state.friction=Number(ui.friction.value);ui.frictionValue.textContent=state.friction.toFixed(2);ui.friction.style.setProperty('--fill',`${state.friction/.6*100}%`)});
  ui.addNpc.addEventListener('click',()=>addNpcAt(state.w*.15+Math.random()*state.w*.7));
  ui.pause.addEventListener('click',()=>{state.paused=!state.paused;ui.pause.innerHTML=state.paused?'▶ DEVAM ET':'Ⅱ DURAKLAT'});
  $('resetSandbox').addEventListener('click',()=>{state.objects=[];state.paused=false;ui.pause.innerHTML='Ⅱ DURAKLAT';addNpcAt(state.w*.3);addNpcAt(state.w*.68);state.feedback='SAHNE SIFIRLANDI';state.feedbackUntil=performance.now()+1000});
  ui.sound.addEventListener('click',()=>{state.sound=!state.sound;ui.sound.classList.toggle('muted',!state.sound);ui.sound.querySelector('span').textContent=state.sound?'SES AÇIK':'SES KAPALI';if(state.sound)beep()});
  window.addEventListener('keydown',e=>{if(state.mode==='reflex'&&state.active&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();hitSignal()}if(state.mode==='sandbox'&&e.key==='Escape'){state.drag=null}});
  window.addEventListener('resize',size);size();ui.gravity.style.setProperty('--fill',`${state.gravity/9.81*100}%`);ui.friction.style.setProperty('--fill',`${state.friction/.6*100}%`);
  setInterval(()=>{const d=new Date();$('simClock').textContent=[d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(x=>String(x).padStart(2,'0')).join(':')},1000);
  requestAnimationFrame(frame);
})();
