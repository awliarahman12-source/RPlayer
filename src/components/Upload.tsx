import { useRef, useState, type DragEvent } from 'react';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { UploadCloud } from 'lucide-react';

interface DropzoneProps {
  className?: string;
  compact?: boolean;
  onUploaded?: () => void;
}

export function UploadButton({ className = '', onUploaded, playlistId }: { className?: string; onUploaded?: () => void; playlistId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = useLibrary((s) => s.addFiles);
  const importing = useLibrary((s) => s.importing);
  const pushToast = useToast((s) => s.push);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg,.opus"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (!files.length) return;
          // Kalau ada playlistId, lagu langsung masuk library DAN playlist itu
          const added = await addFiles(files, { playlistId });
          if (added.length) {
            pushToast(playlistId ? `${added.length} lagu ditambahkan ke playlist dan library` : `${added.length} lagu ditambahkan`);
          } else {
            pushToast('Tidak ada lagu yang berhasil diimpor');
          }
          onUploaded?.();
        }}
      />
      <button
        className={`glass-pill-strong px-4 py-2.5 text-sm font-semibold tap flex items-center gap-2 ${className}`}
        onClick={() => inputRef.current?.click()}
        disabled={importing}
      >
        <UploadCloud className="w-4 h-4" />
        {importing ? 'Mengimpor…' : 'Add songs'}
      </button>
    </>
  );
}

export function Dropzone({ className = '', compact = false, onUploaded }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const addFiles = useLibrary((s) => s.addFiles);
  const pushToast = useToast((s) => s.push);

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('audio') || /\.(mp3|m4a|wav|flac|ogg|opus)$/i.test(f.name));
    if (files.length) {
      await addFiles(files);
      pushToast(`${files.length} lagu ditambahkan`);
      onUploaded?.();
    }
  };

  if (compact) {
    return (
      <div
        className={`rounded-2xl border-2 border-dashed transition-colors ${
          dragOver ? 'border-accent bg-accent/10' : 'border-white/20'
        } ${className}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      />
    );
  }

  return (
    <div
      className={`glass rounded-glass p-10 flex flex-col items-center justify-center text-center border-2 border-dashed transition-colors ${
        dragOver ? 'border-accent bg-accent/10' : 'border-white/15'
      } ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center mb-4">
        <UploadCloud className="w-8 h-8 text-white/80" />
      </div>
      <h3 className="text-xl font-semibold mb-1">Tambahkan lagu pertamamu</h3>
      <p className="text-white/50 text-sm mb-5 max-w-xs">
        Tarik lepas file audio di sini, atau tekan tombol di bawah. Mendukung MP3, M4A, WAV, FLAC, OGG.
      </p>
      <UploadButton onUploaded={onUploaded} />
    </div>
  );
}
