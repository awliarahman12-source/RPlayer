import { create } from 'zustand';
import type { Track } from '@/types';

interface JamendoState {
  tracks: Track[];
  loading: boolean;
  search: (query: string) => Promise<void>;
  fetchTrending: () => Promise<void>;
}

export const useJamendo = create<JamendoState>((set) => ({
  tracks: [],
  loading: false,

  search: async (query) => {
    set({ loading: true });
    try {
      const clientId = import.meta.env.VITE_JAMENDO_CLIENT_ID;
      const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=20&search=${query}`);
      const data = await res.json();
      
      const formattedTracks: Track[] = data.results.map((t: any) => ({
        id: `jam-${t.id}`,
        title: t.name,
        artist: t.artist_name,
        album: t.album_name,
        duration: t.duration,
        coverDataUrl: t.image,
        audioUrl: t.audio,
        fileName: `${t.name}.mp3`,
        mimeType: 'audio/mpeg',
        size: 0,
        addedAt: Date.now(),
        liked: false,
        isExternal: true,
      }));

      set({ tracks: formattedTracks, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },

  fetchTrending: async () => {
    set({ loading: true });
    try {
      const clientId = import.meta.env.VITE_JAMENDO_CLIENT_ID;
      const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=20&featured=1`);
      const data = await res.json();
      
      const formattedTracks: Track[] = data.results.map((t: any) => ({
        id: `jam-${t.id}`,
        title: t.name,
        artist: t.artist_name,
        album: t.album_name,
        duration: t.duration,
        coverDataUrl: t.image,
        audioUrl: t.audio,
        fileName: `${t.name}.mp3`,
        mimeType: 'audio/mpeg',
        size: 0,
        addedAt: Date.now(),
        liked: false,
        isExternal: true,
      }));

      set({ tracks: formattedTracks, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
}));