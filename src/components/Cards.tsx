import type { Track } from '@/types';
import { Link } from 'react-router-dom';
import { usePlayer } from '@/store/player';
import { Cover } from './Cover';
import { Play, Pause } from 'lucide-react';

interface TrackCardProps {
  track: Track;
  contextIds?: string[];
}

export function TrackCard({ track, contextIds }: TrackCardProps) {
  const currentId = usePlayer((s) => s.currentTrack?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const playTrack = usePlayer((s) => s.playTrack);
  const togglePlay = usePlayer((s) => s.togglePlay);

  const isCurrent = currentId === track.id;

  return (
    <button
      className="glass rounded-2xl p-3 flex flex-col gap-2 tap text-left specular group relative w-full transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:-rotate-2 focus-visible:ring-2 focus-visible:ring-accent"
      onClick={() => (isCurrent ? togglePlay() : void playTrack(track.id, contextIds))}
    >
      <div className="relative">
        <Cover src={track.coverDataUrl} alt={track.title} className="w-full aspect-square rounded-xl" rounded="lg" />
        <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full glass-strong flex items-center justify-center transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isCurrent && isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </div>
      </div>
      <div className="min-w-0">
        <div className={`truncate text-sm font-semibold ${isCurrent ? 'text-accent' : ''}`}>{track.title}</div>
        <div className="truncate text-xs text-white/50">{track.artist}</div>
      </div>
    </button>
  );
}

export function PlaylistCard({ to, cover, name, subtitle }: { to: string; cover?: string; name: string; subtitle: string; }) {
  return (
    <Link to={to} className="glass rounded-2xl p-3 flex flex-col gap-2 tap specular group block transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:-rotate-2 focus-visible:ring-2 focus-visible:ring-accent">
      <Cover src={cover} alt={name} className="w-full aspect-square rounded-xl" rounded="lg" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="truncate text-xs text-white/50">{subtitle}</div>
      </div>
    </Link>
  );
}