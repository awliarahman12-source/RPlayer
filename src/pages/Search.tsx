import { useMemo, useRef, useEffect, useState } from 'react';
import { Search as SearchIcon, X, History } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { TrackRow } from '@/components/TrackRow';
import { PlaylistCard } from '@/components/Cards';

export function SearchPage() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const [q, setQ] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('search-history') || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusHandler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', focusHandler);
    return () => window.removeEventListener('keydown', focusHandler);
  }, []);

  useEffect(() => {
    if (q.trim().length > 2) {
      const timer = setTimeout(() => {
        const newHistory = [q.trim(), ...history.filter(h => h !== q.trim())].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem('search-history', JSON.stringify(newHistory));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [q]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return { tracks: [], playlists: [] };
    // Fuzzy search: ngecek satu per satu kata
    const match = (s: string) => s.toLowerCase().includes(query) || query.split(' ').every(word => s.toLowerCase().includes(word));
    return {
      tracks: tracks.filter((t) => match(t.title) || match(t.artist) || match(t.album || '')),
      playlists: playlists.filter((p) => match(p.name)),
    };
  }, [q, tracks, playlists]);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1000px] mx-auto">
      <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass mb-6">Search</h1>

      <div className="glass-pill-strong flex items-center gap-2 px-4 py-3 mb-6 sticky top-2 z-10">
        <SearchIcon className="w-5 h-5 text-white/60 shrink-0" />
        <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari lagu, artis, album, atau playlist" className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-[15px]" />
        {q && <button className="tap p-1 text-white/60" onClick={() => setQ('')} aria-label="Clear"><X className="w-4 h-4" /></button>}
      </div>

      {!q.trim() && (
        <div>
          {history.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Pencarian Terakhir</h2>
              <div className="flex flex-wrap gap-2">
                {history.map(h => (
                  <button key={h} onClick={() => setQ(h)} className="glass-pill px-4 py-2 text-sm text-white/80 tap">{h}</button>
                ))}
              </div>
            </div>
          )}
          <div className="text-center text-white/40 py-12">
            <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Ketik untuk mencari di pustaka musikmu</p>
          </div>
        </div>
      )}

      {q.trim() && results.tracks.length === 0 && results.playlists.length === 0 && (
        <div className="text-center text-white/40 py-12"><p className="text-sm">Tidak ada hasil untuk "{q}"</p></div>
      )}

      {results.playlists.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3 text-shadow-glass">Playlist</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.playlists.map((p) => (
              <PlaylistCard key={p.id} to={`/playlist/${p.id}`} name={p.name} subtitle={`${p.trackIds.length} lagu`} cover={p.coverDataUrl} />
            ))}
          </div>
        </section>
      )}

      {results.tracks.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 text-shadow-glass">Lagu</h2>
          <div className="space-y-0.5">
            {results.tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} contextIds={results.tracks.map((x) => x.id)} showAlbum />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}