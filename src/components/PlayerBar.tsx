import { useState } from 'react';
import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { Cover } from './Cover';
import { Slider } from './Slider';
import { PlayerControls, VolumeControl } from './PlayerControls';
import { Heart, ChevronUp, Mic2, Gauge, Radio, Gamepad2, Cast, Maximize2, X } from 'lucide-react';
import { LyricsView } from './LyricsView';
import { GuessTheSong } from './GuessTheSong';
import { usePresence } from '@/store/presence';
import { BottomSheet } from './BottomSheet'; // Tetap dipakai buat Lirik di mobile

interface PlayerBarProps {
  onExpand: () => void;
  onFullscreen: () => void;
  onShowLyrics: () => void; // <-- Tambahan
}

export function PlayerBar({ onExpand, onFullscreen, onShowLyrics }: PlayerBarProps) {
  const track = usePlayer((s) => s.currentTrack);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const pushToast = useToast((s) => s.push);

  const playbackRate = usePlayer((s) => s.playbackRate);
  const setPlaybackRate = usePlayer((s) => s.setPlaybackRate);
  const radioMode = usePlayer((s) => s.radioMode);
  const toggleRadioMode = usePlayer((s) => s.toggleRadioMode);
  const syncMode = usePlayer((s) => s.syncMode);
  const setSyncMode = usePlayer((s) => s.setSyncMode);

  const [menuOpen, setMenuOpen] = useState(false);
  const [syncSubMenu, setSyncSubMenu] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  if (!track) return null;

  return (
    <>
      <div className="hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-[80] w-[min(960px,calc(100vw-1.5rem))]">
        <div className="glass-pill-strong w-full px-3 py-2.5 flex items-center gap-4">
          {/* track info */}
          <div className="flex items-center gap-3 w-[240px] min-w-0 shrink-0">
            <Cover src={track.coverDataUrl} alt={track.title} className="w-12 h-12 rounded-full shrink-0" rounded="pill" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{track.title}</div>
              <div className="truncate text-xs text-white/50">{track.artist}</div>
            </div>
            <button className="tap p-1.5 text-white/60 hover:text-white" onClick={() => toggleLike(track.id)}>
              <Heart className={`w-5 h-5 ${track.liked ? 'fill-accent text-accent' : ''}`} />
            </button>
          </div>

          {/* controls + slider */}
          <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <PlayerControls size="md" />
            <Slider
              value={position}
              max={duration || track.duration || 0}
              onChange={seek}
              onCommit={seek}
              className="w-full max-w-[520px]"
            />
          </div>

          {/* right side */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <VolumeControl />
            
            {/* Tombol Menu Popover */}
            <div className="relative">
              <button 
                className="tap glass-pill w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" 
                onClick={() => { setMenuOpen(!menuOpen); setSyncSubMenu(false); }}
              >
                <ChevronUp className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Menu */}
              {menuOpen && (
                <div className="absolute bottom-14 right-0 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-48 shadow-2xl animate-spring-up z-[90]">
                  {!syncSubMenu ? (
                    <div className="space-y-1">
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-xl tap" onClick={() => { setMenuOpen(false); setLyricsOpen(true); }}>
                        <Mic2 className="w-4 h-4" /> Lirik
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-xl tap" onClick={() => { const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1; setPlaybackRate(next); pushToast(`Kecepatan: ${next}x`); }}>
                        <Gauge className="w-4 h-4" /> Speed {playbackRate}x
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-xl tap" onClick={() => { toggleRadioMode(); pushToast(radioMode ? 'Radio Mati' : 'Radio Nyala'); }}>
                        <Radio className="w-4 h-4" /> Radio {radioMode ? 'On' : 'Off'}
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-xl tap" onClick={() => setSyncSubMenu(true)}>
                        <Cast className="w-4 h-4" /> Sync: {syncMode === 'host' ? 'Host' : syncMode === 'remote' ? 'Remote' : syncMode === 'speaker' ? 'Speaker' : 'Off'}
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-xl tap" onClick={() => { setMenuOpen(false); setGameOpen(true); }}>
                        <Gamepad2 className="w-4 h-4" /> Game
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-accent hover:bg-white/10 rounded-xl tap" onClick={() => { setMenuOpen(false); onFullscreen(); }}>
                        <Maximize2 className="w-4 h-4" /> Full Screen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button className="w-full flex items-center gap-2 px-2 py-1 text-xs text-white/50 hover:text-white" onClick={() => setSyncSubMenu(false)}>
                        <X className="w-3 h-3" /> Kembali
                      </button>
                      <button className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl tap ${syncMode === 'host' ? 'text-accent font-bold bg-white/10' : 'text-white hover:bg-white/10'}`} onClick={() => { setSyncMode('host'); setMenuOpen(false); }}>
                        <span>Host</span> {syncMode === 'host' && <span className="text-xs bg-accent text-black px-2 py-0.5 rounded-full">Aktif</span>}
                      </button>
                      <button className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl tap ${syncMode === 'remote' ? 'text-accent font-bold bg-white/10' : 'text-white hover:bg-white/10'}`} onClick={() => { setSyncMode('remote'); setMenuOpen(false); }}>
                        <span>Remote</span> {syncMode === 'remote' && <span className="text-xs bg-accent text-black px-2 py-0.5 rounded-full">Aktif</span>}
                      </button>
                      <button className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl tap ${syncMode === 'speaker' ? 'text-accent font-bold bg-white/10' : 'text-white hover:bg-white/10'}`} onClick={() => { setSyncMode('speaker'); setMenuOpen(false); }}>
                        <span>Speaker</span> {syncMode === 'speaker' && <span className="text-xs bg-accent text-black px-2 py-0.5 rounded-full">Aktif</span>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lirik & Game tetap pakai BottomSheet */}
      <BottomSheet open={lyricsOpen} onClose={() => setLyricsOpen(false)} title="Lirik Lagu">
        <LyricsView trackId={track.id} />
      </BottomSheet>
      {gameOpen && <GuessTheSong onClose={() => setGameOpen(false)} />}
    </>
  );
}