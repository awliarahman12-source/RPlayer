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
  addFiles: (files: File[]) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  editTrack: (id: string, patch: Partial<Track>) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  importExternalTrack: (track: Track) => Promise<void>;
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
}

export const useLibrary = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: true,
  importing: false,

  load: async () => {
    const user = useAuth.getState().user;
    if (!user) return;
    
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
    const notify = useNotification.getState();

    try {
      const newTracks: Track[] = [];
      for (const file of valid) {
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

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl, true);
            xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');
            
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                notify.updateProgress((event.loaded / event.total) * 100);
              }
            };
            
            xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('Upload gagal')); };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(file);
          });

          track.audioUrl = publicUrl;
          await fs.saveTrackToCloud(user, track);
          newTracks.push(track);
          notify.endUpload(true);
        } catch (e) {
          console.error('Failed to import', file.name, e);
          notify.endUpload(false);
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

  importExternalTrack: async (track) => {
    const user = useAuth.getState().user;
    if (!user) return;
    
    // Ubah statusnya jadi lagu lokal
    const localTrack = { ...track, isExternal: false };
    
    await fs.saveTrackToCloud(user, localTrack);
    set((s) => ({ tracks: [localTrack, ...s.tracks] }));
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
    const updated = { ...p, coverDataUrl };
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