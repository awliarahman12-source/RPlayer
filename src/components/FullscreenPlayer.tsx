import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, Heart, ListMusic, Maximize2, Mic2, Minimize2, Pause, Play,
  Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X,
} from 'lucide-react';
import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { Cover } from './Cover';
import { LyricsView } from './LyricsView';
import { formatTime } from '@/lib/format';

type Panel = 'lyrics' | 'queue' | 'none';

/** Background: cover di-blur besar, berputar pelan (mirip Apple Music). */
function Backdrop({ cover }: { cover?: string }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#0b0b0f]">
      <AnimatePresence initial={false}>
      <motion.div
        key={cover || 'none'}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.3, ease: 'easeInOut' }}
      >
        {cover ? (
          <>
            <motion.img
              src={cover}
              alt=""
              className="absolute -left-[20vw] -top-[25vw] w-[110vw] h-[110vw] object-cover opacity-80 will-change-transform"
              style={{ filter: 'blur(80px) saturate(1.8) brightness(0.75)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
            />
            <motion.img
              src={cover}
              alt=""
              className="absolute -right-[30vw] -bottom-[35vw] w-[100vw] h-[100vw] object-cover opacity-70 will-change-transform"
              style={{ filter: 'blur(90px) saturate(1.6) brightness(0.65)' }}
              animate={{ rotate: -360 }}
              transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0 opacity-50"
            style={{ background: 'radial-gradient(circle at 30% 20%, var(--accent-color, #30D158), transparent 60%)' }}
          />
        )}
      </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

/** Progress bar tipis ala Apple Music: seek cuma dipanggil sekali pas dilepas. */
function ProgressBar({ value, max, onSeek }: { value: number; max: number; onSeek: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const safeMax = isFinite(max) && max > 0 ? max : 1;
  const shown = drag ?? (isFinite(value) ? value : 0);
  const pct = Math.min(100, Math.max(0, (shown / safeMax) * 100));

  const calc = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * safeMax;
  };

  return (
    <div>
      <div
        ref={ref}
        className="group py-2 cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const v = calc(e.clientX);
          dragRef.current = v;
          setDrag(v);
        }}
        onPointerMove={(e) => {
          if (dragRef.current === null) return;
          const v = calc(e.clientX);
          dragRef.current = v;
          setDrag(v);
        }}
        onPointerUp={() => {
          if (dragRef.current === null) return;
          onSeek(dragRef.current);
          dragRef.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
      >
        <div className="h-1 group-hover:h-2 transition-all rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white/90 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex justify-between text-xs tabular-nums text-white/50 -mt-0.5">
        <span>{formatTime(shown)}</span>
        <span>-{formatTime(Math.max(0, safeMax - shown))}</span>
      </div>
    </div>
  );
}

function TopButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`tap w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center transition-colors ${
        active ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp({ w: window.innerWidth, h: window.innerHeight }));
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return vp;
}

const SPRING = { type: 'spring', stiffness: 130, damping: 24, mass: 0.9 } as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function FullscreenPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const track = usePlayer((s) => s.currentTrack);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => s.volume);
  const queue = usePlayer((s) => s.queue);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const setVolume = usePlayer((s) => s.setVolume);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const tracks = useLibrary((s) => s.tracks);

  const [panel, setPanel] = useState<Panel>('lyrics');
  const [browserFs, setBrowserFs] = useState(false);
  const vp = useViewport();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const onFs = () => setBrowserFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!open && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [open]);

  // Karena komponen ini di-unmount lewat animasi keluar, keluar dari fullscreen browser dilakukan saat unmount
  useEffect(() => () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (open && !track) onClose();
  }, [open, track, onClose]);

  if (!open || !track) return null;

  const toggleBrowserFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* browser menolak, abaikan */ }
  };

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? 'none' : p));
  const queueTracks = queue
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const maxDur = duration || track.duration || 0;

  const panelOpen = panel !== 'none';
  const coverW = Math.round(Math.min(vp.h * 0.46, vp.w * 0.34));
  const panelW = Math.round(Math.min(vp.w * 0.36, 540));
  const panelH = Math.round(vp.h * 0.78);
  const gap = Math.round(vp.w * 0.06);

  return (
    <motion.div
      className="fixed inset-0 z-[200] overflow-hidden bg-black text-white select-none"
      initial={{ opacity: 0, scale: 1.03 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <Backdrop cover={track.coverDataUrl} />

      {/* Bar atas */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-8 pt-6">
        <TopButton onClick={onClose} label="Tutup"><ChevronDown className="w-5 h-5" /></TopButton>
        <div className="flex items-center gap-2">
          <TopButton active={panel === 'lyrics'} onClick={() => togglePanel('lyrics')} label="Lirik"><Mic2 className="w-[18px] h-[18px]" /></TopButton>
          <TopButton active={panel === 'queue'} onClick={() => togglePanel('queue')} label="Antrian"><ListMusic className="w-[18px] h-[18px]" /></TopButton>
          <TopButton onClick={() => void toggleBrowserFs()} label={browserFs ? 'Keluar layar penuh' : 'Layar penuh'}>
            {browserFs ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
          </TopButton>
        </div>
      </div>

      {/* Konten utama */}
      <div className="relative z-10 h-full flex items-center justify-center px-[3vw]">
        {/* Kiri: cover, info, durasi, kontrol */}
        <motion.div className="shrink-0 flex flex-col" initial={false} animate={{ width: coverW }} transition={SPRING}>
          <motion.div animate={{ scale: isPlaying ? 1 : 0.88 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
            <motion.div
              key={track.id}
              initial={{ opacity: 0.35, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <Cover
                src={track.coverDataUrl}
                alt={track.title}
                rounded="lg"
                className="w-full aspect-square shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
              />
            </motion.div>
          </motion.div>

          <div className="mt-8 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold truncate">{track.title}</h1>
              <p className="text-lg text-white/60 truncate">{track.artist}</p>
            </div>
            <button
              className="tap w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
              onClick={() => void toggleLike(track.id)}
              aria-label="Suka"
            >
              <Heart className={`w-5 h-5 ${track.liked ? 'fill-white text-white' : 'text-white/80'}`} />
            </button>
          </div>

          <div className="mt-3">
            <ProgressBar value={position} max={maxDur} onSeek={seek} />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              className={`tap p-2.5 rounded-full transition-colors ${shuffle ? 'bg-white/25 text-white' : 'text-white/60 hover:text-white'}`}
              onClick={toggleShuffle}
              aria-label="Acak"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button className="tap p-2 text-white hover:scale-105 transition-transform" onClick={() => void prev()} aria-label="Sebelumnya">
              <SkipBack className="w-8 h-8 fill-white" />
            </button>
            <button className="tap p-2 text-white hover:scale-105 transition-transform" onClick={togglePlay} aria-label={isPlaying ? 'Jeda' : 'Putar'}>
              {isPlaying ? <Pause className="w-12 h-12 fill-white" /> : <Play className="w-12 h-12 fill-white" />}
            </button>
            <button className="tap p-2 text-white hover:scale-105 transition-transform" onClick={() => void next()} aria-label="Berikutnya">
              <SkipForward className="w-8 h-8 fill-white" />
            </button>
            <button
              className={`tap p-2.5 rounded-full transition-colors ${repeat !== 'off' ? 'bg-white/25 text-white' : 'text-white/60 hover:text-white'}`}
              onClick={cycleRepeat}
              aria-label="Ulangi"
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 text-white/70">
            <button className="tap p-1" onClick={() => setVolume(volume === 0 ? 0.8 : 0)} aria-label="Bisukan">
              <VolIcon className="w-5 h-5" />
            </button>
            <input
              type="range"
              className="glass-range flex-1"
              style={{ background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.18) ${volume * 100}%)` }}
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>
        </motion.div>

        {/* Kanan: lirik / antrian (lebar dianimasikan, isi digeser halus saat ganti panel) */}
        <motion.div
          className="shrink-0 overflow-hidden"
          initial={false}
          animate={{ width: panelOpen ? panelW : 0, marginLeft: panelOpen ? gap : 0, opacity: panelOpen ? 1 : 0, height: panelH }}
          transition={SPRING}
        >
          <div style={{ width: panelW, height: panelH }}>
            <AnimatePresence mode="wait" initial={false}>
              {panel === 'lyrics' && (
                <motion.div
                  key="lyrics"
                  className="h-full"
                  initial={{ opacity: 0, x: 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.34, ease: EASE_OUT }}
                >
                  <LyricsView trackId={track.id} variant="full" />
                </motion.div>
              )}
              {panel === 'queue' && (
                <motion.div
                  key="queue"
                  className="h-full flex flex-col"
                  initial={{ opacity: 0, x: 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.34, ease: EASE_OUT }}
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-2xl font-bold">Berikutnya</h2>
                    {queueTracks.length > 0 && (
                      <button className="tap text-sm text-white/60 hover:text-white" onClick={clearQueue}>Bersihkan</button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto scroll-hidden space-y-1">
                    {queueTracks.length === 0 ? (
                      <p className="text-white/40 text-center py-16">Antrian kosong</p>
                    ) : (
                      queueTracks.map((t, i) => (
                        <motion.div
                          key={`${t.id}-${i}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE_OUT }}
                          className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/10"
                        >
                          <Cover src={t.coverDataUrl} alt={t.title} rounded="md" className="w-12 h-12 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{t.title}</div>
                            <div className="truncate text-sm text-white/50">{t.artist}</div>
                          </div>
                          <span className="text-xs text-white/40 tabular-nums">{formatTime(t.duration)}</span>
                          <button
                            className="tap p-1.5 text-white/50 opacity-0 group-hover:opacity-100 hover:text-white"
                            onClick={() => removeFromQueue(i)}
                            aria-label="Hapus dari antrian"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
