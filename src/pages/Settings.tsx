import { useState, useEffect } from 'react';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { Timer, Activity, Check, Sliders } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { BackupManager } from '@/components/BackupManager';
import { StorageManager } from '@/components/storageManager';
import { Equalizer } from '@/components/Equalizer';
import { useAuth } from '@/store/auth';
import { LogOut } from 'lucide-react';

export function SettingsPage() {
  const sleepTimerEnd = usePlayer((s) => s.sleepTimerEnd);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const crossfade = usePlayer((s) => s.crossfade);
  const toggleCrossfade = usePlayer((s) => s.toggleCrossfade);
  const pushToast = useToast((s) => s.push);
  const logout = useAuth((s) => s.logout);

  const [timerOpen, setTimerOpen] = useState(false);
  const [blurLevel, setBlurLevel] = useState(() => Number(localStorage.getItem('glass-blur') || 24));

  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', `${blurLevel}px`);
    localStorage.setItem('glass-blur', blurLevel.toString());
  }, [blurLevel]);

  const formatTimeLeft = (end: number | null) => {
    if (!end) return 'Mati';
    const diff = Math.max(0, end - Date.now());
    return `${Math.ceil(diff / 60000)} menit lagi`;
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[800px] mx-auto">
      <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass mb-6">Settings</h1>

      <div className="glass rounded-glass p-2">
        <button className="w-full flex items-center justify-between px-4 py-4 tap hover:bg-white/5 rounded-2xl transition-colors" onClick={() => setTimerOpen(true)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"><Timer className="w-5 h-5" /></div>
            <div className="text-left"><div className="font-semibold text-white">Sleep Timer</div><div className={`text-xs ${sleepTimerEnd ? 'text-accent' : 'text-white/50'}`}>{formatTimeLeft(sleepTimerEnd)}</div></div>
          </div>
        </button>

        <div className="h-px bg-white/10 mx-4" />
        <button className="w-full flex items-center justify-between px-4 py-4 tap hover:bg-white/5 rounded-2xl transition-colors" onClick={() => { toggleCrossfade(); pushToast(crossfade ? 'Crossfade Mati' : 'Crossfade Nyala'); }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"><Activity className="w-5 h-5" /></div>
            <div className="text-left"><div className="font-semibold text-white">Crossfade</div><div className="text-xs text-white/50">Transisi lagu lebih halus</div></div>
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${crossfade ? 'bg-accent text-black' : 'border border-white/30'}`}>{crossfade && <Check className="w-4 h-4" />}</div>
        </button>

        <div className="h-px bg-white/10 mx-4" />
        <div className="w-full flex flex-col px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"><Sliders className="w-5 h-5" /></div>
            <div className="text-left"><div className="font-semibold text-white">Glass Blur Intensity</div><div className="text-xs text-white/50">Atur ketebalan efek kaca</div></div>
          </div>
          <input type="range" min="0" max="40" value={blurLevel} onChange={(e) => setBlurLevel(Number(e.target.value))} className="w-full accent-accent" />
        </div>
      </div>

      <Equalizer />
      <BackupManager />
      <StorageManager />

      <button 
        onClick={logout} 
        className="w-full glass-pill py-3 text-sm tap text-red-400 flex items-center justify-center gap-2 mt-6"
      >
        <LogOut className="w-4 h-4" /> Logout
      </button>

      <BottomSheet open={timerOpen} onClose={() => setTimerOpen(false)} title="Sleep Timer">
        <div className="space-y-1 pb-4">
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(15); pushToast('Timer disetel 15 menit'); setTimerOpen(false); }}>15 Menit</button>
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(30); pushToast('Timer disetel 30 menit'); setTimerOpen(false); }}>30 Menit</button>
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(60); pushToast('Timer disetel 1 Jam'); setTimerOpen(false); }}>1 Jam</button>
          {sleepTimerEnd && <button className="w-full text-left px-4 py-3 text-sm text-red-400 tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(null); pushToast('Timer dibatalkan'); setTimerOpen(false); }}>Batalkan Timer</button>}
        </div>
      </BottomSheet>
    </div>
  );
}