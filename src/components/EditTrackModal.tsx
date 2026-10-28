import { useState } from 'react';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import type { Track } from '@/types';
import { Image as ImageIcon, ArrowUpDown, Wand2 } from 'lucide-react';
import { Cover } from './Cover';
import { createPortal } from 'react-dom'; 
import { searchMusicBrainz } from '@/lib/musicbrainz';

export function EditTrackModal({ track, onClose }: { track: Track; onClose: () => void }) {
  const editTrack = useLibrary((s) => s.editTrack);
  const pushToast = useToast((s) => s.push);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album || '');
  const [cover, setCover] = useState(track.coverDataUrl || '');
  const [isFetching, setIsFetching] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      pushToast('Ukuran gambar maksimal 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => { setCover(event.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleAutoFetch = async () => {
    if (!title || !artist) return pushToast('Isi judul dan artis dulu', 'error');
    setIsFetching(true);
    const result = await searchMusicBrainz(title, artist);
    if (result) {
      if (result.album) setAlbum(result.album);
      if (result.coverUrl) {
        // Konversi URL gambar ke Base64 agar aman disimpan di Firestore
        const imgRes = await fetch(result.coverUrl);
        const blob = await imgRes.blob();
        const reader = new FileReader();
        reader.onload = (e) => setCover(e.target?.result as string);
        reader.readAsDataURL(blob);
      }
      pushToast('Metadata ditemukan!');
    } else {
      pushToast('Metadata tidak ditemukan', 'error');
    }
    setIsFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editTrack(track.id, { title, artist, album: album || undefined, coverDataUrl: cover || undefined });
    pushToast('Metadata lagu diperbarui');
    onClose();
  };

  // Pakai createPortal biar nggak kerender di dalam parent yang aneh
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto scroll-hidden">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Edit Info Lagu</h2>
          <button 
            type="button" 
            onClick={handleAutoFetch} 
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-accent rounded-full text-xs font-semibold tap hover:bg-accent/30 disabled:opacity-50 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" /> {isFetching ? 'Mencari...' : 'Auto Cari'}
          </button>
        </div>
        
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="relative group cursor-pointer">
            <Cover src={cover} alt={title} className="w-28 h-28 rounded-2xl shadow-lg" rounded="lg" />
            <label className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <ImageIcon className="w-8 h-8 text-white" />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
          <p className="text-[10px] text-white/50">Klik gambar untuk ganti cover</p>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Judul</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-accent" required />
        </div>
        <div className="flex justify-center -my-1">
          <button type="button" onClick={() => { setTitle(artist); setArtist(title); }} className="tap flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] text-white/70 hover:text-white">
            <ArrowUpDown className="w-3 h-3" /> Tukar judul dan artis
          </button>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Artis</label>
          <input value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-accent" required />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Album</label>
          <input value={album} onChange={(e) => setAlbum(e.target.value)} className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-accent" />
        </div>
        
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 glass-pill py-2 text-sm tap text-white">Batal</button>
          <button type="submit" className="flex-1 bg-accent text-black font-semibold rounded-full py-2 text-sm tap">Simpan</button>
        </div>
      </form>
    </div>,
    document.body
  );
}