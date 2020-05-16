let screenSize = V2(1,1);
Q.resize = s=>{ screenSize = s; };

const L = Log();

const Inst = (_=>{
  const X = new AudioContext();
  const out = X.createGain();
  out.gain.value = 0.5;
  const reverb = X.createConvolver();
  function clampValue(t0,t1,x) {
    function value(x) {
      const x2 = x*x;
      const a = t0+t1-2;
      const b = -2*t0-t1+3;
      const c = t0;
      return a*x*x2 + b*x2 + c*x;
    }
    return Math.min(1,Math.max(0,value(Math.min(1,Math.max(0,x)))));
  }
  reverb.buffer = (_=>{
    const buffer = X.createBuffer(2, X.sampleRate*5, X.sampleRate);
    const b0 = buffer.getChannelData(0);
    const b1 = buffer.getChannelData(1);
    for(let i=0;i<b0.length;i++) {
      let v = clampValue(-0.1, 4.45, 1 - i/(b0.length/5)) + Math.exp(-i*0.00002) * 0.3 * (1 - i/b0.length);
      const a = Math.random() * 2 * Math.PI + Math.PI / 4;
      b0[i] = v * Math.cos(a);
      b1[i] = v * Math.sin(a);
    }
    return buffer;
  })();
  const analyser = X.createAnalyser();
  const waveFreqs = new Float32Array(4096);
  analyser.fftSize = waveFreqs.length*2;
  const comp = X.createDynamicsCompressor();
  out.connect(reverb).connect(analyser).connect(comp).connect(X.destination);

  const soundWave = (_=>{
    const baseFrequency = 440;
    const vf = Math.log2(baseFrequency);
    const multiplier = 1;
    const maxFreq = 1000; // X.sampleRate*multiplier;
    const buffer = new Float32Array(maxFreq), iBuffer = new Float32Array(maxFreq);
    for(let i=1;i<maxFreq;i++) {
      const va = Math.log2(i/multiplier);
      let dif = va - vf;
      const eFac = clampValue(-3, 7, 1 - dif/8); // Envelope

      const fDist = Math.abs(dif - Math.floor(dif + 0.5)); // Log
      const fFac = clampValue(-3, 7, 1 - fDist*12);
      dif = Math.pow(2, dif);
      const uDist = Math.abs(dif - Math.floor(dif + 0.5)); // Ratio
      const uFac = clampValue(-3, 7, 1 - uDist*8);
      let v = (fFac + uFac) * eFac;
      if(va < vf - 0.5) v = 0;
      v /= multiplier;
      const ra = Math.random() * 2 * Math.PI;
      buffer[i] = v * Math.cos(ra);
      iBuffer[i] = v * Math.sin(ra);
    }
    return X.createPeriodicWave(buffer, iBuffer);
  })();
  let baseDetune = 0, baseSound = 0;
  function lerp(a,b,x) {
    return a*(1-x) + b*x;
  }
  function createOsc(b) {
    const o1 = X.createOscillator();
    o1.setPeriodicWave(soundWave);
    o1.frequency.value = 1;
    o1.detune.value = 1200 * (b + baseDetune);
    const o2 = X.createOscillator();
    o2.setPeriodicWave(soundWave);
    o2.frequency.value = 2;
    o2.detune.value = 1200 * (b + baseDetune);
    const g2 = X.createGain();
    g2.gain.value = lerp(0, 0.3, baseSound);
    const o3 = X.createOscillator();
    o3.setPeriodicWave(soundWave);
    o3.frequency.value = 0.5;
    o3.detune.value = 1200 * (b + baseDetune);
    const g3 = X.createGain();
    g3.gain.value = lerp(0, 1, baseSound);
    const lpf = X.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 24000;
    lpf.detune.value = 1200 * (b + baseDetune);

    const a = X.createGain();
    a.gain.value = 0;
    const d = X.createGain();
    d.gain.value = 1;
    const r = X.createGain();
    lpf.connect(a).connect(d).connect(r).connect(out);
    o1.connect(lpf);
    o2.connect(g2).connect(lpf);
    o3.connect(g3).connect(lpf);
    o1.start();
    o2.start();
    o3.start();
    let status = 0, press = false;
    return {
      attack: v=>{
        const t = X.currentTime;
        a.gain.setTargetAtTime(0, t, 0.001);
        a.gain.setTargetAtTime(Math.pow(v,2)*0.8+0.2, t+0.001, lerp(0.1, 0.0001, baseSound));
        d.gain.setTargetAtTime(1, t, 0.001);
        d.gain.setTargetAtTime(lerp(0.4, 0.1, baseSound), t+lerp(0.01, 0.05, baseSound), lerp(0.2, 0.05+Math.pow(v,2)*0.15, baseSound));
        r.gain.setTargetAtTime(1, t, 0.001);
        lpf.frequency.setTargetAtTime(24000, t, 0.001);
        lpf.frequency.setTargetAtTime(lerp(24000, 330, baseSound), t+0.01, 0.005);
        press = true;
      },
      release: _=>{
        const t = X.currentTime;
        r.gain.setTargetAtTime(0, t, 0.1);
        press = false;
      },
      gain: _=>{
        return Math.pow(a.gain.value * d.gain.value * r.gain.value * (1 + g2.gain.value + g3.gain.value) / 2, 0.5);
      },
      status: _=>{
        status += ((press?1:0) - status) / 2.0;
        return status;
      },
      tune: _=>{
        o1.detune.setTargetAtTime(1200 * (b + baseDetune), X.currentTime, 0.001);
        o2.detune.setTargetAtTime(1200 * (b + baseDetune), X.currentTime, 0.001);
        o3.detune.setTargetAtTime(1200 * (b + baseDetune), X.currentTime, 0.001);
        g2.gain.value = lerp(0, 0.3, baseSound);
        g3.gain.value = lerp(0, 1, baseSound);
        lpf.detune.value = 1200 * (b + baseDetune);
      }
    };
  }
  const a = {};
  const os = {};
  a.setDetune = b=>{
    baseDetune = b;
    Object.keys(os).forEach(p=>{
      os[p].tune();
    });
  };
  a.setSound = b=>{
    baseSound = b;
    Object.keys(os).forEach(p=>{
      os[p].tune();
    });
  }
  a.detuneValue = _=>{
    return baseDetune;
  };
  a.soundValue = _=>{
    return baseSound;
  };
  a.noteOn = (p,v)=>{
    if(os[p] == null) {
      os[p] = createOsc(
        Math.floor(p/2)*Math.log2(3)
         + (p%2)*(Math.log2(5)-Math.log2(3)-1)
         - Math.floor(p/4)*3
         - (Math.floor(p/2)%2 == 1 ? 2 : 0)
       );
    }
    os[p].attack(v);
  };
  a.noteOff = p=>{
    os[p].release();
  };
  a.gain = p=>{
    if(os[p] == null) return 0;
    return os[p].gain();
  };
  a.status = p=>{
    if(os[p] == null) return 0;
    return os[p].status();
  };
  a.render = _=>{
    analyser.getFloatFrequencyData(waveFreqs);
    return waveFreqs;
  };
  return a;
})();

let R = null;

let logTimer = null;
function SetLogTimer() {
  if(logTimer) clearTimeout(logTimer);
  logTimer = setTimeout(_=>{
    L.add("Sound: " + Math.floor(Inst.soundValue()*100) + "%");
    L.add("Detune: " + Math.floor(Inst.detuneValue()*100)/100);
  },100);
}

Q.midi = d=>{
  if(d.length != 3) {
    console.log(d);
  }
  if(d[0] == 0x90) Inst.noteOn((d[1]-4)%16, d[2]/127);
  if(d[0] == 0x80) Inst.noteOff((d[1]-4)%16);
  if(d[0] == 0xB0) {
    if(d[1] == 0x02) {
      Inst.setSound(d[2]/127);
      SetLogTimer();
    }
    if(d[1] == 0x01) {
      Inst.setDetune((d[2]/127-0.5)*4);
      SetLogTimer();
    }
  }
};

Q.mouse = (e,p,b)=>{};

Q.key = (e,k)=>{};

Q.render = X=>{
  R = Renderer(X);
  X.lineCap = "butt";
  X.lineJoin = "miter";
  R.rect(0,0,screenSize.x,screenSize.y).fill(0,0,0.1);

  R.translate(screenSize.x/2, screenSize.y/2).scale(screenSize.y/2*0.7).with(_=>{
    R.line(-1.2,-1.1,1.2,-1.1).stroke(0,0,0.2,0.02);
    R.line(-1.2,+1.1,1.2,+1.1).stroke(0,0,0.2,0.02);
    let dx;
    dx = Inst.detuneValue()*1.1*0.5;
    R.line(dx,-1.15,dx,-1.05).stroke(0,0,0.5,0.015);
    dx = (Inst.soundValue()*2-1)*1.1;
    R.line(dx,+1.15,dx,+1.05).stroke(0,0,0.5,0.015);
    for(let i=0;i<8;i++) {
      for(let j=1;j<5;j++) {
        if(j == 1 && i < 4 || j == 4 && i >= 4) continue;
        const x = i - 3.5, y = 2.5 - j;
        let index = (i+Math.max(2,Math.min(3,j)))%2 == 1 ? 2 : 1;
        const c = [0.08,0.1,0.15,0.25];
        R.rect(x*0.4-0.1,y*0.4-0.1,0.2,0.2).stroke(0,0,c[index],0.03);
      }
    }
  });
  R.translate(0,screenSize.y).with(_=>{
    L.render(R);
  });

  const wave = Inst.render();
  R.shape(_=>{
    const le = wave.length;
    for(let i=0;i<le;i++) {
      const x = i*screenSize.x/le;
      const y = screenSize.y/2-wave[i];
      if(i == 0) X.moveTo(x,y);
      else X.lineTo(x,y);
    }
  }).stroke(0,0,0.3,2);

  R.translate(screenSize.x/2, screenSize.y/2).scale(screenSize.y/2*0.7).with(_=>{
    for(let i=0;i<8;i++) {
      for(let j=1;j<5;j++) {
        let p = i*2 + j%2;
        if(j == 1) p += 7;
        if(j == 4) p -= 7;
        p = (p%16 + 16) % 16;
        if(j == 1 && i < 4 || j == 4 && i >= 4) continue;
        let pitch = Math.floor(p/2)*Math.log2(3) + (p%2)*(Math.log2(5)-Math.log2(3));
        const x = i - 3.5, y = 2.5 - j;
        function r(i,o,s,v) {
          if(i < 0) i = 0;
          const scale = 0.32, u = (i+o)/2*scale;
          R.rect(x*0.4-u/2,y*0.4-u/2,u,u).stroke(pitch,s,v,(o-i)*scale/2);
        }
        r(1,1.1,1,0.5);
        const g = Inst.gain(p);
        r(g-0.2,g,1,1);
        const s = Inst.status(p);
        if(s > 0.01) r(1-s*0.1,1,0.5,1);
      }
    }
  });
};
