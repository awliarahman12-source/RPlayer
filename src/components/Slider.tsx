import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/format';

interface SliderProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  className?: string;
  accentColor?: string;
}

export function Slider({ value, max, onChange, onCommit, className = '', accentColor = '#fff' }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    if (!dragging) setLocalVal(value);
  }, [value, dragging]);

  // Pastikan nilai aman (bukan NaN/Infinity)
  const safeMax = isFinite(max) && max > 0 ? max : 1;
  const safeVal = isFinite(localVal) && localVal > 0 ? localVal : 0;
  const pct = Math.min(100, Math.max(0, (safeVal / safeMax) * 100));

  const handleInteraction = (clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newVal = (x / rect.width) * safeMax;
    setLocalVal(newVal);
    onChange(newVal);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs tabular-nums text-white/50 w-10 text-right hidden sm:block">
        {formatTime(localVal)}
      </span>
      
      {/* Slider Baru (Custom Div) */}
      <div
        ref={ref}
        className="relative flex-1 h-6 flex items-center cursor-pointer touch-none"
        onPointerDown={(e) => {
          setDragging(true);
          handleInteraction(e.clientX);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragging) handleInteraction(e.clientX);
        }}
        onPointerUp={() => {
          setDragging(false);
          onCommit?.(localVal);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        {/* Garis Background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20" />
        
        {/* Garis Progress (Putih) */}
        <div
          className="absolute left-0 h-1.5 rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, background: accentColor }}
        />

        {/* Bola (Thumb) */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md transition-transform duration-100"
          style={{ 
            left: `${pct}%`, 
            transform: `translateX(-50%) scale(${dragging ? 1.3 : 1})` 
          }}
        />
      </div>

      <span className="text-xs tabular-nums text-white/50 w-10 hidden sm:block">
        {formatTime(safeMax)}
      </span>
    </div>
  );
}