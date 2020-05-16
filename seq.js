let screenSize = V2(1,1);
Q.resize = s=>{ screenSize = s; };

const L = Log();
let R = null;

const Audio = (_=>{
  const X = new AudioContext();
  const out = X.createGain();
  out.gain.value = 1;
  const reverb = X.createConvolver();
  reverb.buffer = (_=>{
    const buffer = X.createBuffer(2, X.sampleRate*5, X.sampleRate);
    const b0 = buffer.getChannelData(0);
    const b1 = buffer.getChannelData(1);
    for(let i=0;i<b0.length;i++) {
      let v = Math.exp(-i/b0.length*90.0) * 0.3 * (1 - i/b0.length);
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
  const master = X.createGain();
  master.gain.value = 0.4;
  out.connect(analyser).connect(reverb).connect(comp).connect(master).connect(X.destination);

  const a = {};
  a.wave = _=>{
    analyser.getFloatFrequencyData(waveFreqs);
    return waveFreqs;
  };
  const nodes = [];
  a.add = n=>{
    n.connect(out);
    nodes.push(n);
  };
  a.X = X;

  return a;
})();

const Sound = (baseFreq)=>{
  const X = Audio.X;

  const o = X.createOscillator();
  o.frequency.value = 880/3 * baseFreq;
  const g = X.createGain();
  g.gain.value = 0;
  o.connect(g);
  o.start();

  const eQ = [];
  const s = {};
  s.hue = - Math.log2(baseFreq) + 0.77;
  s.noteOn = (v,d)=>{
    g.gain.setTargetAtTime(v, d, 0.01);
    eQ.push({ time:d, press:true });
  };
  s.noteOff = d=>{
    g.gain.setTargetAtTime(0, d, 0.1);
    eQ.push({ time:d, press:false });
  };
  s.clear = _=>{
    g.gain.cancelScheduledValues(Audio.X.currentTime);
    g.gain.setTargetAtTime(0, Audio.X.currentTime, 0.1);
  };
  let press = 0, pressTarget = 0;
  s.status = _=>{
    let nearestTime = -1;
    eQ.forEach(e=>{
      if(e.time < Audio.X.currentTime && nearestTime <= e.time) {
        nearestTime = e.time;
        pressTarget = e.press ? 1 : 0;
      }
    });
    for(let i=0;i<eQ.length;i++) {
      if(eQ[i].time <= nearestTime) {
        eQ.splice(i,1);
        i--;
      }
    }
    press += (pressTarget - press) / 2.0;
    return { press: press, gain: g.gain.value };
  };
  s.output = g;
  return s;
};

const tempo = 116, beat = 60/tempo;
const Inst = _=>{
  const u = {};
  let durLog = Math.floor(Math.random()*4)-1;
  let dur = Math.pow(2,durLog+2);
  let durText = durLog == 0 ? "0" : durLog > 0 ? "+" + durLog : durLog;
  let score = [];
  const sounds = [];
  const freqTable = [1, 3/2, 9/8, 27/16, 6/5, 9/5, 27/20, 81/40];
  for(let i=0;i<8;i++) {
    const s = Sound(freqTable[i]);
    Audio.add(s.output);
    sounds.push(s);
  }
  let lastTime = 0;
  u.tick = _=>{
    if(score.length == 0) return;
    const curTime = Audio.X.currentTime / beat + dur / 8 + 0.001;
    lastTime = Math.max(lastTime, curTime - dur / 8);
    // Play sounds from lastTime to curTime
    const base = Math.floor(lastTime / dur) * dur;
    score.forEach(n=>{
      const s = sounds[n.i];
      let t = base + n.t;
      if(t < lastTime) t += dur;
      if(lastTime <= t && t < curTime) {
        s.noteOn(n.v, t * beat);
        s.noteOff((t + n.d) * beat);
      }
    });
    lastTime = curTime;
  };
  let waitNotes = [];
  u.noteOn = (i,v)=>{
    const s = sounds[i];
    const t = Audio.X.currentTime;
    s.noteOn(v, t);
    waitNotes.push({ i, v, t });
  };
  u.noteOff = i=>{
    const s = sounds[i];
    const endT = Audio.X.currentTime;
    s.noteOff(endT);
    for(let j=0;j<waitNotes.length;j++) {
      if(waitNotes[j].i == i) {
        const d = (endT - waitNotes[j].t) / beat;
        let t = waitNotes[j].t / beat % dur;
        t = Math.floor(t / dur * 16 + 0.5) % 16 * dur / 16;
        const v = waitNotes[j].v;
        score.push({ i, v, d, t });
        waitNotes.splice(j, 1);
        j--;
      }
    }
  };
  u.render = _=>{
    R.translate(-1.4,0).with(_=>{
      for(let i=0;i<8;i++) {
        const x = i%4, y = Math.floor(i/4);
        const s = sounds[i];
        R.scale(0.2).translate(x,y-0.5).scale(0.85).with(_=>{
          R.rect(-0.5,-0.5,1,1).stroke(s.hue,1,0.5,0.05);
          const stat = s.status();
          if(stat.press > 0.01) {
            const w = 0.03 * stat.press;
            const e = 0.5-0.05/2-w;
            R.rect(-e,-e,e*2,e*2).stroke(s.hue,0.5,1,w*2);
          }
          let v = stat.gain * 0.35 - 0.05;
          if(v > 0.001) {
            if(v>0.1) R.rect(-v,-v,v*2,v*2).stroke(s.hue,1,1,0.1);
            else {
              v += 0.05;
              R.rect(-v,-v,v*2,v*2).fill(s.hue,1,1);
            }
          }
        });
      }
      R.translate(-0.4,0).with(_=>{
        R.circle(0,0,0.2).stroke(0,0,0.5,0.01);
      });
    });
    R.text(durText,-0.3,0.095,0.25).r().fill(0,0,0.8);
    R.translate(-0.2,0).scale(0.55).with(_=>{
      R.line(0,0,4,0).stroke(0,0,0.3,0.015);
      R.line(0,-0.2,0,0.2).stroke(0,0,0.5,0.02);
      R.line(1,-0.08,1,0.08).stroke(0,0,0.3,0.02);
      R.line(2,-0.1,2,0.1).stroke(0,0,0.4,0.02);
      R.line(3,-0.08,3,0.08).stroke(0,0,0.3,0.02);
      R.line(4,-0.2,4,0.2).stroke(0,0,0.5,0.02);
      const beat = 60/tempo;
      const t = ((Audio.X.currentTime / beat) % dur) / dur * 4;
      R.line(t,-0.15,t,0.15).stroke(0,0,0.8,0.02);
      score.forEach(s=>{
        const r = 0.1;
        R.translate(s.t/dur*4,0).with(_=>{
          const v = s.v;
          R.shape(_=>{
            R.X.moveTo(0,0);
            R.X.lineTo(0.04,0.1*v);
            R.X.lineTo(s.d/dur*4.0,0);
            R.X.lineTo(0.04,-0.1*v);
            R.X.closePath();
          }).stroke(sounds[s.i].hue,1,1);
        });
      });
    });
  };
  return u;
};
const insts = [];
for(let i=0;i<4;i++) insts.push(Inst());

const Input = (_=>{
  const input = {};
  const padPress = [];
  for(let i=0;i<16;i++) padPress.push({ val:0, target:0 });
  const noteIndex = [4,0,5,1,6,2,7,3];
  input.padDown = (i,v)=>{
    padPress[i].target = 1;
    if(i < 8) insts[0].noteOn(noteIndex[i], v);
  };
  input.padUp = i=>{
    padPress[i].target = 0;
    if(i < 8) insts[0].noteOff(noteIndex[i]);
  };
  input.touchX = x=>{

  };
  input.touchY = y=>{

  };
  input.touchDown = _=>{

  };
  input.touchUp = _=>{

  };
  input.render = _=>{
    for(let i=0;i<16;i++) {
      const pp = padPress[i];
      pp.val += (pp.target - pp.val) / 2.0;
      const x = Math.floor(i/2), y = i%2;
      R.scale(0.2).translate(x-3.5,0.5-y).scale(0.85).with(_=>{
        R.rect(-0.5,-0.5,1,1).stroke(1,0,0.5,0.05);
        if(pp.val > 0.01) {
          const w = 0.03 * pp.val;
          const e = 0.5-0.05/2-w;
          R.rect(-e,-e,e*2,e*2).stroke(0,0,1,w*2);
        }
      });
    }
  };
  return input;
})();

Q.midi = d=>{
  if(d.length != 3) console.log(d);
  if(d[0] == 0x90) Input.padDown((d[1]-4)%16, d[2]/127);
  if(d[0] == 0x80) Input.padUp((d[1]-4)%16);
  if(d[0] == 0xB0) {
    if(d[1] == 0x01) Input.touchX(d[2]/127);
    if(d[1] == 0x02) Input.touchY(d[2]/127);
    if(d[1] == 0x10) {
      if(d[2] == 0x7f) Input.touchDown();
      if(d[2] == 0x00) Input.touchUp();
    }
  }
};

Q.mouse = (e,p,b)=>{};

Q.key = (e,k)=>{};

Q.render = X=>{
  for(let i=0;i<insts.length;i++) {
    const u = insts[i];
    u.tick();
  }
  R = Renderer(X);
  X.lineCap = "butt";
  X.lineJoin = "miter";
  R.rect(0,0,screenSize.x,screenSize.y).fill(0,0,0.1);

  R.translate(0,screenSize.y).with(_=>{
    L.render(R);
  });

  const wave = Audio.wave();
  R.shape(_=>{
    const le = wave.length/4;
    for(let i=0;i<le;i++) {
      const x = i*screenSize.x/le;
      const y = screenSize.y/2-wave[i];
      if(i == 0) X.moveTo(x,y);
      else X.lineTo(x,y);
    }
  }).stroke(0,0,0.2,2);

  R.translate(screenSize.x/2, screenSize.y/2).scale(screenSize.x*0.2).with(_=>{
    for(let i=0;i<insts.length;i++) {
      R.translate(0,-1.0+i*0.45).with(_=>{
        insts[i].render();
      });
    }
    R.translate(0,0.95).scale(1.3).with(_=>{
      Input.render();
    });
  });
};
