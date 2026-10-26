import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Heart, Music } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Track, Playlist } from '@/types';
import { Cover } from '@/components/Cover';
import { TrackRow } from '@/components/TrackRow';
import { usePlayer } from '@/store/player';
import { formatDuration } from '@/lib/format';

export function SharedPlaylistPage() {
  const { username, playlistId } = useParams<{ username: string; playlistId: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const playTracks = usePlayer((s) => s.playTracks);

  useEffect(() => {
    if (!username || !playlistId) return;

    const fetchData = async () => {
      try {
        // Tarik data Playlist
        const plDoc = await getDoc(doc(db, 'users', username, 'playlists', playlistId));
        if (!plDoc.exists()) {
          setLoading(false);
          return;
        }
        const plData = plDoc.data() as Playlist;
        setPlaylist(plData);

        // Tarik data semua lagu (buat nyocokin ID)
        const trSnap = await getDocs(collection(db, 'users', username, 'tracks'));
        const allTracks = trSnap.docs.map((d) => d.data() as Track);
        
        // Filter lagu sesuai urutan di playlist
        const playlistTracks = plData.trackIds
          .map((id) => allTracks.find((t) => t.id === id))
          .filter((t): t is Track => Boolean(t));
        
        setTracks(playlistTracks);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [username, playlistId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0f] text-white">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0b0f] text-white/50">
        <Music className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-semibold">Playlist tidak ditemukan</p>
        <Link to="/" className="mt-4 text-accent tap">Kembali ke Home</Link>
      </div>
    );
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white px-4 py-8 max-w-[1000px] mx-auto">
      <div className="flex flex-col items-center text-center mb-8">
        <Cover src={playlist.coverDataUrl} alt={playlist.name} className="w-48 h-48 rounded-2xl shadow-2xl mb-4" rounded="xl" />
        <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Playlist Publik</div>
        <h1 className="text-3xl font-bold text-shadow-glass">{playlist.name}</h1>
        <p className="text-sm text-white/50 mt-2">
          Dibuat oleh <span className="text-white font-medium">@{username}</span>
        </p>
        <div className="text-sm text-white/50 mt-1">
          {tracks.length} lagu · {formatDuration(totalDuration)}
        </div>
        {playlist.description && (
          <p className="text-sm text-white/40 italic mt-3 max-w-md">"{playlist.description}"</p>
        )}
      </div>

      <div className="flex justify-center mb-8">
        <button 
          className="tap bg-white text-black font-bold rounded-full px-8 py-3 flex items-center gap-2"
          onClick={() => { if (tracks.length) void playTracks(tracks.map(t => t.id)); }}
          disabled={tracks.length === 0}
        >
          <Play className="w-5 h-5 fill-black" /> Putar Semua
        </button>
      </div>

      <div className="space-y-0.5 max-w-[800px] mx-auto">
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} contextIds={tracks.map(x => x.id)} showAlbum />
        ))}
      </div>
      
      <div className="text-center mt-12 pb-8">
        <p className="text-sm text-white/40">Mau dengerin musik kamu sendiri?</p>
        <Link to="/" className="text-accent text-sm font-semibold tap mt-2 inline-block">Buka Liquid Music</Link>
      </div>
    </div>
  );
}