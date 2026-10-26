import { useState, type ReactNode } from 'react';

interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
}

export function MenuButton({ items, children, align = 'right' }: { items: MenuItem[]; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        className="tap"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-2 z-50 glass-strong rounded-2xl py-1 min-w-[200px] animate-spring-up ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <div key={i}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left tap ${
                  item.danger ? 'text-red-400' : 'text-white/90 hover:text-white'
                }`}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
              {item.dividerAfter && <div className="h-px bg-white/10 my-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
