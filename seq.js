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
  master.gain.value = 0.1;
  out.connect(analyser).connect(reverb).connect(comp).connect(master).connect(X.destination);

  const a = {};
  a.wave = _=>{
    analyser.getFloatFrequencyData(waveFreqs);
    return waveFreqs;
  };
  const nodes = [];
  a.add = n=>{
    // n should be GainNode
    n.connect(out);
    nodes.push(n);
  };
  a.fadeOut = n=>{
    n.gain.linearRampToValueAtTime(0, X.currentTime+0.5);
    setTimeout(_=>{
      for(let i=0;i<nodes.length;i++) {
        if(nodes[i] == n) {
          nodes.splice(i,1);
          break;
        }
      }
      n.disconnect();
    },1000);
  };
  a.X = X;

  return a;
})();

let tempo = 135, beat = 60/tempo, timeShift = 0;
let pitchShift = 0, pitchShiftAnim = 0;

const PureGen = {
  create: freq=>{
    const o = Audio.X.createOscillator();
    o.frequency.value = freq;
    o.start();
    return {
      output: o,
      attack: d=>{},
      sound: (x,y)=>{},
      detune: ps=>{
        o.detune.setTargetAtTime(ps*100, Audio.X.currentTime, 0.01);
      }
    }
  },
  icon: v=>{
    R.circle(0,0,0.2).stroke(0,0,0.5,0.02+v*0.04);
  }
};
const PercussGen = {
  create: freq=>{ // TODO...
    const o = Audio.X.createOscillator();
    o.frequency.value = freq;
    o.start();
    return {
      output: o,
      attack: d=>{},
      sound: (x,y)=>{},
      detune: ps=>{
        o.detune.setTargetAtTime(ps*100, Audio.X.currentTime, 0.01);
      }
    }
  },
  icon: v=>{
    R.shape(_=>{
      R.X.moveTo(-0.2,-0.2);
      R.X.lineTo(0,0.2);
      R.X.lineTo(0.2,-0.2);
      R.X.moveTo(0,-0.2);
      R.X.lineTo(0,0.2);
    }).stroke(0,0,0.5,0.02+v*0.04);
  }
};
const HolyGen = (_=>{
  const X = Audio.X;
  const baseFrequency = 440;
  const soundWave = (_=>{
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
  return {
    create: freq=>{
      const o1 = X.createOscillator();
      o1.setPeriodicWave(soundWave);
      o1.frequency.value = freq/baseFrequency;
      const o2 = X.createOscillator();
      o2.setPeriodicWave(soundWave);
      o2.frequency.value = freq*2/baseFrequency;
      const g2 = X.createGain();
      g2.gain.value = 0.15;
      const o3 = X.createOscillator();
      o3.setPeriodicWave(soundWave);
      o3.frequency.value = freq*0.5/baseFrequency;
      const g3 = X.createGain();
      g3.gain.value = 0.5;
      const lpf = X.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 24000;
      o1.connect(lpf);
      o2.connect(g2).connect(lpf);
      o3.connect(g3).connect(lpf);
      o1.start();
      o2.start();
      o3.start();
      let attackTarget = freq*16;
      return {
        output: lpf,
        attack: d=>{
          lpf.frequency.setTargetAtTime(freq*16, d, 0.001);
          lpf.frequency.setTargetAtTime(attackTarget, d+0.01, 0.01);
        },
        sound: (x,y)=>{
          g2.gain.setTargetAtTime(0.3*y, X.currentTime, 0.01);
          g3.gain.setTargetAtTime(1*y, X.currentTime, 0.01);
          attackTarget = freq * Math.pow(2, x*4);
        },
        detune: ps=>{
          o1.detune.setTargetAtTime(ps*100, X.currentTime, 0.01);
          o2.detune.setTargetAtTime(ps*100, X.currentTime, 0.01);
          o3.detune.setTargetAtTime(ps*100, X.currentTime, 0.01);
          lpf.detune.setTargetAtTime(ps*100, X.currentTime, 0.01);
        }
      }
    },
    icon: v=>{
      R.shape(_=>{
        R.X.moveTo(0.15,-0.2);
        R.X.lineTo(-0.15,0.2);
        R.X.lineTo(0.15,0.2);
        R.X.lineTo(-0.15,-0.2);
        R.X.closePath();
      }).stroke(0,0,0.5,0.02+v*0.04);
    }
  };
})();
const FMGen = {
  create: freq=>{
    const m = Audio.X.createOscillator();
    m.frequency.value = freq*4.25;
    m.start();
    const mg = Audio.X.createGain();
    mg.gain.value = freq;
    m.connect(mg);
    const o = Audio.X.createOscillator();
    o.frequency.value = freq;
    mg.connect(o.frequency);
    o.start();
    return {
      output: o,
      attack: d=>{},
      sound: (x,y)=>{
        m.frequency.setTargetAtTime(freq*(0.5+x*7.5), Audio.X.currentTime, 0.01);
        mg.gain.setTargetAtTime(freq*Math.pow(2,y*4-2), Audio.X.currentTime, 0.01);
      },
      detune: ps=>{
        m.detune.setTargetAtTime(ps*100, Audio.X.currentTime, 0.01);
        o.detune.setTargetAtTime(ps*100, Audio.X.currentTime, 0.01);
      }
    }
  },
  icon: v=>{
    R.shape(_=>{
      R.X.moveTo(-0.2,-0.2);
      R.X.lineTo(-0.2,0.2);
      R.X.lineTo(0.2,-0.2);
      R.X.lineTo(0.2,0.2);
    }).stroke(0,0,0.5,0.02+v*0.04);
  }
};
const Generators = [
    PercussGen, PureGen,
    HolyGen, FMGen,
    PureGen, PureGen,
    PureGen, PureGen
];

const Sound = (Gen, baseFreq, hueShift)=>{
  const X = Audio.X;

  const o = Gen.create(880/3 * baseFreq);
  const g = X.createGain();
  g.gain.value = 0;
  const decay = X.createGain();
  decay.gain.value = 1;
  o.output.connect(decay).connect(g);

  const eQ = [];
  const s = {};
  s.hue = - Math.log2(baseFreq)*0.3 + 0.68 + hueShift;
  let attack = 0.01, sustain = 1, release = 0.1;
  s.noteOn = (v,d)=>{
    o.attack(d);
    g.gain.setTargetAtTime(v, d, attack);
    decay.gain.setTargetAtTime(1, d, 0.001);
    decay.gain.setTargetAtTime(sustain, d+0.001, release*0.5);
    eQ.push({ time:d, press:true });
  };
  s.noteOff = d=>{
    g.gain.setTargetAtTime(0, d, release);
    eQ.push({ time:d, press:false });
  };
  s.clear = _=>{
    g.gain.cancelScheduledValues(X.currentTime);
    g.gain.setTargetAtTime(0, X.currentTime, 0.1);
  };
  s.setASR = (a,s,r)=>{
    attack = Math.pow(a,2)*0.5+0.001;
    sustain = s;
    release = Math.pow(r,2)*0.5+0.001;
  };
  s.setSound = (x,y)=>{
    o.sound(x*0.5+0.5,y*0.5+0.5);
  };
  s.setPitchShift = _=>{
    o.detune(pitchShift);
  };
  let press = 0, pressTarget = 0;
  s.status = _=>{
    let nearestTime = -1;
    eQ.forEach(e=>{
      if(e.time < X.currentTime && nearestTime <= e.time) {
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

const Inst = instIndex=>{
  const u = {};
  let durLog = 0;
  let dur = Math.pow(2,durLog+2);
  let durText = durLog == 0 ? "0" : durLog > 0 ? "+" + durLog : durLog, durAnim = 0;
  let quant = 16;
  let score = [];
  let sounds = [];
  const freqTable = [1, 3/2, 9/8, 27/16, 6/5, 9/5, 27/20, 81/40];

  let record = true, recordAnim = 0;
  let mute = false, muteAnim = 0;
  let soundX = 0, soundXAnim = 0, soundY = 0, soundYAnim = 0;
  let volume = 0.5, volumeAnim = 0.5;
  let release = 0.44, releaseAnim = 0.44;
  let attack = 0.13, attackAnim = 0.13;
  let sustain = 1, sustainAnim = 1;

  let gain = null;
  let generator = PureGen;
  u.changeGen = gen=>{
    generator = gen;

    if(gain) Audio.fadeOut(gain);
    gain = Audio.X.createGain();
    gain.gain.setTargetAtTime(volume*2, Audio.X.currentTime, 0.01);
    sounds = [];
    Audio.add(gain);
    for(let i=0;i<24;i++) {
      const s = Sound(generator, freqTable[i%8] * Math.pow(2, Math.floor(i/8)-1), instIndex*0.25);
      s.setSound(soundX, soundY);
      s.output.connect(gain);
      sounds.push(s);
    }
  };
  u.changeGen(generator);

  let lastTime = 0;
  u.tick = _=>{
    if(score.length == 0) return;
    const curTime = Audio.X.currentTime / beat + dur / 8 + 0.001;
    lastTime = Math.max(lastTime, curTime - dur / 8);
    // Play sounds from lastTime to curTime
    const base = Math.floor(lastTime / dur) * dur;
    score.forEach(n=>{
      const s = sounds[n.i];
      if(n.t >= dur) return;
      let t = (Math.floor(n.t / dur * quant + 0.5) % quant * dur / quant + dur - timeShift) % dur;
      t += base;
      if(t < lastTime) t += dur;
      if(lastTime <= t && t < curTime && !mute) {
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
    if(!mute) s.noteOn(v, t);
    if(record) waitNotes.push({ i, v, t });
  };
  u.noteOff = i=>{
    const s = sounds[i];
    const endT = Audio.X.currentTime;
    s.noteOff(endT);
    for(let j=0;j<waitNotes.length;j++) {
      if(waitNotes[j].i == i) {
        const d = (endT - waitNotes[j].t) / beat;
        const t = (waitNotes[j].t / beat + dur + timeShift) % dur;
        const v = waitNotes[j].v;
        score.push({ i, v, d, t });
        waitNotes.splice(j, 1);
        j--;
      }
    }
  };
  u.clear = _=>{
    score = [];
    for(let i=0;i<sounds.length;i++) sounds[i].clear();
  };
  u.duration = _=>{
    return dur;
  };
  u.setRelease = v=>{
    release = v;
    for(let i=0;i<16;i++) sounds[i].setASR(attack, sustain, release);
  };
  u.setVolume = v=>{
    volume = v;
    gain.gain.setTargetAtTime(v*2, Audio.X.currentTime, 0.01);
  };
  u.setAttack = v=>{
    attack = v;
    for(let i=0;i<16;i++) sounds[i].setASR(attack, sustain, release);
  };
  u.setSustain = v=>{
    sustain = v;
    for(let i=0;i<16;i++) sounds[i].setASR(attack, sustain, release);
  };
  u.setSoundX = v=>{
    soundX = v;
    for(let i=0;i<16;i++) sounds[i].setSound(soundX, soundY);
  };
  u.setSoundY = v=>{
    soundY = v;
    for(let i=0;i<16;i++) sounds[i].setSound(soundX, soundY);
  };
  u.toggleRecord = _=>{
    record = !record;
    waitNotes = [];
  };
  u.toggleMute = _=>{
    mute = !mute;
    if(mute) {
      for(let i=0;i<sounds.length;i++) sounds[i].clear();
    } else {
      const curTime = Audio.X.currentTime / beat + dur / 8 + 0.001;
      lastTime = curTime - dur / 8 - dur / 16;
    }
  };
  u.changeDuration = dd=>{
    durLog += dd;
    dur = Math.pow(2, durLog+2);
    durText = durLog == 0 ? "0" : durLog > 0 ? "+" + durLog : durLog;
    durAnim = 1;
    // TODO
  };
  u.setPitchShift = _=>{
    for(let i=0;i<16;i++) sounds[i].setPitchShift(0);
  };
  u.render = _=>{
    R.translate(-1.4,0).with(_=>{
      for(let i=0;i<8;i++) {
        const x = i%4, y = Math.floor(i/4);
        const s = sounds[i+8];
        R.scale(0.2).translate(x,y-0.5).scale(0.85).with(_=>{
          R.rect(-0.5,-0.5,1,1).stroke(s.hue,1,0.5,0.05);
          if(i%2 == 1) R.rect(-0.25,-0.25,0.5,0.5).stroke(s.hue,0.5,0.2,0.15);
        });
      }
      for(let i=0;i<sounds.length;i++) {
        const x = i%4, y = Math.floor(i%8/4);
        const s = sounds[i];
        R.scale(0.2).translate(x,y-0.5).scale(0.85).with(_=>{
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
      R.translate(-0.3,0).with(_=>{
        // Instrument Shape
        R.shape(_=>{
          const s = 0.15;
          const x = soundXAnim*s;
          const y = -soundYAnim*s;
          R.X.moveTo(-s,y);
          R.X.lineTo(s,y);
          R.X.moveTo(x,-s);
          R.X.lineTo(x,+s);
        }).stroke(0,0,0.5,0.01);
        R.scale(0.5).with(_=>{
          generator.icon(0);
        });
      });
      R.translate(-0.8,0).with(_=>{
        R.shape(_=>{
          R.X.moveTo(-0.04,0);
          R.X.lineTo(0.04,0);
          // Volume
          const v = volumeAnim*0.2;
          const xs = 0.1;
          let x = 0;
          R.X.moveTo(x*xs,v);
          R.X.lineTo(x*xs,0);
          x += attackAnim;
          R.X.lineTo(x*xs,-v);
          x += releaseAnim;
          R.X.lineTo(x*xs,-v*sustainAnim);
          x += releaseAnim;
          R.X.lineTo(x*xs,0);
        }).stroke(0,0,0.5,0.01);
      });
    });
    durAnim += (0 - durAnim) / 2;
    recordAnim += ((record ? 1 : 0) - recordAnim) / 2;
    muteAnim += ((mute ? 1 : 0) - muteAnim) / 2;
    volumeAnim += (volume - volumeAnim) / 2;
    releaseAnim += (release - releaseAnim) / 2;
    attackAnim += (attack - attackAnim) / 2;
    sustainAnim += (sustain - sustainAnim) / 2;
    soundXAnim += (soundX - soundXAnim) / 2;
    soundYAnim += (soundY - soundYAnim) / 2;
    R.text(durText,-0.1,0.095,0.25+0.1*durAnim).r().fill(0,0,0.8);
    R.translate(-0.0,0).scale(0.55).with(_=>{
      for(let i=0;i<quant;i++) {
        const sep = quant/4;
        if(i%sep == 0) continue;
        R.line(i/sep,-0.05,i/sep,0.05).stroke(0,0,0.2,0.02);
      }
      R.line(0,0,4,0).stroke(0,0,0.3,0.015);
      R.line(0,-0.2+recordAnim*0.05,0,0.2).stroke(0,0,0.5,0.02);
      R.circle(0,-0.2,recordAnim*0.05).stroke(0,0,0.5,0.02);
      R.line(-muteAnim*0.05,0.2,muteAnim*0.05,0.2).stroke(0,0,0.5,0.02);
      R.line(4-muteAnim*0.05,0.2,4+muteAnim*0.05,0.2).stroke(0,0,0.5,0.02);
      R.line(1,-0.08,1,0.08).stroke(0,0,0.3,0.02);
      R.line(2,-0.1,2,0.1).stroke(0,0,0.4,0.02);
      R.line(3,-0.08,3,0.08).stroke(0,0,0.3,0.02);
      R.line(4,-0.2,4,0.2).stroke(0,0,0.5,0.02);
      const beat = 60/tempo;
      const t = ((Audio.X.currentTime / beat + timeShift) % dur) / dur * 4;
      R.line(t,-0.15,t,0.15-recordAnim*0.05).stroke(0,0,0.8,0.02);
      R.circle(t,0.15,recordAnim*0.05).stroke(0,0,0.8,0.02);
      score.forEach(s=>{
        if(s.t >= dur) return;
        const r = 0.1;
        const t = Math.floor(s.t / dur * quant + 0.5) % quant * dur / quant;
        R.translate(t/dur*4,0).with(_=>{
          const v = s.v;
          R.shape(_=>{
            R.X.moveTo(0,0);
            R.X.lineTo(0.04,0.1*v);
            R.X.lineTo(s.d/dur*4.0,0);
            R.X.lineTo(0.04,-0.1*v);
            R.X.closePath();
          }).stroke(sounds[s.i].hue,1,mute ? 0.5 : 1);
        });
      });
      for(let j=0;j<waitNotes.length;j++) {
        const i = waitNotes[j].i;
        const d = (Audio.X.currentTime - waitNotes[j].t) / beat;
        const tu = (waitNotes[j].t / beat + dur + timeShift) % dur;
        const t = Math.floor(tu / dur * quant + 0.5) % quant * dur / quant;
        R.translate(t/dur*4,0).with(_=>{
          const v = waitNotes[j].v;
          R.shape(_=>{
            R.X.moveTo(0,0);
            R.X.lineTo(0.04,0.1*v);
            R.X.lineTo(d/dur*4.0,0);
            R.X.lineTo(0.04,-0.1*v);
            R.X.closePath();
          }).stroke(sounds[i].hue,1,0.5);
        });
      }
    });
  };
  return u;
};
const insts = [];
for(let i=0;i<4;i++) insts.push(Inst(i));

const SetPitchShift = ds=>{
  pitchShift += ds;
  pitchShiftAnim = 1;
  pitchText = pitchShift > 0 ? "+" + pitchShift : pitchShift == 0 ? "±0" : pitchShift;
  for(let i=0;i<insts.length;i++) {
    insts[i].setPitchShift();
  }
};
SetPitchShift(0);

const changeTempo = nt=>{
  let maxDur = 0;
  for(let i=0;i<insts.length;i++) maxDur = Math.max(maxDur, insts[i].duration());
  const a = Audio.X.currentTime;
  const t = (a / beat + timeShift) % maxDur;
  tempo = nt;
  beat = 60/tempo;
  const s = a / beat % maxDur;
  timeShift = (t - s + maxDur/2) % maxDur - maxDur/2;
};

const Icons = {
  none: v=>{},
  upC: v=>{
    R.scale(v*0.3+1).with(_=>{ R.text("^",0,0.47,0.8).fill(0,0,0.5); });
  },
  dnC: v=>{
    R.scale(v*0.3+1).rotate(Math.PI).with(_=>{ R.text("^",0,0.47,0.8).fill(0,0,0.5); });
  },
  inst: v=>{
    R.shape(_=>{
      R.X.moveTo(0,0.2);
      R.X.lineTo(0.2,0);
      R.X.lineTo(0,-0.2);
      R.X.lineTo(-0.2,0);
      R.X.closePath();
    }).stroke(0,0,0.7,v*0.05+0.07);
  },
  whole: v=>{
    R.circle(0,0,0.2).stroke(0,0,0.7,v*0.05+0.07);
  },
  tone: v=>{
    const u = 0.15;
    R.rect(-u,-u,2*u,2*u).stroke(0,0,0.3,v*0.05+0.1);
  },
  volume: v=>{
    const u = 0.15, f = 0.02;
    R.shape(_=>{
      R.X.moveTo(u+f,u);
      R.X.lineTo(-u+f,u);
      R.X.lineTo(u+f,-u);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  filter: v=>{
    const u = 0.15, f = -0.02;
    R.shape(_=>{
      R.X.moveTo(-u,-u+f);
      R.X.lineTo(0,u+f);
      R.X.lineTo(u,-u+f);
      R.X.closePath();
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  envelope: v=>{
    const u = 0.15, f = 0.03;
    R.shape(_=>{
      R.X.moveTo(-u,u+f);
      R.X.lineTo(0,-u+f);
      R.X.lineTo(u,u+f);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  delete: v=>{
    const u = 0.15;
    R.shape(_=>{
      R.X.moveTo(-u,-u);
      R.X.lineTo(u,u);
      R.X.moveTo(-u,u);
      R.X.lineTo(u,-u);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  reverb: v=>{
    const u = 0.15, f = 0.18, e = 0.02;
    R.shape(_=>{
      R.X.moveTo(-u+e,-f);
      R.X.lineTo(-u+e,f);
      R.X.moveTo(-u+e,0);
      R.X.lineTo(u+e,0);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  record: v=>{
    const u = 0.15;
    R.circle(0,0,u).stroke(0,0,0.3,v*0.05+0.1);
  },
  plus: v=>{
    const u = 0.2;
    R.shape(_=>{
      R.X.moveTo(-u,0);
      R.X.lineTo(u,0);
      R.X.moveTo(0,-u);
      R.X.lineTo(0,u);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  minus: v=>{
    const u = 0.2;
    R.shape(_=>{
      R.X.moveTo(-u,0);
      R.X.lineTo(u,0);
    }).stroke(0,0,0.3,v*0.05+0.1);
  },
  mute: v=>{
    const u = 0.2, f = 0.15;
    R.shape(_=>{
      R.X.moveTo(-u,f);
      R.X.lineTo(u,f);
      R.X.moveTo(0,f);
      R.X.lineTo(0,-f);
    }).stroke(0,0,0.3,v*0.05+0.1);
  }
};

const Input = (_=>{
  const input = {};
  const padPress = [];
  for(let i=0;i<16;i++) padPress.push({ val:0, target:0 });
  let cursorPos = 0, cursorTarget = 0;
  const noteIndex = [4,0,5,1,6,2,7,3];
  let lastTap = 0, beginMeasure = 0, lastMeasure = 0, tapCount = 0;
  let tapAnim = 0, tempoAnim = 0;
  const tapDuration = 0.25;
  const padIcons = [];
  for(let i=0;i<16;i++) padIcons.push({ cur: Icons.none, prev: Icons.none, time: 0.5 });
  const SetHandler = h=>{
    padHandler = h;
    iconActive = h == Handler.basic || h == Handler.up || h == Handler.down;
    for(let i=0;i<16;i++) {
      const ni = h.icon(i);
      if(ni == padIcons[i].cur) continue;
      if(padIcons[i].time > 0.5) padIcons[i].prev = padIcons[i].cur;
      padIcons[i].cur = ni;
      padIcons[i].time = 0;
    }
  };
  const Handler = {
    basic: {
      icon: i=>{
        if(i < 8) return Icons.none;
        else return [
          Icons.dnC, Icons.upC,
          Icons.inst, Icons.whole,
          Icons.tone, Icons.volume,
          Icons.record, Icons.envelope
        ][i-8];
      },
      action: (i,v)=>{
        if(i < 8) insts[cursorTarget].noteOn(noteIndex[i]+8, v);
        if(i == 8) SetHandler(Handler.down);
        if(i == 9) SetHandler(Handler.up);
        if(i == 10) SetHandler(Handler.inst);
        if(i == 11) SetHandler(Handler.whole);
        if(i == 14) insts[cursorTarget].toggleRecord();
      },
      release: i=>{
        if(i < 8) {
          insts[cursorTarget].noteOff(noteIndex[i]+0);
          insts[cursorTarget].noteOff(noteIndex[i]+8);
          insts[cursorTarget].noteOff(noteIndex[i]+16);
        }
      }
    },
    up: {
      icon: i=>{
        if(i == 8) return Icons.dnC;
        if(i == 9) return Icons.upC;
        return Icons.none;
      },
      action: (i,v)=>{
        if(i < 8) insts[cursorTarget].noteOn(noteIndex[i]+16, v);
        else if(i == 8) {
          cursorTarget++;
          if(cursorTarget > 3) cursorTarget = 3, cursorPos = 3.4;
        }
      },
      release: i=>{
        if(i < 8) Handler.basic.release(i);
        if(i == 9) SetHandler(padPress[8].target == 1 ? Handler.down : Handler.basic);
      }
    },
    down: {
      icon: i=>{
        if(i == 8) return Icons.dnC;
        if(i == 9) return Icons.upC;
        return Icons.none;
      },
      action: (i,v)=>{
        if(i < 8) insts[cursorTarget].noteOn(noteIndex[i]+0, v);
        else if(i == 9) {
          cursorTarget--;
          if(cursorTarget < 0) cursorTarget = 0, cursorPos = -0.4;
        }
      },
      release: i=>{
        if(i < 8) Handler.basic.release(i);
        if(i == 8) SetHandler(padPress[9].target == 1 ? Handler.up : Handler.basic);
      }
    },
    whole: {
      icon: i=>{
        if(i < 8) return Icons.none;
        else return [
          Icons.dnC, Icons.upC,
          Icons.none, Icons.whole,
          Icons.none, Icons.volume,
          Icons.delete, Icons.none
        ][i-8];
      },
      action: (i,v)=>{
        if(i == 8) SetPitchShift(-1);
        if(i == 9) SetPitchShift(+1);
        if(i == 14) console.log("x");
      },
      release: i=>{
        if(i == 11) SetHandler(padPress[10].target == 1 ? Handler.inst : Handler.basic);
      }
    },
    inst: {
      icon: i=>{
        if(i < 8) return Generators[i].icon;
        else return [
          Icons.dnC, Icons.upC,
          Icons.inst, Icons.none,
          Icons.minus, Icons.mute,
          Icons.plus, Icons.delete
        ][i-8];
      },
      action: (i,v)=>{
        if(i < 8) {
          insts[cursorTarget].changeGen(Generators[i]);
        }
        if(i == 12) insts[cursorTarget].changeDuration(-1);
        if(i == 14) insts[cursorTarget].changeDuration(+1);
        if(i == 13) insts[cursorTarget].toggleMute();
        if(i == 15) insts[cursorTarget].clear();
      },
      release: i=>{
        if(i == 10) SetHandler(padPress[11].target == 1 ? Handler.whole : Handler.basic);
      }
    }
  };
  let padHandler = Handler.basic, iconActive = false, iconDisplay = 0;
  SetHandler(Handler.basic);
  input.padDown = (i,v)=>{
    padPress[i].target = 1;
    if(i == 11 && padHandler == Handler.basic) {
      lastTap = Audio.X.currentTime;
      if(beginMeasure == 0) beginMeasure = lastTap, tapCount = 0;
      lastMeasure = lastTap;
      tapCount++;
      if(tapCount >= 4) {
        let b = (lastMeasure - beginMeasure) / (tapCount - 1);
        changeTempo(Math.floor(60 / b * 2) / 2);
        tempoAnim = 1;
      }
      tapAnim = 1;
    }
    padHandler.action(i,v);
  };
  input.padUp = i=>{
    padPress[i].target = 0;
    padHandler.release(i);
    if(i == 11 && padHandler == Handler.basic) {
      if(lastTap > 0 && Audio.X.currentTime - lastTap < tapDuration) {
        lastTap = 0;
      }
    }
  };
  input.touchX = v=>{
    if(iconActive) { // default
      if(padPress[12].target == 1) insts[cursorTarget].setSoundX(v*2-1);
      if(padPress[13].target == 1) insts[cursorTarget].setRelease(v);
      if(padPress[15].target == 1) insts[cursorTarget].setAttack(v);
    }
  };
  input.touchY = v=>{
    if(iconActive) { // default
      if(padPress[12].target == 1) insts[cursorTarget].setSoundY(v*2-1);
      if(padPress[13].target == 1) insts[cursorTarget].setVolume(v);
      if(padPress[15].target == 1) insts[cursorTarget].setSustain(v);
    }
  };
  input.touchDown = _=>{};
  input.touchUp = _=>{};
  input.render = _=>{
    if(lastTap > 0 && Audio.X.currentTime - lastTap > tapDuration) {
      beginMeasure = lastMeasure = 0;
      lastTap = 0, tapCount = 0, tapAnim = 1;
    }
    if(beginMeasure > 0 && Audio.X.currentTime - lastMeasure > 3 * beat) {
      beginMeasure = lastMeasure = 0;
      lastTap = 0, tapCount = 0, tapAnim = 1;
    }
    tapAnim += (0 - tapAnim) / 2.0;
    tempoAnim += (0 - tempoAnim) / 2.0;
    pitchShiftAnim += (0 - pitchShiftAnim) / 2.0;
    iconDisplay += ((iconActive ? 1 : 0) - iconDisplay) / 4.0;
    for(let i=0;i<16;i++) {
      const pp = padPress[i];
      pp.val += (pp.target - pp.val) / 2.0;
      const x = Math.floor(i/2), y = i%2;
      R.scale(0.2).translate(x-3.5,0.5-y).scale(0.85).with(_=>{
        R.rect(-0.5,-0.5,1,1).stroke(0,0,0.5,0.05);
        if(x < 4) {
          let off = padPress[9].val - padPress[8].val;
          off += x%2 == 1 ? 1 : 0;
          R.rect(-0.25,-0.25,0.5,0.5).stroke(0,0,(Math.pow(2,off)-1)*0.1*iconDisplay+0.1,0.15);
        }
        if(pp.val > 0.01) {
          const w = 0.03 * pp.val;
          const e = 0.5-0.05/2-w;
          R.rect(-e,-e,e*2,e*2).stroke(0,0,1,w*2);
        }
        let pt = padIcons[i].time;
        pt += 0.08;
        if(pt > 1) pt = 1;
        padIcons[i].time = pt;
        if(pt < 0.5) {
          let s = pt*2;
          R.scale(1-Math.pow(s,2)).with(_=>{
            padIcons[i].prev(pp.val);
          });
        } else {
          let s = pt*2 - 1;
          R.scale(1-Math.pow(1-s,2)).with(_=>{
            padIcons[i].cur(pp.val);
          });
        }
      });
    }
    cursorPos += (cursorTarget - cursorPos) / 2.0;
    R.translate(-0.45,-(3-cursorPos)*0.45/1.3-0.465).scale(0.05).with(_=>{
      const s = R.shape(_=>{
        R.X.moveTo(0,1);
        R.X.lineTo(1,0);
        R.X.lineTo(0,-1);
        R.X.lineTo(-1,0);
        R.X.closePath();
      });
      R.translate(0,0.5).with(_=>{ s.stroke(0,0,0.3,0.5) });
      s.stroke(0,0,0.7,0.5);
    });
    R.translate(0.9,-0.03).with(_=>{
      R.text(tempo,0,0,0.2+tempoAnim*0.1).l().fill(0,0,0.5);
      R.text("+"+tapCount,R.measure(tempo,0.2),0,0.1+tapAnim*0.05).l().fill(0,0,0.5);
      R.text(pitchText,0,0.2,0.2+pitchShiftAnim*0.1).l().fill(0,0,0.5);
    });
    R.translate(-1.1,0).with(_=>{
      R.shape(_=>{
        const s = 0.2;
        R.X.moveTo(0,-s);
        R.X.lineTo(0,s);
        R.X.moveTo(-s,0);
        R.X.lineTo(s,0);
      }).stroke(0,0,0.3,0.01);
    })
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
