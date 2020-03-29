const Q = {
  renderCallback: [],
  startCallback: []
};

window.onload = _=>{

const canvas = document.getElementById("canvas");
const container = document.getElementById("container");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener("resize",resize);
resize();

function render() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  Q.renderCallback.forEach(cb=>{ cb(ctx,w,h); });
  requestAnimationFrame(render);
}
render();

container.addEventListener("mousedown",_=>{
  Q.startCallback.forEach(cb=>{ cb(); });
  Q.startCallback = [];
});
document.addEventListener("keydown",_=>{
  Q.startCallback.forEach(cb=>{ cb(); });
  Q.startCallback = [];
});

};
