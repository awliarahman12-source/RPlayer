import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Play, Settings, Users } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { greeting } from '@/lib/format';
import { TrackCard, PlaylistCard } from '@/components/Cards';
import { Dropzone } from '@/components/Upload';
import { Cover } from '@/components/Cover';
import { useParty } from '@/store/party';
import { PartyHostPanel } from '@/components/PartyHostPanel';

export function HomePage() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const likedTracks = useLibrary((s) => s.likedTracks)();
  const recentlyPlayed = useLibrary((s) => s.recentlyPlayed)();
  const playTracks = usePlayer((s) => s.playTracks);
  
  const { room, startParty } = useParty();
  const [showPartyPanel, setShowPartyPanel] = useState(false);

  const recent = useMemo(() => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12), [tracks]);

  if (tracks.length === 0) {
    return (
      <div className="px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-shadow-glass">{greeting()}</h1>
          <div className="flex gap-2">
            {room ? (
              <button className="tap glass-pill px-3 h-10 flex items-center justify-center text-accent text-xs font-medium gap-2 bg-accent/10 border-accent/30" onClick={() => setShowPartyPanel(true)}>
                <Users className="w-4 h-4" /> Kelola Party
              </button>
            ) : (
              <button className="tap glass-pill px-3 h-10 flex items-center justify-center text-white text-xs font-medium gap-2" onClick={async () => {
                const code = await startParty();
                if (code) setShowPartyPanel(true);
              }}>
                <Users className="w-4 h-4" /> Start Party
              </button>
            )}
            <Link to="/settings" className="tap glass-pill w-10 h-10 flex items-center justify-center text-white">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
        <Dropzone />
        {showPartyPanel && <PartyHostPanel onClose={() => setShowPartyPanel(false)} />}
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass">{greeting()}</h1>
        <div className="flex gap-2">
          {room ? (
            <button className="tap glass-pill px-3 h-10 flex items-center justify-center text-accent text-xs font-medium gap-2 bg-accent/10 border-accent/30" onClick={() => setShowPartyPanel(true)}>
              <Users className="w-4 h-4" /> Kelola Party
            </button>
          ) : (
            <button className="tap glass-pill px-3 h-10 flex items-center justify-center text-white text-xs font-medium gap-2" onClick={async () => {
              const code = await startParty();
              if (code) setShowPartyPanel(true);
            }}>
              <Users className="w-4 h-4" /> Start Party
            </button>
          )}
          <Link to="/settings" className="tap glass-pill w-10 h-10 flex items-center justify-center text-white">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <section className="mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl">
          <Link
            to="/playlist/liked"
            className="glass rounded-2xl p-3 flex items-center gap-3 tap specular overflow-hidden transition-transform hover:scale-[1.02]"
          >
            <div className="w-12 h-12 shrink-0 rounded-md bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center text-white">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Liked Songs</div>
              <div className="truncate text-xs text-white/50">{likedTracks.length} lagu</div>
            </div>
          </Link>
          {playlists.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              to={`/playlist/${p.id}`}
              className="glass rounded-2xl p-3 flex items-center gap-3 tap specular overflow-hidden transition-transform hover:scale-[1.02]"
            >
              <Cover src={p.coverDataUrl} alt={p.name} className="w-12 h-12 shrink-0" rounded="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="truncate text-xs text-white/50">{p.trackIds.length} lagu</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <Section title="Recently added" onPlayAll={() => void playTracks(recent.map((t) => t.id))}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {recent.map((t) => (
              <TrackCard key={t.id} track={t} contextIds={recent.map((x) => x.id)} />
            ))}
          </div>
        </Section>
      )}

      {recentlyPlayed.length > 0 && (
        <Section title="Recently played" onPlayAll={() => void playTracks(recentlyPlayed.map((t) => t.id))}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {recentlyPlayed.map((t) => (
              <TrackCard key={t.id} track={t} contextIds={recentlyPlayed.map((x) => x.id)} />
            ))}
          </div>
        </Section>
      )}

      {playlists.length > 0 && (
        <Section title="Playlist kamu">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {playlists.map((p) => (
              <PlaylistCard
                key={p.id}
                to={`/playlist/${p.id}`}
                cover={p.coverDataUrl}
                name={p.name}
                subtitle={`${p.trackIds.length} lagu`}
              />
            ))}
          </div>
        </Section>
      )}

      {showPartyPanel && <PartyHostPanel onClose={() => setShowPartyPanel(false)} />}
    </div>
  );
}

function Section({ title, onPlayAll, children }: { title: string; onPlayAll?: () => void; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-shadow-glass">{title}</h2>
        {onPlayAll && (
          <button
            className="tap glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
            onClick={onPlayAll}
          >
            <Play className="w-3.5 h-3.5 fill-white" /> Putar semua
          </button>
        )}
      </div>
      {children}
    </section>
  );
}