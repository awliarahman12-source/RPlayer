import { useState, useEffect, useRef, useMemo } from 'react';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { Pencil } from 'lucide-react';

interface LyricLine {
  time: number;
  text: string;
}

export function parseLRC(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const re = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const stamps: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) stamps.push(m);
    if (!stamps.length) continue;
    const text = raw.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
    if (!text) continue;
    for (const s of stamps) {
      const frac = s[3] ? parseInt(s[3], 10) / Math.pow(10, s[3].length) : 0;
      out.push({ time: parseInt(s[1], 10) * 60 + parseInt(s[2], 10) + frac, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

function parsePlain(text: string): LyricLine[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^\[[a-z]+:.*\]$/i.test(l)).map((l) => ({ time: -1, text: l }));
}

interface LyricsViewProps {
  trackId: string;
  variant?: 'sheet' | 'full';
}

export function LyricsView({ trackId, variant = 'sheet' }: LyricsViewProps) {
  const full = variant === 'full';
  const track = useLibrary((s) => s.tracks.find((t) => t.id === trackId));
  const updateLyrics = useLibrary((s) => s.updateLyrics);
  const position = usePlayer((s) => s.position);
  
  const [raw, setRaw] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setRaw(track?.lyrics || '');
    setEditing(false);
  }, [track?.lyrics]);

  const { lines, synced } = useMemo(() => {
    const timed = parseLRC(raw);
    if (timed.length) return { lines: timed, synced: true };
    return { lines: parsePlain(raw), synced: false };
  }, [raw]);

  const activeIndex = useMemo(() => {
    if (!synced) return -1;
    let idx = -1;
    const pos = position + 0.25;
    for (let i = 0; i < lines.length; i++) {
      if (pos >= lines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [lines, synced, position]);

  useEffect(() => {
    const c = containerRef.current;
    const el = lineRefs.current[activeIndex];
    if (!c || !el || !synced) return;
    const offset = full ? c.clientHeight * 0.35 : c.clientHeight / 2;
    c.scrollTo({ top: el.offsetTop - offset + el.clientHeight / 2, behavior: 'smooth' });
  }, [activeIndex, synced, full, editing]);

  const startEdit = () => { setDraft(raw); setEditing(true); };
  const save = () => {
    void updateLyrics(trackId, draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex flex-col gap-3 ${full ? 'h-full justify-center' : 'p-4 h-[60vh] justify-center'}`}>
        <p className="text-white/60 text-sm">Tempel lirik format LRC (<span className="font-mono">[00:12.00] teks</span>) atau lirik biasa.</p>
        <textarea
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          className={`w-full bg-white/10 border border-white/15 rounded-2xl p-4 text-white text-sm outline-none resize-none ${full ? 'flex-1 max-h-[60vh]' : 'h-40'}`}
        />
        <div className="flex gap-2 justify-end">
          <button className="tap px-4 py-2 rounded-full bg-white/10 text-sm" onClick={() => setEditing(false)}>Batal</button>
          <button className="tap px-5 py-2 rounded-full bg-white text-black text-sm font-semibold" onClick={save}>Simpan</button>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center text-center gap-4 ${full ? 'h-full' : 'p-4 h-[60vh]'}`}>
        <p className={full ? 'text-3xl font-bold text-white/40' : 'text-white/50'}>Belum ada lirik</p>
        <button className="tap px-5 py-2.5 rounded-full bg-white/15 text-sm font-medium flex items-center gap-2" onClick={startEdit}>
          <Pencil className="w-4 h-4" /> Tambah lirik
        </button>
      </div>
    );
  }

  const mask = full ? { maskImage: 'linear-gradient(to bottom, transparent 0, #000 14%, #000 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 14%, #000 80%, transparent 100%)' } : undefined;

  return (
    <div className={`relative ${full ? 'h-full' : ''}`}>
      <div ref={containerRef} className={`relative overflow-y-auto scroll-hidden ${full ? 'h-full px-2' : 'h-[60vh] px-4 text-center'}`} style={mask}>
        <div className={full ? 'h-[30vh]' : 'h-32'} />
        {lines.map((line, i) => {
          const active = synced && i === activeIndex;
          const stateClass = !synced ? 'text-white/85' : active ? 'text-white scale-100' : 'text-white/35 scale-[0.96] hover:text-white/70' + (full ? ' blur-[1.5px] hover:blur-0' : '');
          return (
            <div key={i} ref={(el) => { lineRefs.current[i] = el; }} onClick={() => synced && usePlayer.getState().seek(line.time)}
              className={`transition-all duration-500 ease-out ${synced ? 'cursor-pointer' : ''} ${full ? 'origin-left py-3 pr-8 font-bold leading-tight text-[clamp(1.6rem,3.4vh,2.6rem)]' : 'origin-center py-3 text-lg font-medium'} ${stateClass} ${!full && active ? '!text-accent font-bold' : ''}`}
            >
              {line.text}
            </div>
          );
        })}
        <div className={full ? 'h-[45vh]' : 'h-32'} />
      </div>
      <button onClick={startEdit} className={`tap absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md text-xs text-white/60 hover:text-white ${full ? 'bottom-3 right-3' : 'top-2 right-2'}`}>
        <Pencil className="w-3 h-3" /> Edit
      </button>
    </div>
  );
}