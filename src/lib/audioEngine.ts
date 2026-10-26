let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let bassFilter: BiquadFilterNode | null = null;
let midFilter: BiquadFilterNode | null = null;
let trebleFilter: BiquadFilterNode | null = null;
export let analyserNode: AnalyserNode | null = null;

export function initAudioEngine(audioEl: HTMLAudioElement) {
  if (audioCtx) return;
  
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audioEl);

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 200;

  midFilter = audioCtx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3000;

  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 256;

  sourceNode.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

export function setEQ(bass: number, mid: number, treble: number) {
  if (bassFilter) bassFilter.gain.value = bass;
  if (midFilter) midFilter.gain.value = mid;
  if (trebleFilter) trebleFilter.gain.value = treble;
}