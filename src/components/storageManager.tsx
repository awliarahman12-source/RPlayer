import { useEffect, useState } from 'react';
import { useToast } from '@/store/toast';
import { HardDrive, Trash2 } from 'lucide-react';
import { clearAllData } from '@/lib/db';

export function StorageManager() {
  const [usage, setUsage] = useState<number>(0);
  const pushToast = useToast((s) => s.push);

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setUsage((estimate.usage || 0) / (1024 * 1024)); // MB
      });
    }
  }, []);

  const handleClear = async () => {
    if (confirm('Yakin hapus semua data? Lagu, playlist, dan history bakal hilang permanen.')) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="glass rounded-glass p-4 space-y-2 mt-4">
      <h3 className="font-semibold text-white mb-2">Storage</h3>
      <div className="flex items-center justify-between text-sm text-white/70">
        <span className="flex items-center gap-2"><HardDrive className="w-4 h-4" /> Terpakai</span>
        <span>{usage.toFixed(2)} MB</span>
      </div>
      <button onClick={handleClear} className="w-full glass-pill py-2 text-sm tap text-red-400 flex items-center justify-center gap-2 mt-2">
        <Trash2 className="w-4 h-4" /> Hapus Semua Data
      </button>
    </div>
  );
}