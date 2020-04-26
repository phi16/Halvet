const Q = {
  render: X=>{},
  resize: s=>{},
  key: (e,k)=>{},
  mouse: (e,p,b)=>{},
  wheel: (p,d)=>{},
  midi: d=>{}
};

window.onload = _=>{

const canvas = document.getElementById("canvas");
const container = document.getElementById("container");
const ctx = canvas.getContext("2d");
let canvasSize = V2(1,1);

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  canvasSize = V2(canvas.width, canvas.height);
  Q.resize(canvasSize);
}
window.addEventListener("resize",resize);
resize();

document.oncontextmenu = _=>false;
document.addEventListener("mousedown",e=>{
  Q.mouse("down", V2(e.clientX, e.clientY), e.button);
});
document.addEventListener("mousemove",e=>{
  Q.mouse("move", V2(e.clientX, e.clientY), e.button);
});
document.addEventListener("mouseup",e=>{
  Q.mouse("up", V2(e.clientX, e.clientY), e.button);
});
document.addEventListener("mouseleave",e=>{
  Q.mouse("leave", V2(e.clientX, e.clientY), e.button);
});
document.addEventListener("wheel",e=>{
  Q.wheel(V2(e.clientX, e.clientY), e.deltaY);
});
document.addEventListener("keydown",e=>{
  if(e.repeat) return;
  Q.key("down", e.key);
  if(e.key == "Tab") e.preventDefault();
});
document.addEventListener("keyup",e=>{
  Q.key("up", e.key);
});
navigator.requestMIDIAccess({sysex: true}).then(midi=>{
  const inputIt = midi.inputs.values();
  for(let input = inputIt.next(); !input.done; input = inputIt.next()) {
    const device = input.value;
    device.addEventListener("midimessage", e=>{
      Q.midi(e.data);
    });
  }
});

function render() {
  ctx.clearRect(0,0,canvasSize.x,canvasSize.y);
  Q.render(ctx);
  requestAnimationFrame(render);
}
render();

};
