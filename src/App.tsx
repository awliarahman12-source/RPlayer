import { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AmbientBackground } from '@/components/AmbientBackground';
import { TabBar } from '@/components/TabBar';
import { Sidebar } from '@/components/Sidebar';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PlayerBar } from '@/components/PlayerBar';
import { NowPlaying } from '@/components/NowPlaying';
import { DynamicIsland } from '@/components/DynamicIsland';
import { HomePage } from '@/pages/Home';
import { SearchPage } from '@/pages/Search';
import { LibraryPage } from '@/pages/Library';
import { PlaylistDetailPage } from '@/pages/PlaylistDetail';
import { SettingsPage } from '@/pages/Settings';
import { ExplorePage } from '@/pages/Explore';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { getSettingsFromCloud } from '@/lib/firestore';
import { useAuth } from '@/store/auth';
import { LoginPage } from '@/pages/Login';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const load = useLibrary((s) => s.load);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [nowOpen, setNowOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const handleClick = () => { if (navigator.vibrate) navigator.vibrate(10); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    // Pasang audio element ke player DULU, biar lagu bisa muter
    if (audioRef.current) {
      usePlayer.getState()._attach(audioRef.current);
    }

    // Baru tarik data library & settingan
    void load().then(async () => {
      try {
        const settings = user ? await getSettingsFromCloud(user) : null;
        if (settings) await usePlayer.getState()._restore(settings);
      } catch (err) {
        console.error("Gagal narik settingan cloud:", err);
      }
    });

    return () => usePlayer.getState()._detach();
  }, [load, user]); // Tambahin user di dependency array

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const p = usePlayer.getState();
      if (e.code === 'Space') { e.preventDefault(); p.togglePlay(); }
      else if (e.code === 'KeyL') { e.preventDefault(); if (p.currentTrack) useLibrary.getState().toggleLike(p.currentTrack.id); }
      else if (e.code === 'KeyM') { e.preventDefault(); p.setVolume(p.volume === 0 ? 0.8 : 0); }
      else if (e.code === 'ArrowRight') { if (e.shiftKey) void p.next(); else p.seek((audioRef.current?.currentTime || 0) + 5); }
      else if (e.code === 'ArrowLeft') { if (e.shiftKey) void p.prev(); else p.seek(Math.max(0, (audioRef.current?.currentTime || 0) - 5)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasCurrent = usePlayer((s) => !!s.currentTrack);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white">Memuat...</div>;

  return (
    <HashRouter>
      {!user ? (
        <Routes><Route path="*" element={<LoginPage />} /></Routes>
      ) : (
        <>
          <AmbientBackground />
          {/* Pastikan crossOrigin tetap ada biar audio dari R2 bisa jalan */}
          <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
          <DynamicIsland />

          <div className="h-[100dvh] overflow-hidden flex transform-gpu">
            <div className="hidden lg:block w-[280px] shrink-0 p-3 pr-0 h-full"><Sidebar /></div>
            <main className="flex-1 min-w-0 flex h-full">
              <div 
                className="flex-1 min-w-0 lg:py-3 lg:pr-3 lg:pb-36 overflow-y-auto scroll-hidden transform-gpu" 
                style={{
                  paddingBottom: hasCurrent ? 'calc(env(safe-area-inset-bottom) + 220px)' : 'calc(env(safe-area-inset-bottom) + 120px)',
                }}
              >
                <AnimatedRoutes />
              </div>
              <div className="hidden lg:block w-[340px] shrink-0 p-3 pl-0 h-full">
                <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} variant="desktop" />
              </div>
            </main>
          </div>

          <div className="lg:hidden fixed inset-x-0 bottom-0 z-[80] flex flex-col gap-2 px-3 pointer-events-none" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
            {hasCurrent && <div className="pointer-events-auto w-full shadow-lg"><MiniPlayer onExpand={() => setNowOpen(true)} /></div>}
            <div className="pointer-events-auto w-full"><TabBar /></div>
          </div>

          <div className="hidden lg:block"><PlayerBar onExpand={() => setNowOpen(true)} /></div>
          <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} variant="mobile" />
        </>
      )}
    </HashRouter>
  );
}
