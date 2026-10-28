import { useEffect, useState } from 'react';
import { useRadio } from '@/store/radio';
import { usePlayer } from '@/store/player';
import { Search, Radio as RadioIcon, Play } from 'lucide-react';
import { Cover } from '@/components/Cover';

export function RadioPage() {
  const { stations, loading, fetchTrending, search } = useRadio();
  const [q, setQ] = useState('');
  const playRadio = usePlayer((s) => s.playRadio);
  const currentId = usePlayer((s) => s.currentTrack?.id);

  useEffect(() => {
    void fetchTrending();
  }, []);

  const handlePlay = (station: any) => {
    // Buat object Track palsu agar bisa diputar oleh player utama
    playRadio({
      id: `radio-${station.id}`,
      title: station.name,
      artist: station.country || 'Internet Radio',
      coverDataUrl: station.favicon,
      audioUrl: station.url,
      duration: 0, // Stream tidak punya durasi
      fileName: 'radio-stream',
      mimeType: 'audio/mpeg',
      size: 0,
      addedAt: Date.now(),
      liked: false,
      isExternal: true
    });
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass flex items-center gap-3">
          <RadioIcon className="w-8 h-8 text-accent" /> Radio
        </h1>
      </div>

      <div className="glass-pill-strong flex items-center gap-2 px-4 py-3 mb-6">
        <Search className="w-5 h-5 text-white/60 shrink-0" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search(q)}
          placeholder="Cari stasiun radio (misal: Jazz, Jakarta, Rock)..."
          className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-[15px]"
        />
      </div>

      {loading ? (
        <div className="text-center text-white/50 py-10 flex flex-col items-center">
           <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3"></div>
           Mencari stasiun...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stations.map((s) => {
            const isCurrent = currentId === `radio-${s.id}`;
            return (
              <div key={s.id} className={`glass rounded-2xl p-3 flex flex-col gap-2 tap group relative cursor-pointer hover:bg-white/10 transition-colors ${isCurrent ? 'ring-2 ring-accent' : ''}`} onClick={() => handlePlay(s)}>
                <div className="relative">
                  <Cover src={s.favicon} alt={s.name} className="w-full aspect-square rounded-xl" rounded="lg" />
                  <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full glass-strong flex items-center justify-center transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-sm font-semibold ${isCurrent ? 'text-accent' : ''}`}>{s.name}</div>
                  <div className="truncate text-xs text-white/50">{s.country || s.tags}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}