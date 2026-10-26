import { Heart, ListPlus, Plus, Trash2, PlayCircle, Pencil } from 'lucide-react';
import type { Track } from '@/types';
import { BottomSheet } from './BottomSheet';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { useState } from 'react';
import { Cover } from './Cover';
import { EditTrackModal } from './EditTrackModal';

interface Props {
  open: boolean;
  onClose: () => void;
  track: Track;
  onToast?: (msg: string) => void;
}

export function TrackMenuSheet({ open, onClose, track, onToast }: Props) {
  const toggleLike = useLibrary((s) => s.toggleLike);
  const importExternalTrack = useLibrary((s) => s.importExternalTrack);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const addToPlaylist = useLibrary((s) => s.addToPlaylist);
  const removeTrack = useLibrary((s) => s.removeTrack);
  const downloadTrack = useLibrary((s) => s.downloadTrack);
  const playNext = usePlayer((s) => s.playNext);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const pushToast = useToast((s) => s.push);
  const toast = onToast || pushToast;
  
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (track.isExternal) {
    return (
      <BottomSheet open={open} onClose={onClose}>
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <Cover src={track.coverDataUrl} alt={track.title} className="w-14 h-14" rounded="md" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{track.title}</div>
            <div className="truncate text-sm text-white/50">{track.artist}</div>
          </div>
        </div>
        <div className="h-px bg-white/10 my-2" />
        
        <div className="space-y-1">
          <SheetItem 
            icon={<Plus className="w-5 h-5" />} 
            label="Simpan ke Library" 
            onClick={async () => { 
              await importExternalTrack(track); 
              toast('Lagu berhasil disimpan ke Library'); 
              onClose(); 
            }} 
          />
        </div>
      </BottomSheet>
    );
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <Cover src={track.coverDataUrl} alt={track.title} className="w-14 h-14" rounded="md" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{track.title}</div>
            <div className="truncate text-sm text-white/50">{track.artist}</div>
          </div>
        </div>
        <div className="h-px bg-white/10 my-2" />

        {!pickerOpen ? (
          <div className="space-y-1">
            <SheetItem icon={<PlayCircle className="w-5 h-5" />} label="Putar berikutnya" onClick={() => { playNext(track.id); toast('Ditambahkan ke urutan berikutnya'); onClose(); }} />
            <SheetItem icon={<ListPlus className="w-5 h-5" />} label="Tambahkan ke antrian" onClick={() => { addToQueue(track.id); toast('Ditambahkan ke antrian'); onClose(); }} />
            <SheetItem icon={<Heart className={`w-5 h-5 ${track.liked ? 'fill-accent text-accent' : ''}`} />} label={track.liked ? 'Hapus dari Liked Songs' : 'Tambahkan ke Liked Songs'} onClick={() => { void toggleLike(track.id); toast(track.liked ? 'Dihapus dari Liked' : 'Ditambahkan ke Liked'); onClose(); }} />
            <SheetItem icon={<Plus className="w-5 h-5" />} label="Tambahkan ke playlist" onClick={() => setPickerOpen(true)} />
            
            <SheetItem 
              icon={<Pencil className="w-5 h-5" />} 
              label="Edit Info" 
              onClick={() => { onClose(); setEditOpen(true); }} 
            />

            {!track.isDownloaded && (
              <SheetItem 
                icon={<Download className="w-5 h-5" />} 
                label="Download untuk Offline" 
                onClick={() => { void downloadTrack(track.id); toast('Memulai download...'); onClose(); }} 
              />
            )}
            {track.isDownloaded && (
              <div className="px-4 py-3 text-sm text-green-400 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" /> Tersedia Offline
              </div>
            )}

            <div className="h-px bg-white/10 my-1" />
            <SheetItem icon={<Trash2 className="w-5 h-5" />} label="Hapus lagu" danger onClick={() => { void removeTrack(track.id); toast('Lagu dihapus'); onClose(); }} />
          </div>
        ) : (
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 tap rounded-xl hover:bg-white/5" onClick={async () => { const p = await createPlaylist('Playlist Baru'); await addToPlaylist(p.id, track.id); toast('Ditambahkan ke playlist baru'); onClose(); setPickerOpen(false); }}>
              <Plus className="w-5 h-5" /><span>Playlist baru</span>
            </button>
            {playlists.length > 0 && <div className="px-4 pt-2 pb-1 text-xs text-white/40 uppercase tracking-wide">Playlist</div>}
            <div className="max-h-60 overflow-y-auto scroll-hidden">
              {playlists.map((p) => (
                <button key={p.id} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 tap rounded-xl hover:bg-white/5 text-left" onClick={() => { void addToPlaylist(p.id, track.id); toast(`Ditambahkan ke ${p.name}`); onClose(); setPickerOpen(false); }}>
                  <Cover src={p.coverDataUrl} alt={p.name} className="w-9 h-9" rounded="md" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-xs text-white/40">{p.trackIds.length}</span>
                </button>
              ))}
            </div>
            <div className="h-px bg-white/10 my-1" />
            <button className="w-full px-4 py-3 text-sm text-white/70 tap rounded-xl hover:bg-white/5" onClick={() => setPickerOpen(false)}>Kembali</button>
          </div>
        )}
      </BottomSheet>

      {editOpen && <EditTrackModal track={track} onClose={() => setEditOpen(false)} />}
    </>
  );
}

function SheetItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${danger ? 'text-red-400' : 'text-white/90'}`} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}