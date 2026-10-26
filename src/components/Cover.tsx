import { useMemo } from 'react';

interface CoverProps {
  src?: string;
  alt: string;
  className?: string;
  rounded?: 'md' | 'lg' | 'xl' | 'pill' | 'none';
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

const roundedMap = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-glass',
  pill: 'rounded-full',
  none: '',
};

export function Cover({ src, alt, className = '', rounded = 'lg', onTouchStart, onTouchEnd }: CoverProps) {
  const gradient = useMemo(() => {
    // deterministic gradient based on alt string
    let h = 0;
    for (let i = 0; i < alt.length; i++) h = (h * 31 + alt.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${h} 45% 32%), hsl(${(h + 60) % 360} 50% 22%))`;
  }, [alt]);

  const touchProps = onTouchStart || onTouchEnd ? { onTouchStart, onTouchEnd } : {};

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`object-cover ${roundedMap[rounded]} ${className}`}
        {...touchProps}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center ${roundedMap[rounded]} ${className}`}
      style={{ background: gradient }}
      aria-label={alt}
      {...touchProps}
    >
      <svg viewBox="0 0 24 24" className="w-1/3 h-1/3 text-white/70" fill="currentColor">
        <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
      </svg>
    </div>
  );
}
