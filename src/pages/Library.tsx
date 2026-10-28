import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, ArrowUpDown, Library as LibraryIcon, Music } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { TrackRow } from '@/components/TrackRow';
import { UploadButton } from '@/components/Upload';
import { useToast } from '@/store/toast';
import { Cover } from '@/components/Cover';
import { SkeletonRow } from '@/components/Skeleton';

type SortMode = 'recent' | 'title' | 'artist' | 'duration';

export function LibraryPage() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const loading = useLibrary((s) => s.loading);
  const pushToast = useToast((s) => s.push);
  const [sort, setSort] = useState<SortMode>('recent');
  const [tab, setTab] = useState<'tracks' | 'playlists'>('tracks');

  const sortedTracks = useMemo(() => {
    const arr = [...tracks];
    if (sort === 'recent') arr.sort((a, b) => b.addedAt - a.addedAt);
    else if (sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'artist') arr.sort((a, b) => a.artist.localeCompare(b.artist));
    else if (sort === 'duration') arr.sort((a, b) => b.duration - a.duration);
    return arr;
  }, [tracks, sort]);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass">Library</h1>
        <UploadButton className="lg:hidden" />
      </div>

      {/* Floating Sticky Header */}
      <div className="sticky top-2 z-20 flex justify-between items-center mb-4 pointer-events-none">
        <div className="glass-pill p-1 inline-flex text-sm pointer-events-auto">
          <button className={`px-4 py-1.5 rounded-full tap ${tab === 'tracks' ? 'glass-strong' : 'text-white/60'}`} onClick={() => setTab('tracks')}>Lagu</button>
          <button className={`px-4 py-1.5 rounded-full tap ${tab === 'playlists' ? 'glass-strong' : 'text-white/60'}`} onClick={() => setTab('playlists')}>Playlist</button>
        </div>
      </div>

      {tab === 'tracks' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/50">{tracks.length} lagu</div>
            <SortMenu sort={sort} onChange={setSort} />
          </div>

          {loading ? (
             <div className="space-y-1">
               <SkeletonRow /><SkeletonRow /><SkeletonRow />
             </div>
          ) : tracks.length === 0 ? (
            <div className="text-center text-white/40 py-16 flex flex-col items-center">
              <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">Pustaka Kosong</p>
              <p className="text-sm mb-6">Upload lagu pertamamu buat mulai dengerin musik.</p>
              <UploadButton />
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedTracks.map((t, i) => (
                <div key={t.id} className="cv-auto">
                  <TrackRow track={t} index={i} contextIds={sortedTracks.map((x) => x.id)} showAlbum />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/50">{playlists.length + 1} playlist</div>
            <button className="tap glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5" onClick={async () => { await createPlaylist('Playlist Baru'); pushToast('Playlist dibuat'); }}>
              <Plus className="w-3.5 h-3.5" /> Playlist baru
            </button>
          </div>

          <div className="space-y-2">
            <Link to="/playlist/liked" className="glass rounded-2xl p-3 flex items-center gap-3 tap specular">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center">
                <Heart className="w-6 h-6 fill-white text-white" />
              </div>
              <div><div className="font-semibold">Liked Songs</div><div className="text-xs text-white/50">Lagu yang kamu sukai</div></div>
            </Link>
            {playlists.map((p) => (
              <Link key={p.id} to={`/playlist/${p.id}`} className="glass rounded-2xl p-3 flex items-center gap-3 tap specular">
                <Cover src={p.coverDataUrl} alt={p.name} className="w-14 h-14 shrink-0" rounded="md" />
                <div className="min-w-0"><div className="font-semibold truncate">{p.name}</div><div className="text-xs text-white/50">{p.trackIds.length} lagu</div></div>
              </Link>
            ))}
            {playlists.length === 0 && <div className="text-center text-white/40 py-10 text-sm">Belum ada playlist. Buat dengan tombol di atas.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function SortMenu({ sort, onChange }: { sort: SortMode; onChange: (m: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const labels: Record<SortMode, string> = { recent: 'Recently added', title: 'Title', artist: 'Artist', duration: 'Duration' };
  return (
    <div className="relative">
      <button className="tap glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5" onClick={() => setOpen((o) => !o)}>
        <ArrowUpDown className="w-3.5 h-3.5" /> {labels[sort]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 glass-strong rounded-2xl py-1 min-w-[180px] animate-spring-up">
          {(Object.keys(labels) as SortMode[]).map((m) => (
            <button key={m} className={`w-full text-left px-4 py-2 text-sm tap ${sort === m ? 'text-accent' : 'text-white/80'}`} onClick={() => { onChange(m); setOpen(false); }}>
              {labels[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
