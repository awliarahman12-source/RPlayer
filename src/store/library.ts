import { create } from 'zustand';
import type { Track, Playlist } from '@/types';
import { usePlayer } from './player';
import { useAuth } from './auth';
import * as fs from '@/lib/firestore';
import * as db from '@/lib/db';
import { useNotification } from './notification';

interface LibraryState {
  tracks: Track[];
  playlists: Playlist[];
  loading: boolean;
  importing: boolean;
  load: () => Promise<void>;
  addFiles: (files: File[], options?: { playlistId?: string }) => Promise<Track[]>;
  removeTrack: (id: string) => Promise<void>;
  editTrack: (id: string, patch: Partial<Track>) => Promise<void>;
  updateLyrics: (id: string, lyrics: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>;
  updatePlaylistCover: (id: string, coverDataUrl: string) => Promise<void>;
  updatePlaylistNotes: (id: string, notes: string) => Promise<void>;
  movePlaylist: (id: string, parentId: string | null) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, newTrackIds: string[]) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  likedTracks: () => Track[];
  recentlyPlayed: () => Track[];
  importExternalTrack: (track: Track) => Promise<void>;
  downloadTrack: (id: string) => Promise<void>;
}

async function deleteRemoteFile(audioUrl: string) {
  try {
    await fetch('/api/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl }),
    });
  } catch (e) {
    console.warn('Gagal hapus file di R2 (diabaikan):', e);
  }
}

async function shrinkDataUrl(dataUrl: string, maxSize = 512, maxChars = 400_000): Promise<string> {
  if (dataUrl.length <= maxChars) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const useLibrary = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: true,
  importing: false,

  load: async () => {
    const user = useAuth.getState().user;
    if (!user) {
      set({ loading: false });
      return;
    }
    
    try {
      const [tracks, playlists] = await Promise.all([
        fs.getTracksFromCloud(user),
        fs.getPlaylistsFromCloud(user)
      ]);
      // isDownloaded dihitung dari IndexedDB perangkat ini, bukan dari cloud
      const withLocal = await Promise.all(
        tracks.map(async (t) => ({ ...t, isDownloaded: await db.hasAudioBlob(t.id) }))
      );
      set({ tracks: withLocal, playlists, loading: false });
    } catch (error: any) {
      console.error("Gagal narik data:", error);
      // MUNCULIN NOTIFIKASI MERAH DI LAYAR
      import('./notification').then((mod) => {
        mod.useNotification.getState().show(`Gagal load: ${error.message || 'Koneksi diblokir'}`, 'error');
      });
      set({ loading: false });
    }
  },

  addFiles: async (files, options) => {
    const user = useAuth.getState().user;
    if (!user) return [];

    const { fileToTrack, isSupportedAudio } = await import('@/lib/metadata');
    const valid = files.filter(isSupportedAudio);
    if (!valid.length) return [];
    
    set({ importing: true });
    const notify = useNotification.getState();

    const newTracks: Track[] = [];
    try {
      for (const file of valid) {
        let uploadedUrl: string | null = null;
        try {
          notify.startUpload(file.name);
          
          const track = await fileToTrack(file);
          
          const res = await fetch('/api/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type || 'audio/mpeg' })
          });
          
          if (!res.ok) throw new Error('Gagal konek ke API Vercel');
          const { uploadUrl, publicUrl } = await res.json();

          // Fungsi upload dengan fitur Retry (Coba ulang) otomatis
          const uploadWithRetry = (url: string, fileToUpload: File, mimeType: string, retries = 3): Promise<void> => {
            return new Promise((resolve, reject) => {
              const attempt = (attemptsLeft: number) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', url, true);
                xhr.setRequestHeader('Content-Type', mimeType);
                
                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    notify.updateProgress((event.loaded / event.total) * 100);
                  }
                };
                
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else if (attemptsLeft > 0) attempt(attemptsLeft - 1);
                  else reject(new Error('Upload ke R2 gagal'));
                };
                xhr.onerror = () => {
                  if (attemptsLeft > 0) attempt(attemptsLeft - 1);
                  else reject(new Error('Network error saat upload'));
                };
                xhr.send(fileToUpload);
              };
              attempt(retries);
            });
          };

          await uploadWithRetry(uploadUrl, file, file.type || 'audio/mpeg');

          uploadedUrl = publicUrl;
          track.audioUrl = publicUrl;

          // === TASK 3.2: Upload cover Base64 ke R2 ===
          if (track.coverDataUrl && track.coverDataUrl.startsWith('data:image')) {
            try {
              const coverBlob = await (await fetch(track.coverDataUrl)).blob();
              const coverRes = await fetch('/api/generate-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: `${track.id}-cover.jpg`, contentType: 'image/jpeg' })
              });
              if (coverRes.ok) {
                const { uploadUrl: coverUploadUrl, publicUrl: coverPublicUrl } = await coverRes.json();
                // Upload file gambar
                await fetch(coverUploadUrl, {
                  method: 'PUT',
                  body: coverBlob,
                  headers: { 'Content-Type': 'image/jpeg' }
                });
                // Ganti string Base64 panjang dengan URL R2 yang ringan
                track.coverDataUrl = coverPublicUrl; 
              }
            } catch (coverErr) {
              console.warn("Gagal upload cover ke R2, cover tetap pakai Base64:", coverErr);
            }
          }
          // ==========================================

          await fs.saveTrackToCloud(user, track);
          newTracks.push(track);
          
          notify.endUpload(true);
          
        } catch (e) {
          console.error('Failed to import', file.name, e);
          // Kalau file sudah ke-upload tapi simpan metadata gagal, bersihin file yatim di R2
          if (uploadedUrl) void deleteRemoteFile(uploadedUrl);
          notify.endUpload(false);
        }
      }
      
      if (newTracks.length) {
        const all = [...newTracks, ...get().tracks].sort((a, b) => b.addedAt - a.addedAt);
        set({ tracks: all });
        // Kalau upload dari halaman playlist, langsung masukkan ke playlist itu
        if (options?.playlistId) {
          for (const nt of newTracks) {
            await get().addToPlaylist(options.playlistId, nt.id);
          }
        }
      }
    } finally {
      set({ importing: false });
    }
    return newTracks;
  },

  removeTrack: async (id) => {
    const user = useAuth.getState().user;
    const track = get().tracks.find((t) => t.id === id);

    // 1. Stop player kalau lagu ini lagi aktif, dan bersihin dari antrian/riwayat
    const player = usePlayer.getState();
    if (player.currentTrack?.id === id) player.clearCurrent();
    usePlayer.setState((s) => ({
      queue: s.queue.filter((q) => q !== id),
      history: s.history.filter((h) => h !== id),
    }));

    // 2. Hapus dokumen lagu + simpan ulang playlist yang terdampak ke Firestore
    const cleanedPlaylists = get()
      .playlists.filter((p) => p.trackIds.includes(id))
      .map((p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== id) }));
    if (user) {
      await fs.deleteTrackFromCloud(user, id);
      await Promise.all(cleanedPlaylists.map((p) => fs.savePlaylistToCloud(user, p)));
    }

    // 3. Update state lokal
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      playlists: s.playlists.map((p) => cleanedPlaylists.find((c) => c.id === p.id) ?? p),
    }));

    // 4. Bersihin file offline + file di R2 (best effort)
    try { await db.deleteAudioBlob(id); } catch { /* abaikan */ }
    if (track?.audioUrl && !track.isExternal) void deleteRemoteFile(track.audioUrl);
  },
  
  updateLyrics: async (id, lyrics) => {
    const user = useAuth.getState().user;
    const track = get().tracks.find(t => t.id === id);
    if (!track || !user) return;
    const updated = { ...track, lyrics };
    await fs.saveTrackToCloud(user, updated);
    set(s => ({ tracks: s.tracks.map(t => t.id === id ? updated : t) }));
    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.setState({ currentTrack: updated });
    }
  },

  editTrack: async (id, patch) => {
    const user = useAuth.getState().user;
    const track = get().tracks.find(t => t.id === id);
    if (!track || !user) return;
    
    const updatedTrack = { ...track, ...patch };
    await fs.saveTrackToCloud(user, updatedTrack);
    
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? updatedTrack : t)) }));
    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.setState((state) => ({ currentTrack: updatedTrack }));
    }
  },

  toggleLike: async (id) => {
    const user = useAuth.getState().user;
    const track = get().tracks.find((t) => t.id === id);
    if (!track || !user) return;
    
    const liked = !track.liked;
    const likedAt = liked ? Date.now() : undefined;
    const updated = { ...track, liked, likedAt };
    
    await fs.saveTrackToCloud(user, updated);
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? updated : t)) }));
    
    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.setState({ currentTrack: updated });
    }
  },

  importExternalTrack: async (track) => {
    const user = useAuth.getState().user;
    if (!user) return;
    
    const localTrack = { ...track, isExternal: false };
    await fs.saveTrackToCloud(user, localTrack);
    set((s) => ({ tracks: [localTrack, ...s.tracks] }));
  },

  downloadTrack: async (id) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track || !track.audioUrl) return;
    const user = useAuth.getState().user;
    if (!user) return;
    
    try {
      const res = await fetch(track.audioUrl);
      const blob = await res.blob();
      await db.saveAudioBlob(track.id, blob);
      
      const updated = { ...track, isDownloaded: true };
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? updated : t)) }));
      
      useNotification.getState().show('Lagu berhasil di-download', 'success');
    } catch (e) {
      console.error(e);
      useNotification.getState().show('Gagal download lagu', 'error');
    }
  },

  createPlaylist: async (name) => {
    const user = useAuth.getState().user;
    const playlist: Playlist = {
      id: `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'Playlist Baru',
      createdAt: Date.now(),
      trackIds: [],
      parentId: null,
    };
    if (user) await fs.savePlaylistToCloud(user, playlist);
    set((s) => ({ playlists: [...s.playlists, playlist] }));
    return playlist;
  },

  renamePlaylist: async (id, name) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === id);
    if (!p || !user) return;
    
    const updated = { ...p, name: name.trim() || p.name };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  removePlaylist: async (id) => {
    const user = useAuth.getState().user;
    if (user) await fs.deletePlaylistFromCloud(user, id);
    set((s) => ({ playlists: s.playlists.filter((x) => x.id !== id) }));
  },

  updatePlaylistCover: async (id, coverDataUrl) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === id);
    if (!p || !user) return;
    const safeCover = await shrinkDataUrl(coverDataUrl);
    const updated = { ...p, coverDataUrl: safeCover };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  updatePlaylistNotes: async (id, description) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === id);
    if (!p || !user) return;
    const updated = { ...p, description };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  movePlaylist: async (id, parentId) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === id);
    if (!p || !user) return;
    
    const updated = { ...p, parentId };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  reorderPlaylistTracks: async (playlistId, newTrackIds) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p || !user) return;
    
    const updated = { ...p, trackIds: newTrackIds };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  addToPlaylist: async (playlistId, trackId) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p || p.trackIds.includes(trackId) || !user) return;
    
    const updated = { ...p, trackIds: [...p.trackIds, trackId] };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  removeFromPlaylist: async (playlistId, trackId) => {
    const user = useAuth.getState().user;
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p || !user) return;
    
    const updated = { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) };
    await fs.savePlaylistToCloud(user, updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  likedTracks: () => get().tracks.filter((t) => t.liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0)),
  recentlyPlayed: () => get().tracks.filter((t) => t.lastPlayedAt).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)).slice(0, 10),
}));