import { useToast } from '@/store/toast';

export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 px-4 pb-safe"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 110px)' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass-pill-strong animate-spring-up px-4 py-2 text-sm text-white text-shadow-glass pointer-events-auto"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
