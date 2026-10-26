import { useState } from 'react';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { Timer, Activity, Check } from 'lucide-react';
import { BackupManager } from '@/components/BackupManager';
import { BottomSheet } from '@/components/BottomSheet';
import { StorageManager } from '@/components/StorageManager';
import { Equalizer } from '@/components/Equalizer';

export function SettingsPage() {
  const sleepTimerEnd = usePlayer((s) => s.sleepTimerEnd);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const crossfade = usePlayer((s) => s.crossfade);
  const toggleCrossfade = usePlayer((s) => s.toggleCrossfade);
  const pushToast = useToast((s) => s.push);

  const [timerOpen, setTimerOpen] = useState(false);

  const formatTimeLeft = (end: number | null) => {
    if (!end) return 'Mati';
    const diff = Math.max(0, end - Date.now());
    const mins = Math.ceil(diff / 60000);
    return `${mins} menit lagi`;
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[800px] mx-auto">
      <h1 className="text-3xl lg:text-4xl font-bold text-shadow-glass mb-6">Settings</h1>

      <div className="glass rounded-glass p-2">
        {/* Item Timer */}
        <button 
          className="w-full flex items-center justify-between px-4 py-4 tap hover:bg-white/5 rounded-2xl transition-colors"
          onClick={() => setTimerOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-white">
              <Timer className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Sleep Timer</div>
              <div className={`text-xs ${sleepTimerEnd ? 'text-accent' : 'text-white/50'}`}>
                {formatTimeLeft(sleepTimerEnd)}
              </div>
            </div>
          </div>
        </button>

        {/* Item Crossfade */}
        <div className="h-px bg-white/10 mx-4" />
        <button 
          className="w-full flex items-center justify-between px-4 py-4 tap hover:bg-white/5 rounded-2xl transition-colors"
          onClick={() => {
            toggleCrossfade();
            pushToast(crossfade ? 'Crossfade Mati' : 'Crossfade Nyala');
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-white">
              <Activity className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Crossfade</div>
              <div className="text-xs text-white/50">Transisi lagu lebih halus</div>
            </div>
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${crossfade ? 'bg-accent text-black' : 'border border-white/30'}`}>
            {crossfade && <Check className="w-4 h-4" />}
          </div>
        </button>
      </div>

      <BackupManager />
      <StorageManager />
      <Equalizer />

      {/* Modal Timer */}
      <BottomSheet open={timerOpen} onClose={() => setTimerOpen(false)} title="Sleep Timer">
        <div className="space-y-1 pb-4">
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(15); pushToast('Timer disetel 15 menit'); setTimerOpen(false); }}>15 Menit</button>
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(30); pushToast('Timer disetel 30 menit'); setTimerOpen(false); }}>30 Menit</button>
          <button className="w-full text-left px-4 py-3 text-sm text-white tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(60); pushToast('Timer disetel 1 Jam'); setTimerOpen(false); }}>1 Jam</button>
          {sleepTimerEnd && (
            <button className="w-full text-left px-4 py-3 text-sm text-red-400 tap rounded-xl hover:bg-white/5" onClick={() => { setSleepTimer(null); pushToast('Timer dibatalkan'); setTimerOpen(false); }}>Batalkan Timer</button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}