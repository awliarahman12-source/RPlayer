import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Shuffle, Heart, MoreHorizontal, Pencil, Trash2, Plus, Clock, Search, X, Image } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { TrackRow } from '@/components/TrackRow';
import { Cover } from '@/components/Cover';
import { formatDuration } from '@/lib/format';
import { BottomSheet } from '@/components/BottomSheet';
import { UploadButton } from '@/components/Upload';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableTrackRow } from '@/components/SortableTrackRow';

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const renamePlaylist = useLibrary((s) => s.renamePlaylist);
  const removePlaylist = useLibrary((s) => s.removePlaylist);
  const reorderPlaylistTracks = useLibrary((s) => s.reorderPlaylistTracks);
  const updatePlaylistCover = useLibrary((s) => s.updatePlaylistCover);
  const playTracks = usePlayer((s) => s.playTracks);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);
  const pushToast = useToast((s) => s.push);

  const [menuOpen, setMenuOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const isLiked = id === 'liked';
  const playlist = isLiked ? null : playlists.find((p) => p.id === id);

  const playlistTracks = useMemo(() => {
    if (isLiked) return useLibrary.getState().likedTracks();
    if (!playlist) return [];
    return playlist.trackIds.map((tid) => tracks.find((t) => t.id === tid)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [isLiked, playlist, tracks, playlists]);

  const filteredTracks = playlistTracks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalDuration = playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const cover = isLiked ? undefined : playlist?.coverDataUrl;
  const name = isLiked ? 'Liked Songs' : playlist?.name || 'Playlist';

  const handlePlay = () => { if (playlistTracks.length) void playTracks(playlistTracks.map((t) => t.id)); };
  const handleShuffle = () => { if (!shuffle) toggleShuffle(); if (playlistTracks.length) void playTracks(playlistTracks.map((t) => t.id)); };

  if (!isLiked && !playlist) return <div className="px-4 py-12 text-center text-white/50">Playlist tidak ditemukan.<div className="mt-4"><Link to="/library" className="text-accent">Kembali ke Library</Link></div></div>;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1100px] mx-auto">
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-6">
        <div className="relative group">
          {isLiked ? (
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-glass bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center shadow-2xl">
              <Heart className="w-16 h-16 fill-white text-white" />
            </div>
          ) : (
            <>
              <Cover src={cover} alt={name} className="w-40 h-40 sm:w-48 sm:h-48 shadow-2xl" rounded="xl" />
              {/* Tombol Ganti Cover Overlay */}
              <button 
                className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity tap cursor-pointer"
                onClick={() => setCoverOpen(true)}
              >
                <Image className="w-8 h-8 text-white" />
              </button>
            </>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Playlist</div>
          {renaming ? (
            <form onSubmit={(e) => { e.preventDefault(); if (playlist) { void renamePlaylist(playlist.id, nameInput); pushToast('Playlist diganti nama'); } setRenaming(false); }}>
              <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="bg-white/10 rounded-xl px-3 py-2 text-2xl font-bold outline-none w-full max-w-xs" />
            </form>
          ) : (
            <h1 className="text-3xl sm:text-5xl font-bold truncate text-shadow-glass">{name}</h1>
          )}
          <div className="text-sm text-white/50 mt-2">{playlistTracks.length} lagu · {formatDuration(totalDuration)}</div>
          {playlist?.description && <p className="text-sm text-white/40 italic mt-1">"{playlist.description}"</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <button className="tap glass-pill-strong w-14 h-14 flex items-center justify-center !bg-white !text-black" onClick={handlePlay} disabled={playlistTracks.length === 0} aria-label="Play">
          <Play className="w-6 h-6 fill-black ml-0.5" />
        </button>
        <button className={`tap glass-pill w-12 h-12 flex items-center justify-center ${shuffle ? 'text-accent' : 'text-white/80'}`} onClick={handleShuffle} disabled={playlistTracks.length === 0} aria-label="Shuffle">
          <Shuffle className="w-5 h-5" />
        </button>
        {!isLiked && (
          <button className="tap glass-pill w-12 h-12 flex items-center justify-center text-white/80 ml-auto" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {playlistTracks.length > 0 && (
        <div className="glass-pill flex items-center gap-2 px-3 py-2 mb-4">
          <Search className="w-4 h-4 text-white/50" />
          <input type="text" placeholder="Cari di playlist ini..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" />
          {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-4 h-4 text-white/50" /></button>}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="glass-strong rounded-full px-4 py-2 flex items-center justify-between mb-4 animate-spring-up">
          <span className="text-sm text-white">{selectedIds.length} lagu dipilih</span>
          <button onClick={() => setSelectedIds([])} className="text-xs text-red-400 tap">Batal</button>
        </div>
      )}

      {filteredTracks.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-14 h-14 rounded-full glass mx-auto flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-white/50" />
          </div>
          <p className="text-white/50 text-sm mb-4">{isLiked ? 'Lagu yang kamu sukai akan muncul di sini' : 'Playlist masih kosong'}</p>
          <UploadButton />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
          const { active, over } = e;
          if (over && active.id !== over.id && playlist) {
            const oldIndex = playlistTracks.findIndex((t) => t.id === active.id);
            const newIndex = playlistTracks.findIndex((t) => t.id === over.id);
            const newArray = arrayMove(playlist.trackIds, oldIndex, newIndex);
            void reorderPlaylistTracks(playlist.id, newArray);
          }
        }}>
          <SortableContext items={filteredTracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {filteredTracks.map((t, i) => (
                <SortableTrackRow 
                  key={`${t.id}-${i}`} 
                  track={t} 
                  index={i} 
                  contextIds={playlistTracks.map((x) => x.id)} 
                  isSelected={selectedIds.includes(t.id)}
                  onSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={name}>
        <div className="space-y-1">
          <div className="text-sm text-white/50 mt-2">{playlistTracks.length} lagu · {formatDuration(totalDuration)}</div>
          {playlist?.description && <p className="text-sm text-white/40 italic mt-1">"{playlist.description}"</p>}
          <SheetItem icon={<Image className="w-5 h-5" />} label="Ganti Cover" onClick={() => { setCoverOpen(true); setMenuOpen(false); }} />
          <SheetItem icon={<FileText className="w-5 h-5" />} label="Edit Notes" onClick={() => { 
            const notes = prompt("Tulis catatan buat playlist ini:", playlist?.description || '');
            if (notes !== null && playlist) updatePlaylistNotes(playlist.id, notes);
            setMenuOpen(false);
          }} />
          <SheetItem icon={<Image className="w-5 h-5" />} label="Ganti Cover" onClick={() => { setCoverOpen(true); setMenuOpen(false); }} />
          <SheetItem icon={<Plus className="w-5 h-5" />} label="Tambah lagu" onClick={() => { setMenuOpen(false); navigate('/library'); pushToast('Cari lagu lalu pakai menu "Tambahkan ke playlist"'); }} />
          <div className="h-px bg-white/10 my-1" />
          <SheetItem icon={<Trash2 className="w-5 h-5" />} label="Hapus playlist" danger onClick={() => {
            if (playlist && confirm(`Hapus playlist "${name}"? Lagu tidak ikut terhapus.`)) {
              void removePlaylist(playlist.id); pushToast('Playlist dihapus'); navigate('/library');
            }
            setMenuOpen(false);
          }} />
        </div>
      </BottomSheet>

      {/* Modal Ganti Cover */}
      {coverOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-white">Ganti Cover Playlist</h2>
            <p className="text-xs text-white/50">Pilih gambar dari galeri kamu (JPG/PNG).</p>
            <input 
              type="file" 
              accept="image/*" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && playlist) {
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = reader.result as string;
                    await updatePlaylistCover(playlist.id, base64);
                    pushToast('Cover playlist diperbarui');
                    setCoverOpen(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-black hover:file:bg-accent/80 tap"
            />
            <button onClick={() => setCoverOpen(false)} className="w-full glass-pill py-2 text-sm tap text-white">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SheetItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${danger ? 'text-red-400' : 'text-white/90'}`} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}