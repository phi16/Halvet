let screenSize = V2(1,1);
Q.resize = s=>{ screenSize = s; };

const Inst = (_=>{
  const X = new AudioContext();
  const out = X.createGain();
  out.gain.value = 0.2;
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
    const buffer = X.createBuffer(2, X.sampleRate, X.sampleRate);
    const b0 = buffer.getChannelData(0);
    const b1 = buffer.getChannelData(1);
    for(let i=0;i<b0.length;i++) {
      let v = clampValue(-0.1, 4.45, 1 - i/b0.length);
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
  function createOsc(b) {
    const o = X.createOscillator();
    o.setPeriodicWave(soundWave);
    o.frequency.value = 1;
    o.detune.value = 1200 * b;
    const a = X.createGain();
    a.gain.value = 0;
    const d = X.createGain();
    d.gain.value = 1;
    const r = X.createGain();
    o.connect(a).connect(d).connect(r).connect(out);
    o.start();
    let status = 0, press = false;
    return {
      attack: v=>{
        const t = X.currentTime;
        a.gain.setTargetAtTime(0, t, 0.001);
        a.gain.setTargetAtTime(Math.pow(v,2)*0.8+0.2, t+0.001, 0.1);
        d.gain.setTargetAtTime(1, t, 0.001);
        d.gain.setTargetAtTime(0.4, t+0.01, 0.2);
        r.gain.setTargetAtTime(1, t, 0.001);
        press = true;
      },
      release: _=>{
        const t = X.currentTime;
        r.gain.setTargetAtTime(0, t, 0.1);
        press = false;
      },
      gain: _=>{
        return a.gain.value * d.gain.value * r.gain.value;
      },
      status: _=>{
        status += ((press?1:0) - status) / 2.0;
        return status;
      }
    };
  }
  const a = {};
  const os = {};
  const octave = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  a.noteOn = (p,v)=>{
    if(os[p] == null) {
      os[p] = createOsc(
        Math.floor(p/2)*Math.log2(3)
         + (p%2)*(Math.log2(5)-2)
         - Math.floor(p/4)*3
         - (Math.floor(p/2)%2 == 1 ? 1 : 0)
         - (p%4 == 3 ? 1 : 0)
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

Q.midi = d=>{
  if(d[0] == 0x90) Inst.noteOn((d[1]-4)%16, d[2]/128);
  if(d[0] == 0x80) Inst.noteOff((d[1]-4)%16);
};

Q.mouse = (e,p,b)=>{};

Q.key = (e,k)=>{};

Q.render = X=>{
  R = Renderer(X);
  X.lineCap = "butt";
  X.lineJoin = "miter";
  R.rect(0,0,screenSize.x,screenSize.y).fill(0,0,0.1);

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

  R.translate(screenSize.x/2, screenSize.y/2).scale(screenSize.y/2*0.8).with(_=>{
    for(let i=0;i<8;i++) {
      for(let j=1;j<5;j++) {
        let p = i*2 + j%2;
        if(j == 1) p += 7;
        if(j == 4) p -= 7;
        p = (p%16 + 16) % 16;
        if(j == 1 && i < 4 || j == 4 && i >= 4) continue;
        let pitch = Math.floor(p/2)*Math.log2(3) + (p%2)*Math.log2(5);
        const x = i - 3.5, y = 2.5 - j;
        if((i+Math.max(2,Math.min(3,j)))%2 == 1) {
          R.rect(x*0.4-0.1,y*0.4-0.1,0.2,0.2).fill(0,0,0.15);
        }
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
