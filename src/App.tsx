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
import { getSettingsFromCloud, onSyncPlaybackChange } from '@/lib/firestore';
import { usePresence } from '@/store/presence';
import { useAuth } from '@/store/auth';
import { LoginPage } from '@/pages/Login';
import { PartyGuestPage } from '@/pages/PartyGuest';
import { SharedPlaylistPage } from '@/pages/SharedPlaylist';

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
        className="min-h-full"
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
  const [fullscreenOpen, setFullscreenOpen] = useState(false); // <-- State Fullscreen
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const handleClick = () => { if (navigator.vibrate) navigator.vibrate(10); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      usePlayer.getState()._attach(audioRef.current);
    }

    if (user) {
      void load().then(async () => {
        try {
          const settings = await getSettingsFromCloud(user);
          if (settings) await usePlayer.getState()._restore(settings);
        } catch (err) {
          console.error("Gagal restore settings:", err);
        }
      });
    }

    const unsub = user ? onSyncPlaybackChange(user, (state) => {
      usePlayer.getState()._handleRemoteSync(state);
    }) : () => {};

    const stopPresence = user ? usePresence.getState().startPresence() : () => {};

    return () => {
      usePlayer.getState()._detach();
      unsub();
      if (typeof stopPresence === 'function') stopPresence();
    };
  }, [user, load]);

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

  if (window.location.hash.startsWith('#/share/')) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/share/:username/:playlistId" element={<SharedPlaylistPage />} />
        </Routes>
      </HashRouter>
    );
  }

  if (window.location.hash.startsWith('#/party/')) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/party/:roomCode" element={<PartyGuestPage />} />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      {!user ? (
        <Routes><Route path="*" element={<LoginPage />} /></Routes>
      ) : (
        <>
          <AmbientBackground />
          <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
          <DynamicIsland />

          <div className="h-[100dvh] overflow-hidden flex transform-gpu">
            <div className="hidden lg:block w-[280px] shrink-0 p-3 pr-0 h-full"><Sidebar /></div>
            <main className="flex-1 min-w-0 flex h-full">
              <div 
                className="flex-1 min-w-0 lg:py-3 lg:pr-3 lg:pb-36 overflow-y-auto scroll-hidden transform-gpu" 
                style={{
                  paddingBottom: hasCurrent ? 'calc(env(safe-area-inset-bottom) + 260px)' : 'calc(env(safe-area-inset-bottom) + 140px)',
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

          {/* TAMBAHAN: Props onFullscreen ke PlayerBar */}
          <div className="hidden lg:block">
            <PlayerBar onExpand={() => setNowOpen(true)} onFullscreen={() => setFullscreenOpen(true)} />
          </div>
          
          <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} variant="mobile" />
          
          {/* TAMBAHAN: Render NowPlaying Fullscreen */}
          <NowPlaying open={fullscreenOpen} onClose={() => setFullscreenOpen(false)} variant="fullscreen" />
        </>
      )}
    </HashRouter>
  );
}
