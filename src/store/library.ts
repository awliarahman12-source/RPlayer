import { create } from 'zustand';
import type { Track, Playlist } from '@/types';
import * as db from '@/lib/db';
import { usePlayer } from './player';

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
  updatePlaylistCover: (id: string, coverDataUrl: string) => Promise<void>;
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
    const [tracks, playlists] = await Promise.all([db.getAllTracks(), db.getAllPlaylists()]);
    tracks.sort((a, b) => b.addedAt - a.addedAt);
    playlists.sort((a, b) => a.createdAt - b.createdAt);
    set({ tracks, playlists, loading: false });
  },

  addFiles: async (files) => {
    const { fileToTrack, isSupportedAudio } = await import('@/lib/metadata');
    const valid = files.filter(isSupportedAudio);
    if (!valid.length) return;
    set({ importing: true });
    try {
      const newTracks: Track[] = [];
      for (const file of valid) {
        try {
          const track = await fileToTrack(file);
          await db.putTrack(track, file);
          newTracks.push(track);
        } catch (e) { console.warn('Failed to import', file.name, e); }
      }
      if (newTracks.length) {
        const all = [...newTracks, ...get().tracks].sort((a, b) => b.addedAt - a.addedAt);
        set({ tracks: all });
      }
    } finally { set({ importing: false }); }
  },

  removeTrack: async (id) => {
    await db.deleteTrack(id);
    const { revokeTrackUrl } = await import('@/lib/metadata');
    revokeTrackUrl(id);
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
    await db.updateTrack(id, patch);
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.setState((state) => ({ currentTrack: state.currentTrack ? { ...state.currentTrack, ...patch } : null }));
    }
  },

  toggleLike: async (id) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track) return;
    const liked = !track.liked;
    const likedAt = liked ? Date.now() : undefined;
    await db.updateTrack(id, { liked, likedAt });
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, liked, likedAt } : t)) }));
    if (usePlayer.getState().currentTrack?.id === id) {
      usePlayer.setState((state) => ({ currentTrack: state.currentTrack ? { ...state.currentTrack, liked, likedAt } : null }));
    }
  },

  createPlaylist: async (name) => {
    const playlist: Playlist = {
      id: `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'Playlist Baru',
      createdAt: Date.now(),
      trackIds: [],
      parentId: null,
    };
    await db.putPlaylist(playlist);
    set((s) => ({ playlists: [...s.playlists, playlist] }));
    return playlist;
  },

  renamePlaylist: async (id, name) => {
    const p = get().playlists.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, name: name.trim() || p.name };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  removePlaylist: async (id) => {
    await db.deletePlaylist(id);
    set((s) => ({ playlists: s.playlists.filter((x) => x.id !== id) }));
  },

  updatePlaylistCover: async (id, coverDataUrl) => {
    const p = get().playlists.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, coverDataUrl };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  movePlaylist: async (id, parentId) => {
    const p = get().playlists.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, parentId };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? updated : x)) }));
  },

  reorderPlaylistTracks: async (playlistId, newTrackIds) => {
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p) return;
    const updated = { ...p, trackIds: newTrackIds };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  addToPlaylist: async (playlistId, trackId) => {
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p || p.trackIds.includes(trackId)) return;
    const updated = { ...p, trackIds: [...p.trackIds, trackId] };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  removeFromPlaylist: async (playlistId, trackId) => {
    const p = get().playlists.find((x) => x.id === playlistId);
    if (!p) return;
    const updated = { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) };
    await db.putPlaylist(updated);
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === playlistId ? updated : x)) }));
  },

  likedTracks: () => get().tracks.filter((t) => t.liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0)),
  recentlyPlayed: () => get().tracks.filter((t) => t.lastPlayedAt).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)).slice(0, 10),
}));