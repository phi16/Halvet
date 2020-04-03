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
      data: {},
      connection: {
        input: [],
        output: []
      },
      result: {}
    };
    nodes[nextId] = n;
    i.nodeId = nextId;
    nextId++;
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

const Operators = [];
const OperatorMap = {};

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
    let value = n.eval(context);
    n.result[context.id] = value;
  };
  let defaultNoteListener = [];
  const defaultNote = {
    listen: (a,r)=>{
      defaultNoteListener.push({
        attack: a, release: r
      });
    },
    attack: (p,v)=>{
      defaultNoteListener.forEach(l=>{
        l.attack(p,v);
      });
    },
    release: p=>{
      defaultNoteListener.forEach(l=>{
        l.release(p);
      });
    }
  };
  h.noteOn = (m,v)=>{
    defaultNote.attack(m,v);
  };
  h.noteOff = m=>{
    defaultNote.release(m);
  }
  const Compile = _=>{
    defaultNoteListener = [];
    runtime.restart();
    const defaultContext = {
      note: defaultNote,
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
    const n = nodes.new(i,o,a,n=>{
      if(o.initialize) o.initialize(n,runtime);
      if(cb) cb(n);
    });
    Compile();
    return n;
  };
  h.remove = (n,noCompile)=>{
    region.dealloc(n.region);
    nodes.remove(n);
    if(noCompile != "NoCompile") Compile();
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
      if(n.startsWith(t)) {
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
