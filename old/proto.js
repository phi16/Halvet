const Runtime = async _=>{

const midi = await navigator.requestMIDIAccess();
const inputIt = midi.inputs.values();
const midiReceive = [];
for(let input = inputIt.next(); !input.done; input = inputIt.next()) {
  console.log("Midi connecteed");
  const device = input.value;
  device.addEventListener("midimessage", e=>{
    midiReceive.forEach(l=>{
      l(e);
    });
  });
}

function hue(h,l,d) {
  const a = h*Math.PI*2;
  let r = Math.cos(a+0)*0.5+0.5;
  let g = Math.cos(a+Math.PI*2/3)*0.5+0.5;
  let b = Math.cos(a-Math.PI*2/3)*0.5+0.5;
  r = (1-(1-r)*l) * d;
  g = (1-(1-g)*l) * d;
  b = (1-(1-b)*l) * d;
  r = Math.round(r*255);
  g = Math.round(g*255);
  b = Math.round(b*255);
  return "rgb(" + r + "," + g + "," + b + ")";
}
const Renderer = (X,w,h)=>{
  X.textAlign = "center";
  X.lineCap = X.lineJoin = "round";
  const r = {};
  function shape(s) {
    return {
      fill: c=>{
        s();
        X.fillStyle = c;
        X.fill();
      },
      stroke: (c,b)=>{
        s();
        X.strokeStyle = c;
        X.lineWidth = b;
        X.stroke();
      }
    }
  }
  r.text = (t,x,y,s)=>{
    return {
      fill: c=>{
        X.fillStyle = c;
        X.font = s + "px Sen";
        X.fillText(t,x,y);
      },
      stroke: (c,b)=>{
        X.strokeStyle = c;
        X.lineWidth = b;
        X.font = s + "px Sen";
        X.strokeText(t,x,y);
      }
    }
  };
  r.shape = s=>shape(_=>{
    X.beginPath();
    s();
  });
  r.poly = (x,y,s,n,a)=>shape(_=>{
    X.beginPath();
    for(let i=0;i<=n;i++) {
      const dx = Math.cos((i/n+a)*Math.PI*2), dy = Math.sin((i/n+a)*Math.PI*2);
      if(i == 0) X.moveTo(x+dx*s, y+dy*s);
      else X.lineTo(x+dx*s,y+dy*s);
    }
  });
  r.up = (x,y,s)=>r.poly(x,y,s,3,0.75);
  r.down = (x,y,s)=>r.poly(x,y,s,3,0.25);
  r.circle = (x,y,r)=>shape(_=>{
    X.beginPath();
    X.arc(x,y,r,0,2*Math.PI,false);
  });
  r.rect = (x,y,w,h)=>shape(_=>{
    X.beginPath();
    X.rect(x,y,w,h);
  });
  r.line = (x0,y0,x1,y1)=>shape(_=>{
    X.beginPath();
    X.moveTo(x0,y0);
    X.lineTo(x1,y1);
  });
  r.translated = (x,y,cb)=>{
    X.save();
    X.translate(x,y);
    cb();
    X.restore();
  };
  r.rotated = (a,cb)=>{
    X.save();
    X.rotate(a);
    cb();
    X.restore();
  };
  r.default = {
    X: X,
    w: w,
    h: h
  };
  return r;
};

const Key = (_=>{
  const k = {};
  let intIndex = 0;
  const corresp = {};
  const state = {};
  const listener = {};
  k.attack = (e,s)=>{
    const u = corresp[e];
    if(!state[u]) return;
    if(state[u].target == 1) return;
    state[u].target = 1;
    listener[u].forEach(l=>{
      l.attack(s);
    });
  };
  k.release = e=>{
    const u = corresp[e];
    if(!state[u]) return;
    if(state[u].target == 0) return;
    state[u].target = 0;
    listener[u].forEach(l=>{
      l.release();
    });
  };
  const states = [];
  k.state = o=>{
    const u = corresp[o.key];
    if(state[u]) {
      return state[u].value;
    }
    return 0;
  };
  k.step = _=>{
    Object.keys(state).forEach(u=>{
      state[u].value += (state[u].target - state[u].value) / 2.0;
      if(state[u].value < 0.001) state[u].value = 0;
    });
  };
  k.listen = (o,a,r)=>{
    corresp[o.key] = corresp[o.midi] = intIndex;
    const u = intIndex;
    intIndex++;
    if(listener[u] === undefined) {
      state[u] = { value: 0, target: 0 };
      listener[u] = [];
    }
    listener[u].push({
      attack: a,
      release: r
    });
  };
  return k;
})();

// Left
const leftKeys = [
  { key: "a", midi: "25", minor: 4/3 },
  { key: "s", midi: "27", minor: 1 },
  { key: "d", midi: "29", minor: 3/2 },
  { key: "z", midi: "24", major: 5/3 },
  { key: "x", midi: "26", major: 5/4 },
  { key: "c", midi: "28", major: 15/8 }
];
// Right
const rightKeys = [
  { key: "g", midi: "2f", ratio: 1 },
  { key: "h", midi: "31", ratio: 9/8 /* or 10/9 */ },
  { key: "j", midi: "33", ratio: 5/4 },
  { key: "v", midi: "2c", ratio: 15/8 },
  { key: "b", midi: "2e", ratio: 5/3 },
  { key: "n", midi: "30", ratio: 3/2 },
  { key: "m", midi: "32", ratio: 4/3 },
];

document.addEventListener("keydown",e=>{
  Key.attack(e.key, 1);
});
document.addEventListener("keyup",e=>{
  Key.release(e.key);
});
midiReceive.push(e=>{
  function h(s) {
    return ("0" + s.toString(16)).substr(-2);
  }
  if(e.data[0] == 0x90) {
    const str = e.data[2] / 128;
    Key.attack(h(e.data[1]), str);
  } else if(e.data[0] == 0x80){
    Key.release(h(e.data[1]));
  }
});

const UI = (_=>{
  let x = 0, y = 0;
  const objects = [];
  document.addEventListener("mousedown",e=>{
    if(e.button != 0) return;
    objects.forEach(o=>{ o.down(e.clientX-x, e.clientY-y); });
  });
  document.addEventListener("mousemove",e=>{
    if(e.button != 0) return;
    objects.forEach(o=>{ o.move(e.clientX-x, e.clientY-y); });
  });
  document.addEventListener("mouseup",e=>{
    if(e.button != 0) return;
    objects.forEach(o=>{ o.up(e.clientX-x, e.clientY-y); });
  });
  return {
    position: (px,py)=>{
      x = px, y = py;
    },
    add: o=>{
      objects.push(o);
    },
    render: R=>{
      objects.forEach(o=>{
        o.render(R);
      });
    }
  }
})();
const CurveSquare = (it0,it1)=>{
  const s2 = Math.sqrt(2);
  let x = 0, y = 0, s = 0;
  let t0 = it0, t1 = it1;
  const listeners = [];
  function inRegion(lx,ly) {
    const ux = Math.abs(lx), uy = Math.abs(ly);
    return ux + uy < s;
  }
  const States = {
    out: {},
    hover: {},
    drag: {},
    dragOut: {}
  };
  States.out.enter = "hover";
  States.hover.leave = "out";
  States.hover.press = "drag";
  States.drag.release = "hover";
  States.drag.leave = "dragOut";
  States.dragOut.enter = "drag";
  States.dragOut.release = "out";
  States.drag.event = States.dragOut.event = (lx,ly)=>{
    const dx = lx/s*2, dy = ly/s*2; // [-1,1]
    const u = dx + Math.pow(2,-dy+1)-1, v = dx + Math.pow(2,dy+1)-1;
    t0 = u, t1 = v;
  };
  States.drag.commit = States.dragOut.commit = _=>{
    listeners.forEach(l=>{ l(); });
  };
  let state = States.out;
  const ev = n=>{
    return (mx,my)=>{
      const e = n == "down" ? "press"
              : n == "up"   ? "release"
              : inRegion(mx-x,my-y) ? "enter" : "leave";
      const nn = state[e];
      if(state.commit && n == "up") state.commit(mx-x,my-y);
      if(States[nn]) {
        state = States[nn];
      }
      if(state.event) state.event(mx-x,my-y);
    };
  };
  let outColor = 0;
  function value(x) {
    const x2 = x*x;
    const a = t0+t1-2;
    const b = -2*t0-t1+3;
    const c = t0;
    return a*x*x2 + b*x2 + c*x;
  }
  return {
    listen: cb=>{
      listeners.push(cb);
    },
    clampValue: x=>{
      return Math.min(1,Math.max(0,value(Math.min(1,Math.max(0,x)))));
    },
    value: value,
    down: ev("down"),
    up: ev("up"),
    move: ev("move"),
    present: (px,py,ps)=>{
      x = px, y = py, s = ps;
    },
    render: R=>{
      const X = R.default.X, w = R.default.w, h = R.default.h;
      const size = w/24;
      const bold = w/400;
      if(state == States.out) outColor += (0 - outColor) / 2;
      else outColor += (1 - outColor) / 2;
      R.translated(x,y,_=>{
        R.poly(0,0,s,4,0).fill(hue(0,0,0.3+0.05*outColor));
        R.poly(0,0,s,4,0).stroke(hue(0,0,0.6),bold);
        R.translated(-s,0,_=>{
          R.rotated(Math.PI/4,_=>{
            R.shape(_=>{
              X.moveTo(0,0);
              for(let j=1;j<=64;j++) {
                X.lineTo(j/64*s*s2,-value(j/64)*s*s2);
              }
            }).stroke(hue(0,0,0.8),bold);
          });
        });
      });
    }
  };
};
function curveLists() {
  const a = [];
  for(let i=0;i<5;i++) {
    const t0 = [-3,-3,-3,1,-9][i];
    const t1 = [7,7,7,1,50][i];
    const cs = CurveSquare(t0,t1);
    a.push(cs);
    UI.add(cs);
  }
  return a;
}
const LeftCurves = curveLists();
const RightCurves = curveLists();

const waveFreqs = new Float32Array(4096);
let waitRender = true, waitAlpha = 1;
Q.renderCallback.push((X,w,h)=>{
  const size = w/24;
  const s3 = Math.sqrt(3.0);
  const bold = w/400;

  const R = Renderer(X,w,h);
  R.rect(0,0,w,h).fill(hue(0,0,0.1));
  if(waitAlpha > 0.001) {
    if(!waitRender) waitAlpha += (0 - waitAlpha) / 4.0;
    const e = h/24;
    const a = 0.08*(1-waitAlpha)+0.02;
    R.rect(0,0,w,e).fill(hue(0,0,a));
    R.rect(0,h-e,w,e).fill(hue(0,0,a));
  }

  R.shape(_=>{
    const le = waveFreqs.length;
    for(let i=0;i<le;i++) {
      const x = i*w/le;
      const y = h/2-waveFreqs[i];
      if(i == 0) X.moveTo(x,y);
      else X.lineTo(x,y);
    }
  }).stroke(hue(0,0,0.3), bold*0.5);

  X.save();
  X.translate(w*0.55,h/2+w*0.03);
  UI.position(w*0.55,h/2+w*0.03);
  UI.render(R);

  // Squares
  let x = 0;
  const curveNames = ["L","M","A","S","R"];
  for(let i=0;i<5;i++) {
    const s = size*0.18*(i+3);
    LeftCurves[i].present(-x-size*2, -size*2.5, s);
    R.text(curveNames[i],-x-size*2,-size*2.7-s,size*0.5).fill(hue(0,0,0.3));
    x += s*2 + size*0.4;
  }
  x = 0;
  for(let i=0;i<5;i++) {
    const s = size*0.18*(i+3);
    RightCurves[i].present(x+size*0, size*1.2, s);
    R.text(curveNames[i],x+size*0,size*1.7+s,size*0.5).fill(hue(0,0,0.3));
    x += s*2 + size*0.4;
  }

  // Left
  R.translated(-w/4,0,_=>{
    for(let i=0;i<3;i++) {
      function draw(shape, h, o) {
        const s = size * 0.9;
        shape(0,0,s).fill(hue(h,1,0.5));
        shape(0,0,s).stroke(hue(h,1,1),bold);
        const k = Key.state(o);
        shape(0,0,s*k*0.6).fill(hue(h,0.5,1));
        shape(0,0,s*Math.max(0,k*0.6-0.3)).fill(hue(h,1,0.5));
      }
      R.translated(i*size*s3,0,_=>{
        draw(R.up, (i*7+7)/12, leftKeys[i+3]);
      });
      R.translated((i-0.5)*size*s3,-0.5*size,_=>{
        draw(R.down, (i*7+3)/12, leftKeys[i]);
      });
    }
    for(let i=0;i<4;i++) {
      function draw(h, o) {
        const s = size*0.2;
        const k = Key.state(o);
        if(k>0) R.circle(0,0,s*(1+k)).stroke(hue(h,0.5,1),bold);
        R.circle(0,0,s).fill(hue(h,1,0.5));
        R.circle(0,0,s).stroke(hue(h,1,1),bold);
      }
      R.translated((i-1)*size*s3,-1*size,_=>{
        draw((i*7)/12, rightKeys[[1,4,2,3][i]] );
      });
      R.translated((i-0.5)*size*s3,0.5*size,_=>{
        draw((i*7+3)/12, rightKeys[[6,0,5,1][i]] );
      });
    }
  });

  // Right
  R.translated(0,-size,_=>{
    function drawRect(x0,x1,b) {
      const shape = R.rect(x0,-b/2,x1-x0,b);
      shape.fill(hue(0,0,0.25));
      shape.stroke(hue(0,0,0.5),bold);
    }
    R.translated(0*size*s3,0.5*size,_=>{
      drawRect(-size*s3/2,size*s3*2.5,size*0.1);
    });
    R.translated(0*size*s3,-1*size,_=>{
      drawRect(0,size*s3*2,size*0.1);
    });
    R.line(-0.5*s3*size,0.5*size,0,-1*size).stroke(hue(0,0,0.5),bold);
    R.line(2.5*s3*size,0.5*size,2*s3*size,-1*size).stroke(hue(0,0,0.5),bold);
    for(let i=0;i<7;i++) {
      function draw(h, o) {
        const s = size*0.2;
        const k = Key.state(o);
        if(k>0) R.circle(0,0,s*(1+k)).stroke(hue(h,0.5,1),bold);

        R.circle(0,0,s).fill(hue(h,1,0.5));
        R.circle(0,0,s).stroke(hue(h,1,1),bold);
      }
      if(i < 3) {
        R.translated(i*size*s3,-1*size,_=>{
          draw((i*2-2)/12, rightKeys[i]);
        });
      } else {
        R.translated((i-3.5)*size*s3,0.5*size,_=>{
          draw((-i*2+3)/12, rightKeys[i]);
        });
      }
    }
  });

  X.restore();
  Key.step();
});

Q.startCallback.push(_=>{

const Scheduler = (_=>{
  return {
    task: p=>{
      setTimeout(_=>{
        p();
      }, 0);
    },
    switch: _=>{
      return new Promise(resolve=>{
        setTimeout(_=>{
          resolve();
        }, 0);
      });
    }
  };
})();

const A = new AudioContext();
const out = A.createGain();
const comp = A.createDynamicsCompressor();
comp.threshold.value = -50;
comp.knee.value = 40;
comp.ratio.value = 12;
comp.attack.value = 0;
comp.release.value = 0.25;
comp.connect(A.destination);
out.connect(comp);
const analyser = A.createAnalyser();
analyser.fftSize = waveFreqs.length*2;
out.connect(analyser);
Q.renderCallback.push(_=>{
  analyser.getFloatFrequencyData(waveFreqs);
});

const rightReverb = A.createConvolver();
rightReverb.connect(out);
const rightShaper = A.createWaveShaper();
rightShaper.connect(rightReverb);
function setRightShaper() {
  Scheduler.task(async _=>{
    const curve = new Float32Array(256);
    for(let i=0;i<curve.length;i++) {
      const x = i/(curve.length-1) * 2 - 1;
      let v = RightCurves[3].clampValue(Math.abs(x)) * Math.sign(x);
      curve[i] = v;
      if(i % 10000 == 0) await Scheduler.switch();
    }
    rightShaper.curve = curve;
  });
}
function setRightReverb() {
  Scheduler.task(async _=>{
    const buffer = A.createBuffer(2, A.sampleRate, A.sampleRate);
    const b0 = buffer.getChannelData(0);
    const b1 = buffer.getChannelData(1);
    for(let i=0;i<b0.length;i++) {
      let v = RightCurves[4].clampValue(1 - i/b0.length);
      const a = (Math.random()-0.5) * 0.5 * 2 * Math.PI + Math.PI / 4;
      b0[i] = v * Math.cos(a);
      b1[i] = v * Math.sin(a);
      if(i % 10000 == 0) await Scheduler.switch();
    }
    rightReverb.buffer = buffer;
  });
}
setRightShaper();
setRightReverb();
RightCurves[3].listen(setRightShaper);
RightCurves[4].listen(setRightReverb);
const rightSounds = [];
let baseFrequency = 440;
let lastRatio = 0;
rightKeys.forEach(o=>{
  const gain = A.createGain();
  const osc = A.createOscillator();
  osc.frequency.value = 1;
  osc.connect(gain);
  osc.start();
  rightSounds.push(osc);
  gain.connect(rightShaper);
  gain.gain.linearRampToValueAtTime(0, A.currentTime);
  Key.listen(o,a=>{
    let ratio = Math.log2(o.ratio);
    ratio -= Math.floor(ratio - lastRatio + 0.5);
    lastRatio = ratio;
    osc.detune.value = ratio*1200;
    gain.gain.setTargetAtTime(a, A.currentTime, 0.01);
  },_=>{
    gain.gain.setTargetAtTime(0, A.currentTime, 0.1);
  });
});
function setRightSounds() {
  Scheduler.task(async _=>{
    const vf = Math.log2(baseFrequency);
    const multiplier = 1;
    const maxFreq = A.sampleRate*multiplier;
    const buffer = new Float32Array(maxFreq), iBuffer = new Float32Array(maxFreq);
    for(let i=1;i<maxFreq;i++) {
      const va = Math.log2(i/multiplier);
      let dif = va - vf;
      const eFac = RightCurves[2].clampValue(1 - dif/8); // Envelope

      const fDist = Math.abs(dif - Math.floor(dif + 0.5)); // Log
      const fFac = RightCurves[0].clampValue(1 - fDist*12);
      dif = Math.pow(2, dif);
      const uDist = Math.abs(dif - Math.floor(dif + 0.5)); // Ratio
      const uFac = RightCurves[1].clampValue(1 - uDist*8);
      let v = (fFac + uFac) * eFac;
      if(va < vf - 0.5) v = 0;
      v /= multiplier;
      const ra = Math.random() * 2 * Math.PI;
      buffer[i] = v * Math.cos(ra);
      iBuffer[i] = v * Math.sin(ra);
      if(i%10000 == 0) await Scheduler.switch();
    }
    const wave = A.createPeriodicWave(buffer, iBuffer);
    rightSounds.forEach(osc=>{
      osc.frequency.value = 1/multiplier;
      osc.setPeriodicWave(wave);
    });
  });
};
setRightSounds();
RightCurves.forEach(c=>{
  c.listen(setRightSounds);
});

function freqName(vf) {
  const e = vf - Math.floor(vf);
  return Math.floor(e*1000) + "";
}
const leftSounds = {};
for(let i=0;i<4;i++) {
  for(let j=0;j<2;j++) {
    const f = baseFrequency * Math.pow(3,i-1) * Math.pow(5/3,j);
    const vf = Math.log2(f);
    const name = freqName(vf);
    const gain = A.createGain();
    gain.connect(out);
    gain.gain.value = 0;
    let playCount = 0;
    leftSounds[name] = {
      attack: a=>{
        playCount++;
        if(playCount > 1) return;
        gain.gain.setTargetAtTime(a*0.3, A.currentTime, 0.01);
      },
      release: _=>{
        playCount--;
        if(playCount >= 1) return;
        gain.gain.setTargetAtTime(0, A.currentTime, 0.1);
      }
    };
    Scheduler.task(async _=>{
      const multiplier = 1;
      const maxFreq = A.sampleRate*multiplier;
      const buffer = new Float32Array(maxFreq), iBuffer = new Float32Array(maxFreq);
      const osc = A.createOscillator();
      for(let i=1;i<maxFreq;i++) {
        const va = Math.log2(i/multiplier);
        const dif = vf - va;
        const fDist = Math.abs(dif - Math.floor(dif + 0.5));
        const fac = Math.pow(Math.max(1 - fDist*12, 0), 9);
        const eDist = Math.abs(va - Math.log2(baseFrequency));
        const eFac = Math.max(1 - Math.pow(eDist/3, 3), 0);
        let v = fac * eFac * 0.2;
        v /= multiplier;
        const ra = Math.random() * 2 * Math.PI;
        buffer[i] = v * Math.cos(ra);
        iBuffer[i] = v * Math.sin(ra);
        if(i%10000 == 0) await Scheduler.switch();
      }
      console.log("Computation done: " + name);
      const wave = A.createPeriodicWave(buffer, iBuffer);
      await Scheduler.switch();
      osc.setPeriodicWave(wave);
      osc.frequency.value = 1/multiplier;
      osc.connect(gain);
      osc.start();
      console.log("Preparation done: " + name);
    });
  }
}
leftKeys.forEach(o=>{
  const base = o.major ? o.major : o.minor;
  const freqs = o.major ? [1, 4/5, 6/5] : [1, 5/4, 5/6];
  const resps = [];
  freqs.forEach(ratio=>{
    const f = baseFrequency * base * ratio;
    const vf = Math.log2(f);
    const name = freqName(vf);
    const s = leftSounds[name];
    if(!s) console.log(name + " not found");
    resps.push(leftSounds[name]);
  });
  Key.listen(o,a=>{
    resps.forEach(r=>{ r.attack(a); });
  },_=>{
    resps.forEach(r=>{ r.release(); });
  });
});
waitRender = false;

});

};
Runtime();
