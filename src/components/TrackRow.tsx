import { useState, useRef } from 'react';
import { MoreHorizontal, Play, Pause, Plus } from 'lucide-react';
import type { Track } from '@/types';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { Cover } from './Cover';
import { TrackMenuSheet } from './TrackMenuSheet';

interface TrackRowProps {
  track: Track;
  index?: number;
  contextIds?: string[];
  onPlay?: () => void;
  showAlbum?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function TrackRow({ track, index, contextIds, onPlay, showAlbum, isSelected, onSelect }: TrackRowProps) {
  const currentId = usePlayer((s) => s.currentTrack?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const playTrack = usePlayer((s) => s.playTrack);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const pushToast = useToast((s) => s.push);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCurrent = currentId === track.id;

  const handlePlay = () => {
    if (onPlay) onPlay();
    else if (isCurrent) togglePlay();
    else void playTrack(track.id, contextIds);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 600ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <>
      <div
        className={`group flex items-center gap-3 px-3 py-2 rounded-2xl tap cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent ${
          isCurrent ? 'bg-white/10' : isSelected ? 'bg-accent/20' : 'hover:bg-white/5 hover:scale-[1.01] hover:shadow-lg'
        }`}
        onClick={handlePlay}
        onDoubleClick={handlePlay}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePlay(); } }}
      >
        <div className="w-6 flex items-center justify-center shrink-0">
          {onSelect ? (
            <input type="checkbox" checked={isSelected} onChange={() => onSelect(track.id)} className="accent-[#30D158] w-4 h-4 cursor-pointer" onClick={(e) => e.stopPropagation()} />
          ) : isCurrent && isPlaying ? (
            <EqualizerIcon />
          ) : (
            <span className={`text-sm text-white/40 ${isCurrent ? 'text-accent' : ''}`}>{index !== undefined ? index + 1 : ''}</span>
          )}
        </div>
        <Cover src={track.coverDataUrl} alt={track.title} className="w-11 h-11 shrink-0" rounded="md" />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-medium ${isCurrent ? 'text-accent' : 'text-white'}`}>{track.title}</div>
          <div className="truncate text-[13px] text-white/50">{track.artist}</div>
        </div>
        {showAlbum && <div className="hidden sm:block truncate text-[13px] text-white/40 flex-1 min-w-0 max-w-[180px]">{track.album || '—'}</div>}
        <div className="flex items-center gap-1">
          <button className="opacity-0 group-hover:opacity-100 tap p-2 text-white/60 hover:text-white transition-opacity" onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }} aria-label="Quick Add"><Plus className="w-4 h-4" /></button>
          <button className="opacity-60 hover:opacity-100 tap p-2 -mr-1" onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }} aria-label="Menu"><MoreHorizontal className="w-5 h-5" /></button>
        </div>
      </div>
      <TrackMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} track={track} onToast={pushToast} />
    </>
  );
}

function EqualizerIcon() {
  return (
    <div className="flex items-end justify-center gap-0.5 h-4">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-0.5 bg-accent rounded-full" style={{ height: '100%', animation: `eq-bar 0.9s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes eq-bar {0%,100%{height:30%}50%{height:100%}}`}</style>
    </div>
  );
}