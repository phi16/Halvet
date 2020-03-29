const Runtime = async _=>{

const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

const midi = await navigator.requestMIDIAccess();
const inputIt = midi.inputs.values();
const customReceive = {};
for(let input = inputIt.next(); !input.done; input = inputIt.next()) {
  console.log("Midi connecteed");
  const device = input.value;
  device.addEventListener("midimessage", e=>{
    function h(s) {
      return ("0" + s.toString(16)).substr(-2);
    }
    let str = h(e.data[0]) + h(e.data[1]);
    if(customReceive[str]) customReceive[str](e.data[2]);
    else console.log(str);
  });
}

const ctx = new AudioContext();
const analyseNode = ctx.createAnalyser();
const fftSize = 32768;
analyseNode.fftSize = fftSize;
const streamNode = ctx.createMediaStreamSource(stream);
streamNode.connect(analyseNode);
const waveNode = ctx.createAnalyser();
waveNode.fftSize = 2048;
streamNode.connect(waveNode);
const timeLength = 2048;
let length = analyseNode.frequencyBinCount;
const timeArray = new Uint8Array(timeLength);
const dataArray = new Float32Array(length);
length /= 8;

let freqArray = [];
let mTop = 0;
let accumEnable = false, accum = 0, accumCount = 0;
customReceive["9043"] = _=>{
  accumEnable = true;
  accum = 0;
  accumCount = 0;
};
customReceive["8043"] = _=>{
  accumEnable = false;
  const f = accum / accumCount;
  let aux = "";
  if(freqArray.length > 0) {
    const l = freqArray[freqArray.length-1];
    aux = "(Ratio: " + f / l + ")";
  }
  console.log(Math.floor(f*100)/100 + "Hz " + aux);
  freqArray.push(f);
  if(freqArray.length > 400) freqArray.shift();
};

const tapFreqs = {
  "37": 4/3,
  "39": 1,
  "3b": 3/2,
  "3d": 9/8,
  "34": 10/9,
  "36": 5/3,
  "38": 5/4,
  "3a": 15/8
};
const toneAnalyser = new Tone.Analyser().toDestination();
toneAnalyser.size = 32768/2;
toneAnalyser.type = "fft";
Object.keys(tapFreqs).forEach(k=>{
  const synth = new Tone.Synth().connect(toneAnalyser);
  // synth.oscillator.type = "sine";
  const f = tapFreqs[k] * 523.251;
  customReceive["90" + k] = v=>{
    synth.triggerAttack(f, "8t", v/128*0.5+0.5);
  };
  customReceive["80" + k] = v=>{
    synth.triggerRelease();
  };
});

Q.renderCallback.push((X,w,h)=>{
  analyseNode.getFloatFrequencyData(dataArray);
  const toneArray = toneAnalyser.getValue();
  waveNode.getByteTimeDomainData(timeArray);
  X.strokeStyle = "rgb(0,0,0)";
  X.lineWidth = 2;
  X.beginPath();
  for(let i=0;i<timeLength;i++) {
    const v = (timeArray[i]-128)/128 * 100;
    const x = i*w/length;
    const y = h*7/8 + v;
    if(i == 0) X.moveTo(x,y);
    else X.lineTo(x,y);
  }
  X.stroke();
  X.strokeStyle = "rgb(100,100,100)";
  X.lineWidth = 1;
  X.beginPath();
  for(let i=0;i<length;i++) {
    const v = -toneArray[i];
    const x = i*w/length;
    const y = h/2 + v;
    if(i == 0) X.moveTo(x,y);
    else X.lineTo(x,y);
  }
  X.stroke();
  X.strokeStyle = "rgb(0,0,0)";
  X.lineWidth = 2;
  X.beginPath();
  let top = 0, topv = 10000;
  for(let i=0;i<length;i++) {
    const v = -dataArray[i];
    if(topv > v) top = i, topv = v;

    const x = i*w/length;
    const y = h/2 + v;
    if(i == 0) X.moveTo(x,y);
    else X.lineTo(x,y);
  }
  X.stroke();
  X.beginPath();
  X.moveTo(0,h/2);
  X.lineTo(w,h/2);
  X.stroke();
  X.strokeStyle = X.fillStyle = "rgb(192,0,0)";
  X.beginPath();
  X.moveTo(mTop*w/length,h/2 + topv);
  X.lineTo(mTop*w/length,h/2 - 100);
  X.lineTo(mTop*w/length + 50, h/2 - 100);
  X.stroke();
  X.font = "20px Consolas";
  X.textAlign = "left";
  X.textBaseline = "middle";
  mTop += (top - mTop) / 2.0;
  const freq = mTop*ctx.sampleRate/fftSize;
  if(accumEnable) {
    accum += freq;
    accumCount++;
  }
  X.fillText(Math.floor(freq*100)/100 + "Hz", mTop*w/length + 55, h/2 - 100);

  X.strokeStyle = X.fillStyle = "rgb(0,0,0)";
  X.beginPath();
  X.moveTo(0,h/4);
  X.lineTo(w,h/4);
  X.stroke();

  (_=>{
    const f = freq;
    const si = Math.log(500), fi = Math.log(2500);
    const x = (Math.log(f) - si) / (fi - si) * w;
    const y = h/4;
    const u = 10;
    X.strokeStyle = X.fillStyle = "rgb(192,0,0)";
    X.beginPath();
    X.moveTo(x, y-u);
    X.lineTo(x, y+u);
    X.stroke();
  })();
  for(let i=0;i<30;i++) {
    const f = 440 * Math.pow(Math.pow(2,1/12.0), i);
    const si = Math.log(500), fi = Math.log(2500);
    const x = (Math.log(f) - si) / (fi - si) * w;
    const y = h/4;
    const u = 3;
    X.beginPath();
    X.moveTo(x, y-u);
    X.lineTo(x, y+u);
    X.stroke();
  }
  if(accumCount > 0) {
    const f = accum / accumCount;
    const si = Math.log(500), fi = Math.log(2500);
    const x = (Math.log(f) - si) / (fi - si) * w;
    const y = h/4;
    const u = 30;
    X.beginPath();
    X.moveTo(x, y-u);
    X.lineTo(x, y+u);
    X.stroke();
    X.textAlign = "center";
    X.textBaseline = "alphabetic";
    X.fillText(Math.floor(f*100)/100 + "Hz",x,y-u-5);
  }
  freqArray.forEach((f,i)=>{
    const si = Math.log(500), fi = Math.log(2500);
    const x = (Math.log(f) - si) / (fi - si) * w;
    const y = h/4;
    const u = 15;
    X.beginPath();
    X.moveTo(x, y-u);
    X.lineTo(x, y+u);
    X.stroke();
  });
});

};

Runtime().then();
