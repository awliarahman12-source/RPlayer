import { create } from 'zustand';
import type { Track, Playlist } from '@/types';
import { usePlayer } from './player';
import { useAuth } from './auth';
import * as fs from '@/lib/firestore'; // Firestore Helper
import * as db from '@/lib/db'; // Masih dipakai buat cache lokal

interface LibraryState {
  tracks: Track[];
  playlists: Playlist[];
  loading: boolean;
  importing: boolean;
  load: () => Promise<void>;
  addFiles: (files: File[]) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  editTrack: (id: string, patch: Partial<Track>) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>;
  movePlaylist: (id: string, parentId: string | null) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, newTrackIds: string[]) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  likedTracks: () => Track[];
  recentlyPlayed: () => Track[];
}

export const useLibrary = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: true,
  importing: false,

  load: async () => {
    const user = useAuth.getState().user;
    if (!user) return;
    
    // Ambil dari Firestore
    const [tracks, playlists] = await Promise.all([
      fs.getTracksFromCloud(user),
      fs.getPlaylistsFromCloud(user)
    ]);
    
    set({ tracks, playlists, loading: false });
  },

  addFiles: async (files) => {
    const user = useAuth.getState().user;
    if (!user) return;

    const { fileToTrack, isSupportedAudio } = await import('@/lib/metadata');
    const valid = files.filter(isSupportedAudio);
    if (!valid.length) return;
    
    set({ importing: true });
    try {
      const newTracks: Track[] = [];
      for (const file of valid) {
        try {
          const track = await fileToTrack(file);
          
          // 1. Minta Presigned URL ke Vercel API
          const res = await fetch('/api/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type })
          });
          const { uploadUrl, publicUrl } = await res.json();

          // 2. Upload MP3 langsung ke R2
          await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          });

          track.audioUrl = publicUrl; // Simpan URL R2
          
          // 3. Simpan ke Firestore
          await fs.saveTrackToCloud(user, track);
          newTracks.push(track);
          
        } catch (e) {
          console.warn('Failed to import', file.name, e);
        }
      }
      if (newTracks.length) {
        const all = [...newTracks, ...get().tracks].sort((a, b) => b.addedAt - a.addedAt);
        set({ tracks: all });
      }
    } finally {
      set({ importing: false });
    }
  },

  removeTrack: async (id) => {
    const user = useAuth.getState().user;
    if (user) await fs.deleteTrackFromCloud(user, id);
    
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== id) })),
    }));

    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.getState().togglePlay();
      usePlayer.setState({ currentTrack: null, isPlaying: false, position: 0 });
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
    if (user) await fs.deleteDoc(doc(db, 'users', user, 'playlists', id)); // Perlu import doc & db
    set((s) => ({ playlists: s.playlists.filter((x) => x.id !== id) }));
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