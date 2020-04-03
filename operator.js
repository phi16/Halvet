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
  name: "Pure",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  initialize: (n,E)=>{
    const samples = 400;
    const curve = [new Float32Array(samples), new Float32Array(samples)];
    for(let i=0;i<samples;i++) {
      curve[0][i] = Math.cos(i*Math.PI*2/samples);
      curve[1][i] = Math.sin(i*Math.PI*2/samples);
    }
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        for(let i=0;i<=samples;i++) {
          const v = curve[1][i == samples ? 0 : i];
          const x = 0.15+(i/samples)*(w-0.3);
          const y = h*0.5-v*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
    n.eval = X=>{
      const oR = E.X.createBufferSource();
      const bR = E.X.createBuffer(1, samples, E.X.sampleRate);
      bR.copyToChannel(curve[0], 0);
      const oI = E.X.createBufferSource();
      const bI = E.X.createBuffer(1, samples, E.X.sampleRate);
      bI.copyToChannel(curve[1], 0);
      const freq = E.X.sampleRate / samples;
      oR.buffer = bR;
      oI.buffer = bI;
      oR.detune.value = oI.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      oR.loop = oI.loop = true;
      oR.start();
      oI.start();
      return { real: oR, imag: oI };
    };
  }
});

Operators.push({
  name: "Harmonics",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  initialize: (n,E)=>{
    let alpha = 0, beta = 0.5;
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
        alpha += dif.y*5;
        beta += dif.x;
        beta = Clamp(0.001, 1)(beta);
        if(n.update) n.update();
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
      const oR = E.X.createOscillator();
      const oI = E.X.createOscillator();
      const freq = 600;
      const multiplier = 1;
      oR.frequency.value = oI.frequency.value = freq/multiplier;
      oR.detune.value = oI.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      const samples = 256;
      const pR = new Float32Array(samples);
      const pI = new Float32Array(samples);
      const nR = new Float32Array(samples);
      n.update = _=>{
        pR[0] = 1, pI[0] = 0, nR[0] = -1;
        for(let i=1;i<samples;i++) {
          const x = Math.log2(i)/Math.log2(samples);
          let v = Math.pow(Saturate(1-x/beta), Math.pow(2,alpha));
          const a = 0;
          pR[i] = v*Math.cos(a);
          pI[i] = v*Math.sin(a);
          nR[i] = -pR[i];
        }
        oR.setPeriodicWave(E.X.createPeriodicWave(pR,pI));
        oI.setPeriodicWave(E.X.createPeriodicWave(pI,nR));
      };
      n.update();
      oR.start();
      oI.start();
      const iR = E.X.createGain();
      const iI = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].real.connect(iR);
          c.source.result[X.id].imag.connect(iI);
        }
      });
      return E.multiply(oR,oI,iR,iI);
    };
  }
});

Operators.push({
  name: "Detune",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: {},
  initialize: (n,E)=>{
    let alpha = 0, beta = 0.5;
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
        alpha += dif.y*5;
        beta += dif.x;
        beta = Clamp(0.001, 1)(beta);
        if(n.update) n.update();
        mousePos = cur;
      }
    };
    n.render = (R,w,h)=>{ };
    n.eval = X=>{
      const oR = E.X.createOscillator();
      const oI = E.X.createOscillator();
      oR.frequency.value = oI.frequency.value = 1;
      const samples = 256;
      const pR = new Float32Array(samples);
      const pI = new Float32Array(samples);
      const nR = new Float32Array(samples);
      n.update = _=>{
        for(let i=0;i<samples;i++) {
          pR[i] = pI[i] = nR[i] = 0;
        }
        pR[100] = 0;
        pI[100] = -1;
        nR[100] = 0;
        oR.setPeriodicWave(E.X.createPeriodicWave(pR,pI));
        oI.setPeriodicWave(E.X.createPeriodicWave(pI,nR));
      };
      n.update();
      oR.start();
      oI.start();
      const iR = E.X.createGain();
      const iI = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].real.connect(iR);
          c.source.result[X.id].imag.connect(iI);
        }
      });
      return E.multiply(oR,oI,iR,iI);
    };
  }
});

Operators.push({
  name: "Proto",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: {},
  initialize: (n,E)=>{
    n.eval = X=>{
      const oR = E.X.createOscillator();
      const oI = E.X.createOscillator();
      oR.frequency.value = oI.frequency.value = 1;
      const freq = 600;
      oR.detune.value = oI.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
      const samples = E.X.sampleRate;
      const pR = new Float32Array(samples);
      const pI = new Float32Array(samples);
      const nR = new Float32Array(samples);
      n.update = _=>{
        for(let i=0;i<samples;i++) {
          let dif = Math.log2(i / freq);
          const eFac = Math.pow(Saturate(1 - dif/8), 3); // Envelope

          const fDist = Math.abs(dif - Math.floor(dif + 0.5)); // Log
          const fFac = Math.pow(Saturate(1 - fDist*12), 900);
          let v = fFac * eFac;
          if(i < freq) v = 0;
          const ra = Math.random() * 2 * Math.PI;
          pR[i] = v * Math.cos(ra);
          pI[i] = v * Math.sin(ra);
          nR[i] = -pR[i];
        }
        oR.setPeriodicWave(E.X.createPeriodicWave(pR,pI));
        oI.setPeriodicWave(E.X.createPeriodicWave(pI,nR));
      };
      n.update();
      oR.start();
      oI.start();
      return { real: oR, imag: oI };
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
      const oR = E.X.createBufferSource();
      const bR = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
      const oI = E.X.createBufferSource();
      const bI = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
      const cR = bR.getChannelData(0);
      const cI = bI.getChannelData(0);
      for(let i=0;i<E.X.sampleRate;i++) {
        cR[i] = Math.random()*2-1;
        cI[i] = Math.random()*2-1;
      }
      oR.buffer = bR;
      oI.buffer = bI;
      oR.loop = oI.loop = true;
      oR.start();
      oI.start();
      return { real: oR, imag: oI };
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
      const g = E.X.createGain();
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          c.source.result[X.id].real.connect(a);
          c.source.result[X.id].imag.connect(g);
        }
      });
      n.data.analyser = a;
      return { real: a, imag: g };
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
          c.source.result[X.id].real.connect(g);
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
      let gR = null, gI = null;
      n.connection.input.forEach(c=>{
        if(c.type == Type.wave) {
          if(count == 0) {
            gR = c.source.result[X.id].real;
            gI = c.source.result[X.id].imag;
          } else {
            if(count == 1) {
              const tR = gR, tI = gI;
              gR = E.X.createGain();
              gI = E.X.createGain();
              tR.connect(gR);
              tI.connect(gI);
            }
            // Additive
            // TODO: multiplicative
            c.source.result[X.id].real.connect(gR);
            c.source.result[X.id].imag.connect(gI);
          }
          count++;
        }
      });
      return { real: gR, imag: gI };
    };
  }
});

for(let i=0;i<Operators.length;i++) {
  OperatorMap[Operators[i].name] = Operators[i];
}
