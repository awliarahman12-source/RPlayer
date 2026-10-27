import { parseBlob } from 'music-metadata-browser';
import type { Track } from '@/types';
import { readTagsFallback } from './id3';

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
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Selalu encode ulang ke JPEG dan turunkan kualitas sampai cukup kecil (batas dokumen Firestore 1MB)
      let q = 0.85;
      let out = canvas.toDataURL('image/jpeg', q);
      while (out.length > 250_000 && q > 0.4) {
        q -= 0.15;
        out = canvas.toDataURL('image/jpeg', q);
      }
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Bersihkan sampah di nama file: underscore, "(Official Audio)", "[320kbps]", nomor urut, dll. */
function cleanName(s: string): string {
  return s
    .replace(/_+/g, ' ')
    .replace(/\s*[\(\[][^\)\]]*(official|lyrics?|lirik|audio|video|mv|hd|hq|kbps|download|downcloud|y2mate|spotdown)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseFileName(name: string): { title: string; artist: string } {
  let raw = name.replace(/\.[^.]+$/, '');
  raw = raw.replace(/^\s*\d{1,3}\s*[-._)]\s+/, ''); // "01 - " / "01. "
  raw = cleanName(raw);
  const parts = raw.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { title: raw, artist: 'Unknown artist' };
}

const norm = (s: string) => s.trim().toLowerCase();

export async function fileToTrack(file: File): Promise<Track> {
  const id = uid();
  const parsed = parseFileName(file.name);

  const base: Track = {
    id,
    title: parsed.title || file.name,
    artist: parsed.artist,
    album: undefined,
    duration: 0,
    fileName: file.name,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
    addedAt: Date.now(),
    liked: false,
  };

  let gotTitle = false;
  let gotArtist = false;
  let gotCover = false;

  const setCover = async (data: Uint8Array, mime: string) => {
    try {
      const blob = new Blob([data as unknown as BlobPart], { type: mime || 'image/jpeg' });
      base.coverDataUrl = await downscaleCover(await blobToDataUrl(blob));
      gotCover = true;
    } catch { /* cover gagal, abaikan */ }
  };

  // 1) Library music-metadata-browser (mendukung MP3, M4A, FLAC, OGG, dll)
  try {
    const meta = await parseBlob(file);
    const common = meta.common;
    if (common.title) { base.title = common.title; gotTitle = true; }
    const artist = common.artist || (common.artists && common.artists.length ? common.artists.join(', ') : '');
    if (artist) { base.artist = artist; gotArtist = true; }
    if (common.album) base.album = common.album;
    if (meta.format.duration) base.duration = meta.format.duration;
    const picture = common.picture?.[0];
    if (picture) await setCover(picture.data, picture.format);
  } catch {
    // lanjut ke parser cadangan di bawah
  }

  // 2) Cadangan: parser ID3 bawaan (jalan tanpa Buffer/polyfill)
  if (!gotTitle || !gotArtist || !gotCover) {
    const tags = await readTagsFallback(file);
    if (tags) {
      if (!gotTitle && tags.title) { base.title = tags.title; gotTitle = true; }
      if (!gotArtist && tags.artist) { base.artist = tags.artist; gotArtist = true; }
      if (!base.album && tags.album) base.album = tags.album;
      if (!gotCover && tags.picture) await setCover(tags.picture.data, tags.picture.mime);
    }
  }

  // 3) Kalau tag cuma sebagian, cocokkan dengan nama file (termasuk nama file yang urutannya terbalik)
  if (gotTitle && !gotArtist) {
    if (norm(parsed.title) === norm(base.title)) base.artist = parsed.artist;
    else if (norm(parsed.artist) === norm(base.title)) base.artist = parsed.title;
    else base.artist = 'Unknown artist';
  } else if (!gotTitle && gotArtist) {
    if (norm(parsed.artist) === norm(base.artist)) base.title = parsed.title;
    else if (norm(parsed.title) === norm(base.artist)) base.title = parsed.artist;
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