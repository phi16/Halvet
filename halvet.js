const Region = _=>{
  const r = {};
  let nextId = 1;
  const regions = {};
  r.alloc = u=>{
    const i = { x:u.x, y:u.y, w:u.w, h:u.h, id:nextId, nodeId:null };
    regions[nextId] = i;
    nextId++;
    return i;
  };
  r.dealloc = u=>{
    delete regions[u.id];
  };
  r.available = u=>{
    const ris = Object.keys(regions);
    for(let ri=0;ri<ris.length;ri++) {
      const i = regions[ris[ri]];
      if(u.x < i.x+i.w && u.y < i.y+i.h && i.x < u.x+u.w && i.y < u.y+u.h) {
        return false;
      }
    }
    return true;
  };
  r.select = (x,y)=>{
    const ris = Object.keys(regions);
    for(let ri=0;ri<ris.length;ri++) {
      const i = regions[ris[ri]];
      if(i.x <= x && x <= i.x+i.w-1 && i.y <= y && y <= i.y+i.h-1) {
        return i;
      }
    }
    return null;
  };
  r.raycast = (x,y,a)=>{
    const dx = [0,1,0,-1][a], dy = [1,0,-1,0][a];
    let res = null, resD = -1;
    Object.keys(regions).forEach(ri=>{
      const i = regions[ri];
      let d = -1;
      if(i.y <= y && y <= i.y+i.h-1) {
        if(dx > 0) d = Math.max(d, i.x-x);
        if(dx < 0) d = Math.max(d, x-(i.x+i.w-1));
      }
      if(i.x <= x && x <= i.x+i.w-1) {
        if(dy > 0) d = Math.max(d, i.y-y);
        if(dy < 0) d = Math.max(d, y-(i.y+i.h-1));
      }
      if(d >= 1 && (res == null || d < resD)) {
        res = i;
        resD = d;
      }
    });
    return res ? { target: res, distance: resD } : null;
  };
  return r;
};
Region.corner = (r,a,i,ad)=>{
  const u = Mod(a+i,4);
  const d = ad === undefined ? 1 : ad;
  let loc = null;
  if(u == 0) loc = V2(0,0);
  if(u == 1) loc = V2(0,r.h-d);
  if(u == 2) loc = V2(r.w-d,r.h-d);
  if(u == 3) loc = V2(r.w-d,0);
  return loc.add(V2(r.x,r.y));
};

const Type = {
  none: {
    hue: 0, sat: 0
  },
  invalid: {
    hue: 0, sat: -1
  }
};

const Nodes = R=>{
  const s = {};
  let nextId = 1;
  const nodes = {};
  let connections = [];
  const ComputeConnection = _=>{
    Object.keys(nodes).forEach(ni=>{
      const n = nodes[ni];
      n.connection.input = [];
      n.connection.output = [];
      n.result = {};
    });
    connections = [];
    Object.keys(nodes).forEach(ni=>{
      const n = nodes[ni];
      if(n.operator.type == Type.none) return;
      const Connect = (p,a,type)=>{
        const t = R.raycast(p.x, p.y, a);
        const dx = [0,1,0,-1][a], dy = [1,0,-1,0][a];
        if(t) {
          const target = nodes[t.target.id];
          const dist = t.distance;
          const conn = {
            source: n,
            target: target,
            sourceLoc: p,
            targetLoc: p.add(V2(dx*dist,dy*dist)),
            type: type
          };
          n.connection.output.push(conn);
          target.connection.input.push(conn);
          connections.push(conn);
        } else {
          const conn = {
            source: n,
            target: null,
            sourceLoc: p,
            targetLoc: p.add(V2(dx,dy)),
            type: type
          };
          n.connection.output.push(conn);
          connections.push(conn);
        }
      };
      if(n.operator.name == "*") {
        n.open.forEach(o=>{
          let p = o.location;
          Connect(p,o.angle,Type.invalid);
        });
      } else {
        const p = Region.corner(n.region,n.angle,1);
        Connect(p,n.angle,n.operator.type);
      }
      n.type = null;
    });
    // Type Check
    const TypeCheck = n=>{
      const flowControl = n.operator.name == "*";
      if(n.type) return n.type;
      if(flowControl && n.connection.output.length == 0) {
        return n.type = Type.none;
      }
      let type = flowControl ? Type.none : n.operator.type;
      n.typeChecking = true;
      n.connection.input.forEach(c=>{
        const t = c.source;
        if(t.typeChecking) {
          type = Type.invalid;
        } else {
          const tt = TypeCheck(t);
          if(tt == Type.invalid) type = Type.invalid;
          else if(flowControl) {
            if(tt != Type.none) {
              if(type == Type.none) type = tt;
              else if(type != tt) type = Type.invalid;
            }
          }
        }
      });
      n.connection.output.forEach(c=>{
        c.type = type;
      });
      n.type = type;
      delete n.typeChecking;
      return type;
    };
    Object.keys(nodes).forEach(ni=>{
      const n = nodes[ni];
      TypeCheck(n);
    });
  };
  s.new = (i,o,a,cb)=>{
    const n = {
      id: nextId,
      region: i,
      operator: o,
      angle: a,
      event: {
        mouse: (e,p)=>{},
        key: (e,k)=>{},
        begin: _=>_,
        end: _=>_
      },
      connection: {
        input: [],
        output: []
      },
      result: {}
    };
    nodes[nextId] = n;
    i.nodeId = nextId;
    nextId++;
    if(o.initialize) o.initialize(n);
    if(cb) cb(n);
    ComputeConnection();
    return n;
  };
  s.remove = n=>{
    delete nodes[n.id];
    ComputeConnection();
  };
  s.at = id=>{
    return nodes[id];
  };
  s.connectionAt = p=>{
    const cs = [];
    for(let i=0;i<connections.length;i++) {
      const c = connections[i];
      const rel = p.sub(c.sourceLoc);
      const dir = c.targetLoc.sub(c.sourceLoc);
      if(rel.x == 0 && dir.x == 0 && rel.y*dir.y > 0) {
        if(c.target == null || Math.abs(rel.y) < Math.abs(dir.y)) {
          cs.push(c);
        }
      }
      if(rel.y == 0 && dir.y == 0 && rel.x*dir.x > 0) {
        if(c.target == null || Math.abs(rel.x) < Math.abs(dir.x)) {
          cs.push(c);
        }
      }
    }
    return cs;
  };
  s.traverse = cb=>{
    Object.keys(nodes).forEach(ni=>{
      cb(nodes[ni]);
    });
  };
  s.compute = _=>{
    ComputeConnection();
  };
  return s;
};

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

const Operators = [{
  name: "Oscillator",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  eval: (n,E,X)=>{
    const o = E.X.createBufferSource();
    const b = E.X.createBuffer(1, 400, E.X.sampleRate);
    b.copyToChannel(n.data.curve, 0);
    const freq = E.X.sampleRate / 400;
    o.buffer = b;
    o.detune.value = 1200 * (Math.log2(X.frequency/freq) + X.pitch);
    o.loop = true;
    o.start();
    n.data.buffer = b;
    return o;
  },
  initialize: n=>{
    const curve = new Float32Array(400);
    for(let i=0;i<400;i++) {
      curve[i] = Math.sin(i*Math.PI*2/400);
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
        if(n.data.buffer) n.data.buffer.copyToChannel(n.data.curve, 0);
      } else if(e == "move" && drag) {
        const y = (p.y-prev.y)/h;
        for(let i=0;i<400;i++) {
          const x = 0.15+(i/400)*(w-0.3);
          const d = 1 - Math.max(0, Math.max(prev.x-x, x-p.x))/spread;
          if(d>0) curve[i] -= d*y;
        }
        if(n.data.buffer) n.data.buffer.copyToChannel(n.data.curve, 0);
        prev = p;
      }
    };
    n.data = { curve: curve };
    n.render = (R,w,h)=>{
      const X = R.X;
      R.line(0.1,h*0.5,w-0.1,h*0.5).stroke(n.operator.hue,n.operator.sat*0.25,0.5,0.01);
      R.shape(_=>{
        for(let i=0;i<=400;i++) {
          const v = n.data.curve[i == 400 ? 0 : i];
          const x = 0.15+(i/400)*(w-0.3);
          const y = h*0.5-v*(h-0.3)/2;
          if(i == 0) X.moveTo(x,y);
          else X.lineTo(x,y);
        }
      }).stroke(n.operator.hue,n.operator.sat*0.5,1,0.02);
    };
  }
},{
  name: "Harmonics",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar },
  eval: (n,E,X)=>{
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
  },
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
  }
},{
  name: "Impulse",
  hue: 0.5, sat: 1,
  type: Type.wave,
  context: { pitch: Type.scalar }
},{
  name: "Noise",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: {},
  eval: (n,E,X)=>{
    const o = E.X.createBufferSource();
    const b = E.X.createBuffer(1, E.X.sampleRate, E.X.sampleRate);
    const c = b.getChannelData(0);
    for(let i=0;i<E.X.sampleRate;i++) c[i] = Math.random()*2-1;
    o.buffer = b;
    o.loop = true;
    o.start();
    return o;
  },
},{
  name: "Envelope",
  hue: 0.7, sat: 1,
  type: Type.scalar,
  context: { note: Type.note, velocity: Type.scalar }
},{
  name: "Filter",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Reverb",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Gain",
  hue: 0.95, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Lerp",
  hue: 0.7, sat: 1,
  type: Type.scalar,
  context: {}
},{
  name: "Distortion",
  hue: 0.25, sat: 1,
  type: Type.wave,
  context: {},
  eval: (n,E,X)=>{
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
  },
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
  }
},{
  name: "Equalizer",
  hue: 0.4, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Pattern",
  hue: 0.1, sat: 1,
  type: Type.note,
  context: { tempo: Type.scalar }
},{
  name: "Perform",
  hue: 0.1, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Curve",
  hue: 0.7, sat: 1,
  type: Type.curve,
  context: {}
},{
  name: "Compressor",
  hue: 0.25, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Mixer",
  hue: 0.95, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Value",
  hue: 0.7, sat: 1,
  type: Type.scalar,
  context: {}
},{
  name: "Note",
  hue: 0.1, sat: 1,
  type: Type.note,
  context: {}
},{
  name: "Comment",
  hue: 0, sat: 0,
  type: Type.none,
  context: {},
  eval: (n,E,X)=>{ return null; }
},{
  name: "Scope",
  hue: 0, sat: 0,
  type: Type.wave,
  context: {},
  eval: (n,E,X)=>{
    const a = E.X.createAnalyser();
    a.fftSize = 4096;
    n.connection.input.forEach(c=>{
      if(c.type == Type.wave) {
        c.source.result[X.id].connect(a);
      }
    });
    n.data.analyser = a;
    return a;
  },
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
    }
  }
},{
  name: "Buffer",
  hue: 0.85, sat: 1,
  type: Type.wave,
  context: {}
},{
  name: "Output",
  hue: 0, sat: 0,
  type: Type.none,
  context: {},
  eval: (n,E,X)=>{
    const g = E.X.createGain();
    g.gain.value = 0.1;
    n.connection.input.forEach(c=>{
      if(c.type == Type.wave) {
        c.source.result[X.id].connect(g);
      }
    });
    E.addOutput(g);
    return null;
  }
},{
  name: "Translocate",
  hue: 0, sat: 0,
  type: Type.special,
  context: {}
},{
  name: "*", // Flow Control: add, multiply, duplicate, stop, turn
  hue: 0, sat: 0,
  type: Type.special,
  context: {},
  eval: (n,E,X)=>{
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
  }
}];

const OperatorMap = {};
for(let i=0;i<Operators.length;i++) {
  OperatorMap[Operators[i].name] = Operators[i];
}

const Runtime = _=>{
  const X = new AudioContext();
  const out = X.createDynamicsCompressor();
  out.threshold.value = -50; // TODO: reconfigure
  out.knee.value = 40;
  out.ratio.value = 12;
  out.attack.value = 0;
  out.release.value = 0.25;
  out.connect(X.destination);
  let outputNodes = [];

  const r = {};
  let ctxId = 0;
  r.X = X;
  r.restart = _=>{
    ctxId = 0;
    outputNodes.forEach(g=>{
      g.disconnect();
    });
    outputNodes = [];
  };
  r.freshId = _=>{
    return ctxId++;
  };
  r.addOutput = g=>{
    g.connect(out);
    outputNodes.push(g);
  };
  return r;
};

const Halvet = _=>{
  const h = {};
  const region = Region();
  const nodes = Nodes(region);
  const runtime = Runtime();
  const Eval = (n,context)=>{
    n.connection.input.forEach(c=>{
      if(c.type == Type.invalid) return;
      const t = c.source;
      if(!t.result.hasOwnProperty(context.id)) {
        Eval(t,context);
      }
    });
    let value = n.operator.eval(n, runtime, context);
    n.result[context.id] = value;
  };
  const Compile = _=>{
    runtime.restart();
    const defaultContext = {
      note: null,
      velocity: 1,
      pitch: 0,
      frequency: 440,
      tempo: 140,
      id: runtime.freshId()
    };
    nodes.traverse(n=>{
      if(n.operator.type == Type.none) {
        Eval(n, defaultContext);
      }
    });
  };
  h.available = u=>{
    return region.available(u);
  };
  h.new = (r,o,a,cb)=>{
    const i = region.alloc(r);
    const n = nodes.new(i,o,a,cb);
    Compile();
    return n;
  };
  h.remove = n=>{
    region.dealloc(n.region);
    nodes.remove(n);
    Compile();
  };
  h.select = p=>{
    const i = region.select(p.x,p.y);
    if(i) return nodes.at(i.nodeId);
    return null;
  };
  h.connectionAt = p=>{
    return nodes.connectionAt(p);
  };
  h.traverse = cb=>{
    nodes.traverse(cb);
  };
  h.candidate = t=>{
    if(t.length == 0) return null;
    for(let i=0;i<Operators.length;i++) {
      const n = Operators[i].name;
      if(n.startsWith(t) && Operators[i].eval) {
        return Operators[i];
      }
    }
    return null;
  };
  h.reflect = _=>{
    nodes.compute();
    Compile();
  };
  return h;
};
