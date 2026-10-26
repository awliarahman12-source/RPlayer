import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div
        className="glass-strong rounded-t-[28px] pt-3 pb-safe px-3 animate-spring-up max-h-[80vh] overflow-y-auto scroll-hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1.5 rounded-full bg-white/30" />
        </div>
        {title && (
          <div className="text-center text-white/70 text-sm font-medium mb-2">{title}</div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
