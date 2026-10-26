import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/store/player';

interface LyricLine {
  time: number;
  text: string;
}

function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = min * 60 + sec + ms / 100;
      const text = match[4].trim();
      if (text) result.push({ time, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

export function LyricsView({ trackId }: { trackId: string }) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const position = usePlayer((s) => s.position);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLRC = localStorage.getItem(`lrc-${trackId}`);
    if (savedLRC) setLyrics(parseLRC(savedLRC));
  }, [trackId]);

  useEffect(() => {
    const idx = lyrics.findIndex((l, i) => {
      const next = lyrics[i + 1];
      return position >= l.time && (!next || position < next.time);
    });
    if (idx !== -1 && idx !== activeIndex) {
      setActiveIndex(idx);
      // Auto scroll
      const activeEl = document.getElementById(`lyric-line-${idx}`);
      if (activeEl && containerRef.current) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [position, lyrics, activeIndex]);

  if (lyrics.length === 0) {
    return (
      <div className="p-4 h-[60vh] flex flex-col justify-center items-center">
        <p className="text-white/50 mb-4 text-center">Belum ada lirik. Tempel format LRC di bawah:</p>
        <textarea 
          className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs outline-none"
          placeholder="[00:12.00] Baris pertama lirik..."
          onChange={(e) => {
            localStorage.setItem(`lrc-${trackId}`, e.target.value);
            setLyrics(parseLRC(e.target.value));
          }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[60vh] overflow-y-auto scroll-hidden py-32 px-4 space-y-6 text-center">
      {lyrics.map((line, i) => (
        <div
          key={i}
          id={`lyric-line-${i}`}
          className={`text-lg font-medium transition-all duration-300 ${
            i === activeIndex ? 'text-accent scale-110 font-bold' : 'text-white/40 scale-100'
          }`}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}