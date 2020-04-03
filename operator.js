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
    const samples = 400;
    const curve = new Float32Array(samples);
    for(let i=0;i<samples;i++) {
      curve[i] = Math.sin(i*Math.PI*2/samples);
    }
    let spread = 0, prev = null, drag = false;
    n.event.mouse = (e,p,w,h)=>{
      // TODO: smoothing & nice UI
      if(e == "down") {
        spread = Math.max(0.01, Math.abs(p.y/h-0.5)*2);
        prev = p;
        drag = true;
      } else if(e == "up") {
        drag = false;
        if(n.data.buffer) n.data.buffer.copyToChannel(curve, 0);
      } else if(e == "move" && drag) {
        const y = (p.y-prev.y)/h;
        for(let i=0;i<samples;i++) {
          const x = 0.15+(i/samples)*(w-0.3);
          const d = 1 - Math.max(0, Math.max(prev.x-x, x-p.x))/spread;
          if(d>0) curve[i] -= d*y;
        }
        if(n.data.buffer) n.data.buffer.copyToChannel(curve, 0);
        prev = p;
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
      b.copyToChannel(curve, 0);
      const freq = E.X.sampleRate / samples;
      o.buffer = b;
      o.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      o.loop = true;
      o.start();
      n.data.buffer = b;
      return o;
    };
  }
});

Operators.push({
  name: "Harmonics",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  initialize: n=>{
    let drag = false;
    n.event.mouse = (e,p,w,h)=>{
      if(e == "down") {
        drag = true;
      } else if(e == "up") {
        drag = false;
      }
      if(drag && (e == "move" || e == "down")) {
        n.data.point.x = 1-p.x/w;
        n.data.point.y = 1-p.y/h;
        if(n.update) n.update();
      }
    };
    n.data = { point: { x:1, y:0 } };
    n.render = (R,w,h)=>{
      const X = R.X;
      const curve = CubicCurve(n.data.point.x, n.data.point.y);
      R.shape(_=>{
        for(let i=0;i<128;i++) {
          const v = E(curve(1-i/127))(0,1.5)(E.l)(-0.5,0.5);
          const x = 0.15+(i/127)*(w-0.3);
          const y = h*0.5-v*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const o = E.X.createOscillator();
      o.frequency.value = X.frequency * Math.pow(2, X.pitch);
      const real = new Float32Array(32);
      const imag = new Float32Array(32);
      n.update = _=>{
        const curve = CubicCurve(n.data.point.x, n.data.point.y);
        real[0] = 1, imag[0] = 0;
        for(let i=1;i<32;i++) {
          let v = Math.pow(Math.max(0, curve(1-i/31)), 4);
          let a = Math.random()*Math.PI*2;
          real[i] = v*Math.cos(a);
          imag[i] = v*Math.sin(a);
        }
        o.setPeriodicWave(E.X.createPeriodicWave(real,imag));
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
  name: "Impulse",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  initialize: n=>{
    let drag = false;
    n.event.mouse = (e,p,w,h)=>{
      if(e == "down") {
        drag = true;
      } else if(e == "up") {
        drag = false;
      }
      if(drag && (e == "move" || e == "down")) {
        n.data.point.x = 1-p.x/w;
        n.data.point.y = 1-p.y/h;
        if(n.update) n.update();
      }
    };
    n.data = { point: { x:1, y:0 } };
    n.render = (R,w,h)=>{
      const X = R.X;
      const curve = CubicCurve(n.data.point.x, n.data.point.y);
      R.shape(_=>{
        for(let i=0;i<128;i++) {
          const v = E(curve(1-i/127))(0,1)(E.l)(-0.5,0.5);
          const x = 0.15+(i/127)*(w-0.3);
          const y = h*0.5-v*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const o = E.X.createOscillator();
      const freq = 100;
      o.frequency.value = freq;
      o.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      const real = new Float32Array(32);
      const imag = new Float32Array(32);
      n.update = _=>{
        const curve = CubicCurve(n.data.point.x, n.data.point.y);
        real[0] = 1, imag[0] = 0;
        for(let i=1;i<32;i++) {
          let v = Math.pow(Math.max(0, curve(1-i/31)), 4);
          let a = Math.random()*Math.PI*2;
          real[i] = v*Math.cos(a);
          imag[i] = v*Math.sin(a);
        }
        o.setPeriodicWave(E.X.createPeriodicWave(real,imag));
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
    n.eval = X=>{
      const o = E.X.createBufferSource();
      const b = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
      const c = b.getChannelData(0);
      for(let i=0;i<E.X.sampleRate;i++) c[i] = Math.random()*2-1;
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
  type: Type.scalar,
  context: { note: Type.note, velocity: Type.scalar }
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
  context: {}
});

Operators.push({
  name: "Gain",
  hue: 0.95, sat: 1,
  type: Type.wave,
  context: {}
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
  context: {},
  initialize: n=>{
    n.data = { point: { x:0.5, y:0.5 } };
    let drag = false;
    n.event.mouse = (e,p,w,h)=>{
      if(e == "down") {
        drag = true;
      } else if(e == "up") {
        drag = false;
      }
      if(drag && (e == "move" || e == "down")) {
        n.data.point.x = 1-p.x/w;
        n.data.point.y = 1-p.y/h;
        if(n.update) n.update();
      }
    };
    n.render = (R,w,h)=>{
      const X = R.X;
      const curve = CubicCurve(n.data.point.x, n.data.point.y);
      R.shape(_=>{
        for(let i=0;i<128;i++) {
          const v = E(curve(i/127))(0,1)(E.l)(-0.5,0.5);
          const x = 0.15+(i/127)*(w-0.3);
          const y = h*0.5-v*(h-0.3);
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const p = E.X.createDynamicsCompressor();
      p.threshold.value = -50; // TODO: reconfigure
      p.knee.value = 40;
      p.ratio.value = 12;
      p.attack.value = 0;
      p.release.value = 0.25;
      const w = E.X.createWaveShaper();
      const curve = new Float32Array(256);
      n.update = _=>{
        const cu = CubicCurve(n.data.point.x, n.data.point.y);
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
  initialize: n=>{
    n.data = { array: new Float32Array(2048), analyser: null };
    let mode = "wave";
    n.event.key = (e,k)=>{
      if(e == "down") {
        if(k == "w") mode = "wave";
        if(k == "f") mode = "freq";
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
      g.gain.value = 0.1;
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
    n.eval = X=>{
      let count = 0;
      let g = null;
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          if(count == 0) g = c.source.result[X.id];
          else {
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
