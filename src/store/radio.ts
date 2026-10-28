import { create } from 'zustand';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  tags: string;
  country: string;
}

interface RadioState {
  stations: RadioStation[];
  loading: boolean;
  search: (query: string) => Promise<void>;
  fetchTrending: () => Promise<void>;
}

export const useRadio = create<RadioState>((set) => ({
  stations: [],
  loading: false,

  fetchTrending: async () => {
    set({ loading: true });
    try {
      const res = await fetch('https://de1.api.radio-browser.info/json/stations/search?limit=30&hidebroken=true&order=clickcount&reverse=true');
      const data = await res.json();
      set({
        stations: data.map((s: any) => ({
          id: s.stationuuid,
          name: s.name,
          url: s.url_resolved,
          favicon: s.favicon,
          tags: s.tags,
          country: s.country,
        })),
        loading: false
      });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },

  search: async (query) => {
    if (!query.trim()) return;
    set({ loading: true });
    try {
      const res = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=30&hidebroken=true&order=clickcount&reverse=true`);
      const data = await res.json();
      set({
        stations: data.map((s: any) => ({
          id: s.stationuuid,
          name: s.name,
          url: s.url_resolved,
          favicon: s.favicon,
          tags: s.tags,
          country: s.country,
        })),
        loading: false
      });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
}));