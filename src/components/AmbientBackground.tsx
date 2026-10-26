import { usePlayer } from '@/store/player';

export function AmbientBackground() {
  const cover = usePlayer((s) => s.ambientCover);
  const color = usePlayer((s) => s.ambientColor);

  const blob1 = color ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.55)` : 'rgba(48, 209, 88, 0.25)';
  const blob2 = color
    ? `rgba(${Math.min(255, color.r + 40)}, ${Math.min(255, color.g + 20)}, ${Math.max(0, color.b - 30)}, 0.4)`
    : 'rgba(60, 120, 255, 0.22)';
  const blob3 = color
    ? `rgba(${Math.max(0, color.r - 40)}, ${Math.max(0, color.g - 30)}, ${Math.min(255, color.b + 40)}, 0.35)`
    : 'rgba(180, 60, 200, 0.18)';

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0b0b0f] pointer-events-none">
      {cover ? (
        <img
          key={cover}
          src={cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover animate-fade-in"
          style={{ filter: 'blur(110px) saturate(1.4) brightness(0.7)', transform: 'scale(1.3)', opacity: 0.6 }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, rgba(48,209,88,0.18), transparent 50%), radial-gradient(circle at 70% 80%, rgba(60,120,255,0.18), transparent 50%)',
          }}
        />
      )}
      {/* moving color blobs */}
      <div
        className="absolute -top-32 -left-32 w-[60vw] h-[60vw] rounded-full blur-[100px]"
        style={{ background: blob1, animation: 'blob-float 18s ease-in-out infinite' }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[55vw] h-[55vw] rounded-full blur-[110px]"
        style={{ background: blob2, animation: 'blob-float 22s ease-in-out infinite reverse' }}
      />
      <div
        className="absolute -bottom-40 left-1/4 w-[50vw] h-[50vw] rounded-full blur-[100px]"
        style={{ background: blob3, animation: 'blob-float 25s ease-in-out infinite' }}
      />
      {/* darken base for readability */}
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
