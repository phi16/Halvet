Type.forward = {
  hue: 0.4, sat: 1
};
Type.backward = {
  hue: 0.15, sat: 1
};
Type.dual = {
  hue: 0.7, sat: 1
};
Type.special = {
  hue: 0, sat: 0
};

Operators.push({
  name: "Oscillator",
  hue: 0.85, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    const freq = 300;
    const samples = E.X.sampleRate / freq;
    const curve = new Float32Array(samples);
    for(let i=0;i<samples;i++) {
      curve[i] = Math.sin(i*Math.PI*2/samples);
    }
    const b = E.X.createBuffer(1, samples, E.X.sampleRate);
    function update() {
      b.copyToChannel(curve, 0);
    }
    update();
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
          update();
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
      o.buffer = b;
      o.loop = true;
      o.start();
      X.note.listen((p,v)=>{
        const shift = Math.log2(X.frequency/freq) + p + X.pitch;
        o.detune.setTargetAtTime(1200 * shift, E.now(), 0.001);
      }, _=>{});
      return o;
    };
  }
});

Operators.push({
  name: "Harmonics",
  hue: 0.85, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    const freq = 300;
    const samples = 7;
    const curve = new Float32Array(7);
    curve[0] = 1;
    curve[1] = -0.5;
    let push = false;

    let wave = null;
    const real = new Float32Array(samples+1);
    const imag = new Float32Array(samples+1);
    function update() {
      real[0] = imag[0] = 0;
      for(let i=1;i<=samples;i++) {
        const v = curve[i-1];
        const a = 0; // Math.random() * 2 * Math.PI;
        real[i] = v*Math.cos(a);
        imag[i] = v*Math.sin(a);
      }
      wave = E.X.createPeriodicWave(real,imag,{disableNormalization:true});
    }
    update();
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
        update();
        n.applyRefresh();
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
      o.frequency.value = freq;
      o.start();
      n.apply(_=>{
        o.setPeriodicWave(wave);
      });
      X.note.listen((p,v)=>{
        const shift = Math.log2(X.frequency/freq) + p + X.pitch;
        o.detune.setTargetAtTime(1200 * shift, E.now(), 0.001);
      }, _=>{});
      return o;
    };
  }
});

Operators.push({
  name: "Microphone",
  hue: 0.85, sat: 1,
  type: Type.forward,
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
  type: Type.forward,
  initialize: (n,E)=>{
    const b = E.X.createBuffer(1, E.X.sampleRate * 5, E.X.sampleRate);
    const c = b.getChannelData(0);
    for(let i=0;i<b.length;i++) {
      c[i] = Math.random()*2-1;
    }
    n.eval = X=>{
      const o = E.X.createBufferSource();
      o.buffer = b;
      o.loop = true;
      o.start();
      return o;
    };
  }
});

Operators.push({
  name: "Chirp",
  hue: 0.85, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.eval = X=>{
      const o = E.X.createOscillator();
      o.start();
      X.note.listen((p,v)=>{
        const freq = X.frequency * Math.pow(2, p + X.pitch);
        o.frequency.value = freq;
        o.frequency.setTargetAtTime(freq/5, E.now(), 0.03);
      }, _=>{
      });
      return o;
    };
  }
});

Operators.push({
  name: "Envelope",
  hue: 0.95, sat: 1,
  type: Type.forward,
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
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(Math.pow(v,2), E.now(), 0.01);
      }, _=>{
        g.gain.setTargetAtTime(0, E.now(), 0.1);
      });
      return g;
    };
  }
});

Operators.push({
  name: "Pluck",
  hue: 0.95, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 0;
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      X.note.listen((p,v)=>{
        const freq = X.frequency * Math.pow(2, p + X.pitch);
        g.gain.setTargetAtTime(1, E.now(), 0.001);
        g.gain.setTargetAtTime(0, E.now() + 1/freq, 0.001);
      }, _=>{
      });
      return g;
    };
  }
});

Operators.push({
  name: "Release",
  hue: 0.95, sat: 1,
  type: Type.forward,
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
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(1, E.now(), 0.001);
      }, _=>{
        g.gain.setTargetAtTime(0, E.now(), volume*0.1);
      });
      return g;
    };
  }
});

Operators.push({
  name: "Attack",
  hue: 0.95, sat: 1,
  type: Type.forward,
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
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(0, E.now(), 0.001);
        g.gain.setTargetAtTime(Math.pow(v,2), E.now()+0.001, volume*0.1);
      }, _=>{});
      return g;
    };
  }
});

Operators.push({
  name: "Decay",
  hue: 0.95, sat: 1,
  type: Type.forward,
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
      n.data = { gain: g };
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      X.note.listen((p,v)=>{
        g.gain.setTargetAtTime(1, E.now(), 0.001);
        g.gain.setTargetAtTime(0, E.now()+delay+0.001, volume*0.2);
      }, _=>{});
      return g;
    };
  }
});

const filterPrefs = [
  { name: "LowPass",
    type: "lowpass",
    visual: "mag",
    unit: "decibel",
    param: { pitch: 256, q: 1 }
  },
  { name: "HighPass",
    type: "highpass",
    visual: "mag",
    unit: "decibel",
    param: { pitch: -32, q: -3 }
  },
  { name: "AllPass",
    type: "allpass",
    visual: "phase",
    unit: "scalar",
    param: { pitch: 0, q: 0 }
  }
];
filterPrefs.forEach(pref=>{
  Operators.push({
    name: pref.name,
    hue: 0.4, sat: 1,
    type: Type.forward,
    initialize: (n,E)=>{
      const freqArray = new Float32Array(256);
      const base = 1.0405;
      for(let i=0;i<256;i++) freqArray[i] = Math.pow(base,i);
      const magArray = new Float32Array(256);
      const phaseArray = new Float32Array(256);
      const param = { pitch: pref.param.pitch, q: pref.param.q };
      let prev = null, diverge = false;
      function update() {
        if(!n.data.filter) return;
        n.data.filter.getFrequencyResponse(freqArray, magArray, phaseArray);
        diverge = false;
        for(let i=0;i<freqArray.length;i++) {
          if(magArray[i] > 1.001) diverge = true;
        }
      }
      n.event.mouse = (e,p,w,h)=>{
        const cur = V2(p.x/w, p.y/h);
        if(e == "down") {
          prev = cur;
        } else if(e == "up") {
          prev = null;
        } else if(e == "move") {
          if(prev) {
            const dif = cur.sub(prev);
            param.pitch += dif.x*256;
            param.q -= dif.y*20;
            param.pitch = Clamp(-32,256)(param.pitch);
            param.q = Clamp(-20,20)(param.q);
            update();
            n.applyRefresh();
            prev = cur;
          }
        }
      };
      n.render = (R,w,h)=>{
        const X = R.X;
        if(diverge) {
          R.circle(w/2,h/2,Math.min(w,h)/4).stroke(n.operator.hue,n.operator.sat*0.75,0.4,0.02);
        }
        R.line(w*0.5,0.1,w*0.5,h-0.1).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
        if(n.data.filter) {
          R.shape(_=>{
            const a = pref.visual == "mag" ? magArray : phaseArray;
            const f = pref.visual == "mag" ? (x=>x-1) : (x=>x/Math.PI);
            for(let i=0;i<256;i++) {
              const v = a[i];
              const x = 0.15+(i/255)*(w-0.3);
              const y = h*0.5-f(v)*(h-0.3)/2;
              if(i == 0) X.moveTo(x,y);
              else X.lineTo(x,y);
            }
          }).stroke(0,0,1,0.02);
        }
      };
      n.eval = X=>{
        const f = E.X.createBiquadFilter();
        f.type = pref.type;
        f.frequency.value = Math.min(24000,Math.pow(base,param.pitch));
        f.Q.value = param.q;
        n.apply(_=>{
          f.frequency.setTargetAtTime(Math.min(24000,Math.pow(base,param.pitch)), E.now(), 0.01);
          f.Q.setTargetAtTime(pref.unit == "decibel" ? param.q : Math.pow(10,param.q/20), E.now(), 0.01);
        });
        n.data = { filter: f };
        n.connection.input.forEach(c=>{
          if(c.type == Type.forward) {
            c.source.result[X.id].connect(f);
          }
        });
        update();
        return f;
      };
    }
  });
});

Operators.push({ // TODO
  name: "Reverb",
  hue: 0.4, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    let alpha = 2, beta = 1;
    let drag = false;
    let mousePos = null;
    const b = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
    const samples = E.X.sampleRate;
    function update() {
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
      n.applyRefresh();
    }
    update();
    n.event.mouse = (e,p,w,h)=>{
      const cur = V2(p.x/w, p.y/h);
      if(e == "down") {
        drag = true;
        mousePos = cur;
      } else if(e == "up") {
        drag = false;
        update();
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
      n.apply(_=>{
        r.buffer = b;
      });
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
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
  type: Type.forward,
  initialize: (n,E)=>{
    let volume = 1;
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
        n.applyRefresh();
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
      n.apply(_=>{
        g.gain.setTargetAtTime(Math.pow(volume, 2), E.now(), 0.001);
      });
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Loss",
  hue: 0.95, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    let volume = 1;
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
        n.applyRefresh();
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
      let freq = 440;
      n.apply(_=>{
        g.gain.setTargetAtTime(Math.exp(-volume*100/freq), E.now(), 0.001);
      });
      X.note.listen((p,v)=>{
        freq = X.frequency * Math.pow(2, p + X.pitch);
        g.gain.setTargetAtTime(Math.exp(-volume*100/freq), E.now(), 0.001);
      }, _=>{});
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Amplify",
  hue: 0.95, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    let volume = 1;
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
        n.applyRefresh();
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
      n.apply(_=>{
        g.gain.setTargetAtTime(Math.pow(4, volume), E.now(), 0.001);
      });
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
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
  type: Type.forward,
  initialize: (n,E)=>{
    const freq = 300;
    const curve = [0,0,0,1,0,0,0];
    let diverge = false;
    const samples = 7;
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
        curve[i] = y*0.99;
        let sum = 0;
        for(let i=4;i<7;i++) sum += Math.abs(curve[i]*0.99);
        diverge = sum >= 1.0;
        n.applyRefresh();
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      if(diverge) {
        R.circle(w/2,h/2,Math.min(w,h)/4).stroke(n.operator.hue,n.operator.sat*0.75,0.4,0.02);
      }
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
      const i = E.X.createGain();
      const o = E.X.createGain();
      const ds = [], gs = [];
      for(let j=0;j<7;j++) {
        const d = E.X.createDelay();
        d.delayTime.value = 1/440*Math.abs(j-3);
        const g = E.X.createGain();
        g.gain.value = curve[j];
        ds.push(d);
        gs.push(g);
        if(j < 3) {
          i.connect(d);
          d.connect(g);
          g.connect(o);
        } else if(j == 3) {
          i.connect(g);
          g.connect(o);
        } else {
          o.connect(d);
          d.connect(g);
          g.connect(o);
        }
      }
      n.apply(_=>{
        for(let i=0;i<7;i++) {
          gs[i].gain.setTargetAtTime(curve[i], E.now(), 0.001);
        }
      });
      X.note.listen((p,v)=>{
        for(let i=0;i<7;i++) {
          const freq = X.frequency * Math.pow(2, p + X.pitch);
          ds[i].delayTime.setTargetAtTime(1/freq*Math.abs(i-3), E.now(), 0.001);
        }
      }, _=>{});
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(i);
        }
      });
      return o;
    };
  }
});

/* Operators.push({
  name: "Lerp",
  hue: 0.7, sat: 1,
  type: Type.scalar
});*/

Operators.push({ // TODO
  name: "Distortion",
  hue: 0.25, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    let alpha = 1, beta = 1;
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
        alpha += dif.y*3;
        beta += dif.x*3;
        alpha = Clamp(-5, 5)(alpha);
        beta = Clamp(-5, 5)(beta);
        mousePos = cur;
      }
    };
    const cu = x=>{
      const u = Math.abs(x);
      const u2 = u*u;
      const a = alpha+beta-2;
      const b = -2*alpha-beta+3;
      const c = alpha;
      const f = a*u*u2 + b*u2 + c*u;
      return Clamp(-1,1)(f * Math.sign(x));
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.circle(w/2+(w-0.1)*beta/10,h/2+(h-0.1)*alpha/10,0.02).stroke(n.operator.hue,n.operator.sat*0.8,0.5,0.02);
      R.shape(_=>{
        for(let i=0;i<256;i++) {
          const v = cu(i/255 * 2 - 1);
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
        for(let i=0;i<curve.length;i++) {
          const x = i/(curve.length-1) * 2 - 1;
          curve[i] = cu(x);
        }
        w.curve = curve;
      };
      n.update();
      p.connect(w);
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(p);
        }
      });
      return w;
    };
  }
});

/*Operators.push({
  name: "Equalizer",
  hue: 0.4, sat: 1,
  type: Type.forward
});

Operators.push({
  name: "Compressor",
  hue: 0.25, sat: 1,
  type: Type.forward
});

Operators.push({
  name: "Mixer",
  hue: 0.95, sat: 1,
  type: Type.forward
});

Operators.push({
  name: "Value",
  hue: 0.7, sat: 1,
  type: Type.scalar
});*/

Operators.push({
  name: "Forward",
  hue: 0.4, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.dual) {
          const m = c.source.result[X.id];
          m.right.connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Backward",
  hue: 0.15, sat: 1,
  type: Type.backward,
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.dual) {
          const m = c.source.result[X.id];
          g.connect(m.left);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Join",
  hue: 0.25, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        } else if(c.type == Type.backward) {
          g.connect(c.source.result[X.id]);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Terminal",
  hue: 0.78, sat: 1,
  type: Type.dual,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    n.eval = X=>{
      const right = E.X.createGain();
      const left = E.X.createGain();
      left.connect(right);
      left.gain.value = 1; // TODO
      return { left: left, right: right };
    };
  }
});

Operators.push({
  name: "Delay",
  hue: 0.4, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.render = (R,w,h)=>{};
    let freq = 440;
    n.eval = X=>{
      const d = E.X.createDelay();
      d.delayTime.value = 1/freq;
      X.note.listen((p,v)=>{
        freq = X.frequency * Math.pow(2, p + X.pitch);
        d.delayTime.setTargetAtTime(1/freq, E.now(), 0.001);
      }, _=>{});
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(d);
        }
      });
      return d;
    };
  }
});

Operators.push({
  name: "Scatter",
  hue: 0.78, sat: 1,
  type: Type.dual,
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
        n.applyRefresh();
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
      const rightIn = E.X.createGain();
      const leftIn = E.X.createGain();
      const rightStraight = E.X.createGain();
      const leftStraight = E.X.createGain();
      const r2lScatter = E.X.createGain();
      const l2rScatter = E.X.createGain();
      const rightOut = E.X.createGain();
      const leftOut = E.X.createGain();
      n.apply(_=>{
        let k = volume;
        rightStraight.gain.value = 1+k;
        leftStraight.gain.value = 1-k;
        r2lScatter.gain.value = k;
        l2rScatter.gain.value = -k;
      });
      rightIn.connect(rightStraight);
      rightIn.connect(r2lScatter);
      leftIn.connect(leftStraight);
      leftIn.connect(l2rScatter);
      rightStraight.connect(rightOut);
      leftStraight.connect(leftOut);
      l2rScatter.connect(rightOut);
      r2lScatter.connect(leftOut);
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          const m = c.source.result[X.id];
          m.connect(rightIn);
        } else if(c.type == Type.backward) {
          const m = c.source.result[X.id];
          leftOut.connect(m);
        }
      });
      return { left: leftIn, right: rightOut };
    };
  }
});

Operators.push({
  name: "Scope",
  hue: 0, sat: 0,
  type: Type.forward,
  initialize: (n,E)=>{
    const array = new Float32Array(2048);
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
          n.data.analyser.getFloatTimeDomainData(array);
          shape = R.shape(_=>{
            for(let i=0;i<256;i++) {
              const v = array[i];
              const x = 0.15+(i/255)*(w-0.3);
              const y = h*0.5-v*(h-0.3)/2;
              if(i == 0) X.moveTo(x,y);
              else X.lineTo(x,y);
            }
          });
        } else {
          n.data.analyser.getFloatFrequencyData(array);
          shape = R.shape(_=>{
            for(let i=0;i<256;i++) {
              const v = array[i*8]/128 + 0.5;
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
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(a);
        }
      });
      n.data = { analyser: a };
      return a;
    };
  }
});

/*Operators.push({
  name: "Record",
  hue: 0, sat: 0,
  type: Type.none
});*/

Operators.push({
  name: "Detune",
  hue: 0.1, sat: 1,
  type: Type.forward,
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
        volume = Clamp(0, 1)(volume);
        n.applyRefresh();
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
        X.moveTo(w*0.5,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.context = E.rewriteContext(o=>{
      const n = o.note;
      o.note = {
        listen: (a,r)=>{
          n.listen((p,v)=>{
            const detune = (volume-0.5)*2;
            a(p+detune,v);
          },r);
        }
      };
    });
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Tempo",
  hue: 0.1, sat: 1,
  type: Type.forward,
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
        volume = Clamp(0, 1)(volume);
        n.applyRefresh();
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
        X.moveTo(w*0.5,h*0.5);
        X.lineTo(x,h*0.5);
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.context = E.rewriteContext(o=>{
      const t = o.tempo; // TODO: This will executed only once
      o.tempo = t*Math.pow(2,volume*2-1);
    });
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Beat",
  hue: 0.1, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    let noteListener = [];
    const note = {
      listen: (a,r)=>{
        noteListener.push({
          attack: a, release: r
        });
      },
      attack: (p,v)=>{
        noteListener.forEach(l=>{
          l.attack(p,v);
        });
      },
      release: p=>{
        noteListener.forEach(l=>{
          l.release(p);
        });
      }
    };
    let timer = null;
    n.context = E.rewriteContext(o=>{
      noteListener = []; // TODO: correct restart
      const tempo = o.tempo;
      if(timer) clearInterval(timer);
      timer = setInterval(_=>{
        note.attack(0,1);
        note.release(0);
      }, 60/tempo*1000);
      o.note = note;
    });
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Sequence",
  hue: 0.1, sat: 1,
  type: Type.forward,
  initialize: (n,E)=>{
    n.context = E.rewriteContext(o=>{
      let noteListener = [];
      o.note = {
        listen: (a,r)=>{
          noteListener.push({
            attack: a, release: r
          });
        },
        attack: (p,v)=>{
          noteListener.forEach(l=>{
            l.attack(p,v);
          });
        },
        release: p=>{
          noteListener.forEach(l=>{
            l.release(p);
          });
        }
      };
      const t = o.tempo; // TODO: This will executed only once
      o.tempo = t*Math.pow(2,volume*2-1);
    });
    n.eval = X=>{
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
          c.source.result[X.id].connect(g);
        }
      });
      return g;
    };
  }
});

Operators.push({
  name: "Output",
  hue: 0, sat: 0,
  type: Type.none,
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 1;
      n.connection.input.forEach(c=>{
        if(c.type == Type.forward) {
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
      }
    };
    n.eval = X=>{
      let count = 0;
      let g = null;
      n.connection.input.forEach(c=>{
        if(count == 0) {
          g = c.source.result[X.id];
        } else {
          if(c.type == Type.forward) {
            if(n.mode == "additive") {
              if(count == 1) {
                const t = g;
                g = E.X.createGain();
                t.connect(g);
              }
              c.source.result[X.id].connect(g);
            } else if(n.mode == "multiplicative"){
              const g2 = E.X.createGain();
              g.connect(g2);
              c.source.result[X.id].connect(g2.gain);
              g = g2;
            }
          } else if(c.type == Type.backward) {
            // duplicate
            if(count == 1) {
              const t = g;
              g = E.X.createGain();
              g.connect(t);
            } else {
              g.connect(c.source.result[X.id]);
            }
          } else if(c.type == Type.dual) {
            g = null; // TODO: crash!
          }
        }
        count++;
      });
      return g;
    };
  }
});

for(let i=0;i<Operators.length;i++) {
  console.log(Operators[i].name);
  OperatorMap[Operators[i].name] = Operators[i];
}
