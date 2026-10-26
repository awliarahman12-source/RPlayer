import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useParty } from '@/store/party';
import { Search, Plus, Users, Music, ThumbsUp, ThumbsDown } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Track } from '@/types';
import { Cover } from '@/components/Cover';

export function PartyGuestPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { room, joinParty, addTrackToQueue, loading } = useParty();
  const [guestName, setGuestName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [search, setSearch] = useState('');
  const [hostTracks, setHostTracks] = useState<Track[]>([]);
  const [fetchingTracks, setFetchingTracks] = useState(false);

  useEffect(() => {
    if (roomCode && !hasJoined) joinParty(roomCode).then((s) => { if (s) setHasJoined(true); });
  }, [roomCode, hasJoined, joinParty]);

  useEffect(() => {
    if (room) {
      setFetchingTracks(true);
      getDocs(collection(db, 'users', room.host, 'tracks'))
        .then((snap) => setHostTracks(snap.docs.map(d => d.data() as Track).sort((a, b) => b.addedAt - a.addedAt)))
        .finally(() => setFetchingTracks(false));
    }
  }, [room]);

  if (loading) return <div className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center">Memuat Room...</div>;
  if (!room || !hasJoined) return <div className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center">Room tidak ditemukan atau sudah berakhir.</div>;

  const filtered = hostTracks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white p-4 max-w-md mx-auto">
      <div className="text-center mb-6">
        <Users className="w-12 h-12 mx-auto text-accent mb-2" />
        <h1 className="text-2xl font-bold">Party Mode</h1>
        <p className="text-white/60 text-sm">Host: @{room.host}</p>
        <p className="text-accent font-mono text-lg mt-1">ROOM: {room.roomCode}</p>
      </div>

      {!guestName ? (
        <div className="glass-strong p-6 rounded-2xl">
          <label className="text-sm text-white/60 mb-2 block">Masukkan Nama Kamu</label>
          <input type="text" className="w-full bg-white/10 rounded-xl px-4 py-3 text-white outline-none mb-4" placeholder="Nama panggilan..." onKeyDown={(e) => { if (e.key === 'Enter') setGuestName(e.currentTarget.value); }} />
          <p className="text-xs text-white/40 text-center">Tekan Enter setelah selesai mengetik</p>
        </div>
      ) : (
        <>
          <div className="glass-pill flex items-center gap-2 px-4 py-3 mb-4">
            <Search className="w-5 h-5 text-white/50" />
            <input type="text" placeholder="Cari lagu dari Host..." className="bg-transparent outline-none flex-1 text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {fetchingTracks ? <div className="text-center text-white/50 py-10">Memuat lagu Host...</div> : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto scroll-hidden mb-4">
              {filtered.map(t => (
                <div key={t.id} className="glass rounded-xl p-2 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Cover src={t.coverDataUrl} alt={t.title} className="w-10 h-10 rounded-md shrink-0" rounded="md" />
                    <div className="min-w-0"><div className="text-sm font-medium truncate">{t.title}</div><div className="text-xs text-white/50 truncate">{t.artist}</div></div>
                  </div>
                  <button onClick={() => { if (!guestName.trim()) return alert('Isi nama dulu!'); addTrackToQueue(t, guestName); }} className="bg-white text-black p-2 rounded-full tap shrink-0"><Plus className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Music className="w-4 h-4" /> Antrian Request</h2>
        {room.queue.length === 0 ? <p className="text-xs text-white/40">Belum ada request lagu.</p> : (
          <ul className="space-y-2 max-h-48 overflow-y-auto scroll-hidden">
            {room.queue.map((q, i) => {
              const track = hostTracks.find(t => t.id === q.trackId);
              return (
                <li key={i} className="glass rounded-lg p-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{track ? track.title : 'Lagu tidak ditemukan'}</div>
                    <div className="text-[10px] text-white/50 truncate">Req: {q.requestedBy}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => voteTrack(q.trackId, 1)} className="p-1 text-green-400 hover:bg-white/10 rounded tap">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-white font-bold w-6 text-center">{q.votes || 0}</span>
                    <button onClick={() => voteTrack(q.trackId, -1)} className="p-1 text-red-400 hover:bg-white/10 rounded tap">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}