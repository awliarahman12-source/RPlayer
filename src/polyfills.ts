// Polyfill kecil supaya music-metadata-browser jalan di Vite (butuh Buffer & process).
// Tanpa ini pembacaan tag/cover MP3 gagal diam-diam dan lagu jatuh ke tebakan nama file.
import { Buffer } from 'buffer';

const g = globalThis as any;
if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) {
  g.process = {
    env: {},
    browser: true,
    version: '',
    nextTick: (fn: (...a: any[]) => void, ...args: any[]) => setTimeout(() => fn(...args), 0),
  };
}
