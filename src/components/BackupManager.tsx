import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { Download, Upload } from 'lucide-react';
import { saveAs } from 'file-saver';

export function BackupManager() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const pushToast = useToast((s) => s.push);

  const handleExport = () => {
    const data = { tracks, playlists };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `liquid-music-backup-${new Date().toISOString().split('T')[0]}.json`);
    pushToast('Backup berhasil diunduh');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.playlists) {
          // Logic import ke IndexedDB
          pushToast('Fitur import sedang dalam pengembangan');
        }
      } catch {
        pushToast('File JSON tidak valid');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="glass rounded-glass p-4 space-y-2 mt-4">
      <h3 className="font-semibold text-white mb-2">Backup Data</h3>
      <button onClick={handleExport} className="w-full glass-pill py-2 text-sm tap text-white flex items-center justify-center gap-2">
        <Download className="w-4 h-4" /> Export JSON
      </button>
      <label className="w-full glass-pill py-2 text-sm tap text-white flex items-center justify-center gap-2 cursor-pointer">
        <Upload className="w-4 h-4" /> Import JSON
        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
      </label>
    </div>
  );
}