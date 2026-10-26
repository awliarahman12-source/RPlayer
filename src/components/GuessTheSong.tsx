import { useState, useEffect } from 'react';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { Music, Check, X } from 'lucide-react';

export function GuessTheSong({ onClose }: { onClose: () => void }) {
  const tracks = useLibrary((s) => s.tracks);
  const playTrack = usePlayer((s) => s.playTrack);
  const [options, setOptions] = useState<any[]>([]);
  const [correct, setCorrect] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const startNewRound = () => {
    if (tracks.length < 4) return;
    const shuffled = [...tracks].sort(() => 0.5 - Math.random());
    const selectedTracks = shuffled.slice(0, 4);
    const correctTrack = selectedTracks[Math.floor(Math.random() * 4)];
    setOptions(selectedTracks);
    setCorrect(correctTrack);
    setSelected(null);
    // Mainkan 5 detik pertama
    void playTrack(correctTrack.id);
    setTimeout(() => {
      usePlayer.getState().togglePlay(); // Pause
    }, 5000);
  };

  useEffect(() => {
    startNewRound();
  }, []);

  if (tracks.length < 4) return <div className="p-6 text-center text-white/50">Butuh minimal 4 lagu buat main game ini.</div>;

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-1">Tebak Lagu</h2>
          <p className="text-white/60 text-sm">Dengerin 5 detik, lalu tebak judulnya!</p>
          <p className="text-accent font-semibold mt-2">Score: {score}</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {options.map((t) => {
            const isCorrect = t.id === correct?.id;
            const isSelected = selected === t.id;
            let btnClass = "glass-pill p-3 text-sm font-medium tap text-white";
            if (selected) {
              if (isCorrect) btnClass = "bg-green-500 text-white rounded-full p-3 text-sm font-bold";
              else if (isSelected) btnClass = "bg-red-500 text-white rounded-full p-3 text-sm font-bold";
              else btnClass = "glass-pill p-3 text-sm font-medium opacity-50";
            }

            return (
              <button
                key={t.id}
                disabled={!!selected}
                className={btnClass}
                onClick={() => {
                  setSelected(t.id);
                  if (isCorrect) setScore(s => s + 10);
                  else setScore(s => Math.max(0, s - 5));
                }}
              >
                {t.title}
              </button>
            );
          })}
        </div>

        {selected && (
          <button onClick={startNewRound} className="w-full bg-white text-black font-bold rounded-full py-3 tap">
            Lanjut Main
          </button>
        )}

        <button onClick={onClose} className="w-full text-center text-white/50 text-sm tap mt-2">
          Keluar Game
        </button>
      </div>
    </div>
  );
}