import { useState } from 'react';
import { useParty } from '@/store/party';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { Play, X, Users, Music } from 'lucide-react';
import { Cover } from './Cover';

export function PartyHostPanel({ onClose }: { onClose: () => void }) {
  const { room, endParty, removeFromQueue } = useParty();
  const tracks = useLibrary((s) => s.tracks);
  const playTrack = usePlayer((s) => s.playTrack);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-accent"/> Party Mode</h2>
          <button onClick={onClose} className="tap p-1 text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-sm text-white/60 mb-1">Kode Room:</p>
          <p className="text-3xl font-mono text-accent font-bold tracking-wider">{room.roomCode}</p>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#/party/${room.roomCode}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="mt-2 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full tap transition-colors">{copied ? 'Link Copied!' : 'Copy Link Invite'}</button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-hidden space-y-2">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2"><Music className="w-4 h-4"/> Antrian Request ({room.queue.length})</h3>
          {room.queue.length === 0 ? <div className="text-center text-white/40 py-8"><Music className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Belum ada request.</p></div> : (
            room.queue.map((q, i) => {
              const track = tracks.find(t => t.id === q.trackId);
              if (!track) return null;
              return (
                <div key={i} className="glass rounded-xl p-2 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Cover src={track.coverDataUrl} alt={track.title} className="w-10 h-10 rounded-md shrink-0" rounded="md" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{track.title}</div>
                      <div className="text-xs text-accent truncate flex items-center gap-2">
                        <span>Req: {q.requestedBy}</span>
                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white/70">
                          {q.votes || 0} Votes
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={async () => { await playTrack(track.id); await removeFromQueue(i); }} className="bg-white text-black p-2 rounded-full tap shrink-0"><Play className="w-4 h-4 fill-black" /></button>
                    <button onClick={() => removeFromQueue(i)} className="p-2 text-red-400 hover:text-red-300 tap shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button onClick={async () => { await endParty(); onClose(); }} className="w-full glass-pill py-2.5 text-sm tap text-red-400 font-semibold">Akhiri Party</button>
      </div>
    </div>
  );
}