import { useState } from 'react';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import type { Track } from '@/types';

export function EditTrackModal({ track, onClose }: { track: Track; onClose: () => void }) {
  const editTrack = useLibrary((s) => s.editTrack);
  const pushToast = useToast((s) => s.push);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editTrack(track.id, { title, artist, album: album || undefined });
    pushToast('Metadata diperbarui');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold text-white">Edit Info Lagu</h2>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Judul</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-accent" required />
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
    </div>
  );
}