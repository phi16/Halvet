let screenSize = V2(1,1);
Q.resize = s=>{ screenSize = s; };

let R = null;
const V = View();
const H = Halvet();
const L = Log();

Q.midi = d=>{};

let cursorMode = "Normal"; // Normal, Create, Select, Detail
let cursorValue = V2(0,-1), cursorValueM = V2(0,-1), cursorSize = 1;
V.focus(cursorValue);
let selectNode = null;
let rotateValue = 0, zoomValue = 1;

const ChangeMode = mode=>{
  cursorMode = mode;
  cursorSize = 0.6;
};
const CursorChanged = _=>{
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
  if(e == "down") {
    if(cursorMode == "Normal") {
      const u = V.back(mouseLoc);
      cursorValue = V2(Math.round(u.x), Math.round(u.y));
      CursorChanged();
    }
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

      if(k == "a" || k == "i") {
        if(selectNode) {
          if(k == "a") {
            cursorValue = Region.corner(selectNode.region,selectNode.angle,1);
            const dx = [0,1,0,-1], dy = [1,0,-1,0];
            const d = selectNode.angle;
            const nc = cursorValue.add(V2(dx[d], dy[d]));
            if(H.select(nc) == null) {
              L.add("Append");
              cursorValue = nc;
              CursorChanged();
            }
          } else {
            L.add("Insert");
          }
        } else {
          L.add("Create");
        }
        if(H.select(cursorValue) == null) {
          ChangeMode("Create");
          InitBlankRange();
        } else {
          cursorSize = 1.5;
        }
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
      if(mouseLoc) {
        const u = V.back(mouseLoc);
        R.rect(Math.round(u.x)-0.5,Math.round(u.y)-0.5,1,1).fill(0,0,0.12);
      }
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
          color.l = 0.5;
        }
        DrawNode(color.h,color.l,0.5,blankRangeM,rotateValue,blankName,(aw,ah)=>{
          if(blankCandidate) {
            R.text(blankCandidate.name,-0.5+0.07,ah-0.585,0.15).l().fill(color.h,0.6,0.4);
          }
          blankNameLocM += (blankNameLoc - blankNameLocM) / 2.0;
          const x = -0.5+0.08+blankNameLocM;
          R.line(x,ah-0.7,x,ah-0.58).stroke(0,0,1,0.01);
        });
      }
      H.traverse(n=>{
        let outLoc = Region.corner(n.region,n.angle,1);
        const h = 0.2;
        const l = 0;
        const dif = V2(0,1).rotate(-n.angle*Math.PI*2/4);
        R.translate(outLoc.x,outLoc.y).with(_=>{
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
          let minD = 0.5-of;
          let maxD = n.connection.output ? n.connection.outputDistance-0.5+of : -1;
          minD = Math.max(minD, range[0]);
          maxD = maxD < 0 ? range[1] : Math.min(maxD, range[1]);
          if(minD < maxD) R.line(dif.x*minD,dif.y*minD,dif.x*maxD,dif.y*maxD).stroke(h,l,0.3,0.06).stroke(h,l,1,0.02);
        });
      });
      H.traverse(n=>{
        DrawNode(n.operator.hue,1,1,n.region,n.angle,n.operator.name);
      });

      cursorValueM = cursorValueM.add(cursorValue.sub(cursorValueM).scale(1/2));
      cursorSize += (1 - cursorSize) / 2.0;
      R.translate(cursorValueM.x, cursorValueM.y).scale(1.18*cursorSize).with(_=>{
        let h = 0, l = 0;
        if(selectNode) {
          h = selectNode.operator.hue;
          l = 0.5;
        }
        R.blend("lighter",_=>{
          R.rect(-0.5,-0.5,1,1).stroke(h,l,0.3,0.03);
          R.rotate(-rotateValue*Math.PI*2/4).with(_=>{
            const dx = [0,1,1,0], dy = [1,1,0,0];
            const d = rotateValue;
            const curLoc = cursorValue.add(V2(dx[d],dy[d]));
            R.text(curLoc,-0.52,0.61,0.1).l().fill(h,l,0.3);
            R.text(cursorMode,0.51,-0.55,0.1).r().fill(h,l,0.3);
          });
        });
        R.blend("overlay",_=>{
          R.rect(-0.5,-0.5,1,1).fill(h,l*0.5,0.7);
        });
      });
    });
    R.translate(-screenSize.x/2,screenSize.y/2).with(_=>{
      L.render(R);
    });
  });
  R.blend("lighter",_=>{
    R.text("Halvet-α",screenSize.x-10,screenSize.y-20,50).r().fill(0,0,0.1);
  });
};
