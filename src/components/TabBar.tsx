import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Library, Compass, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/radio', label: 'Radio', icon: Radio },
  { to: '/library', label: 'Library', icon: Library },
];

export function TabBar() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeIdx = tabs.findIndex((t) =>
      t.end ? location.pathname === t.to : location.pathname.startsWith(t.to),
    );
    if (activeIdx === -1 || !containerRef.current) return;
    const children = containerRef.current.children;
    const el = children[activeIdx] as HTMLElement;
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [location.pathname]);

  return (
    <div className="w-full">
      <nav className="glass-pill-strong relative flex items-center justify-around px-2 py-1.5">
        {/* sliding indicator */}
        <div
          className="absolute top-1.5 bottom-1.5 glass-strong rounded-full transition-all duration-300 spring"
          style={{ left: indicator.left, width: indicator.width, opacity: 0.7 }}
        />
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="relative z-10 flex flex-col items-center gap-0.5 px-5 py-1.5 text-white/60 tap"
              style={({ isActive }) => ({ color: isActive ? '#fff' : undefined })}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
