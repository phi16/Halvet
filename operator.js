Type.scalar = {
  hue: 0.6, sat: 1
};
Type.wave = {
  hue: 0.45, sat: 1
};
Type.model = {
  hue: 0.78, sat: 1
};
Type.special = {
  hue: 0, sat: 0
};

Type.forward = {
  hue: 0.4, sat: 1
};
Type.backward = {
  hue: 0.15, sat: 1
};
Type.dual = {
  hue: 0.7, sat: 1
};

Operators.push({
  name: "A",
  hue: 0.85, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{}
});
Operators.push({
  name: "B",
  hue: 0.85, sat: 1,
  type: Type.backward,
  initialize: (n,E)=>{}
});
Operators.push({
  name: "C",
  hue: 0.85, sat: 1,
  type: Type.dual,
  initialize: (n,E)=>{}
});

Operators.push({
  name: "Oscillator",
  hue: 0.85, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    const freq = 300;
    const samples = E.X.sampleRate / freq;
    const curve = new Float32Array(samples);
    for(let i=0;i<samples;i++) {
      curve[i] = Math.sin(i*Math.PI*2/samples);
    }
    let prev = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = p.dup();
      if(e == "down") {
        prev = cur;
      } else if(e == "up") {
        prev = null;
      } else if(e == "move") {
        if(prev) {
          const dist = Math.sqrt(Math.pow(cur.x-prev.x,2) + Math.pow(cur.y-prev.y,2));
          const aX = prev.x, aY = (prev.y-0.15)/(h-0.3)*2-1;
          const bX = cur.x, bY = (cur.y-0.15)/(h-0.3)*2-1;
          for(let i=0;i<samples;i++) {
            // TODO: cyclic
            const x = 0.15+(i/samples)*(w-0.3);
            const e = (bX-x)/(bX-aX);
            if(0 <= e && e <= 1) curve[i] = Clamp(-1,1)(-(bY + (aY-bY) * e));
          }
          if(n.update) n.update();
          prev = cur;
        }
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        for(let i=0;i<=samples;i++) {
          const v = curve[i == samples ? 0 : i];
          const x = 0.15+(i/samples)*(w-0.3);
          const y = h*0.5-v*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const o = E.X.createBufferSource();
      const b = E.X.createBuffer(1, samples, E.X.sampleRate);
      n.update = _=>{
        b.copyToChannel(curve, 0);
      };
      X.note.listen((p,v)=>{
        const f = X.frequency * Math.pow(2, (p-60)/12);
        o.detune.setTargetAtTime(1200 * (Math.log2(f/freq) + X.pitch), E.X.currentTime, 0.001);
      }, _=>{});
      n.update();
      o.buffer = b;
      o.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      o.loop = true;
      o.start();
      return o;
    };
  }
});

Operators.push({
  name: "Harmonics",
  hue: 0.85, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    const freq = 300;
    const samples = 7;
    const curve = new Float32Array(7);
    curve[0] = 1;
    curve[1] = -0.5;
    let push = false;
    n.event.mouse = (e,p,w,h)=>{
      const cur = p.dup();
      if(e == "down") {
        push = true;
      } else if(e == "up") {
        push = false;
      }
      if((e == "down" || e == "move") && push) {
        const u = (cur.x-0.15)/(w-0.3)*(samples-1);
        const i = Math.max(0, Math.min(6, Math.round(u)));
        const y = Math.max(-1, Math.min(1, -(cur.y-0.5)/((h-0.3)/2)));
        curve[i] = y;
        if(n.update) n.update();
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        for(let i=0;i<samples;i++) {
          const v = curve[i];
          const x = 0.15+(i/(samples-1))*(w-0.3);
          const y = h*0.5-v*(h-0.3)/2;
          const yb = h*0.5;
          X.moveTo(x,yb);
          X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const o = E.X.createOscillator();
      const real = new Float32Array(samples+1);
      const imag = new Float32Array(samples+1);
      o.frequency.value = 440;
      n.update = _=>{
        real[0] = imag[0] = 0;
        for(let i=1;i<=samples;i++) {
          const v = curve[i-1];
          const a = 0; // Math.random() * 2 * Math.PI;
          real[i] = v*Math.cos(a);
          imag[i] = v*Math.sin(a);
        }
        o.setPeriodicWave(E.X.createPeriodicWave(real,imag,{disableNormalization:true}));
      };
      n.update();
      X.note.listen((p,v)=>{
        const f = X.frequency * Math.pow(2, (p-60)/12);
        o.frequency.setTargetAtTime(f, E.X.currentTime, 0.001);
      }, _=>{});
      o.start();
      return o;
    };
  }
});

Operators.push({
  name: "Microphone",
  hue: 0.85, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const g = E.X.createGain();
      E.getMic(m=>{
        m.connect(g);
      });
      return g;
    };
  }
});

Operators.push({
  name: "Noise",
  hue: 0.85, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    n.eval = X=>{
      const o = E.X.createBufferSource();
      const b = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
      const c = b.getChannelData(0);
      for(let i=0;i<E.X.sampleRate;i++) {
        c[i] = Math.random()*2-1;
      }
      o.buffer = b;
      o.loop = true;
      o.start();
      return o;
    };
  }
});

Operators.push({
  name: "Envelope",
  hue: 0.7, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      if(n.data.gain) {
        R.shape(_=>{
          const value = n.data.gain.gain.value;
          const x = 0.15+value*(w-0.3);
          X.moveTo(x,h*0.5-0.1);
          X.lineTo(x,h*0.5+0.1);
          X.moveTo(0.15,h*0.5);
          X.lineTo(x,h*0.5);
        }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
      }
    };
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 0;
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(Math.pow(v,2), E.X.currentTime, 0.01);
      }, _=>{
        g.gain.setTargetAtTime(0, E.X.currentTime, 0.1);
      });
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Release",
  hue: 0.7, sat: 1,
  type: Type.wave, // TODO: scalar
  initialize: (n,E)=>{
    let volume = 0.5;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0.001, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const samples = 32;
        for(let i=0;i<=samples;i++) {
          const u = Math.pow(i/samples, 5);
          const v = Math.exp(-u/volume);
          const x = 0.15+u*(w-0.3);
          const y = h*0.5-(v*2-1)*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,0.5,0.02);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 0;
      n.update = _=>{};
      n.update();
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(1, E.X.currentTime, 0.001);
      }, _=>{
        g.gain.setTargetAtTime(0, E.X.currentTime, volume*0.1);
      });
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Attack",
  hue: 0.7, sat: 1,
  type: Type.wave, // TODO: scalar
  initialize: (n,E)=>{
    let volume = 0.01;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0.001, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const samples = 32;
        for(let i=0;i<=samples;i++) {
          const u = Math.pow(i/samples, 5);
          const v = 1 - Math.exp(-u/volume);
          const x = 0.15+u*(w-0.3);
          const y = h*0.5-(v*2-1)*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,0.5,0.02);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      n.update = _=>{};
      n.update();
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(0, E.X.currentTime, 0.001);
        g.gain.setTargetAtTime(Math.pow(v,2), E.X.currentTime+0.001, volume*0.1);
      }, _=>{
      });
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Decay",
  hue: 0.7, sat: 1,
  type: Type.wave, // TODO: scalar
  initialize: (n,E)=>{
    let delay = 0;
    let volume = 0.1;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        delay += -dif.y*0.1;
        volume = Clamp(0.001, 1)(volume);
        delay = Clamp(0, 0.1)(delay);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const samples = 32;
        for(let i=0;i<=samples;i++) {
          const u = Math.pow(i/samples, 5);
          const v = Math.exp(-Math.max(0,u-delay*5)/volume);
          const x = 0.15+u*(w-0.3);
          const y = h*0.5-(v*2-1)*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,0.5,0.02);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 0;
      n.update = _=>{};
      n.update();
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(1, E.X.currentTime, 0.001);
        g.gain.setTargetAtTime(0, E.X.currentTime+delay+0.001, volume*0.1);
      }, _=>{
      });
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Filter",
  hue: 0.4, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    const freqArray = new Float32Array(256);
    for(let i=0;i<256;i++) freqArray[i] = i*80;
    const lpfArray = new Float32Array(256);
    const hpfArray = new Float32Array(256);
    const phaseArray = new Float32Array(256);
    let lowParam = { freq: 24000, q: 1 };
    let highParam = { freq: 0, q: 1 };
    let target = null, param = null;
    let prev = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        if(cur.x < 0.5) target = n.data.hpf, param = highParam;
        else target = n.data.lpf, param = lowParam;
        param.freq = target.frequency.value;
        param.q = target.Q.value;
        prev = cur;
      } else if(e == "up") {
        target = null;
      } else if(e == "move") {
        if(target) {
          const dif = cur.sub(prev);
          param.freq += dif.x*24000;
          param.q -= dif.y*10;
          param.freq = Clamp(0,24000)(param.freq);
          param.q = Clamp(-20,20)(param.q);
          console.log(param.q);
          target.frequency.setTargetAtTime(param.freq, E.X.currentTime, 0.01);
          target.Q.setTargetAtTime(param.q, E.X.currentTime, 0.01);
          if(n.update) n.update();
          prev = cur;
        }
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(w*0.5,0.1,w*0.5,h-0.1).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      if(n.data.lpf && n.data.hpf) {
        R.shape(_=>{
          for(let i=0;i<256;i++) {
            const v = lpfArray[i]*hpfArray[i];
            const x = 0.15+(i/255)*(w-0.3);
            const y = h*0.5-(v-1)*(h-0.3)/2;
            if(i == 0) X.moveTo(x,y);
            else X.lineTo(x,y);
          }
        }).stroke(0,0,1,0.02);
      }
    };
    n.eval = X=>{
      const lpf = E.X.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = lowParam.freq;
      lpf.Q.value = lowParam.q;
      const hpf = E.X.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = highParam.freq;
      hpf.Q.value = highParam.q;
      n.update = _=>{
        lpf.getFrequencyResponse(freqArray, lpfArray, phaseArray);
        hpf.getFrequencyResponse(freqArray, hpfArray, phaseArray);
      };
      n.update();
      n.data = { lpf: lpf, hpf: hpf };
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(lpf);
        }
      });
      lpf.connect(hpf);
      return hpf;
    };
  }
});

Operators.push({
  name: "Reverb",
  hue: 0.4, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    let alpha = 2, beta = 1;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
        if(n.update) n.update();
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        alpha += dif.y*5;
        beta += dif.x;
        alpha = Clamp(-10, 10)(alpha);
        beta = Clamp(0.01, 1)(beta);
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.shape(_=>{
        for(let i=0;i<128;i++) {
          const v = Math.pow(Saturate(1-i/127/beta), Math.pow(2,alpha));
          const x = 0.15+(i/127)*(w-0.3);
          const y = h*0.5-(v*0.25)*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
        for(let i=0;i<128;i++) {
          const v = Math.pow(Saturate(1-i/127/beta), Math.pow(2,alpha));
          const x = 0.15+(i/127)*(w-0.3);
          const y = h*0.5-(-v*0.25)*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const r = E.X.createConvolver();
      const samples = E.X.sampleRate;
      const b = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
      n.update = _=>{
        const b0 = b.getChannelData(0);
        // const b1 = b.getChannelData(1);
        for(let i=0;i<samples;i++) {
          const x = i/samples;
          let v = Math.pow(Saturate(1-x/beta), Math.pow(2,alpha));
          v = Saturate(v);
          const a = Math.random()*Math.PI*2;
          b0[i] = v*Math.cos(a);
          // b1[i] = v*Math.sin(a);
        }
        r.buffer = b;
      };
      n.update();
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(r);
        }
      });
      return r;
    };
  }
});

Operators.push({
  name: "Gain",
  hue: 0.95, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    let volume = 0.1;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      n.update = _=>{
        // TODO: reconfigure
        g.gain.setTargetAtTime(Math.pow(volume, 2), E.X.currentTime, 0.01);
      };
      n.update();
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Comb",
  hue: 0.4, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const g = E.X.createGain();
      const d = E.X.createDelay();
      d.delayTime.value = 1/440;
      X.note.listen((p,v)=>{
        let freq = X.frequency * Math.pow(2, (p-60)/12);
        d.delayTime.setTargetAtTime(1/freq, E.X.currentTime, 0.001);
      },_=>{});
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
          c.source.result[X.id].connect(d);
        }
      });
      d.connect(g);
      return g;
    };
  }
});

/* Operators.push({
  name: "Lerp",
  hue: 0.7, sat: 1,
  type: Type.scalar
});

Operators.push({ // TODO
  name: "Distortion",
  hue: 0.25, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    let alpha = 0, beta = 0;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
        if(n.update) n.update();
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        alpha += dif.y;
        beta += dif.x;
        alpha = Clamp(-1, 1)(alpha);
        beta = Clamp(-1, 1)(beta);
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.shape(_=>{
        for(let i=0;i<256;i++) {
          const v = i/255 * 2 - 1;
          const x = 0.15+(i/255)*(w-0.3);
          const y = h*0.5-(v*0.5)*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const p = E.X.createDynamicsCompressor();
      const w = E.X.createWaveShaper();
      const curve = new Float32Array(256);
      n.update = _=>{
        const cu = x=>x;
        for(let i=0;i<curve.length;i++) {
          const x = i/(curve.length-1) * 2 - 1;
          curve[i] = Saturate(cu(Math.abs(x))) * Math.sign(x);
        }
        w.curve = curve;
      };
      n.update();
      p.connect(w);
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(p);
        }
      });
      return w;
    };
  }
});

Operators.push({
  name: "Equalizer",
  hue: 0.4, sat: 1,
  type: Type.wave
});

Operators.push({
  name: "Compressor",
  hue: 0.25, sat: 1,
  type: Type.wave
});

Operators.push({
  name: "Mixer",
  hue: 0.95, sat: 1,
  type: Type.wave
});

Operators.push({
  name: "Value",
  hue: 0.7, sat: 1,
  type: Type.scalar
});

*/

Operators.push({
  name: "Delay",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    let freq = 440;
    n.eval = X=>{
      const right = E.X.createDelay();
      const left = E.X.createDelay();
      left.delayTime.value = right.delayTime.value = 1/freq/4;
      X.note.listen((p,v)=>{
        freq = X.frequency * Math.pow(2, (p-60)/12);
        left.delayTime.setTargetAtTime(1/freq/4, E.X.currentTime, 0.001);
        right.delayTime.setTargetAtTime(1/freq/4, E.X.currentTime, 0.001);
      }, _=>{});
      let os = [];
      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "Scatter",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    let volume = 0;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      let k = 0;
      const rightIn = E.X.createGain();
      const leftIn = E.X.createGain();
      const rightStraight = E.X.createGain();
      const leftStraight = E.X.createGain();
      const r2lScatter = E.X.createGain();
      const l2rScatter = E.X.createGain();
      const rightOut = E.X.createGain();
      const leftOut = E.X.createGain();
      n.update = _=>{
        k = volume;
        rightStraight.gain.value = 1+k;
        leftStraight.gain.value = 1-k;
        r2lScatter.gain.value = k;
        l2rScatter.gain.value = -k;
      };
      n.update();
      rightIn.connect(rightStraight);
      rightIn.connect(r2lScatter);
      leftIn.connect(leftStraight);
      leftIn.connect(l2rScatter);
      rightStraight.connect(rightOut);
      leftStraight.connect(leftOut);
      l2rScatter.connect(rightOut);
      r2lScatter.connect(leftOut);
      let os = [];
      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          leftOut.connect(m.left);
          m.right.connect(rightIn);
          os = os.concat(m.output);
        }
      });
      return { left: leftIn, right: rightOut, output: os };
    };
  }
});

Operators.push({
  name: "Loss",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    let volume = 0;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const right = E.X.createGain();
      const left = E.X.createGain();
      let os = [];
      n.update = _=>{
        const v = 1 - 0.1 * volume;
        left.gain.setTargetAtTime(v, E.X.currentTime, 0.01);
        right.gain.setTargetAtTime(v, E.X.currentTime, 0.01);
      };
      n.update();
      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "Terminal",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const right = E.X.createGain();
      const left = E.X.createGain();
      left.connect(right);
      left.gain.value = -1;
      return { left: left, right: right, output: [] };
    };
  }
});

Operators.push({
  name: "Extract",
  hue: 0.78, sat: 1,
  type: Type.wave,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const right = E.X.createGain();
      const left = E.X.createGain();
      right.connect(left);
      right.gain.value = -1;
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          m.output.forEach(o=>{
            o.connect(g);
          });
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Pluck",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    let volume = 0.1;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      const right = E.X.createGain();
      const left = E.X.createGain();
      let os = [];

      let dur = 0;
      g.gain.value = 0;
      X.note.listen((p,v)=>{
        const f = X.frequency * Math.pow(2, (p-60)/12);
        g.gain.setTargetAtTime(1, E.X.currentTime, 0.01);
        g.gain.setTargetAtTime(0, E.X.currentTime + 1/f, dur); // TODO: param
      }, _=>{});
      n.update = _=>{
        dur = volume*0.1;
      };
      n.update();
      g.connect(left);
      g.connect(right);
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        } else if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "Valve",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    let volume = 0;
    let drag = false;
    let mousePos = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
      } else if(e == "move" && drag) {
        const dif = cur.sub(mousePos);
        volume += dif.x;
        volume = Clamp(0, 1)(volume);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        const x = 0.15+volume*(w-0.3);
        X.moveTo(x,h*0.5-0.1);
        X.lineTo(x,h*0.5+0.1);
        X.moveTo(0.15,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const g = E.X.createGain();
      const right = E.X.createGain();
      const left = E.X.createGain();
      let os = [];

      g.gain.value = 0;
      n.update = _=>{
        const v = volume;
        g.gain.setTargetAtTime(v, E.X.currentTime, 0.01);
      };
      n.update();
      g.connect(left);
      g.connect(right);
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        } else if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "Listen",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const right = E.X.createGain();
      const left = E.X.createGain();
      const g = E.X.createGain();
      left.connect(g);
      right.connect(g);
      let os = [g];

      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "AllPass",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    const freqArray = new Float32Array(256);
    for(let i=0;i<256;i++) freqArray[i] = i*80;
    const apfArray = new Float32Array(256);
    const phaseArray = new Float32Array(256);
    let target = null, param = { freq: 440, q: 0.001 };
    let prev = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        target = n.data.apf;
        param.freq = target.frequency.value;
        param.q = target.Q.value;
        prev = cur;
      } else if(e == "up") {
        target = null;
      } else if(e == "move") {
        if(target) {
          const dif = cur.sub(prev);
          param.freq += dif.x*24000;
          param.q -= dif.y*10;
          param.freq = Clamp(0,24000)(param.freq);
          param.q = Clamp(0,20)(param.q);
          target.frequency.setTargetAtTime(param.freq, E.X.currentTime, 0.01);
          target.Q.setTargetAtTime(param.q, E.X.currentTime, 0.01);
          if(n.update) n.update();
          prev = cur;
        }
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(w*0.5,0.1,w*0.5,h-0.1).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      if(n.data.apf) {
        R.shape(_=>{
          for(let i=0;i<256;i++) {
            const v = phaseArray[i]/3.1415926535;
            const x = 0.15+(i/255)*(w-0.3);
            const y = h*0.5-v*(h-0.3)/2;
            if(i == 0) X.moveTo(x,y);
            else X.lineTo(x,y);
          }
        }).stroke(0,0,1,0.02);
      }
    };
    n.eval = X=>{
      const right = E.X.createBiquadFilter();
      const left = E.X.createBiquadFilter();
      left.type = right.type = "allpass";
      left.frequency.value = right.frequency.value = param.freq;
      left.Q.value = right.Q.value = param.q;
      n.update = _=>{
        if(target) console.log(target.frequency.value, target.Q.value);
        left.getFrequencyResponse(freqArray, apfArray, phaseArray);
      };
      n.update();
      n.data = { apf: left };
      let os = [];

      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "LowPass",
  hue: 0.78, sat: 1,
  type: Type.model,
  initialize: (n,E)=>{
    const freqArray = new Float32Array(256);
    for(let i=0;i<256;i++) freqArray[i] = i*80;
    const lpfArray = new Float32Array(256);
    const phaseArray = new Float32Array(256);
    let target = null, param = { freq: 24000, q: 0 };
    let prev = null;
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        target = n.data.lpf;
        param.freq = target.frequency.value;
        param.q = target.Q.value;
        prev = cur;
      } else if(e == "up") {
        target = null;
      } else if(e == "move") {
        if(target) {
          const dif = cur.sub(prev);
          param.freq += dif.x*24000;
          param.q -= dif.y*10;
          param.freq = Clamp(0,24000)(param.freq);
          param.q = Clamp(-20,20)(param.q);
          target.frequency.setTargetAtTime(param.freq, E.X.currentTime, 0.01);
          target.Q.setTargetAtTime(param.q, E.X.currentTime, 0.01);
          if(n.update) n.update();
          prev = cur;
        }
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(w*0.5,0.1,w*0.5,h-0.1).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      if(n.data.lpf) {
        R.shape(_=>{
          for(let i=0;i<256;i++) {
            const v = lpfArray[i];
            const x = 0.15+(i/255)*(w-0.3);
            const y = h*0.5-(v-1)*(h-0.3)/2;
            if(i == 0) X.moveTo(x,y);
            else X.lineTo(x,y);
          }
        }).stroke(0,0,1,0.02);
      }
    };
    n.eval = X=>{
      const right = E.X.createBiquadFilter();
      const left = E.X.createBiquadFilter();
      left.type = right.type = "lowpass";
      left.frequency.value = right.frequency.value = param.freq;
      left.Q.value = right.Q.value = param.q;
      n.update = _=>{
        left.getFrequencyResponse(freqArray, lpfArray, phaseArray);
      };
      n.update();
      n.data = { lpf: left };
      let os = [];

      n.connection.input.forEach(c=>{
        if(c.type == Type.model) {
          const m = c.source.result[X.id];
          left.connect(m.left);
          m.right.connect(right);
          os = os.concat(m.output);
        }
      });
      return { left: left, right: right, output: os };
    };
  }
});

Operators.push({
  name: "Scope",
  hue: 0, sat: 0,
  type: Type.wave,
  initialize: (n,E)=>{
    n.data = { array: new Float32Array(2048), analyser: null };
    let mode = "wave";
    n.event.key = (e,k)=>{
      if(e == "down" && k == "s") {
        if(mode == "wave") mode = "freq";
        else mode = "wave";
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      if(mode == "wave") R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(0,0,0.5,0.01);
      if(n.data.analyser) {
        let shape = null;
        if(mode == "wave") {
          n.data.analyser.getFloatTimeDomainData(n.data.array);
          shape = R.shape(_=>{
            for(let i=0;i<256;i++) {
              const v = n.data.array[i];
              const x = 0.15+(i/255)*(w-0.3);
              const y = h*0.5-v*(h-0.3)/2;
              if(i == 0) X.moveTo(x,y);
              else X.lineTo(x,y);
            }
          });
        } else {
          n.data.analyser.getFloatFrequencyData(n.data.array);
          shape = R.shape(_=>{
            for(let i=0;i<256;i++) {
              const v = n.data.array[i*8]/128 + 0.5;
              const x = 0.15+(i/255)*(w-0.3);
              const y = h*0.5-v*(h-0.3)/2;
              if(i == 0) X.moveTo(x,y);
              else X.lineTo(x,y);
            }
          });
        }
        shape.stroke(0,0,1,0.02);
      }
    };
    n.eval = X=>{
      const a = E.X.createAnalyser();
      a.fftSize = 4096;
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(a);
        }
      });
      n.data.analyser = a;
      return a;
    };
  }
});

/* Operators.push({
  name: "Buffer",
  hue: 0.85, sat: 1,
  type: Type.wave
}); */

Operators.push({
  name: "Output",
  hue: 0, sat: 0,
  type: Type.none,
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 1;
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].connect(g);
        }
      });
      E.addOutput(g);
      return null;
    };
  }
});

/* Operators.push({
  name: "Translocate",
  hue: 0, sat: 0,
  type: Type.special
}); */

Operators.push({
  name: "*", // Flow Control: add, multiply, duplicate, stop, turn
  hue: 0, sat: 0,
  type: Type.special,
  initialize: (n,E)=>{
    n.mode = "additive";
    n.event.key = (e,k)=>{
      if(e == "down" && k == "s") {
        if(n.mode == "additive") n.mode = "multiplicative";
        else n.mode = "additive";
        // TODO: actual function switch
      }
    };
    n.eval = X=>{
      let count = 0;
      let g = null;
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          if(count == 0) {
            g = c.source.result[X.id];
          } else {
            if(count == 1) {
              const t = g;
              g = E.X.createGain();
              t.connect(g);
            }
            // Additive
            // TODO: multiplicative
            c.source.result[X.id].connect(g);
          }
          count++;
        }
      });
      return g;
    };
  }
});

for(let i=0;i<Operators.length;i++) {
  console.log(Operators[i].name);
  OperatorMap[Operators[i].name] = Operators[i];
}
