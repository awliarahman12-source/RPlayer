import { create } from 'zustand';
import type { Track, RepeatMode, PlayerSettings, SyncPlaybackState, SyncMode } from '@/types';
import { useLibrary } from './library';
import * as db from '@/lib/db';
import * as fs from '@/lib/firestore';
import { useAuth } from './auth';
import { getTrackUrl, getDominantColor } from '@/lib/metadata';
import { usePresence } from './presence';
import { serverNow } from '@/lib/clock';

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
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  
  setSleepTimer: (minutes: number | null) => void;
  toggleRadioMode: () => void;
  toggleCrossfade: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolumeBoost: (boost: number) => void;
  setSyncMode: (mode: SyncMode, options?: { silent?: boolean }) => void;
  playRadio: (track: Track) => Promise<void>;
  playTrack: (trackId: string, contextIds?: string[]) => Promise<void>;
  playTracks: (trackIds: string[], startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  clearCurrent: () => void;
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
  _handleRemoteSync: (remote: SyncPlaybackState, force?: boolean) => void;
  _forceSyncWithHost: () => Promise<void>;
  _handleRoleChange: (role: SyncMode) => void;
}

let audioEl: HTMLAudioElement | null = null;
let lastTick = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let seekPushTimer: ReturnType<typeof setTimeout> | null = null;
// --- state crossfade ---
let fadeMul = 1; // pengali volume untuk fade lagu baru (0..1), terpisah dari slider volume
let fadeToken = 0; // pembatal fade yang sedang jalan
let playToken = 0; // pembatal loadAndPlay lama kalau user pencet next berkali-kali
let outgoing: HTMLAudioElement | null = null; // lagu lama yang di-fade out (overlap)
let crossfadeTriggered = false;
// --- state sync host / remote / speaker ---
let lastState: SyncPlaybackState | null = null; // state sync terakhir yang kita tahu (dari cloud atau yang kita tulis)
let followToken = 0; // pembatal proses "ikuti state" yang sudah usang
let remoteTicker: ReturnType<typeof setInterval> | null = null;
let preloadEl: HTMLAudioElement | null = null;
let preloadedId = '';
let gestureArmed = false;

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
  crossfadeEnabled: false,
  crossfadeDuration: 3, // default 3 detik

  setSyncMode: (mode, _options) => {
    if (!mode) return;
    
    // Validasi: Cek apakah role ini diizinkan
    const devices = usePresence.getState().devices;
    const myDeviceId = usePresence.getState().deviceId;
    const myDevice = devices.find(d => d.deviceId === myDeviceId);
    
    if (myDevice) {
      if (mode === 'host' && myDevice.role === 'speaker') {
        const currentHost = devices.find(d => d.role === 'host');
        const currentRemote = devices.find(d => d.role === 'remote');
        if (currentHost && currentRemote) {
          import('./notification').then((mod) => mod.useNotification.getState().show('Hanya Remote yang bisa menjadi Host!', 'error'));
          return; // Batalkan
        }
      }
      
      if (mode === 'remote' && myDevice.role === 'speaker') {
        const currentRemote = devices.find(d => d.role === 'remote');
        if (currentRemote) {
          import('./notification').then((mod) => mod.useNotification.getState().show('Slot Remote sudah terisi!', 'error'));
          return; // Batalkan
        }
      }
    }

    const deviceId = usePresence.getState().deviceId;
    const prevMode = get().syncMode;

    // Host lama menyimpan posisi akuratnya dulu sebelum turun jabatan
    if (prevMode === 'host' && mode !== 'host') pushSyncState(get, true);

    // Ganti peran = IKUTI state yang ada di cloud (diambil di _handleRoleChange -> _forceSyncWithHost),
    // bukan menimpa state itu dengan state lokal yang mungkin kosong/pause.
    get()._handleRoleChange(mode);

    set({ hostId: mode === 'host' ? deviceId : get().hostId });
    void usePresence.getState().updateMyRole(mode);
  },

  playRadio: async (track) => {
    if (get().syncMode === 'speaker') return;
    set({ queue: [], history: [] }); // Radio nggak punya antrean
    await loadAndPlay(track, set, get);
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
    const mode = get().syncMode;
    if (mode === 'speaker') {
      import('./notification').then((mod) => mod.useNotification.getState().show('Mode Speaker: Kontrol dikunci oleh Host', 'info'));
      return;
    }
    if (!get().currentTrack) return;

    // Remote: nggak punya audio. Ubah tampilan langsung (tanpa nunggu), lalu kirim perintah ke Host.
    if (mode === 'remote') {
      const nextPlaying = !get().isPlaying;
      set({ isPlaying: nextPlaying });
      if (lastState) lastState = { ...lastState, isPlaying: nextPlaying, position: get().position, updatedAt: serverNow() };
      pushSyncState(get, true);
      return;
    }

    if (!audioEl) return;
    if (audioEl.paused) {
      // Umumkan "play" duluan supaya device lain langsung ikut, jangan nunggu play() selesai
      set({ isPlaying: true });
      pushSyncState(get);
      audioEl.play().then(() => {
        updateMediaSession(get);
      }).catch((error) => {
        set({ isPlaying: false });
        pushSyncState(get);
        if (error && error.name === 'NotAllowedError') armGestureResume(get);
      });
    } else {
      killOutgoing();
      audioEl.pause();
      set({ isPlaying: false });
      updateMediaSession(get);
      pushSyncState(get);
    }
  },

  clearCurrent: () => {
    killOutgoing();
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
    set({ currentTrack: null, isPlaying: false, isBuffering: false, position: 0, duration: 0, ambientCover: null, ambientColor: null });
    persist(get);
    pushSyncState(get);
  },

  next: async () => {
    if (get().syncMode === 'speaker') return;
    const { queue, history, repeat, currentTrack } = get();
    if (repeat === 'one' && currentTrack) {
      get().seek(0);
      if (get().syncMode !== 'remote' && audioEl) void audioEl.play().catch(() => {});
      return;
    }
    if (queue.length) {
      const [nextId, ...rest] = queue;
      const newHistory = currentTrack ? [...history, currentTrack.id].slice(-50) : history;
      set({ queue: rest, history: newHistory });
      const track = useLibrary.getState().tracks.find((t) => t.id === nextId);
      if (track) await loadAndPlay(track, set, get);
    } else if (repeat === 'all' && currentTrack) {
      get().seek(0);
      if (get().syncMode !== 'remote' && audioEl) void audioEl.play().catch(() => {});
    } else {
      set({ isPlaying: false });
      pushSyncState(get, true);
    }
  },

  prev: async () => {
    if (get().syncMode === 'speaker') return;
    if (get().syncMode !== 'remote' && !audioEl) return;
    if (livePosition(get) > 3) { get().seek(0); return; }
    const { history, queue, currentTrack } = get();
    if (history.length) {
      const prevId = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      const newQueue = currentTrack ? [currentTrack.id, ...queue] : queue;
      set({ history: newHistory, queue: newQueue });
      const track = useLibrary.getState().tracks.find((t) => t.id === prevId);
      if (track) await loadAndPlay(track, set, get);
    } else {
      get().seek(0);
    }
  },

  seek: (seconds) => {
    if (get().syncMode === 'speaker') return;
    if (!isFinite(seconds)) return;
    if (get().syncMode === 'remote') {
      // Remote: geser tampilan langsung, perintah dikirim ke Host
      set({ position: seconds });
      if (lastState) lastState = { ...lastState, position: seconds, updatedAt: serverNow() };
      pushSyncStateSoon(get);
      return;
    }
    if (audioEl) audioEl.currentTime = seconds;
    set({ position: seconds });
    pushSyncStateSoon(get);
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    set({ volume: vol });
    applyVolume(get);
    persist(get);
  },

  toggleShuffle: () => { 
    if (get().syncMode === 'speaker') return; 
    set((s) => ({ shuffle: !s.shuffle })); 
    persist(get); 
    pushSyncState(get); 
  },
  cycleRepeat: () => { 
    if (get().syncMode === 'speaker') return; 
    set((s) => { const nextMode: RepeatMode = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off'; return { repeat: nextMode }; }); 
    persist(get); 
    pushSyncState(get); 
  },
  playNext: (trackId) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: [trackId, ...s.queue] })); pushSyncState(get); },
  addToQueue: (trackId) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: [...s.queue, trackId] })); pushSyncState(get); },
  removeFromQueue: (index) => { if (get().syncMode === 'speaker') return; set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })); pushSyncState(get); },
  clearQueue: () => { if (get().syncMode === 'speaker') return; set({ queue: [] }); pushSyncState(get); },
  toggleRadioMode: () => { if (get().syncMode === 'speaker') return; set((s) => ({ radioMode: !s.radioMode })); persist(get); pushSyncState(get); },
  setSleepTimer: (minutes) => {
    if (get().syncMode === 'speaker') return;
    const end = minutes ? Date.now() + minutes * 60 * 1000 : null;
    set({ sleepTimerEnd: end });
    persist(get);
    pushSyncState(get);
  },
  toggleCrossfade: () => { if (get().syncMode === 'speaker') return; set((s) => ({ crossfade: !s.crossfade })); persist(get); pushSyncState(get); },
  setPlaybackRate: (rate) => { if (get().syncMode === 'speaker') return; if (audioEl) audioEl.playbackRate = rate; set({ playbackRate: rate }); persist(get); pushSyncState(get); },
  setVolumeBoost: (boost) => { if (get().syncMode === 'speaker') return; const newVol = Math.min(1.5, Math.max(0, get().volume * boost)); set({ volumeBoost: boost }); applyVolume(get); persist(get); pushSyncState(get); },
    setCrossfadeEnabled: (enabled) => {
    set({ crossfadeEnabled: enabled });
    persist(get);
  },
  setCrossfadeDuration: (duration) => {
    set({ crossfadeDuration: duration });
    persist(get);
  },

  _onTimeUpdate: () => {
    if (!audioEl) return;
    set({ position: audioEl.currentTime });

    // Smart Sleep Timer (Fade out 10 detik terakhir)
    const s = get();
    if (s.sleepTimerEnd) {
      const remaining = s.sleepTimerEnd - Date.now();
      if (remaining > 0 && remaining <= 10000) {
        // Menurunkan volume secara perlahan (0 s/d 1)
        const fadeRatio = remaining / 10000;
        audioEl.volume = Math.max(0, Math.min(1, s.volume * s.volumeBoost * fadeMul * fadeRatio));
      } else if (remaining <= 0) {
        // Waktu habis, matikan lagu
        if (audioEl && !audioEl.paused) {
          audioEl.pause();
          set({ isPlaying: false, sleepTimerEnd: null });
          import('./notification').then((mod) => mod.useNotification.getState().show('Sleep Timer selesai, selamat tidur!', 'info'));
        }
      }
    }
    // Throttle: maksimal sekali tiap 5 detik (timeupdate jalan ~4x/detik)
    const now = Date.now();
    if (now - lastTick >= 5000) {
      lastTick = now;
      persist(get);
      heartbeatSync(get);
    }

    // Speaker: koreksi selisih waktu dengan mengubah kecepatan sedikit (tanpa lompat / suara putus)
    const sp = get();
    if (sp.syncMode === 'speaker' && lastState && lastState.isPlaying && lastState.trackId === sp.currentTrack?.id && !audioEl.paused && audioEl.readyState >= 3) {
      const want = estimatePos(lastState);
      const drift = audioEl.currentTime - want;
      if (Math.abs(drift) > 0.7) {
        audioEl.currentTime = want;
      } else {
        const nudge = Math.abs(drift) < 0.04 ? 0 : Math.max(-0.05, Math.min(0.05, -drift * 0.2));
        const rate = sp.playbackRate * (1 + nudge);
        if (Math.abs(audioEl.playbackRate - rate) > 0.002) audioEl.playbackRate = rate;
      }
    }

    // Crossfade otomatis: mulai lagu berikutnya sebelum lagu ini habis supaya saling menimpa
    const st = get();
    if (st.crossfadeEnabled && !crossfadeTriggered && st.queue.length > 0 && st.repeat !== 'one' && st.syncMode !== 'speaker' && st.syncMode !== 'remote' && !audioEl.paused) {
      const fadeSec = Math.max(0.6, st.crossfadeDuration || 3);
      const dur = audioEl.duration;
      const remaining = dur - audioEl.currentTime;
      // Trigger sedikit lebih awal (fadeSec + 0.5 detik) agar buffer lagu baru siap sebelum lagu lama habis
      if (isFinite(dur) && dur > fadeSec * 2 && remaining > 0.3 && remaining <= (fadeSec + 0.5)) {
        crossfadeTriggered = true;
        void get().next();
      }
    }
  }, // <-- PENUTUP FUNGSI _onTimeUpdate YANG SEBELUMNYA HILANG
  
  _onLoadedMetadata: () => { if (!audioEl) return; set({ duration: audioEl.duration || 0 }); },
  _onEnded: () => void get().next(),
  _onError: () => {
    const { currentTrack } = get();
    set({ isPlaying: false, isBuffering: false, error: `Tidak bisa memutar: ${currentTrack?.title}` });
    setTimeout(() => void get().next(), 800);
  },

  _attach: (el) => {
    audioEl = el;
    audioEl.volume = get().syncMode === 'remote' ? 0 : Math.min(1, get().volume * get().volumeBoost);
    audioEl.playbackRate = get().playbackRate;
    audioEl.addEventListener('timeupdate', get()._onTimeUpdate);
    audioEl.addEventListener('loadedmetadata', get()._onLoadedMetadata);
    audioEl.addEventListener('ended', get()._onEnded);
    audioEl.addEventListener('error', get()._onError);
    audioEl.addEventListener('play', () => { set({ isPlaying: true, isBuffering: false }); updateMediaSession(get); });
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
    const role = get().syncMode;
    const follower = role === 'remote' || role === 'speaker';
    set({
      volumeBoost: settings.volumeBoost || 1,
      crossfadeEnabled: settings.crossfadeEnabled || false,
      crossfadeDuration: settings.crossfadeDuration || 3,
      ...(follower
        ? {}
        : {
            shuffle: settings.shuffle,
            repeat: settings.repeat,
            queue: settings.queue || [],
            isPlaying: !!(audioEl && !audioEl.paused),
          }),
    });
    // Perangkat pengikut (remote/speaker): state diambil dari sync, jangan ditimpa data lama
    if (follower) return;

    if (settings.currentTrackId) {
      const track = useLibrary.getState().tracks.find((t) => t.id === settings.currentTrackId);
      if (track && !get().currentTrack) {
        set({ currentTrack: track, position: settings.position || 0 });
        await updateAmbient(track, set);

        const roleNow = get().syncMode;
        if (roleNow === 'remote' || roleNow === 'speaker') return;

        if (audioEl && !audioEl.src) {
          const url = await resolveTrackUrl(track);
          if (url && audioEl && !audioEl.src) {
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
      let remote = await fs.getSyncPlayback(user);
      // pakai state terbaru yang kita tahu (misalnya baru saja kita tulis sendiri)
      if (lastState && (!remote || lastState.updatedAt > remote.updatedAt)) remote = lastState;
      if (remote) get()._handleRemoteSync(remote, true);
    } catch (e) {
      console.error('Gagal force sync', e);
    }
  },

  _handleRoleChange: (role) => {
    const state = get();
    if (state.syncMode === role) return;

    set({ syncMode: role });

    if (role === 'remote') {
      // Remote cuma cermin + kontrol: audio lokal berhenti, posisi dihitung dari state cloud
      followToken++;
      killOutgoing();
      if (audioEl && !audioEl.paused) audioEl.pause();
      startRemoteTicker(set, get);
    } else if (state.syncMode === 'remote') {
      fadeMul = 1; // dari remote ke host/speaker: mulai bersuara lagi
    }
    if (audioEl) audioEl.playbackRate = get().playbackRate;
    applyVolume(get);

    void get()._forceSyncWithHost();
  },

  _handleRemoteSync: (incoming, force = false) => {
    const state = get();
    if (!state.syncMode) return;
    if (incoming.originMode === 'speaker' && !force) return;

    if (!force) {
      const myId = usePresence.getState().deviceId;
      // Abaikan gema dari tulisan sendiri (tampilan lokal sudah benar)
      if (incoming.deviceId === myId || incoming.hbBy === myId) return;
    }

    const remote = normalizeSync(incoming);
    lastState = remote;

    set({
      hostId: remote.hostId,
      repeat: remote.repeat !== undefined ? remote.repeat : state.repeat,
      shuffle: remote.shuffle !== undefined ? remote.shuffle : state.shuffle,
      queue: remote.queue !== undefined ? remote.queue : state.queue,
    });

    if (state.syncMode === 'remote') {
      void mirrorRemote(remote, set, get);
    } else {
      void followRemote(remote, force, set, get);
    }
  },
}));

// ===================== Sync host / remote / speaker =====================

/** Posisi lagu sekarang menurut state sync (memperhitungkan waktu yang sudah lewat, pakai jam server). */
function estimatePos(s: SyncPlaybackState): number {
  const dt = s.isPlaying ? Math.max(0, (serverNow() - s.updatedAt) / 1000) : 0;
  return s.position + dt;
}

/** State "playing" yang sudah lama dan penulisnya sudah offline = sesi lama: anggap pause di posisi terakhir. */
function normalizeSync(s: SyncPlaybackState): SyncPlaybackState {
  if (!s.isPlaying) return s;
  const age = (serverNow() - s.updatedAt) / 1000;
  const writerAlive = usePresence.getState().devices.some((d) => d.deviceId === s.deviceId);
  if (age > 25 && !writerAlive) return { ...s, isPlaying: false };
  return s;
}

function livePosition(get: () => PlayerState): number {
  const s = get();
  if (s.syncMode === 'remote' || !audioEl || !audioEl.src) return s.position;
  return audioEl.currentTime;
}

/** Tunggu lagu muncul di library (perangkat yang baru dibuka belum selesai memuat library). */
function whenTrackAvailable(id: string): Promise<Track | null> {
  const find = () => useLibrary.getState().tracks.find((t) => t.id === id) || null;
  const now = find();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { unsub(); resolve(null); }, 10000);
    const unsub = useLibrary.subscribe(() => {
      const t = find();
      if (t) { clearTimeout(timeout); unsub(); resolve(t); }
    });
  });
}

async function resolveTrackUrl(track: Track): Promise<string | null> {
  const local = await getTrackUrl(track.id, (id) => db.getAudioBlob(id));
  let url = local || track.audioUrl || null;
  if (url && url.includes('.r2.dev')) {
    url = `https://r2-proxy.awliarahman12-ca2.workers.dev${new URL(url).pathname}`;
  }
  return url;
}

/** Muat lagu berikutnya di belakang layar supaya pindah lagu langsung jalan tanpa buffering. */
async function preloadNext(get: () => PlayerState) {
  try {
    const s = get();
    if (s.syncMode === 'remote') return;
    const nav = navigator as any;
    if (nav.connection && nav.connection.saveData) return;
    const nextId = s.queue[0];
    if (!nextId || nextId === preloadedId) return;
    const t = useLibrary.getState().tracks.find((x) => x.id === nextId);
    if (!t) return;
    const url = await resolveTrackUrl(t);
    if (!url || url.startsWith('blob:')) return;
    preloadedId = nextId;
    if (!preloadEl) preloadEl = new Audio();
    preloadEl.preload = 'auto';
    preloadEl.src = url;
    preloadEl.load();
  } catch { /* abaikan */ }
}

/** Browser memblokir autoplay di tab yang belum pernah diklik. Kita tunggu sentuhan pertama lalu lanjutkan. */
function armGestureResume(get: () => PlayerState) {
  if (gestureArmed) return;
  gestureArmed = true;
  import('./notification').then((m) => m.useNotification.getState().show('Ketuk layar sekali untuk mulai memutar di perangkat ini', 'info'));
  const resume = () => {
    gestureArmed = false;
    document.removeEventListener('pointerdown', resume, true);
    document.removeEventListener('keydown', resume, true);
    const st = lastState;
    const mode = get().syncMode;
    if (st && st.isPlaying && audioEl && (mode === 'host' || mode === 'speaker')) {
      audioEl.currentTime = estimatePos(st);
      void audioEl.play().catch(() => {});
    }
  };
  document.addEventListener('pointerdown', resume, true);
  document.addEventListener('keydown', resume, true);
}

function startRemoteTicker(set: any, get: () => PlayerState) {
  if (remoteTicker) return;
  remoteTicker = setInterval(() => {
    const s = get();
    if (s.syncMode !== 'remote') {
      if (remoteTicker) { clearInterval(remoteTicker); remoteTicker = null; }
      return;
    }
    if (!lastState || !lastState.isPlaying) return;
    const dur = s.duration || s.currentTrack?.duration || 0;
    const pos = estimatePos(lastState);
    set({ position: dur ? Math.min(pos, dur) : pos });
  }, 250);
}

/** Remote: tampilan ikut state cloud, tanpa memuat/memutar audio. */
async function mirrorRemote(remote: SyncPlaybackState, set: any, get: () => PlayerState) {
  const token = ++followToken;
  if (audioEl && !audioEl.paused) audioEl.pause();

  if (remote.trackId && remote.trackId !== get().currentTrack?.id) {
    const track = await whenTrackAvailable(remote.trackId);
    if (token !== followToken || get().syncMode !== 'remote' || !track) return;
    set({ currentTrack: track, duration: track.duration || 0, error: null });
    void updateAmbient(track, set);
  } else if (!remote.trackId && get().currentTrack) {
    set({ currentTrack: null, duration: 0, ambientCover: null, ambientColor: null });
  }
  set({ position: estimatePos(remote), isPlaying: remote.isPlaying });
  startRemoteTicker(set, get);
}

/** Host / Speaker: ikuti state cloud (ganti lagu, play/pause, posisi) dengan gangguan sekecil mungkin. */
async function followRemote(remote: SyncPlaybackState, force: boolean, set: any, get: () => PlayerState) {
  const token = ++followToken;
  if (!audioEl) return;
  const cur = get().currentTrack;

  if (remote.trackId && remote.trackId !== cur?.id) {
    const track = await whenTrackAvailable(remote.trackId);
    if (token !== followToken || !track) return;
    // Pakai loadAndPlay supaya crossfade, background, dan pembatalan balapan tetap berlaku.
    await loadAndPlay(track, set, get, { startAt: () => estimatePos(remote), autoplay: remote.isPlaying, silent: true });
  } else if (!remote.trackId) {
    if (audioEl && !audioEl.paused) audioEl.pause();
  } else if (audioEl) {
    const want = estimatePos(remote);
    const drift = audioEl.currentTime - want;
    if (remote.isPlaying) {
      if (Math.abs(drift) > 0.6) audioEl.currentTime = want;
      if (audioEl.paused) {
        fadeMul = 1;
        applyVolume(get);
        await audioEl.play().catch((e) => { if (e && e.name === 'NotAllowedError') armGestureResume(get); });
      }
    } else {
      if (!audioEl.paused) audioEl.pause();
      if (Math.abs(drift) > 0.3) audioEl.currentTime = want;
    }
    set({ position: audioEl ? audioEl.currentTime : want });
  }

  if (token !== followToken) return;
  // Host baru (ambil alih): umumkan bahwa sekarang dialah host, dengan state yang sama persis
  if (force && get().syncMode === 'host') pushSyncState(get, true);
  void preloadNext(get);
}

interface LoadOpts {
  startAt?: () => number; // mulai dari posisi tertentu (dipakai saat mengikuti state sync)
  autoplay?: boolean; // false = muat saja, jangan putar
  silent?: boolean; // true = jangan tulis state ke cloud / catat putaran (perubahan datang dari device lain)
}

function applyVolume(get: () => PlayerState) {
  if (!audioEl) return;
  const s = get();
  audioEl.volume = s.syncMode === 'remote' ? 0 : Math.max(0, Math.min(1, s.volume * s.volumeBoost * fadeMul));
}

/** Naikkan/turunkan fadeMul dengan kurva equal-power. Berbasis waktu (bukan rAF) supaya tetap jalan di tab background. */
function rampFadeMul(to: number, ms: number, get: () => PlayerState): Promise<void> {
  const token = ++fadeToken;
  const from = fadeMul;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (token !== fadeToken) { clearInterval(timer); resolve(); return; }
      const p = Math.min(1, (performance.now() - t0) / ms);
      const curve = to > from ? Math.sin((p * Math.PI) / 2) : 1 - Math.sin((p * Math.PI) / 2);
      fadeMul = to > from ? from + (to - from) * curve : to + (from - to) * curve;
      applyVolume(get);
      if (p >= 1) { clearInterval(timer); resolve(); }
    }, 40);
  });
}

function killOutgoing() {
  if (!outgoing) return;
  const o = outgoing;
  outgoing = null;
  try { o.pause(); o.removeAttribute('src'); o.load(); } catch { /* abaikan */ }
}

/** Lagu lama diputar di elemen audio terpisah sambil di-fade out, jadi benar-benar overlap dengan lagu baru. */
function startOutgoing(ms: number) {
  if (!audioEl || !audioEl.src) return;
  killOutgoing();
  const o = new Audio();
  o.src = audioEl.currentSrc || audioEl.src;
  o.currentTime = audioEl.currentTime;
  const startVol = audioEl.volume;
  o.volume = startVol;
  outgoing = o;
  void o.play().catch(() => { if (outgoing === o) killOutgoing(); });
  const t0 = performance.now();
  const timer = setInterval(() => {
    if (outgoing !== o) { clearInterval(timer); return; }
    const p = Math.min(1, (performance.now() - t0) / ms);
    o.volume = Math.max(0, startVol * Math.cos((p * Math.PI) / 2));
    if (p >= 1) { clearInterval(timer); killOutgoing(); }
  }, 40);
}

async function loadAndPlay(track: Track, set: any, get: any, opts?: LoadOpts) {
  const myToken = ++playToken;
  const state = get();

  // Remote nggak bersuara: cukup umumkan lagu baru ke Host lewat state sync
  if (state.syncMode === 'remote') {
    set({ currentTrack: track, position: 0, duration: track.duration || 0, error: null, isPlaying: true });
    void updateAmbient(track, set);
    pushSyncState(get, true);
    return;
  }

  const wasPlaying = !!(audioEl && !audioEl.paused && !audioEl.ended && audioEl.src && state.currentTrack);
  const useFade = !!state.crossfadeEnabled && wasPlaying;
  const ms = Math.max(600, (state.crossfadeDuration || 3) * 1000);

  crossfadeTriggered = false;
  fadeToken++; // batalkan fade lama yang masih jalan

  if (useFade) startOutgoing(ms); // lagu lama lanjut main di elemen terpisah, volumenya turun pelan
  else killOutgoing();

  fadeMul = useFade ? 0 : 1; // lagu baru mulai dari senyap kalau crossfade
  applyVolume(get);

  // UI dan background langsung ganti ke lagu baru (nggak nunggu fade selesai)
  set({ currentTrack: track, position: 0, duration: track.duration || 0, error: null });
  void updateAmbient(track, set);
  if (!audioEl) return;

  try {
    const url = await resolveTrackUrl(track);
    if (myToken !== playToken) return; // sudah ada permintaan lagu yang lebih baru
    if (!url) {
      fadeMul = 1; applyVolume(get);
      set({ error: 'File tidak ditemukan' });
      setTimeout(() => void get().next(), 800);
      return;
    }

    audioEl.src = url;
    const startAt = opts?.startAt ? opts.startAt() : 0;
    audioEl.currentTime = startAt > 0.5 ? startAt : 0;
    if (startAt > 0.5 && opts?.startAt) {
      const el = audioEl;
      const getWant = opts.startAt;
      const fix = () => {
        el.removeEventListener('loadedmetadata', fix);
        const want = getWant();
        if (Math.abs(el.currentTime - want) > 1) el.currentTime = want;
      };
      el.addEventListener('loadedmetadata', fix);
    }
    set({ isBuffering: true });

    // Cuma muat (state sync bilang lagi pause)
    if (opts?.autoplay === false) {
      fadeMul = 1; applyVolume(get);
      audioEl.pause();
      set({ isBuffering: false, isPlaying: false, position: startAt });
      return;
    }

    let started = true;
    await audioEl.play().catch((e: any) => {
      started = false;
      if (e && e.name === 'NotAllowedError') armGestureResume(get);
    });
    if (myToken !== playToken) return;

    if (useFade && started) void rampFadeMul(1, ms, get);
    else { fadeMul = 1; applyVolume(get); }

    if (!opts?.silent) {
      void db.updateTrack(track.id, { lastPlayedAt: Date.now(), playCount: (track.playCount || 0) + 1 });
      useLibrary.setState((s) => ({
        tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, lastPlayedAt: Date.now() } : t)),
      }));
    }
    persist(get);
    if (!opts?.silent) pushSyncState(get);
    void preloadNext(get);
  } catch (e) {
    fadeMul = 1; applyVolume(get);
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
  const user = useAuth.getState().user;
  if (!user) return;
  // Debounce tulis ke Firestore biar nggak boros kuota (volume slider, seek, dll)
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = get();
    const settings: PlayerSettings = {
      volume: s.volume, shuffle: s.shuffle, repeat: s.repeat, currentTrackId: s.currentTrack?.id || null,
      position: audioEl?.currentTime || 0, queue: s.queue, sleepTimerEnd: s.sleepTimerEnd, crossfade: s.crossfade,
      playbackRate: s.playbackRate,
      volumeBoost: s.volumeBoost,
      crossfadeEnabled: s.crossfadeEnabled,
      crossfadeDuration: s.crossfadeDuration,
    };
    void fs.saveSettingsToCloud(user, settings);
  }, 1500);
}

function pushSyncStateSoon(get: () => PlayerState) {
  if (seekPushTimer) clearTimeout(seekPushTimer);
  seekPushTimer = setTimeout(() => { seekPushTimer = null; pushSyncState(get); }, 120);
}

/** Heartbeat host tiap beberapa detik: cuma posisi + waktu, supaya perintah dari remote yang sedang di jalan tidak tertimpa. */
function heartbeatSync(get: () => PlayerState) {
  const s = get();
  const user = useAuth.getState().user;
  if (!user || s.syncMode !== 'host' || !s.isPlaying || !audioEl) return;
  const now = serverNow();
  if (lastState) lastState = { ...lastState, position: audioEl.currentTime, updatedAt: now };
  void fs.heartbeatSyncPlayback(user, usePresence.getState().deviceId, audioEl.currentTime, now);
}

function pushSyncState(get: () => PlayerState, force = false) {
  const state = get();
  const user = useAuth.getState().user;
  if (!user || !state.syncMode) return;
  if (state.syncMode === 'speaker' && !force) return;

  const deviceId = usePresence.getState().deviceId;
  const payload: SyncPlaybackState = {
    deviceId,
    hostId: state.hostId || deviceId,
    trackId: state.currentTrack?.id || null,
    isPlaying: state.isPlaying,
    position: livePosition(get),
    updatedAt: serverNow(),
    originMode: state.syncMode,
    repeat: state.repeat,
    shuffle: state.shuffle,
    queue: state.queue,
  };
  lastState = payload;
  void fs.updateSyncPlayback(user, payload);
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
