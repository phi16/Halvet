const Region = _=>{
  const r = {};
  let nextId = 1;
  const regions = {};
  r.alloc = u=>{
    const i = { x:u.x, y:u.y, w:u.w, h:u.h, id:null };
    regions[nextId] = i;
    nextId++;
    return i;
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
Region.corner = (r,a,i)=>{
  const u = Mod(a+i,4);
  let loc = null;
  if(u == 0) loc = V2(0,0);
  if(u == 1) loc = V2(0,r.h-1);
  if(u == 2) loc = V2(r.w-1,r.h-1);
  if(u == 3) loc = V2(r.w-1,0);
  return loc.add(V2(r.x,r.y));
};

const Nodes = R=>{
  const s = {};
  let nextId = 1;
  const nodes = {};
  const ComputeConnection = _=>{
    Object.keys(nodes).forEach(ni=>{
      const n = nodes[ni];
      const p = Region.corner(n.region,n.angle,1);
      const t = R.raycast(p.x, p.y, n.angle);
      if(t) {
        n.connection.output = nodes[t.target.id];
        n.connection.outputDistance = t.distance;
      } else {
        delete n.connection.output;
      }
    });
  };
  s.new = (i,o,a)=>{
    const n = {};
    n.region = i;
    n.operator = o;
    n.angle = a;
    n.connection = {};
    nodes[nextId] = n;
    i.id = nextId;
    nextId++;
    ComputeConnection();
    return n;
  };
  s.at = id=>{
    return nodes[id];
  };
  s.traverse = cb=>{
    Object.keys(nodes).forEach(ni=>{
      cb(nodes[ni]);
    });
  };
  return s;
};

const Halvet = _=>{
  const h = {};
  const region = Region();
  const nodes = Nodes(region);
  h.available = u=>{
    return region.available(u);
  };
  h.new = (r,o,a)=>{
    const i = region.alloc(r);
    return nodes.new(i,blankCandidate,rotateValue);
  };
  h.select = p=>{
    const i = region.select(p.x,p.y);
    if(i) return nodes.at(i.id);
    return null;
  };
  h.traverse = cb=>{
    nodes.traverse(cb);
  };
  h.candidate = t=>{
    const nodeNames = [
      "Oscillator",
      "Harmonics",
      "Impulse",
      "Noise",
      "Envelope",
      "Filter",
      "Reverb",
      "Gain",
      "Distortion",
      "Equalizer",
      "Pattern",
      "Curve",
      "Compressor",
      "Mixer",
      "Value",
      "Note",
      "Key",
      "Comment",
      "Scope",
      "Buffer",
      "Output",
      "Translocate",
      "*" // Flow Control: add, multiply, duplicate, stop, turn
    ];
    if(t.length == 0) return null;
    for(let i=0;i<nodeNames.length;i++) {
      if(nodeNames[i].startsWith(t)) {
        return {
          hue: i/nodeNames.length,
          name: nodeNames[i]
        };
      }
    }
    return null;
  };
  return h;
};
