import { create } from 'zustand';
import type { Track, RepeatMode, PlayerSettings, SyncPlaybackState, SyncMode } from '@/types';
import { useLibrary } from './library';
import * as db from '@/lib/db';
import * as fs from '@/lib/firestore';
import { useAuth } from './auth';
import { getTrackUrl, getDominantColor } from '@/lib/metadata';
import { usePresence } from './presence';

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
  radioMode: boolean;
  syncMode: SyncMode | null;
  hostId: string | null;
  
  setSleepTimer: (minutes: number | null) => void;
  toggleRadioMode: () => void;
  toggleCrossfade: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolumeBoost: (boost: number) => void;
  setSyncMode: (mode: SyncMode) => void;
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
  _handleRemoteSync: (remote: SyncPlaybackState) => void;
  _forceSyncWithHost: () => Promise<void>;
  _handleRoleChange: (role: SyncMode) => void;
}

let audioEl: HTMLAudioElement | null = null;

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
  radioMode: false,
  syncMode: null,
  hostId: null,

  setSyncMode: (mode) => {
    if (!mode) return;
    const deviceId = usePresence.getState().deviceId;
    
    // Panggil handleRoleChange biar volume & state-nya beres
    get()._handleRoleChange(mode); 
    
    set({ hostId: mode === 'host' ? deviceId : get().hostId });
    void usePresence.getState().updateMyRole(mode);
    pushSyncState(get, true);
  },

  playTrack: async (trackId, contextIds) => {
    if (get().syncMode === 'speaker') return;
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
    if (get().syncMode === 'speaker') return;
    if (!trackIds.length) return;
    const id = trackIds[startIndex] ?? trackIds[0];
    const rest = trackIds.slice(startIndex + 1);
    set({ queue: get().shuffle ? shuffleArray(rest) : rest, history: [] });
    await get().playTrack(id, undefined);
  },

  togglePlay: () => {
    if (!audioEl || !get().currentTrack) return;
    if (get().syncMode === 'speaker') {
      import('./notification').then((mod) => mod.useNotification.getState().show('Mode Speaker: Kontrol dikunci oleh Host', 'info'));
      return;
    }

    if (audioEl.paused) {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          set({ isPlaying: true });
          updateMediaSession(get);
          pushSyncState(get);
        }).catch((error) => {
          set({ isPlaying: false });
        });
      }
    } else {
      audioEl.pause();
      set({ isPlaying: false });
      updateMediaSession(get);
      pushSyncState(get);
    }
  },

  next: async () => {
    if (get().syncMode === 'speaker') return;
    const { queue, history, repeat, currentTrack } = get();
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
      if (audioEl) { audioEl.currentTime = 0; void audioEl.play().catch(() => {}); }
    } else {
      set({ isPlaying: false });
    }
  },

  prev: async () => {
    if (get().syncMode === 'speaker') return;
    if (!audioEl) return;
    if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
    const { history, queue, currentTrack } = get();
    if (history.length) {
      const prevId = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      const newQueue = currentTrack ? [currentTrack.id, ...queue] : queue;
      set({ history: newHistory, queue: newQueue });
      const track = useLibrary.getState().tracks.find((t) => t.id === prevId);
      if (track) await loadAndPlay(track, set, get);
    } else if (audioEl) { audioEl.currentTime = 0; }
  },

  seek: (seconds) => {
    if (get().syncMode === 'speaker') return;
    if (audioEl && isFinite(seconds)) audioEl.currentTime = seconds;
    set({ position: seconds });
    pushSyncState(get);
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    if (audioEl) audioEl.volume = vol * get().volumeBoost;
    set({ volume: vol });
    persist(get);
  },

  toggleShuffle: () => { if (get().syncMode === 'speaker') return; set((s) => ({ shuffle: !s.shuffle })); persist(get); },
  cycleRepeat: () => { if (get().syncMode === 'speaker') return; set((s) => { const nextMode: RepeatMode = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off'; return { repeat: nextMode }; }); persist(get); },
  playNext: (trackId) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: [trackId, ...s.queue] })); },
  addToQueue: (trackId) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: [...s.queue, trackId] })); },
  removeFromQueue: (index) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })); },
  clearQueue: () => { if (get().syncMode === 'speaker') return; set({ queue: [] }); },
  toggleRadioMode: () => { if (get().syncMode === 'speaker') return; set((s) => ({ radioMode: !s.radioMode })); persist(get); },
  setSleepTimer: (minutes) => {
    if (get().syncMode === 'speaker') return;
    const end = minutes ? Date.now() + minutes * 60 * 1000 : null;
    set({ sleepTimerEnd: end });
    persist(get);
  },
  toggleCrossfade: () => { if (get().syncMode === 'speaker') return; set((s) => ({ crossfade: !s.crossfade })); persist(get); },
  setPlaybackRate: (rate) => { if (get().syncMode === 'speaker') return; if (audioEl) audioEl.playbackRate = rate; set({ playbackRate: rate }); persist(get); },
  setVolumeBoost: (boost) => { if (get().syncMode === 'speaker') return; const newVol = Math.min(1.5, Math.max(0, get().volume * boost)); if (audioEl) audioEl.volume = newVol; set({ volumeBoost: boost }); persist(get); },

  _onTimeUpdate: () => {
    if (!audioEl) return;
    set({ position: audioEl.currentTime });
    if (Math.floor(audioEl.currentTime) % 5 === 0) {
      persist(get);
      if (get().syncMode === 'host' && get().isPlaying) pushSyncState(get);
    }
  },
  _onLoadedMetadata: () => { if (!audioEl) return; set({ duration: audioEl.duration || 0 }); },
  _onEnded: () => void get().next(),
  _onError: () => {
    const { currentTrack } = get();
    set({ isPlaying: false, isBuffering: false, error: `Tidak bisa memutar: ${currentTrack?.title}` });
    setTimeout(() => void get().next(), 800);
  },

  _attach: (el) => {
    audioEl = el;
    audioEl.volume = get().syncMode === 'remote' ? 0 : get().volume * get().volumeBoost;
    audioEl.playbackRate = get().playbackRate;
    audioEl.addEventListener('timeupdate', get()._onTimeUpdate);
    audioEl.addEventListener('loadedmetadata', get()._onLoadedMetadata);
    audioEl.addEventListener('ended', get()._onEnded);
    audioEl.addEventListener('error', get()._onError);
    audioEl.addEventListener('play', () => { set({ isBuffering: true }); updateMediaSession(get); });
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
      isPlaying: false,
    });
    
    if (settings.currentTrackId) {
      const track = useLibrary.getState().tracks.find((t) => t.id === settings.currentTrackId);
      if (track) {
        set({ currentTrack: track, position: settings.position || 0 }); 
        await updateAmbient(track, set);
        
        if (audioEl) {
          const localUrl = await getTrackUrl(track.id, (id) => db.getAudioBlob(id));
          let url = localUrl || track.audioUrl;

          if (url && url.includes('.r2.dev')) {
            url = `https://r2-proxy.awliarahman12-ca2.workers.dev${new URL(url).pathname}`;
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

  _forceSyncWithHost: async () => {
    const user = useAuth.getState().user;
    if (!user) return;
    try {
      const remote = await fs.getSyncPlayback(user);
      if (remote) get()._handleRemoteSync(remote);
    } catch (e) {
      console.error("Gagal force sync", e);
    }
  },

  _handleRoleChange: (role) => {
    const state = get();
    if (state.syncMode === role) return;
    
    set({ syncMode: role });
    
    // Atur volume otomatis
    if (audioEl) {
      audioEl.volume = role === 'remote' ? 0 : state.volume * state.volumeBoost;
    }
    
    // Kalau turun jadi remote, langsung tarik data dari host baru
    if (role === 'remote') {
      void get()._forceSyncWithHost();
    }
  },

  _handleRemoteSync: (remote) => {
    const state = get();
    if (!state.syncMode) return;
    if (remote.originMode === 'speaker') return; 
    
    const isHost = state.syncMode === 'host';
    const isSpeaker = state.syncMode === 'speaker';
    const isRemote = state.syncMode === 'remote';

    set({ hostId: remote.hostId });

    if (audioEl) {
      if (isRemote) audioEl.volume = 0;
      else audioEl.volume = state.volume * state.volumeBoost;
    }

    if (isHost && remote.deviceId === usePresence.getState().deviceId) return;

    if (isHost || isSpeaker) {
      const { currentTrack } = get();
      const lib = useLibrary.getState();

      const timeDiff = (Date.now() - remote.updatedAt) / 1000;
      const expectedPos = remote.position + (remote.isPlaying ? timeDiff : 0);

      if (remote.trackId && remote.trackId !== currentTrack?.id) {
        const track = lib.tracks.find(t => t.id === remote.trackId);
        if (track) {
          set({ currentTrack: track });
          if (audioEl) {
            let url = track.audioUrl || '';
            if (url.includes('.r2.dev')) {
              url = `https://r2-proxy.awliarahman12-ca2.workers.dev${new URL(url).pathname}`;
            }
            if (url) {
              audioEl.src = url;
              audioEl.currentTime = expectedPos;
              if (remote.isPlaying) void audioEl.play().catch(() => {});
              else audioEl.pause();
            }
          }
        }
      } else if (audioEl && currentTrack) {
        if (Math.abs(audioEl.currentTime - expectedPos) > 0.5) {
          audioEl.currentTime = expectedPos;
        }
        if (remote.isPlaying && audioEl.paused) void audioEl.play().catch(() => {});
        if (!remote.isPlaying && !audioEl.paused) audioEl.pause();
      }
    } else if (isRemote) {
      const lib = useLibrary.getState();
      const track = lib.tracks.find(t => t.id === remote.trackId);
      if (track) {
        set({ currentTrack: track });
        if (audioEl) {
           let url = track.audioUrl || '';
           if (url.includes('.r2.dev')) url = `https://r2-proxy.awliarahman12-ca2.workers.dev${new URL(url).pathname}`;
           if (url && audioEl.src !== url) {
             audioEl.src = url;
           }
           if (audioEl) {
             audioEl.currentTime = remote.position;
             if (remote.isPlaying && audioEl.paused) void audioEl.play().catch(() => {});
             if (!remote.isPlaying && !audioEl.paused) audioEl.pause();
           }
        }
        set({ position: remote.position, isPlaying: remote.isPlaying });
      }
    }
  },
}));

async function loadAndPlay(track: Track, set: any, get: any) {
  set({ currentTrack: track, position: 0, duration: track.duration || 0, error: null });
  if (!audioEl) return;
  try {
    const localUrl = await getTrackUrl(track.id, (id) => db.getAudioBlob(id));
    let url = localUrl || track.audioUrl;
    if (url && url.includes('.r2.dev')) {
      url = `https://r2-proxy.awliarahman12-ca2.workers.dev${new URL(url).pathname}`;
    }
    if (!url) { set({ error: 'File tidak ditemukan' }); setTimeout(() => void get().next(), 800); return; }
    
    audioEl.src = url;
    audioEl.currentTime = 0;
    set({ isBuffering: true });
    
    await audioEl.play().catch((e) => {});
    
    void updateAmbient(track, set);
    void db.updateTrack(track.id, { lastPlayedAt: Date.now(), playCount: (track.playCount || 0) + 1 });
    useLibrary.setState((s) => ({
      tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, lastPlayedAt: Date.now() } : t)),
    }));
    persist(get);
    pushSyncState(get);
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
    volume: s.volume, shuffle: s.shuffle, repeat: s.repeat, currentTrackId: s.currentTrack?.id || null,
    position: audioEl?.currentTime || 0, queue: s.queue, sleepTimerEnd: s.sleepTimerEnd, crossfade: s.crossfade,
    playbackRate: s.playbackRate, volumeBoost: s.volumeBoost,
  };
  const user = useAuth.getState().user;
  if (user) void fs.saveSettingsToCloud(user, settings);
}

function pushSyncState(get: () => PlayerState, force = false) {
  const state = get();
  const user = useAuth.getState().user;
  if (!user || !state.syncMode) return;
  if (state.syncMode === 'speaker' && !force) return;

  const deviceId = usePresence.getState().deviceId;

  void fs.updateSyncPlayback(user, {
    deviceId,
    hostId: state.hostId || deviceId,
    trackId: state.currentTrack?.id || null,
    isPlaying: state.isPlaying,
    position: audioEl?.currentTime || 0,
    updatedAt: Date.now(),
    originMode: state.syncMode,
  });
}

function updateMediaSession(get: () => PlayerState) {
  if (!('mediaSession' in navigator)) return;
  const s = get();
  if (!s.currentTrack) { navigator.mediaSession.metadata = null; return; }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: s.currentTrack.title, artist: s.currentTrack.artist, album: s.currentTrack.album || '',
    artwork: s.currentTrack.coverDataUrl ? [{ src: s.currentTrack.coverDataUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.playbackState = s.isPlaying ? 'playing' : 'paused';
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().togglePlay());
  navigator.mediaSession.setActionHandler('previoustrack', () => void usePlayer.getState().prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => void usePlayer.getState().next());
  navigator.mediaSession.setActionHandler('seekto', (d) => { if (d.seekTime != null) usePlayer.getState().seek(d.seekTime); });
}
