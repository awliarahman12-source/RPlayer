import { create } from 'zustand';
import type { Track, RepeatMode, PlayerSettings } from '@/types';
import { useLibrary } from './library';
import * as db from '@/lib/db';
import { getTrackUrl, getDominantColor } from '@/lib/metadata';


interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: string[];
  history: string[];
  ambientColor: { r: number; g: number; b: number } | null;
  ambientCover: string | null;
  error: string | null;
  sleepTimerEnd: number | null;
  crossfade: boolean;
  playbackRate: number;
  volumeBoost: number;
  
  setSleepTimer: (minutes: number | null) => void;
  toggleCrossfade: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolumeBoost: (boost: number) => void;
  playTrack: (trackId: string, contextIds?: string[]) => Promise<void>;
  playTracks: (trackIds: string[], startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (trackId: string) => void;
  addToQueue: (trackId: string) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  _onTimeUpdate: () => void;
  _onEnded: () => void;
  _onLoadedMetadata: () => void;
  _onError: () => void;
  _attach: (el: HTMLAudioElement) => void;
  _detach: () => void;
  _restore: (settings: PlayerSettings) => Promise<void>;
}

let audioEl: HTMLAudioElement | null = null;

function fixUrl(u?: string): string | undefined {
  const base = import.meta.env.VITE_R2_PUBLIC_URL as string | undefined;
  if (!u || !base) return u;
  return u.replace(/^https:\/\/pub-[a-z0-9]+\.r2\.dev/, base.replace(/\/$/, ''));
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  isBuffering: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  queue: [],
  history: [],
  ambientColor: null,
  ambientCover: null,
  error: null,
  sleepTimerEnd: null,
  crossfade: false,
  playbackRate: 1,
  volumeBoost: 1,

  playTrack: async (trackId, contextIds) => {
    const lib = useLibrary.getState();
    const track = lib.tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (contextIds && contextIds.length) {
      const idx = contextIds.indexOf(trackId);
      let upcoming = contextIds.slice(idx + 1);
      if (get().shuffle) upcoming = shuffleArray(upcoming);
      set({ queue: upcoming, history: [] });
    }
    await loadAndPlay(track, set, get);
  },

  playTracks: async (trackIds, startIndex = 0) => {
    if (!trackIds.length) return;
    const id = trackIds[startIndex] ?? trackIds[0];
    const rest = trackIds.slice(startIndex + 1);
    set({ queue: get().shuffle ? shuffleArray(rest) : rest, history: [] });
    await get().playTrack(id, undefined);
  },

  togglePlay: () => {
    if (!audioEl || !get().currentTrack) return;
    
    if (audioEl.paused) {
      const playPromise = audioEl.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            set({ isPlaying: true }); // Baru ubah ke Pause kalau sukses
            updateMediaSession(get);
          })
          .catch((error) => {
            console.warn("Gagal memutar (mungkin koneksi/ISP diblokir):", error);
            set({ isPlaying: false });
            
            // Panggil notifikasi
            import('./notification').then((mod) => {
              mod.useNotification.getState().show('Gagal memutar. Koneksi terblokir atau file rusak.', 'error');
            });
          });
      }
    } else {
      audioEl.pause();
      set({ isPlaying: false });
      updateMediaSession(get);
    }
  },

  next: async () => {
    const { queue, history, repeat, currentTrack, crossfade } = get();
    if (crossfade && audioEl && currentTrack) {
      const originalVol = audioEl.volume;
      let fadeStep = originalVol / 20;
      const fadeOut = setInterval(() => {
        if (audioEl && audioEl.volume > 0) {
          audioEl.volume = Math.max(0, audioEl.volume - fadeStep);
        } else {
          clearInterval(fadeOut);
        }
      }, 50);
      setTimeout(() => { clearInterval(fadeOut); }, 1100);
    }

    if (repeat === 'one' && currentTrack && audioEl) {
      audioEl.currentTime = 0;
      void audioEl.play().catch(() => {});
      return;
    }
    if (queue.length) {
      const [nextId, ...rest] = queue;
      const newHistory = currentTrack ? [...history, currentTrack.id].slice(-50) : history;
      set({ queue: rest, history: newHistory });
      const track = useLibrary.getState().tracks.find((t) => t.id === nextId);
      if (track) await loadAndPlay(track, set, get);
    } else if (repeat === 'all' && currentTrack) {
      if (audioEl) {
        audioEl.currentTime = 0;
        void audioEl.play().catch(() => {});
      }
    } else {
      set({ isPlaying: false });
    }
  },

  prev: async () => {
    if (!audioEl) return;
    if (audioEl.currentTime > 3) {
      audioEl.currentTime = 0;
      return;
    }
    const { history, queue, currentTrack } = get();
    if (history.length) {
      const prevId = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      const newQueue = currentTrack ? [currentTrack.id, ...queue] : queue;
      set({ history: newHistory, queue: newQueue });
      const track = useLibrary.getState().tracks.find((t) => t.id === prevId);
      if (track) await loadAndPlay(track, set, get);
    } else if (audioEl) {
      audioEl.currentTime = 0;
    }
  },

  seek: (seconds) => {
    if (audioEl && isFinite(seconds)) audioEl.currentTime = seconds;
    set({ position: seconds });
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    if (audioEl) audioEl.volume = vol * get().volumeBoost;
    set({ volume: vol });
    persist(get);
  },

  toggleShuffle: () => {
    set((s) => ({ shuffle: !s.shuffle }));
    persist(get);
  },

  cycleRepeat: () => {
    set((s) => {
      const nextMode: RepeatMode = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off';
      return { repeat: nextMode };
    });
    persist(get);
  },

  playNext: (trackId) => set((s) => ({ queue: [trackId, ...s.queue] })),
  addToQueue: (trackId) => set((s) => ({ queue: [...s.queue, trackId] })),
  removeFromQueue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue: () => set({ queue: [] }),

  setSleepTimer: (minutes) => {
    const end = minutes ? Date.now() + minutes * 60 * 1000 : null;
    set({ sleepTimerEnd: end });
    if (audioEl && end) {
      const timeLeft = end - Date.now();
      setTimeout(() => {
        if (get().sleepTimerEnd === end) {
          get().togglePlay();
          set({ sleepTimerEnd: null });
        }
      }, timeLeft);
    }
    persist(get);
  },

  toggleCrossfade: () => {
    set((s) => ({ crossfade: !s.crossfade }));
    persist(get);
  },

  setPlaybackRate: (rate) => {
    if (audioEl) audioEl.playbackRate = rate;
    set({ playbackRate: rate });
    persist(get);
  },

  setVolumeBoost: (boost) => {
    const newVol = Math.min(1.5, Math.max(0, get().volume * boost));
    if (audioEl) audioEl.volume = newVol;
    set({ volumeBoost: boost });
    persist(get);
  },

  _onTimeUpdate: () => {
    if (!audioEl) return;
    set({ position: audioEl.currentTime });
    if (Math.floor(audioEl.currentTime) % 5 === 0) persist(get);
  },

  _onLoadedMetadata: () => {
    if (!audioEl) return;
    const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
    set({ duration: dur });
  },

  _onEnded: () => void get().next(),

  _onError: () => {
    const { currentTrack } = get();
    console.error('Audio error', audioEl?.error?.code, audioEl?.src);
    set({ isPlaying: false, isBuffering: false, error: `Tidak bisa memutar: ${currentTrack?.title} (sumber audio tidak bisa diakses)` });
    setTimeout(() => void get().next(), 800);
  },

  _attach: (el) => {
    audioEl = el;
    audioEl.volume = get().volume * get().volumeBoost;
    audioEl.playbackRate = get().playbackRate;
    audioEl.addEventListener('timeupdate', get()._onTimeUpdate);
    audioEl.addEventListener('loadedmetadata', get()._onLoadedMetadata);
    audioEl.addEventListener('ended', get()._onEnded);
    audioEl.addEventListener('error', get()._onError);
    audioEl.addEventListener('play', () => set({ isBuffering: true }));
    audioEl.addEventListener('playing', () => { set({ isPlaying: true, isBuffering: false, error: null }); updateMediaSession(get); });
    audioEl.addEventListener('waiting', () => set({ isBuffering: true }));
    audioEl.addEventListener('canplay', () => set({ isBuffering: false }));
    audioEl.addEventListener('pause', () => { set({ isPlaying: false, isBuffering: false }); updateMediaSession(get); });
    persist(get);
  },

  _detach: () => {
    if (!audioEl) return;
    audioEl.removeEventListener('timeupdate', get()._onTimeUpdate);
    audioEl.removeEventListener('loadedmetadata', get()._onLoadedMetadata);
    audioEl.removeEventListener('ended', get()._onEnded);
    audioEl.removeEventListener('error', get()._onError);
    audioEl = null;
  },

  _restore: async (settings) => {
    set({
      volume: settings.volume,
      shuffle: settings.shuffle,
      repeat: settings.repeat,
      queue: settings.queue || [],
      sleepTimerEnd: settings.sleepTimerEnd || null,
      crossfade: settings.crossfade || false,
      playbackRate: settings.playbackRate || 1,
      volumeBoost: settings.volumeBoost || 1,
    });
    if (settings.currentTrackId) {
      const track = useLibrary.getState().tracks.find((t) => t.id === settings.currentTrackId);
      if (track) {
        set({ currentTrack: track });
        await updateAmbient(track, set);
        if (audioEl) {
          // Pakai URL dari R2, kalau nggak ada baru fallback ke lokal
          let url = track.audioUrl || await getTrackUrl(track.id, (id) => db.getAudioBlob(id));

          // Trik buat ngubah URL lama r2.dev ke URL Worker
          if (url && url.includes('.r2.dev')) {
            const workerUrl = "https://r2-proxy.awliarahman12-ca2.workers.dev";
            const path = new URL(url).pathname;
            url = `${workerUrl}${path}`;
          }
          if (url && audioEl) {
            audioEl.src = url;
            audioEl.load();
            const onLoaded = () => {
              if (audioEl && settings.position) {
                audioEl.currentTime = Math.min(settings.position, audioEl.duration || settings.position);
              }
              set({ position: settings.position || 0 });
              audioEl?.removeEventListener('loadedmetadata', onLoaded);
            };
            audioEl.addEventListener('loadedmetadata', onLoaded);
          }
        }
      }
    }
  },
}));

async function loadAndPlay(track: Track, set: any, get: any) {
  set({ currentTrack: track, position: 0, duration: track.duration || 0, error: null });
  if (!audioEl) return;
  try {
    // Pakai URL dari R2, kalau nggak ada baru fallback ke lokal     
    let url = track.audioUrl || await getTrackUrl(track.id, (id) => db.getAudioBlob(id));

    // Trik buat ngubah URL lama r2.dev ke URL Worker
    if (url && url.includes('.r2.dev')) {
      const workerUrl = "https://r2-proxy.awliarahman12-ca2.workers.dev";
      const path = new URL(url).pathname;
      url = `${workerUrl}${path}`;
    }
    if (!url) { set({ error: 'File tidak ditemukan' }); setTimeout(() => void get().next(), 800); return; }
    if (get().currentTrack?.id !== track.id) return;
    audioEl.src = url;
    audioEl.currentTime = 0;
    set({ isBuffering: true });
    const el = audioEl;
    window.setTimeout(() => {
      if (get().currentTrack?.id === track.id && el.readyState === 0) {
        set({ isPlaying: false, isBuffering: false, error: 'Koneksi ke server audio timeout (cek ISP / custom domain R2)' });
      }
    }, 15000);
    await audioEl.play().catch((e) => {
      if (e?.name !== 'AbortError') console.warn('play() rejected', e);
    });
    void updateAmbient(track, set);
    void db.updateTrack(track.id, { lastPlayedAt: Date.now() });
    useLibrary.setState((s) => ({
      tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, lastPlayedAt: Date.now() } : t)),
    }));
    persist(get);
  } catch (e) {
    set({ error: 'Gagal memutar' });
    setTimeout(() => void get().next(), 800);
  }
}

async function updateAmbient(track: Track, set: any) {
  set({ ambientCover: track.coverDataUrl || null });
  if (track.coverDataUrl) {
    const color = await getDominantColor(track.coverDataUrl);
    if (color) set({ ambientColor: color });
  } else {
    set({ ambientColor: null });
  }
}

function persist(get: () => PlayerState) {
  const s = get();
  const settings: PlayerSettings = {
    volume: s.volume,
    shuffle: s.shuffle,
    repeat: s.repeat,
    currentTrackId: s.currentTrack?.id || null,
    position: audioEl?.currentTime || 0,
    queue: s.queue,
    sleepTimerEnd: s.sleepTimerEnd,
    crossfade: s.crossfade,
    playbackRate: s.playbackRate,
    volumeBoost: s.volumeBoost,
  };
  void db.putSettings(settings);
}

function updateMediaSession(get: () => PlayerState) {
  if (!('mediaSession' in navigator)) return;
  const s = get();
  if (!s.currentTrack) { navigator.mediaSession.metadata = null; return; }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: s.currentTrack.title,
    artist: s.currentTrack.artist,
    album: s.currentTrack.album || '',
    artwork: s.currentTrack.coverDataUrl ? [{ src: s.currentTrack.coverDataUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.playbackState = s.isPlaying ? 'playing' : 'paused';
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().togglePlay());
  navigator.mediaSession.setActionHandler('previoustrack', () => void usePlayer.getState().prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => void usePlayer.getState().next());
  navigator.mediaSession.setActionHandler('seekto', (d) => {
    if (d.seekTime != null) usePlayer.getState().seek(d.seekTime);
  });
}
