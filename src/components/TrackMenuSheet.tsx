import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ListPlus, Plus, Trash2, PlayCircle, Pencil, Download, CheckCircle2, ChevronLeft } from 'lucide-react';
import type { Track } from '@/types';
import { BottomSheet } from './BottomSheet';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';
import { Cover } from './Cover';
import { EditTrackModal } from './EditTrackModal';

interface Props {
  open: boolean;
  onClose: () => void;
  track: Track;
  onToast?: (msg: string) => void;
  /** Kalau diisi (dan layar desktop), menu muncul sebagai dropdown yang menempel di elemen ini (tombol titik tiga). */
  anchorRef?: RefObject<HTMLElement | null>;
}

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/** Dropdown kecil yang menempel di anchor, otomatis flip ke atas kalau ruang bawah kurang. */
function Popover({ open, onClose, anchorRef, children }: { open: boolean; onClose: () => void; anchorRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const el = ref.current;
      const anchor = anchorRef.current;
      if (!el || !anchor) return;
      const r = anchor.getBoundingClientRect();
      const mw = el.offsetWidth;
      const mh = el.offsetHeight;
      const margin = 10;
      let left = r.right - mw; // sisi kanan menu sejajar sisi kanan tombol
      left = Math.max(margin, Math.min(left, window.innerWidth - mw - margin));
      let top = r.bottom + 8;
      let origin = 'top right';
      if (top + mh > window.innerHeight - margin) {
        const up = r.top - mh - 8;
        if (up >= margin) { top = up; origin = 'bottom right'; }
        else top = Math.max(margin, window.innerHeight - mh - margin);
      }
      setPos({ left, top, origin });
    };
    place();
    const ro = new ResizeObserver(place); // tinggi menu berubah saat pindah ke daftar playlist
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', place);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div
            key="backdrop"
            className="fixed inset-0 z-[300]"
            onMouseDown={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
          />
          <motion.div
            key="menu"
            ref={ref}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: pos ? 1 : 0, scale: pos ? 1 : 0.92, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
            className="fixed z-[301] w-[280px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, transformOrigin: pos?.origin ?? 'top right', maxHeight: 'calc(100vh - 20px)' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function TrackMenuSheet({ open, onClose, track, onToast, anchorRef }: Props) {
  const toggleLike = useLibrary((s) => s.toggleLike);
  const importExternalTrack = useLibrary((s) => s.importExternalTrack);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const addToPlaylist = useLibrary((s) => s.addToPlaylist);
  const removeTrack = useLibrary((s) => s.removeTrack);
  const downloadTrack = useLibrary((s) => s.downloadTrack);
  const playNext = usePlayer((s) => s.playNext);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const pushToast = useToast((s) => s.push);
  const toast = onToast || pushToast;
  const isDesktop = useIsDesktop();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Reset picker setiap menu ditutup
  useEffect(() => { if (!open) setPickerOpen(false); }, [open]);

  const usePopover = isDesktop && !!anchorRef?.current;

  const header = (
    <div className={`flex items-center gap-3 ${usePopover ? 'px-2.5 py-2' : 'px-3 py-2 mb-1'}`}>
      <Cover src={track.coverDataUrl} alt={track.title} className={usePopover ? 'w-11 h-11 shrink-0' : 'w-14 h-14'} rounded="md" />
      <div className="min-w-0">
        <div className="truncate font-semibold text-sm">{track.title}</div>
        <div className="truncate text-xs text-white/50">{track.artist}</div>
      </div>
    </div>
  );

  const divider = <div className="h-px bg-white/10 my-1.5" />;

  let body: ReactNode;
  if (track.isExternal) {
    body = (
      <>
        {header}
        {divider}
        <div className="space-y-0.5">
          <MenuItem compact={usePopover} icon={<Plus className="w-[18px] h-[18px]" />} label="Simpan ke Library" onClick={async () => { await importExternalTrack(track); toast('Lagu berhasil disimpan ke Library'); onClose(); }} />
        </div>
      </>
    );
  } else if (!pickerOpen) {
    body = (
      <>
        {header}
        {divider}
        <div className="space-y-0.5">
          <MenuItem compact={usePopover} icon={<PlayCircle className="w-[18px] h-[18px]" />} label="Putar berikutnya" onClick={() => { playNext(track.id); toast('Ditambahkan ke urutan berikutnya'); onClose(); }} />
          <MenuItem compact={usePopover} icon={<ListPlus className="w-[18px] h-[18px]" />} label="Tambahkan ke antrian" onClick={() => { addToQueue(track.id); toast('Ditambahkan ke antrian'); onClose(); }} />
          <MenuItem compact={usePopover} icon={<Heart className={`w-[18px] h-[18px] ${track.liked ? 'fill-accent text-accent' : ''}`} />} label={track.liked ? 'Hapus dari Liked Songs' : 'Tambahkan ke Liked Songs'} onClick={() => { void toggleLike(track.id); toast(track.liked ? 'Dihapus dari Liked' : 'Ditambahkan ke Liked'); onClose(); }} />
          <MenuItem compact={usePopover} icon={<Plus className="w-[18px] h-[18px]" />} label="Tambahkan ke playlist" onClick={() => setPickerOpen(true)} />
          <MenuItem compact={usePopover} icon={<Pencil className="w-[18px] h-[18px]" />} label="Edit Info" onClick={() => { onClose(); setEditOpen(true); }} />
          {!track.isDownloaded ? (
            <MenuItem compact={usePopover} icon={<Download className="w-[18px] h-[18px]" />} label="Download untuk Offline" onClick={() => { void downloadTrack(track.id); toast('Memulai download...'); onClose(); }} />
          ) : (
            <div className="px-3 py-2.5 text-sm text-green-400 flex items-center gap-3">
              <CheckCircle2 className="w-[18px] h-[18px]" /> Tersedia Offline
            </div>
          )}
          {divider}
          <MenuItem compact={usePopover} icon={<Trash2 className="w-[18px] h-[18px]" />} label="Hapus lagu" danger onClick={() => { void removeTrack(track.id); toast('Lagu dihapus'); onClose(); }} />
        </div>
      </>
    );
  } else {
    body = (
      <div className="space-y-0.5">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white tap rounded-xl hover:bg-white/10" onClick={() => setPickerOpen(false)}>
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>
        {divider}
        <MenuItem compact={usePopover} icon={<Plus className="w-[18px] h-[18px]" />} label="Playlist baru" onClick={async () => { const p = await createPlaylist('Playlist Baru'); await addToPlaylist(p.id, track.id); toast('Ditambahkan ke playlist baru'); onClose(); }} />
        {playlists.length > 0 && <div className="px-3 pt-2 pb-1 text-[11px] text-white/40 uppercase tracking-wide">Playlist</div>}
        <div className="max-h-60 overflow-y-auto scroll-hidden">
          {playlists.map((p) => (
            <button key={p.id} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 tap rounded-xl hover:bg-white/10 text-left" onClick={() => { void addToPlaylist(p.id, track.id); toast(`Ditambahkan ke ${p.name}`); onClose(); }}>
              <Cover src={p.coverDataUrl} alt={p.name} className="w-9 h-9 shrink-0" rounded="md" />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto text-xs text-white/40">{p.trackIds.length}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {usePopover ? (
        <Popover open={open} onClose={onClose} anchorRef={anchorRef!}>{body}</Popover>
      ) : (
        <BottomSheet open={open} onClose={onClose}>{body}</BottomSheet>
      )}
      {editOpen && <EditTrackModal track={track} onClose={() => setEditOpen(false)} />}
    </>
  );
}

function MenuItem({ icon, label, onClick, danger, compact }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; compact?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-3 text-sm tap rounded-xl hover:bg-white/10 ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/90'}`}
      onClick={onClick}
    >
      {icon}<span>{label}</span>
    </button>
  );
}
