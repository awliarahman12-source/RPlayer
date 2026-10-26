import { useEffect, useState } from 'react';
import { useJamendo } from '@/store/jamendo';
import { TrackRow } from '@/components/TrackRow';
import { Search as SearchIcon } from 'lucide-react';

export function ExplorePage() {
  const { tracks, loading, fetchTrending, search } = useJamendo();
  const [q, setQ] = useState('');

  useEffect(() => {
    void fetchTrending();
  }, []);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass">Explore</h1>
        <div className="text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-full border border-accent/20 font-medium">
          Powered by Jamendo
        </div>
      </div>

      <div className="glass-pill-strong flex items-center gap-2 px-4 py-3 mb-6">
        <SearchIcon className="w-5 h-5 text-white/60 shrink-0" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search(q)}
          placeholder="Cari lagu gratis dari Jamendo..."
          className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-[15px]"
        />
      </div>

      {loading ? (
        <div className="text-center text-white/50 py-10 flex flex-col items-center">
           <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3"></div>
           Memuat lagu...
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} contextIds={tracks.map(x => x.id)} showAlbum />
          ))}
        </div>
      )}
    </div>
  );
}