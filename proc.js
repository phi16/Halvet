let screenSize = V2(1,1);
Q.resize = s=>{ screenSize = s; };

let R = null;
const V = View();
const H = Halvet();
const L = Log();

Q.midi = d=>{};

let cursorMode = "Normal"; // Normal, Create, Select, Detail
let cursorValue = V2(0,-1), cursorValueM = V2(0,-1), cursorSize = 1;
let cursorRegion = { x:0, y:-1, w:1, h:1 }, cursorRegionM = { x:0, y:-1, w:1, h:1 };
V.focus(cursorValue);
let selectNode = null, mouseOnNode = null;
let rotateValue = 0, zoomValue = 1;

const ChangeMode = mode=>{
  cursorMode = mode;
  cursorSize = 0.6;
};
const CursorChanged = _=>{
  cursorRegion.x = cursorValue.x;
  cursorRegion.y = cursorValue.y;
  cursorRegion.w = cursorRegion.h = 1;
  V.focus(cursorValue);
  selectNode = H.select(cursorValue);
};

let blankRange = { x: 0, y: 0, w: 1, h: 1 };
let blankRangeM = { x: 0, y: 0, w: 1, h: 1 };
let blankName = "", blankNameLoc = 0, blankNameLocM = 0;
let blankCandidate = null;
const InitBlankRange = _=>{
  blankRange = cursorValue.dup();
  blankRange.w = blankRange.h = 1;
  blankRangeM = cursorValue.dup();
  blankRangeM.w = blankRangeM.h = 1;
  blankName = "";
  blankNameLoc = blankNameLocM = 0;
  blankCandidate = null;
};
const CheckBlankName = _=>{
  blankNameLoc = R.measure(blankName,0.15);
  blankCandidate = H.candidate(blankName);
};

let mouseLoc = null;
Q.mouse = (e,p)=>{
  mouseLoc = V2(p.x-screenSize.x/2, p.y-screenSize.y/2);
  const u = V.back(mouseLoc);
  if(cursorMode == "Normal") {
    if(e == "down") {
      cursorValue = V2(Math.round(u.x), Math.round(u.y));
      CursorChanged();
    }
  } else if(cursorMode == "Detail") {
    const lu = Region.corner(selectNode.region, selectNode.angle, 0, 0);
    const rw = selectNode.angle%2==0 ? selectNode.region.w : selectNode.region.h;
    const rh = selectNode.angle%2==0 ? selectNode.region.h : selectNode.region.w;
    selectNode.event.mouse(e,u.add(V2(0.5,0.5)).sub(lu).rotate(selectNode.angle*2*Math.PI/4), rw, rh);
  }
  if(e == "leave") {
    mouseLoc = null;
  }
};
Q.wheel = (p,d)=>{
  if(d < 0) zoomValue += 0.5;
  else zoomValue -= 0.5;
  if(zoomValue < -3) zoomValue = -3;
  if(zoomValue > 2) zoomValue = 2;
  V.zoom(Math.pow(2,zoomValue));
};
Q.key = (e,k)=>{
  if(e == "down") {
    if(cursorMode == "Normal") {
      let rotated = false;
      if(k == "h") rotateValue -= 1, rotated = true;
      if(k == "l") rotateValue += 1, rotated = true;
      rotateValue = Mod(rotateValue, 4);
      if(rotated) V.rotate(rotateValue*0.25);

      let moved = false, moveIndex = rotateValue;
      if(k == "ArrowLeft")  moveIndex += 2, moved = true;
      if(k == "ArrowRight") moveIndex += 0, moved = true;
      if(k == "ArrowUp")    moveIndex += 1, moved = true;
      if(k == "ArrowDown")  moveIndex += 3, moved = true;
      if(moved) {
        const dx = [1,0,-1,0], dy = [0,-1,0,1];
        moveIndex = Mod(Math.round(moveIndex), 4);
        cursorValue = cursorValue.add(V2(dx[moveIndex], dy[moveIndex]));
        CursorChanged();
      }

      if(k == "j" || k == "k") {
        let target = null;
        // TODO: select index according to the current cursor and angle
        if(selectNode) {
          if(k == "j" && selectNode.connection.output.length > 0) {
            target = selectNode.connection.output[0].target;
          }
          if(k == "k" && selectNode.connection.input.length > 0) {
            target = selectNode.connection.input[0].source;
          }
        } else {
          const conns = H.connectionAt(cursorValue);
          if(conns.length > 0) {
            const c = conns[0];
            if(k == "j") target = c.target;
            if(k == "k") target = c.source;
          }
        }
        if(target) {
          selectNode = target;
          cursorValue = Region.corner(selectNode.region,selectNode.angle,1);
          CursorChanged();
          if(target.operator.name != "*") {
            rotateValue = selectNode.angle;
            V.rotate(rotateValue*0.25);
          }
        } else {
          cursorSize = 1.5;
        }
      }

      if(k == "a" || k == "i") {
        if(selectNode) {
          if(k == "a") {
            // TODO: special case
            cursorValue = Region.corner(selectNode.region,selectNode.angle,1);
            const dx = [0,1,0,-1], dy = [1,0,-1,0];
            const d = selectNode.angle;
            const nc = cursorValue.add(V2(dx[d], dy[d]));
            if(H.select(nc) == null) {
              cursorValue = nc;
              CursorChanged();
            }
          } else {
            // TODO: insert
          }
        }
        if(H.select(cursorValue) == null) {
          if(k == "a") L.add("Append");
          else L.add("Insert");
          ChangeMode("Create");
          InitBlankRange();
        } else {
          cursorSize = 1.5;
        }
      }

      if(k == "z") {
        if(selectNode && selectNode.operator.name != "*") {
          cursorSize = 1.5;
        } else {
          if(!selectNode) {
            const stopFlow = (_=>{
              const conns = H.connectionAt(cursorValue);
              if(conns.length == 0) return true;
              let type = Type.none;
              // Up Direction
              const dx = -[0,1,0,-1][rotateValue], dy = -[1,0,-1,0][rotateValue];
              for(let i=0;i<conns.length;i++) {
                if(conns[i].type != type && conns[i].type != Type.none) {
                  if(conns[i].type != Type.invalid && type == Type.none) type = conns[i].type;
                  else return true;
                }
                const d = conns[i].targetLoc.sub(conns[i].sourceLoc);
                if(d.x*dx + d.y*dy > 0) return true;
              }
              return false;
            })();
            const range = { x:cursorValue.x, y:cursorValue.y, w:1, h:1 };
            const ope = OperatorMap["*"];
            selectNode = H.new(range, ope, 0, n=>{
              n.open = [];
              if(!stopFlow) {
                n.open.push({
                  location: cursorValue,
                  angle: rotateValue
                });
              }
              n.type = Type.none;
            });
            L.add(stopFlow ? "Stop Flow" : "Turn Flow");
            cursorSize = 0.6;
          } else {
            const n = selectNode;
            let found = false;
            for(let i=0;i<n.open.length;i++) {
              const o = n.open[i];
              if(o.location.equal(cursorValue) && o.angle == rotateValue) {
                found = true;
                n.open.splice(i,1);
                cursorSize = 0.6;
                L.add("Shut Flow");
                break;
              }
            }
            if(!found) {
              L.add(n.open.length == 0 ? "Turn Flow" : "Fork Flow");
              n.open.push({
                location: cursorValue,
                angle: rotateValue
              });
              cursorSize = 0.6;
            }
            H.reflect();
          }
        }
      }
      if(k == "x") {
        if(selectNode) {
          if(selectNode.operator.name != "*") {
            L.add("Remove: " + selectNode.operator.name);
          } else {
            L.add("Release Flow Control");
          }
          H.remove(selectNode);
          selectNode = null;
          cursorSize = 0.6;
        } else {
          cursorSize = 1.5;
        }
      }
      if(k == "Enter" || k == "d") {
        if(selectNode) {
          L.add("Enter Detail");
          ChangeMode("Detail");
          const r = selectNode.region;
          cursorRegion.x = r.x;
          cursorRegion.y = r.y;
          cursorRegion.w = r.w;
          cursorRegion.h = r.h;
          V.focus(V2(r.x+(r.w-1)/2, r.y+(r.h-1)/2));
          rotateValue = selectNode.angle;
          V.rotate(rotateValue*0.25);
          selectNode.event.begin();
        } else cursorSize = 1.5;
      }
    } else if(cursorMode == "Create") {
      let moved = false, moveIndex = rotateValue;
      if(k == "ArrowLeft")  moveIndex += 2, moved = true;
      if(k == "ArrowRight") moveIndex += 0, moved = true;
      if(k == "ArrowUp")    moveIndex += 1, moved = true;
      if(k == "ArrowDown")  moveIndex += 3, moved = true;
      if(moved) {
        moveIndex = Mod(Math.round(moveIndex), 4);
        const prev = {
          x: blankRange.x,
          y: blankRange.y,
          w: blankRange.w,
          h: blankRange.h
        };
        if(moveIndex == 0) blankRange.w += 1;
        if(moveIndex == 2) blankRange.w += 1, blankRange.x -= 1;
        if(moveIndex == 3) blankRange.h += 1;
        if(moveIndex == 1) blankRange.h += 1, blankRange.y -= 1;
        if(!H.available(blankRange)) {
          const sc = 0.2;
          blankRangeM.x += (prev.x - blankRange.x) * sc;
          blankRangeM.y += (prev.y - blankRange.y) * sc;
          blankRangeM.w += (prev.w - blankRange.w) * sc;
          blankRangeM.h += (prev.h - blankRange.h) * sc;
          blankRange = prev;
        }
      }

      if(k == "Escape") {
        L.add("Cancel");
        ChangeMode("Normal");
      }

      if(k.length == 1 && "a" <= k && k <= "z") {
        if(blankName.length == 0) blankName += k.toUpperCase();
        else blankName += k;
        CheckBlankName();
      }
      if(k.length == 1 && "A" <= k && k <= "Z") {
        if(blankName.length != 0) blankName += k.toLowerCase();
        else blankName += k;
        CheckBlankName();
      }
      if(k == "Tab" && blankCandidate) {
        blankName = blankCandidate.name;
        CheckBlankName();
      }
      if(k == "Backspace" && blankName.length > 0) {
        blankName = blankName.slice(0,-1);
        CheckBlankName();
      }
      if(k == "Enter" && blankCandidate) {
        L.add("Create: " + blankCandidate.name);
        H.new(blankRange, blankCandidate, rotateValue);
        ChangeMode("Normal");
        cursorValue = Region.corner(blankRange,rotateValue,1);
        CursorChanged();
      }
    } else if(cursorMode == "Detail") {
      if(k == "Escape") {
        selectNode.event.end();
        L.add("Leave Detail");
        ChangeMode("Normal");
        CursorChanged();
      } else {
        selectNode.event.key(e,k);
      }

      let moved = false, moveIndex = rotateValue;
      if(k == "ArrowLeft")  moveIndex += 2, moved = true;
      if(k == "ArrowRight") moveIndex += 0, moved = true;
      if(k == "ArrowUp")    moveIndex += 1, moved = true;
      if(k == "ArrowDown")  moveIndex += 3, moved = true;
      if(moved) {
        const dx = [1,0,-1,0], dy = [0,-1,0,1];
        moveIndex = Mod(Math.round(moveIndex), 4);
        const r = selectNode.region;
        const next = cursorValue.add(V2(dx[moveIndex], dy[moveIndex]));
        if(r.x <= next.x && next.x <= r.x+r.w-1 && r.y <= next.y && next.y <= r.y+r.h-1) {
          cursorValue = next;
        } else {
          const dif = { x:0, y:0, w:0, h:0 };
          if(moveIndex == 0) dif.w += 1;
          if(moveIndex == 2) dif.w += 1, dif.x -= 1;
          if(moveIndex == 3) dif.h += 1;
          if(moveIndex == 1) dif.h += 1, dif.y -= 1;
          const sc = 0.2;
          cursorRegionM.x -= dif.x * sc;
          cursorRegionM.y -= dif.y * sc;
          cursorRegionM.w -= dif.w * sc;
          cursorRegionM.h -= dif.h * sc;
        }
      }
      // TODO: Shift+Arrow to resize
    }
  }
};

Q.render = X=>{
  R = Renderer(X);
  R.rect(0,0,screenSize.x,screenSize.y).fill(0,0,0.1);
  R.translate(screenSize.x/2, screenSize.y/2).with(_=>{
    V.with(R,_=>{
      R.translate(cursorValue.x, cursorValue.y).scale(1).with(_=>{
        R.rect(-0.5,-0.5,1,1).fill(0,0,0.12);
      });

      let lb = null, ub = null;
      const dx = [-1,1,-1,1];
      const dy = [-1,-1,1,1];
      for(let d=0;d<4;d++) {
        const p = V.back(V2(screenSize.x/2*dx[d], screenSize.y/2*dy[d]));
        if(d == 0) lb = p.dup(), ub = p.dup();
        else {
          lb.x = Math.min(lb.x, p.x);
          lb.y = Math.min(lb.y, p.y);
          ub.x = Math.max(ub.x, p.x);
          ub.y = Math.max(ub.y, p.y);
        }
      }
      if(mouseLoc && cursorMode == "Normal") {
        const u = V.back(mouseLoc);
        u.x = Math.round(u.x), u.y = Math.round(u.y);
        R.rect(u.x-0.5,u.y-0.5,1,1).fill(0,0,0.12);
        mouseOnNode = H.select(u);
      } else mouseOnNode = null;
      for(let j=0;j<3;j++) {
        const m = Math.pow(4,j);
        R.shape(_=>{
          for(let i=Math.ceil(lb.x/m)*m;i<Math.ceil(ub.x+1);i+=m) {
            X.moveTo(i-0.5,lb.y);
            X.lineTo(i-0.5,ub.y);
          }
          for(let i=Math.ceil(lb.y/m)*m;i<Math.ceil(ub.y+1);i+=m) {
            X.moveTo(lb.x,i-0.5);
            X.lineTo(ub.x,i-0.5);
          }
        }).stroke(0,0,0.2+0.1*j,0.02);
      }

      const of = 0.04;
      const DrawNode = (h,l,d,r,a,t,cb)=>{
        // R.rect(r.x-0.5,r.y-0.5,r.w,r.h).fill(h,l,d*0.5);
        R.region(r,a,(aw,ah)=>{
          R.rect(-0.5+of,-0.5+of,aw-2*of,ah-2*of).fill(h,l,d*0.3).stroke(h,l,d*1,0.02);
          R.shape(_=>{
            X.moveTo(aw-0.5-0.25,-0.5+of);
            X.lineTo(aw-0.5-of,-0.25);
          }).stroke(h,l,d*1,0.02);
          if(cb) cb(aw,ah);
          R.text(t,-0.5+0.07,ah-0.585,0.15).l().fill(h,l*0.5,d*1);
        });
      };

      if(cursorMode == "Create") {
        blankRangeM.x += (blankRange.x - blankRangeM.x) / 2.0;
        blankRangeM.y += (blankRange.y - blankRangeM.y) / 2.0;
        blankRangeM.w += (blankRange.w - blankRangeM.w) / 2.0;
        blankRangeM.h += (blankRange.h - blankRangeM.h) / 2.0;
        const color = { h:0, l:0 };
        if(blankCandidate) {
          color.h = blankCandidate.hue;
          color.l = blankCandidate.sat * 0.5;
        }
        DrawNode(color.h,color.l,0.5,blankRangeM,rotateValue,blankName,(aw,ah)=>{
          if(blankCandidate) {
            R.text(blankCandidate.name,-0.5+0.07,ah-0.585,0.15).l().fill(color.h,color.l*0.6,0.4);
          }
          blankNameLocM += (blankNameLoc - blankNameLocM) / 2.0;
          const x = -0.5+0.08+blankNameLocM;
          R.line(x,ah-0.7,x,ah-0.58).stroke(0,0,1,0.01);
        });
      }
      H.traverse(n=>{
        n.connection.output.forEach(conn=>{
          const h = conn.type.hue;
          const l = Math.max(0, conn.type.sat);
          const d = conn.type.sat < 0 ? 0.2 : conn.type == Type.special ? 1 : l*0.5+0.5;
          const outLoc = conn.sourceLoc;
          R.translate(outLoc.x,outLoc.y).with(_=>{
            const dif = conn.targetLoc.sub(outLoc);
            let range = null;
            if(Math.abs(dif.x) > 0.01) {
              const r = [(lb.x-outLoc.x)/dif.x, (ub.x-outLoc.x)/dif.x].sort((x,y)=>x-y);
              range = r;
            }
            if(Math.abs(dif.y) > 0.01) {
              const r = [(lb.y-outLoc.y)/dif.y, (ub.y-outLoc.y)/dif.y].sort((x,y)=>x-y);
              if(range) {
                range[0] = Math.max(range[0], r[0]);
                range[1] = Math.min(range[1], r[1]);
              } else range = r;
            }
            let minD = 0;
            let maxD = conn.target ? 1 : -1;
            minD = Math.max(minD, range[0]);
            maxD = maxD < 0 ? range[1] : Math.min(maxD, range[1]);
            if(minD < maxD) {
              R.line(dif.x*minD,dif.y*minD,dif.x*maxD,dif.y*maxD)
              .stroke(h,l,d*0.4,0.10).stroke(h,l,d*0.9,0.06).stroke(h,l*0.5,Math.sqrt(d)*1,0.02);
            }
          });
        });
      });
      H.traverse(n=>{
        if(n.operator.name != "*") {
          const bright = cursorMode == "Normal" && (n == mouseOnNode || n == selectNode) ? 1.1 : 1;
          DrawNode(n.operator.hue,n.operator.sat,bright,n.region,n.angle,n.operator.name,(aw,ah)=>{
            if(n.render) {
              R.translate(-0.5,-0.5).with(_=>{
                n.render(R,aw,ah);
              });
            }
          });
          n.connection.input.forEach(c=>{
            if(c.type == Type.invalid) return;
            let p = c.targetLoc;
            const nv = V2(Math.sign(c.targetLoc.x-c.sourceLoc.x), Math.sign(c.targetLoc.y-c.sourceLoc.y));
            const v = V2(nv.y, -nv.x).scale(0.06);
            p = p.sub(nv.scale(0.4));
            const h = n.operator.hue, l = n.operator.sat;
            R.line(p.x+v.x,p.y+v.y,p.x-v.x,p.y-v.y).stroke(h,l,1,0.02);
          });
        } else {
          // Flow Control
          const r = n.region;
          const h = n.type.hue;
          const l = Math.max(0, n.type.sat);
          const d = n.type.sat < 0 ? 0.5 : n.type == Type.special ? 1.25 : 1;
          R.shape(_=>{
            const u = 0.05;
            X.rect(r.x-u,r.y-u,r.w-1+2*u,r.h-1+2*u);
            n.open.forEach(o=>{
              let b = o.location;
              let d = V2([0,1,0,-1][o.angle], [1,0,-1,0][o.angle]);
              const r = V2([1,0,-1,0][o.angle], [0,-1,0,1][o.angle]).scale(0.1);
              b = b.add(d.scale(0.15));
              d = d.scale(0.35);
              X.moveTo(b.x+d.x,b.y+d.y);
              X.lineTo(b.x+r.x,b.y+r.y);
              X.lineTo(b.x-r.x,b.y-r.y);
              X.lineTo(b.x+d.x,b.y+d.y);
            });
          }).fill(h,l,d*0.15).stroke(h,l,d*0.65,0.02);
        }
      });

      // Cursor
      (_=>{
        cursorValueM = cursorValueM.add(cursorValue.sub(cursorValueM).scale(1/2.0));
        cursorRegionM.x += (cursorRegion.x - cursorRegionM.x) / 2.0;
        cursorRegionM.y += (cursorRegion.y - cursorRegionM.y) / 2.0;
        cursorRegionM.w += (cursorRegion.w - cursorRegionM.w) / 2.0;
        cursorRegionM.h += (cursorRegion.h - cursorRegionM.h) / 2.0;
        cursorSize += (1 - cursorSize) / 2.0;
        let modScale = (cursorSize-1) + 0.09;
        const modRegion = {
          x: cursorRegionM.x - 0.5 - modScale,
          y: cursorRegionM.y - 0.5 - modScale,
          w: cursorRegionM.w + modScale*2,
          h: cursorRegionM.h + modScale*2,
        };
        let h = 0, l = 0, d = 0.3;
        if(selectNode) {
          h = selectNode.operator.hue;
          l = selectNode.operator.sat * 0.5;
          if(cursorMode == "Detail") {
            l *= 1.5;
            d = 0.6;
          }
        }
        R.translate(modRegion.x, modRegion.y).with(_=>{
          R.blend("lighter",_=>{
            R.rect(0,0,modRegion.w,modRegion.h).stroke(h,l,d,0.04);
            const a = rotateValue;
            const dx = [0,0,1,1][a], dy = [0,1,1,0][a];
            R.translate(dx*modRegion.w,dy*modRegion.h).rotate(-a*Math.PI*2/4).with(_=>{
              let mw = a%2 == 0 ? modRegion.w : modRegion.h;
              let mh = a%2 == 0 ? modRegion.h : modRegion.w;
              const curLoc = Region.corner(cursorRegion,rotateValue,1,0);
              R.text(curLoc,-0.02,mh+0.11,0.1).l().fill(h,l,d);
              R.text(cursorMode,mw+0.01,-0.05,0.1).r().fill(h,l,d);
            });
          });
          R.blend("overlay",_=>{
            R.rect(0,0,modRegion.w,modRegion.h).fill(h,l*0.5,0.7+(d-0.3)*0.5);
          });
        });
        if(cursorMode == "Detail") {
          R.translate(cursorValueM.x, cursorValueM.y).scale(1.08*(cursorSize*0.5+0.5)).with(_=>{
            R.blend("lighter",_=>{
              R.rect(-0.5,-0.5,1,1).stroke(h,l,d*0.5,0.03);
            });
          });
        }
      })();
    });
    R.translate(-screenSize.x/2,screenSize.y/2).with(_=>{
      L.render(R);
    });
  });
  R.blend("lighter",_=>{
    R.text("Halvet-α",screenSize.x-10,screenSize.y-20,50).r().fill(0,0,0.1);
  });
};
