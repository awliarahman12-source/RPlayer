import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Volume1, RotateCcw, RotateCw } from 'lucide-react';
import { usePlayer } from '@/store/player';
import { GlassButton } from './Glass';

export function PlayerControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const position = usePlayer((s) => s.position);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);

  const playSize = size === 'lg' ? 'xl' : 'lg';
  const skipSize = size === 'lg' ? 'md' : 'sm';

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      <GlassButton size="sm" variant="ghost" pill onClick={toggleShuffle} aria-label="Shuffle" className={shuffle ? '!text-accent' : ''}>
        <Shuffle className="w-[18px] h-[18px]" />
      </GlassButton>
      
      <GlassButton size={skipSize} variant="ghost" pill onClick={() => seek(Math.max(0, position - 5))} aria-label="Rewind 5s">
        <RotateCcw className="w-4 h-4" />
      </GlassButton>
      
      <GlassButton size={skipSize} variant="ghost" pill onClick={() => void prev()} aria-label="Previous">
        <SkipBack className="w-5 h-5 fill-white" />
      </GlassButton>

      <GlassButton size={playSize} variant="accent" pill specular onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="!bg-white !text-black shadow-lg">
        {isPlaying ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-0.5" />}
      </GlassButton>

      <GlassButton size={skipSize} variant="ghost" pill onClick={() => void next()} aria-label="Next">
        <SkipForward className="w-5 h-5 fill-white" />
      </GlassButton>

      <GlassButton size={skipSize} variant="ghost" pill onClick={() => seek(position + 5)} aria-label="Forward 5s">
        <RotateCw className="w-4 h-4" />
      </GlassButton>
      
      <GlassButton size="sm" variant="ghost" pill onClick={cycleRepeat} aria-label="Repeat" className={repeat !== 'off' ? '!text-accent' : ''}>
        {repeat === 'one' ? <Repeat1 className="w-[18px] h-[18px]" /> : <Repeat className="w-[18px] h-[18px]" />}
      </GlassButton>
    </div>
  );
}

export function VolumeControl({ className = '' }: { className?: string }) {
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button className="tap p-1 text-white/70 hover:text-white" onClick={() => setVolume(volume === 0 ? 0.8 : 0)}>
        <Icon className="w-5 h-5" />
      </button>
      <input type="range" className="glass-range w-24" style={{ background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.18) ${volume * 100}%)` }} min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
    </div>
  );
}