import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Plus, Heart, ListMusic, Trash2 } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { useToast } from '@/store/toast';
import { UploadButton } from './Upload';
import { Cover } from './Cover';
import { useState } from 'react';

export function Sidebar() {
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const removePlaylist = useLibrary((s) => s.removePlaylist);
  const pushToast = useToast((s) => s.push);
  const [, setCreating] = useState<string | null>(null);

  return (
    <aside className="hidden lg:flex flex-col gap-3 h-full p-3">
      <div className="glass rounded-glass p-4">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-2 px-2">Menu</div>
        <nav className="flex flex-col gap-1">
          <NavItem to="/" icon={<Home className="w-5 h-5" />} label="Home" end />
          <NavItem to="/search" icon={<Search className="w-5 h-5" />} label="Search" />
          <NavItem to="/library" icon={<Library className="w-5 h-5" />} label="Library" />
        </nav>
      </div>

      <div className="glass rounded-glass p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="text-xs uppercase tracking-wider text-white/40">Playlist</div>
          <button
            className="tap p-1 text-white/60 hover:text-white"
            aria-label="Playlist baru"
            onClick={async () => {
              const p = await createPlaylist('Playlist Baru');
              pushToast('Playlist dibuat');
              setCreating(p.id);
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <NavLink
          to="/playlist/liked"
          className="flex items-center gap-3 px-2 py-2 rounded-xl tap hover:bg-white/5"
        >
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-accent/80 to-emerald-700 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="text-sm font-medium">Liked Songs</span>
        </NavLink>

        <div className="flex-1 overflow-y-auto scroll-hidden mt-1">
          {playlists.map((p) => (
            <div key={p.id} className="group flex items-center">
              <NavLink
                to={`/playlist/${p.id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-xl tap hover:bg-white/5 flex-1 min-w-0"
              >
                <Cover src={p.coverDataUrl} alt={p.name} className="w-9 h-9 shrink-0" rounded="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-white/40">{p.trackIds.length} lagu</div>
                </div>
              </NavLink>
              <button
                className="opacity-0 group-hover:opacity-100 tap p-2 text-white/40 hover:text-red-400"
                onClick={() => {
                  if (confirm(`Hapus playlist "${p.name}"?`)) {
                    void removePlaylist(p.id);
                    pushToast('Playlist dihapus');
                  }
                }}
                aria-label="Hapus playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {playlists.length === 0 && (
            <div className="text-center text-white/30 text-xs py-6">
              <ListMusic className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Belum ada playlist
            </div>
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-white/10">
          <UploadButton className="w-full justify-center" />
        </div>
      </div>
    </aside>
  );
}

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl tap ${
          isActive ? 'glass-pill text-white' : 'text-white/70 hover:bg-white/5'
        }`
      }
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </NavLink>
  );
}
