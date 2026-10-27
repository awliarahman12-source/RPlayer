import { useEffect, useRef, useState } from 'react';
import { getDominantColor } from '@/lib/color';
import { GuessTheSong } from './GuessTheSong';
import { ChevronDown, Heart, ListMusic, X, MoreHorizontal, Gauge, Mic2, Radio, Gamepad2, Monitor, Smartphone, Cast } from 'lucide-react';
import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { Cover } from './Cover';
import { Slider } from './Slider';
import { PlayerControls } from './PlayerControls';
import { formatTime } from '@/lib/format';
import { BottomSheet } from './BottomSheet';
import { TrackMenuSheet } from './TrackMenuSheet';
import { Visualizer } from './Visualizer';
import { LyricsView } from './LyricsView';
import { usePresence } from '@/store/presence';

interface NowPlayingProps {
  open: boolean;
  onClose: () => void;
  variant?: 'mobile' | 'desktop';
}

export function NowPlaying({ open, onClose, variant = 'mobile' }: NowPlayingProps) {
  const track = usePlayer((s) => s.currentTrack);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const queue = usePlayer((s) => s.queue);
  const next = usePlayer((s) => s.next);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const tracks = useLibrary((s) => s.tracks);
  const playbackRate = usePlayer((s) => s.playbackRate);
  const setPlaybackRate = usePlayer((s) => s.setPlaybackRate);
  const pushToast = useToast((s) => s.push);
  
  const radioMode = usePlayer((s) => s.radioMode);
  const toggleRadioMode = usePlayer((s) => s.toggleRadioMode);
  const syncMode = usePlayer((s) => s.syncMode);
  const setSyncMode = usePlayer((s) => s.setSyncMode);
  const devices = usePresence((s) => s.devices);
  const myDeviceId = usePresence((s) => s.deviceId);
  const otherDevices = devices.filter(d => d.deviceId !== myDeviceId);

  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [menuTrack, setMenuTrack] = useState<{ id: string } | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const [gameOpen, setGameOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);

  useEffect(() => {
    if (track?.coverDataUrl) {
      getDominantColor(track.coverDataUrl).then((color) => {
        document.documentElement.style.setProperty('--accent-color', color);
      });
    }
  }, [track?.coverDataUrl]);

  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) { setDragY(0); setQueueOpen(false); setLyricsOpen(false); }
  }, [open]);

  if (!track) return null;

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) onClose();
    setDragY(0); startY.current = null;
  };

  const onCoverTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onCoverTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx > 60) void usePlayer.getState().prev();
    if (dx < -60) void next();
    startX.current = null;
  };

  const queueTracks = queue.map((id) => tracks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t));

  if (variant === 'desktop') {
    return (
      <aside className="hidden lg:flex flex-col gap-4 p-4 h-full">
        <div className="glass rounded-glass p-5 flex flex-col items-center text-center relative overflow-hidden">
          <Visualizer />
          <div className={`relative transition-transform duration-700 z-10 ${isPlaying ? 'scale-105' : 'scale-100'}`}>
            <Cover src={track.coverDataUrl} alt={track.title} className="w-full aspect-square max-w-[260px] mb-5 shadow-2xl" rounded="xl" />
            <div className="absolute inset-0 bg-accent/30 blur-3xl -z-10 rounded-full animate-pulse" />
          </div>
          <h2 className="text-xl font-bold truncate w-full z-10">{track.title}</h2>
          <p className="text-white/60 truncate w-full text-sm mt-0.5 z-10">{track.artist}</p>
          <div className="w-full mt-4 z-10">
            <Slider value={position} max={duration || track.duration || 0} onChange={seek} onCommit={seek} />
          </div>
        </div>
        
        {queueOpen && (
          <div className="glass rounded-glass p-3 flex-1 overflow-y-auto scroll-hidden">
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-sm font-semibold text-white/80">Antrian berikutnya</h3>
              {queue.length > 0 && <button className="text-xs text-white/50 tap" onClick={clearQueue}>Bersihkan</button>}
            </div>
            {queueTracks.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-6">Antrian kosong</p>
            ) : (
              queueTracks.map((t, i) => (
                <div key={`${t.id}-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 group">
                  <Cover src={t.coverDataUrl} alt={t.title} className="w-9 h-9 shrink-0" rounded="md" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.title}</div><div className="truncate text-xs text-white/40">{t.artist}</div></div>
                  <button className="opacity-0 group-hover:opacity-100 tap p-1 text-white/50" onClick={() => setMenuTrack({ id: t.id })}><MoreHorizontal className="w-4 h-4" /></button>
                  <button className="opacity-0 group-hover:opacity-100 tap p-1 text-white/50" onClick={() => removeFromQueue(i)}><X className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        )}
        {menuTrack && <TrackMenuSheet open={!!menuTrack} onClose={() => setTrackMenuOpen(null)} track={tracks.find((t) => t.id === menuTrack.id)!} />}
        
        <BottomSheet open={lyricsOpen} onClose={() => setLyricsOpen(false)} title="Lirik Lagu">
          <LyricsView trackId={track.id} />
        </BottomSheet>

        {gameOpen && <GuessTheSong onClose={() => setGameOpen(false)} />}

        {/* TAMBAHAN: BottomSheet Sync untuk Desktop */}
        <BottomSheet open={syncMenuOpen} onClose={() => setSyncMenuOpen(false)} title="Pilih Mode Sync">
          <div className="space-y-1 pb-4">
            <button onClick={() => { setSyncMode('host'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'host' ? 'text-accent font-bold' : 'text-white'}`}>
              <div className="font-bold">Host</div>
              <div className="text-xs text-white/50">Putar lagu & kontrol dari device ini</div>
            </button>
            <button onClick={() => { setSyncMode('remote'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'remote' ? 'text-accent font-bold' : 'text-white'}`}>
              <div className="font-bold">Remote</div>
              <div className="text-xs text-white/50">Bisu, tapi bisa kontrol Host</div>
            </button>
            <button onClick={() => { setSyncMode('speaker'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'speaker' ? 'text-accent font-bold' : 'text-white'}`}>
              <div className="font-bold">Speaker</div>
              <div className="text-xs text-white/50">Ngeluarin suara, ngikutin Host</div>
            </button>
          </div>
        </BottomSheet>
      </aside>
    );
  }

  return (
    <div className={`lg:hidden fixed inset-0 z-[100] flex flex-col bg-[#0b0b0f] transition-transform duration-300 ease-in-out ${open ? 'translate-y-0' : 'translate-y-[100dvh]'}`} style={open && dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : !open ? { transform: 'translateY(100%)' } : undefined}>
      <div className="absolute inset-0 overflow-hidden z-0">
        {track.coverDataUrl && <img src={track.coverDataUrl} alt="" className="w-full h-full object-cover opacity-60" style={{ filter: 'blur(80px) saturate(2) brightness(0.6)', transform: 'scale(1.2)' }} />}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <Visualizer />

      <div className="relative z-10 flex-1 flex flex-col px-5 pt-safe pb-6 overflow-y-auto scroll-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="flex items-center justify-between py-3">
          <button className="tap glass-pill w-10 h-10 flex items-center justify-center text-white" onClick={onClose} aria-label="Tutup"><ChevronDown className="w-5 h-5" /></button>
          
          <div className="flex flex-col items-center">
            <div className="text-xs uppercase tracking-wider text-white/70 font-semibold">Now Playing</div>
            {otherDevices.length > 0 && (
              <div className="flex gap-1 mt-1">
                {otherDevices.map(d => (
                  <div key={d.deviceId} className="p-1 bg-white/10 rounded-full" title={`${d.deviceType} aktif`}>
                    {d.deviceType === 'mobile' ? <Smartphone className="w-3 h-3 text-accent" /> : <Monitor className="w-3 h-3 text-accent" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="tap glass-pill w-10 h-10 flex items-center justify-center" onClick={() => toggleLike(track.id)} aria-label="Like">
            <Heart className={`w-5 h-5 ${track.liked ? 'fill-accent text-accent' : 'text-white'}`} />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center py-6">
          <div className={`relative transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'} now-playing-cover`}>
             <Cover src={track.coverDataUrl} alt={track.title} className="w-full max-w-[340px] aspect-square rounded-glass shadow-2xl z-10 cover-reflection" rounded="xl" onTouchStart={onCoverTouchStart} onTouchEnd={onCoverTouchEnd} />
             <div className="absolute inset-0 bg-accent/30 blur-3xl -z-10 rounded-full animate-pulse" />
          </div>
          <div className="w-full max-w-[340px] mt-7 text-center">
            <h1 className="text-2xl font-bold truncate text-white">{track.title}</h1>
            <p className="text-white/80 truncate mt-1">{track.artist}</p>
            {track.album && <p className="text-white/50 truncate mt-0.5 text-sm">{track.album}</p>}
          </div>
        </div>

        <div className="w-full max-w-[420px] mx-auto">
          <Slider value={position} max={duration || track.duration || 0} onChange={seek} onCommit={seek} />
          <div className="mt-6"><PlayerControls size="lg" /></div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button className={`tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 ${lyricsOpen ? 'text-accent' : 'text-white'}`} onClick={() => setLyricsOpen(true)}>
              <Mic2 className="w-4 h-4" /> Lirik
            </button>
            <button className={`tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 ${queueOpen ? 'text-accent' : 'text-white'}`} onClick={() => setQueueOpen(true)}>
              <ListMusic className="w-4 h-4" /> Antrian
            </button>
            <button className={`tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 ${playbackRate !== 1 ? 'text-accent' : 'text-white'}`} onClick={() => { const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1; setPlaybackRate(nextRate); pushToast(`Kecepatan: ${nextRate}x`); }}>
              <Gauge className="w-4 h-4" /> {playbackRate}x
            </button>
            <button className={`tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 ${radioMode ? 'text-accent' : 'text-white'}`} onClick={() => { toggleRadioMode(); pushToast(radioMode ? 'Radio Mati' : 'Radio Nyala'); }}>
              <Radio className="w-4 h-4" /> Radio
            </button>
            <button className={`tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 ${syncMode ? 'text-accent bg-accent/10' : 'text-white'}`} onClick={() => setSyncMenuOpen(true)}>
              <Cast className="w-4 h-4" /> {!syncMode ? 'Sync' : syncMode === 'host' ? 'Host' : syncMode === 'speaker' ? 'Speaker' : 'Remote'}
            </button>
            <button className="tap glass-pill px-4 py-2.5 text-sm flex items-center gap-2 text-white" onClick={() => setGameOpen(true)}>
              <Gamepad2 className="w-4 h-4" /> Game
            </button>
          </div>
        </div>
      </div>

      <BottomSheet open={queueOpen} onClose={() => setQueueOpen(false)} title="Antrian berikutnya">
        <div className="px-2 pb-2">
          {queueTracks.length === 0 ? (
            <p className="text-sm text-white/60 text-center py-8">Antrian kosong</p>
          ) : (
            <>
              <div className="flex justify-end mb-1"><button className="text-xs text-white/60 tap py-1" onClick={clearQueue}>Bersihkan</button></div>
              {queueTracks.map((t, i) => (
                <div key={`${t.id}-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/10 group">
                  <Cover src={t.coverDataUrl} alt={t.title} className="w-10 h-10 shrink-0" rounded="md" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm text-white">{t.title}</div><div className="truncate text-xs text-white/50">{t.artist}</div></div>
                  <span className="text-xs text-white/50">{formatTime(t.duration)}</span>
                  <button className="tap p-1 text-white/60" onClick={() => removeFromQueue(i)}><X className="w-4 h-4" /></button>
                </div>
              ))}
            </>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={lyricsOpen} onClose={() => setLyricsOpen(false)} title="Lirik Lagu">
        <LyricsView trackId={track.id} />
      </BottomSheet>

      {gameOpen && <GuessTheSong onClose={() => setGameOpen(false)} />}

      <BottomSheet open={syncMenuOpen} onClose={() => setSyncMenuOpen(false)} title="Pilih Mode Sync">
        <div className="space-y-1 pb-4">
          <button onClick={() => { setSyncMode('host'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'host' ? 'text-accent font-bold' : 'text-white'}`}>
            <div className="font-bold">Host</div>
            <div className="text-xs text-white/50">Putar lagu & kontrol dari device ini</div>
          </button>
          <button onClick={() => { setSyncMode('remote'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'remote' ? 'text-accent font-bold' : 'text-white'}`}>
            <div className="font-bold">Remote</div>
            <div className="text-xs text-white/50">Bisu, tapi bisa kontrol Host</div>
          </button>
          <button onClick={() => { setSyncMode('speaker'); setSyncMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm tap rounded-xl hover:bg-white/5 ${syncMode === 'speaker' ? 'text-accent font-bold' : 'text-white'}`}>
            <div className="font-bold">Speaker</div>
            <div className="text-xs text-white/50">Ngeluarin suara, ngikutin Host</div>
          </button>
        </div>
      </BottomSheet>
      
    </div>
  );
}
