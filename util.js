const Mod = (x,m)=>{
  return (x%m+m)%m;
};

const V2 = (x,y)=>{
  const v = {
    x: x,
    y: y
  };
  v.add = u=>{
    return V2(v.x+u.x, v.y+u.y);
  };
  v.sub = u=>{
    return V2(v.x-u.x, v.y-u.y);
  }
  v.rotate = a=>{
    return V2(v.x*Math.cos(a)-v.y*Math.sin(a), v.x*Math.sin(a)+v.y*Math.cos(a));
  };
  v.scale = s=>{
    return V2(v.x*s, v.y*s);
  };
  v.dup = _=>{
    return V2(v.x, v.y);
  }
  v.toString = _=>{
    return v.x + "," + v.y;
  };
  return v;
};

const Renderer = X=>{
  const Hue = (h,l,d)=>{
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
  };

  X.textAlign = "center";
  X.lineCap = X.lineJoin = "round";
  const r = {};
  let lastShape = null;
  function shape(s) {
    const o = {
      fill: (h,l,d)=>{
        if(lastShape != o) {
          lastShape = o;
          s();
        }
        X.fillStyle = Hue(h,l,d);
        X.fill();
        return o;
      },
      stroke: (h,l,d,b)=>{
        if(lastShape != o) {
          lastShape = o;
          s();
        }
        X.strokeStyle = Hue(h,l,d);
        X.lineWidth = b;
        X.stroke();
        return o;
      }
    };
    return o;
  }
  r.text = (t,x,y,s)=>{
    let align = "center";
    const o = {
      fill: (h,l,d)=>{
        lastShape = null;
        X.textAlign = align;
        X.fillStyle = Hue(h,l,d);
        X.font = s + "px Cabin";
        X.fillText(t,x,y);
        return o;
      },
      stroke: (h,l,d,b)=>{
        lastShape = null;
        X.textAlign = align;
        X.strokeStyle = Hue(h,l,d);
        X.lineWidth = b;
        X.font = s + "px Cabin";
        X.strokeText(t,x,y);
        return o;
      }
    };
    o.l = _=>{
      align = "left";
      return o;
    };
    o.r = _=>{
      align = "right";
      return o;
    };
    return o;
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
  const Affine = _=>{
    const q = [];
    const f = {};
    f.with = cb=>{
      X.save();
      q.forEach(e=>{
        e(X);
      });
      cb();
      X.restore();
    };
    f.translate = (x,y)=>{
      q.push(X=>X.translate(x,y));
      return f;
    };
    f.rotate = a=>{
      q.push(X=>X.rotate(a));
      return f;
    };
    f.scale = s=>{
      q.push(X=>X.scale(s,s));
      return f;
    };
    return f;
  };
  r.translate = (x,y)=>Affine().translate(x,y);
  r.rotate = a=>Affine().rotate(a);
  r.scale = s=>Affine().scale(s);
  r.region = (r,a,cb)=>{
    X.save();
    const loc = Region.corner(r,a,0);
    X.translate(loc.x,loc.y);
    X.rotate(-a*Math.PI*2/4);
    if(a%2==0) cb(r.w,r.h);
    else cb(r.h,r.w);
    X.restore();
  };
  r.blend = (m,cb)=>{
    X.globalCompositeOperation = m;
    cb();
    X.globalCompositeOperation = "source-over";
  };
  r.measure = (t,s)=>{
    X.font = s + "px Cabin";
    return X.measureText(t).width;
  };
  return r;
};

const View = _=>{
  let p = V2(0,0), a = 0, s = 101;
  let mp = V2(0,0), ma = 0, ms = 101;
  const v = {};
  v.back = l=>{
    return l.scale(1/ms).rotate(-ma).add(mp);
  };
  v.with = (R,cb)=>{
    mp = mp.add(p.sub(mp).scale(1/2.0));
    ma += (a - ma) / 4.0;
    ms += (s - ms) / 4.0;
    R.scale(ms).rotate(ma).translate(-mp.x,-mp.y).with(_=>{
      cb();
    });
  };
  v.focus = l=>{
    p = l;
  };
  v.rotate = r=>{
    a = r*Math.PI*2;
    a = ma + Mod(a-ma+Math.PI, Math.PI*2) - Math.PI;
  };
  v.zoom = m=>{
    s = m*100;
    s += 1; // Text vanishment workaround
  };
  return v;
};

const E = x=>(a,b)=>f=>(c,d)=>{
  const x01 = Math.max(0,Math.min(1,(x-a)/(b-a)));
  return f(x01)*(d-c) + c;
};
const Ease = j=>{
  const e = {};
  e.s = x=>x*x*(3-x)/2;
  e.q = x=>x*x;
  e.c = x=>x*x*x;
  e.b = x=>x*x*(3*x-2);
  e.e = x=>Math.pow(2,-(1-x)*10);
  return e;
};
E.i = Ease(f=>f);
E.o = Ease(f=>x=>1-f(1-x));
E.io = Ease(f=>x=> x<0.5 ? f(2*x)/2 : 1-f(2-2*x)/2 );
E.l = x=>x;

const Log = _=>{
  const l = {};
  const logs = [];
  l.add = t=>{
    logs.unshift({ text: t + "", pos: -1, time: 0 });
  };
  l.render = R=>{
    R.blend("lighter",_=>{
      for(let i=0;i<logs.length;i++) {
        const u = logs[i];
        u.pos += (i - u.pos) / 2.0;
        const alpha = E(u.time)(4,5)(E.i.q)(1,0);
        R.text(u.text,5,-u.pos*30-10,30).l().fill(0,0,0.3*alpha);
        u.time += 0.01;
        if(u.time > 5) {
          logs.splice(i,1);
          i--;
        }
      }
    });
  };
  return l;
};
