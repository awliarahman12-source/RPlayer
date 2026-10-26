import { create } from 'zustand';
import { doc, setDoc, onSnapshot, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ActiveDevice, SyncMode } from '@/types';
import { useAuth } from './auth';
import { usePlayer } from './player';

interface PresenceState {
  devices: ActiveDevice[];
  deviceId: string;
  startPresence: () => (() => void) | void;
  updateMyRole: (role: SyncMode) => Promise<void>;
}

const myDeviceId = Math.random().toString(36).substring(7);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const usePresence = create<PresenceState>((set, get) => ({
  devices: [],
  deviceId: myDeviceId,

  startPresence: () => {
    const user = useAuth.getState().user;
    if (!user) return;

    const deviceRef = doc(db, 'users', user, 'active_devices', myDeviceId);
    
    const initDevice = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user, 'active_devices'));
        const now = Date.now();
        
        // Cari apakah ada device lain yang udah jadi Host DAN masih aktif (heartbeat < 1 menit)
        const activeHost = snap.docs
          .map(d => d.data() as ActiveDevice)
          .find(d => d.deviceId !== myDeviceId && d.role === 'host' && (now - d.lastActive < 60000));

        // Tentukan role otomatis
        const myRole: SyncMode = activeHost ? 'remote' : 'host';

        // Simpan ke database
        await setDoc(deviceRef, {
          deviceId: myDeviceId,
          deviceType: isMobile ? 'mobile' : 'desktop',
          role: myRole,
          lastActive: Date.now()
        });

        // Set ke state lokal (Zustand)
        usePlayer.setState({ syncMode: myRole });
        
        // Kalau jadi Remote, langsung minta sinkronisasi posisi terakhir dari Host
        if (myRole === 'remote') {
          usePlayer.getState()._forceSyncWithHost();
        }

      } catch (err) {
        console.error("Gagal inisialisasi presence", err);
      }
    };

    void initDevice();

    // Heartbeat setiap 15 detik biar dianggap masih aktif
    const interval = setInterval(() => {
      void setDoc(deviceRef, { lastActive: Date.now() }, { merge: true });
    }, 15000);

    // Listener buat mantau device lain & update UI
    const unsub = onSnapshot(collection(db, 'users', user, 'active_devices'), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => d.data() as ActiveDevice)
        .filter(d => now - d.lastActive < 60000);
      set({ devices: active });
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  },

  updateMyRole: async (newRole) => {
    const user = useAuth.getState().user;
    if (!user) return;
    
    // Kalau mau jadi Host, turunin Host lama jadi Remote
    if (newRole === 'host') {
      const oldHost = get().devices.find(d => d.role === 'host' && d.deviceId !== myDeviceId);
      if (oldHost) {
        await updateDoc(doc(db, 'users', user, 'active_devices', oldHost.deviceId), {
          role: 'remote'
        });
      }
    }

    // Update role device ini
    await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), {
      role: newRole,
      lastActive: Date.now()
    });
  }
}));