import { Play, Pause, Heart } from 'lucide-react';
import { usePlayer } from '@/store/player';
import { useLibrary } from '@/store/library';
import { Cover } from './Cover';

interface MiniPlayerProps {
  onExpand: () => void;
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const track = usePlayer((s) => s.currentTrack);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleLike = useLibrary((s) => s.toggleLike);

  if (!track) return null;

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div
      className="glass-pill-strong px-2.5 py-2 flex items-center gap-3 cursor-pointer tap"
      onClick={onExpand}
    >
      <Cover src={track.coverDataUrl} alt={track.title} className="w-10 h-10 rounded-full shrink-0" rounded="pill" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{track.title}</div>
        <div className="truncate text-xs text-white/50">{track.artist}</div>
        <div className="mt-1 h-0.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-white/70 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button
        className="tap p-2 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(track.id);
        }}
        aria-label="Like"
      >
        <Heart className={`w-5 h-5 ${track.liked ? 'fill-accent text-accent' : 'text-white/70'}`} />
      </button>
      <button
        className="glass-pill w-10 h-10 flex items-center justify-center shrink-0 tap"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
      </button>
    </div>
  );
}
