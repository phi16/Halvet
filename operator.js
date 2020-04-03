Type.scalar = {
  hue: 0.6, sat: 1
};
Type.wave = {
  hue: 0.45, sat: 1
};
Type.curve = {
  hue: 0.9, sat: 1
};
Type.note = {
  hue: 0.15, sat: 1
};
Type.special = {
  hue: 0, sat: 0
};

Operators.push({
  name: "Oscillator",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  initialize: (n,E)=>{
    const freq = 300;
    const samples = E.X.sampleRate / freq;
    const curve = new Float32Array(samples);
    for(let i=0;i<samples;i++) {
      curve[i] = Math.sin(i*Math.PI*2/samples);
    }
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
      b.copyToChannel(curve, 0);
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
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
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
          const y = h*0.5-(v-0.5)*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const o = E.X.createOscillator();
      const freq = 300;
      const multiplier = 1;
      o.frequency.value = freq/multiplier;
      o.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      const samples = 32;
      const pR = new Float32Array(samples);
      const pI = new Float32Array(samples);
      n.update = _=>{
        pR[0] = 0, pI[0] = 0;
        for(let i=1;i<samples;i++) {
          const x = i/samples;
          let v = Math.pow(Saturate(1-x/beta), Math.pow(2,alpha));
          v = Saturate(v);
          const a = Math.random()*Math.PI*2;
          pR[i] = v*Math.cos(a);
          pI[i] = v*Math.sin(a);
        }
        o.setPeriodicWave(E.X.createPeriodicWave(pR,pI));
      };
      n.update();
      o.start();
      const g = E.X.createGain();
      o.connect(g.gain);
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
  name: "Noise",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: {},
  initialize: (n,E)=>{
    n.eval = X=>{ // TODO: parameter
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
  type: Type.wave, // TODO: scalar
  context: { note: Type.note, velocity: Type.scalar },
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
  name: "Filter",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Reverb",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {},
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
          const y = h*0.5-(v-0.5)*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const r = E.X.createConvolver();
      const samples = E.X.sampleRate;
      const b = E.X.createBuffer(2, E.X.sampleRate, E.X.sampleRate);
      n.update = _=>{
        const b0 = b.getChannelData(0);
        const b1 = b.getChannelData(1);
        for(let i=0;i<samples;i++) {
          const x = i/samples;
          let v = Math.pow(Saturate(1-x/beta), Math.pow(2,alpha));
          v = Saturate(v);
          const a = Math.random()*Math.PI*2;
          b0[i] = v*Math.cos(a);
          b1[i] = v*Math.sin(a);
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
  context: {},
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
  name: "Lerp",
  hue: 0.7, sat: 1,
  type: Type.scalar,
  context: {}
});

Operators.push({
  name: "Distortion",
  hue: 0.25, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Equalizer",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Pattern",
  hue: 0.1, sat: 1,
  type: Type.note,
  context: { tempo: Type.scalar }
});

Operators.push({
  name: "Perform",
  hue: 0.1, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Curve",
  hue: 0.7, sat: 1,
  type: Type.curve,
  context: {}
});

Operators.push({
  name: "Compressor",
  hue: 0.25, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Mixer",
  hue: 0.95, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Value",
  hue: 0.7, sat: 1,
  type: Type.scalar,
  context: {}
});

Operators.push({
  name: "Note",
  hue: 0.1, sat: 1,
  type: Type.note,
  context: {}
});

Operators.push({
  name: "Comment",
  hue: 0, sat: 0,
  type: Type.none,
  context: {},
  initialize: (n,E)=>{
    n.eval = X=>null;
  }
});

Operators.push({
  name: "Scope",
  hue: 0, sat: 0,
  type: Type.wave,
  context: {},
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

Operators.push({
  name: "Buffer",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: {}
});

Operators.push({
  name: "Output",
  hue: 0, sat: 0,
  type: Type.none,
  context: {},
  initialize: (n,E)=>{
    n.eval = X=>{
      const g = E.X.createGain();
      g.gain.value = 0.02;
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

Operators.push({
  name: "Translocate",
  hue: 0, sat: 0,
  type: Type.special,
  context: {}
});

Operators.push({
  name: "*", // Flow Control: add, multiply, duplicate, stop, turn
  hue: 0, sat: 0,
  type: Type.special,
  context: {},
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
  OperatorMap[Operators[i].name] = Operators[i];
}
