import { useState } from 'react';
import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { Cover } from './Cover';
import { Slider } from './Slider';
import { PlayerControls, VolumeControl } from './PlayerControls';
import { Heart, ChevronUp, Mic2, ListMusic, Gauge, Radio, Gamepad2, Cast } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { LyricsView } from './LyricsView';
import { GuessTheSong } from './GuessTheSong';
import { usePresence } from '@/store/presence';

interface PlayerBarProps {
  onExpand: () => void;
}

export function PlayerBar({ onExpand }: PlayerBarProps) {
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

  const [controlsOpen, setControlsOpen] = useState(false);
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
          <div className="flex items-center gap-2 shrink-0">
            <VolumeControl />
            <button className="tap glass-pill w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" onClick={() => setControlsOpen(true)} aria-label="More controls">
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* BottomSheet buat Tombol Ekstra di Desktop */}
      <BottomSheet open={controlsOpen} onClose={() => setControlsOpen(false)} title="Kontrol Pemutar">
        <div className="grid grid-cols-2 gap-2 pb-6">
          <button className={`glass-pill p-3 flex flex-col items-center gap-2 tap ${lyricsOpen ? 'text-accent' : 'text-white'}`} onClick={() => { setControlsOpen(false); setLyricsOpen(true); }}>
            <Mic2 className="w-5 h-5" /> Lirik
          </button>
          <button className={`glass-pill p-3 flex flex-col items-center gap-2 tap ${playbackRate !== 1 ? 'text-accent' : 'text-white'}`} onClick={() => { const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1; setPlaybackRate(nextRate); pushToast(`Kecepatan: ${nextRate}x`); }}>
            <Gauge className="w-5 h-5" /> {playbackRate}x Speed
          </button>
          <button className={`glass-pill p-3 flex flex-col items-center gap-2 tap ${radioMode ? 'text-accent' : 'text-white'}`} onClick={() => { toggleRadioMode(); pushToast(radioMode ? 'Radio Mati' : 'Radio Nyala'); }}>
            <Radio className="w-5 h-5" /> Radio
          </button>
          <button className={`glass-pill p-3 flex flex-col items-center gap-2 tap ${syncMode ? 'text-accent bg-accent/10' : 'text-white'}`} onClick={() => { setControlsOpen(false); onExpand(); }}>
            <Cast className="w-5 h-5" /> Sync
          </button>
          <button className="glass-pill p-3 flex flex-col items-center gap-2 tap text-white" onClick={() => { setControlsOpen(false); setGameOpen(true); }}>
            <Gamepad2 className="w-5 h-5" /> Game
          </button>
        </div>
      </BottomSheet>

      {/* BottomSheet buat Lirik */}
      <BottomSheet open={lyricsOpen} onClose={() => setLyricsOpen(false)} title="Lirik Lagu">
        <LyricsView trackId={track.id} />
      </BottomSheet>

      {gameOpen && <GuessTheSong onClose={() => setGameOpen(false)} />}
    </>
  );
}
