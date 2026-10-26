import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { Cover } from './Cover';
import { Slider } from './Slider';
import { PlayerControls, VolumeControl } from './PlayerControls';
import { Heart, ChevronUp } from 'lucide-react';

interface PlayerBarProps {
  onExpand: () => void;
}

export function PlayerBar({ onExpand }: PlayerBarProps) {
  const track = usePlayer((s) => s.currentTrack);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const toggleLike = useLibrary((s) => s.toggleLike);

  if (!track) return null;

  return (
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
          <button className="tap glass-pill w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" onClick={onExpand} aria-label="Now playing">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
