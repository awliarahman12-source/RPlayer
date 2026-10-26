import { useState } from 'react';
import { useLibrary } from '@/store/library';

export function LyricsView({ trackId }: { trackId: string }) {
  const track = useLibrary((s) => s.tracks.find((t) => t.id === trackId));
  const [lyrics, setLyrics] = useState(localStorage.getItem(`lyrics-${trackId}`) || '');

  const handleSave = (text: string) => {
    setLyrics(text);
    localStorage.setItem(`lyrics-${trackId}`, text);
  };

  return (
    <div className="p-4 h-[60vh] flex flex-col">
      {!lyrics ? (
        <div className="flex-1 flex flex-col">
          <p className="text-sm text-white/50 mb-4 text-center">Belum ada lirik untuk lagu ini. Tempel liriknya di bawah:</p>
          <textarea 
            className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none resize-none scroll-hidden"
            placeholder="Tempel lirik di sini..."
            onChange={(e) => handleSave(e.target.value)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-hidden whitespace-pre-wrap text-center text-white/80 text-lg leading-relaxed">
          {lyrics}
          <div className="mt-6">
            <button onClick={() => handleSave('')} className="text-xs text-red-400 tap">Hapus Lirik</button>
          </div>
        </div>
      )}
    </div>
  );
}