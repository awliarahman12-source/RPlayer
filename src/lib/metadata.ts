import { parseBlob } from 'music-metadata-browser';
import type { Track } from '@/types';

const SUPPORTED = ['audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/ogg', 'audio/vorbis'];
const SUPPORTED_EXT = /\.(mp3|m4a|wav|flac|ogg|opus)$/i;

export function isSupportedAudio(file: File): boolean {
  if (SUPPORTED.includes(file.type)) return true;
  if (file.type === '' || file.type === 'application/octet-stream') {
    return SUPPORTED_EXT.test(file.name);
  }
  return SUPPORTED_EXT.test(file.name);
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function downscaleCover(dataUrl: string, maxSize = 512): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function fileToTrack(file: File): Promise<Track> {
  const id = uid();

  // 1. Ambil nama file tanpa ekstensi sebagai cadangan (fallback)
  const rawName = file.name.replace(/\.[^.]+$/, '');
  let parsedTitle = rawName;
  let parsedArtist = 'Unknown artist';

  // Trik: Kalau nama file ada strip " - ", pecah jadi Artis dan Judul
  if (rawName.includes(' - ')) {
    const parts = rawName.split(' - ');
    parsedArtist = parts[0].trim();
    parsedTitle = parts.slice(1).join(' - ').trim();
  }

  const base: Track = {
    id,
    title: parsedTitle,
    artist: parsedArtist,
    album: undefined,
    duration: 0,
    fileName: file.name,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
    addedAt: Date.now(),
    liked: false,
  };

  try {
    // 2. Baca Metadata ID3 Asli dari dalam file MP3
    const meta = await parseBlob(file);
    const common = meta.common;
    
    // 3. Kalau di dalam file ada info, TIMPA hasil tebakan nama file tadi
    if (common.title) base.title = common.title;
    if (common.artist) base.artist = common.artist;
    if (common.album) base.album = common.album;
    if (meta.format.duration) base.duration = meta.format.duration;

    // 4. Ambil Cover Gambar dari dalam file
    const picture = common.picture?.[0];
    if (picture) {
      const blob = new Blob([picture.data], { type: picture.format });
      const raw = await blobToDataUrl(blob);
      base.coverDataUrl = await downscaleCover(raw); // Simpan sebagai base64
    }
  } catch {
    // Kalau gagal baca ID3 (file corrupt atau format aneh), biarin pakai fallback nama file
  }

  if (!base.duration) {
    try {
      base.duration = await readDuration(file);
    } catch {
      base.duration = 0;
    }
  }

  return base;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('duration read failed'));
    };
    audio.src = url;
  });
}

/** Build a usable object URL for a stored blob; reuses the same blob URL until revoked. */
const urlCache = new Map<string, string>();

export async function getTrackUrl(id: string, loader: (id: string) => Promise<Blob | undefined>): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const blob = await loader(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function revokeTrackUrl(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/** Average color from a cover image — used for the ambient background. */
export function getDominantColor(dataUrl: string): Promise<{ r: number; g: number; b: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 12;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        resolve({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}