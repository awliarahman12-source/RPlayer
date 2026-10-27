import { useState, useEffect, useLayoutEffect, useRef, useMemo, type WheelEvent } from 'react';
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

/** Scroll halus dengan easing sendiri (lebih mulus dari behavior:'smooth' bawaan browser). */
function animateScroll(el: HTMLElement, to: number, duration: number, tokenRef: { current: number }) {
  const token = ++tokenRef.current;
  const from = el.scrollTop;
  const delta = to - from;
  if (Math.abs(delta) < 1) return;
  const t0 = performance.now();
  const step = (now: number) => {
    if (token !== tokenRef.current) return;
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.scrollTop = from + delta * eased;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

interface LyricsViewProps {
  trackId: string;
  variant?: 'sheet' | 'full' | 'desktop-panel';
  hideEditButton?: boolean;
}

export function LyricsView({ trackId, variant = 'sheet', hideEditButton = false }: LyricsViewProps) {
  const full = variant === 'full';
  const desktopPanel = variant === 'desktop-panel';
  const wave = full || desktopPanel; // mode animasi gelombang ala Apple Music

  const track = useLibrary((s) => s.tracks.find((t) => t.id === trackId));
  const updateLyrics = useLibrary((s) => s.updateLyrics);
  const position = usePlayer((s) => s.position);

  const [raw, setRaw] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollToken = useRef(0);

  // mode gelombang: posisi tiap baris + gesekan manual (scroll mouse)
  const [geo, setGeo] = useState<{ boxH: number; tops: number[]; heights: number[] }>({ boxH: 0, tops: [], heights: [] });
  const [manual, setManual] = useState(0);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRaw(track?.lyrics || '');
    setEditing(false);
    setManual(0);
  }, [track?.lyrics, trackId]);

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

  const useWave = wave && synced;

  // ukur posisi baris (offsetTop tidak terpengaruh transform, jadi aman)
  useLayoutEffect(() => {
    if (!useWave) return;
    const measure = () => {
      const c = containerRef.current;
      if (!c) return;
      setGeo({
        boxH: c.clientHeight,
        tops: lines.map((_, i) => lineRefs.current[i]?.offsetTop ?? 0),
        heights: lines.map((_, i) => lineRefs.current[i]?.offsetHeight ?? 0),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [useWave, lines, editing]);

  // mode sheet (mobile): auto-scroll dengan easing sendiri
  useEffect(() => {
    if (useWave || !synced) return;
    const c = containerRef.current;
    const el = lineRefs.current[activeIndex];
    if (!c || !el) return;
    animateScroll(c, el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2, 700, scrollToken);
  }, [activeIndex, synced, useWave, editing]);

  const anchor = geo.boxH * (full ? 0.34 : 0.4);
  const focusIdx = Math.max(activeIndex, 0);
  const focusCenter = (geo.tops[focusIdx] ?? 0) + (geo.heights[focusIdx] ?? 0) / 2;
  const autoShift = anchor - focusCenter;
  const lastEnd = (geo.tops[lines.length - 1] ?? 0) + (geo.heights[lines.length - 1] ?? 0);

  const onWheel = (e: WheelEvent) => {
    if (!useWave) return;
    const proposed = autoShift - (manual + e.deltaY);
    const minT = Math.min(0, geo.boxH * 0.75 - lastEnd);
    const maxT = geo.boxH * 0.3;
    const clamped = Math.max(minT, Math.min(maxT, proposed));
    setManual(autoShift - clamped);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => setManual(0), 3500);
  };
  useEffect(() => () => { if (manualTimer.current) clearTimeout(manualTimer.current); }, []);

  const startEdit = () => { setDraft(raw); setEditing(true); };
  const save = () => {
    void updateLyrics(trackId, draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex flex-col gap-3 p-4 ${full ? 'h-full justify-center' : desktopPanel ? 'h-full justify-center' : 'h-[60vh] justify-center'}`}>
        <p className="text-white/60 text-sm">Tempel lirik format LRC atau lirik biasa.</p>
        <textarea
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          className={`w-full bg-white/10 border border-white/15 rounded-2xl p-4 text-white text-sm outline-none resize-none ${full || desktopPanel ? 'flex-1' : 'h-40'}`}
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
      <div className={`flex flex-col items-center justify-center text-center gap-4 ${full || desktopPanel ? 'h-full' : 'p-4 h-[60vh]'}`}>
        <p className={full || desktopPanel ? 'text-lg font-bold text-white/40' : 'text-white/50'}>Belum ada lirik</p>
        {!hideEditButton && (
          <button className="tap px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-xs font-medium flex items-center gap-2" onClick={startEdit}>
            <Pencil className="w-3 h-3" /> Tambah lirik
          </button>
        )}
      </div>
    );
  }

  const mask = wave
    ? { maskImage: 'linear-gradient(to bottom, transparent 0, #000 12%, #000 82%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 12%, #000 82%, transparent 100%)' }
    : undefined;

  const lineSize = full
    ? 'origin-left py-3 pr-8 font-bold leading-tight text-[clamp(1.6rem,3.4vh,2.6rem)] text-left'
    : desktopPanel
      ? 'origin-center py-2 px-1 font-semibold leading-snug text-base text-center'
      : 'origin-center py-3 text-lg font-medium text-center';

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onWheel={onWheel}
        className={`relative h-full ${useWave ? 'overflow-hidden' : 'overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'} ${wave ? 'px-2' : 'px-4'}`}
        style={mask}
      >
        <div className="relative" style={!useWave ? { paddingTop: wave ? '2rem' : '2.5rem', paddingBottom: wave ? '30vh' : '2.5rem' } : undefined}>
          {lines.map((line, i) => {
            const dist = Math.abs(i - activeIndex);
            const active = synced && i === activeIndex;

            let stateClass: string;
            if (!synced) stateClass = 'text-white/85';
            else if (active) stateClass = 'text-white opacity-100';
            else if (dist <= 2) stateClass = 'text-white opacity-40 blur-[0.8px] hover:opacity-80 hover:blur-0';
            else stateClass = 'text-white opacity-25 blur-[2px] hover:opacity-70 hover:blur-0';

            const manualActive = manual !== 0;
            const delay = !manualActive && i >= focusIdx ? Math.min((i - focusIdx) * 55, 440) : 0;
            const y = geo.boxH ? autoShift - manual : 0;

            const style: React.CSSProperties = useWave
              ? {
                  transform: `translateY(${y}px) scale(${active ? 1 : 0.94})`,
                  transition: `transform ${manualActive ? 140 : 700}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity 500ms ease, filter 500ms ease, color 400ms ease`,
                  willChange: 'transform',
                  visibility: geo.boxH ? 'visible' : 'hidden',
                }
              : {
                  transform: `scale(${synced && !active ? 0.96 : 1})`,
                  transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease, filter 500ms ease',
                };

            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                onClick={() => synced && usePlayer.getState().seek(line.time)}
                className={`${synced ? 'cursor-pointer' : ''} ${lineSize} ${stateClass}`}
                style={style}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>

      {!hideEditButton && !desktopPanel && (
        <button
          onClick={startEdit}
          className={`tap absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-xs text-white/60 hover:text-white ${full ? 'bottom-4 right-4' : 'top-0 right-0'}`}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
      )}
    </div>
  );
}
