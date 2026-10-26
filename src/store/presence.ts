import { create } from 'zustand';
import { doc, setDoc, onSnapshot, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ActiveDevice, SyncMode } from '@/types';
import { useAuth } from './auth';
import { usePlayer } from './player';
import { useNotification } from './notification';

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
        const activeDevices = snap.docs
          .map(d => d.data() as ActiveDevice)
          .filter(d => now - d.lastActive < 60000 || d.deviceId === myDeviceId);

        activeDevices.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        const currentHost = activeDevices.find(d => d.role === 'host');
        const currentRemote = activeDevices.find(d => d.role === 'remote');

        let myRole: SyncMode = 'speaker';

        // LOGIKA BARU: 
        // 1. Kalau nggak ada Host, jadi Host
        // 2. Kalau Host udah ada tapi Remote belum ada, jadi Remote
        // 3. Kalau dua-duanya udah ada, jadi Speaker
        if (!currentHost) {
          myRole = 'host';
        } else if (!currentRemote) {
          myRole = 'remote';
        } else {
          myRole = 'speaker';
        }

        await setDoc(deviceRef, {
          deviceId: myDeviceId,
          deviceType: isMobile ? 'mobile' : 'desktop',
          role: myRole,
          lastActive: Date.now(),
          joinedAt: Date.now(),
        });

        usePlayer.getState().setSyncMode(myRole);
        if (myRole === 'remote') usePlayer.getState()._forceSyncWithHost();
      } catch (err) {
        console.error("Gagal inisialisasi presence", err);
      }
    };

    void initDevice();

    const interval = setInterval(() => {
      void setDoc(deviceRef, { lastActive: Date.now() }, { merge: true });
    }, 15000);

    const unsub = onSnapshot(collection(db, 'users', user, 'active_devices'), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => d.data() as ActiveDevice)
        .filter(d => now - d.lastActive < 60000);
      
      const myDbDevice = active.find(d => d.deviceId === myDeviceId);

      if (myDbDevice) {
        const hasHost = active.some(d => d.role === 'host');
        const hasRemote = active.some(d => d.role === 'remote');

        if (!hasHost && active.length > 0) {
          // Kalau nggak ada Host, Remote naik jadi Host. Kalau nggak ada Remote, Speaker tertua naik jadi Host.
          const remote = active.find(d => d.role === 'remote');
          const oldestSpeaker = [...active].filter(d => d.role === 'speaker').sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];

          if (remote && remote.deviceId === myDeviceId) {
            void updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });
            usePlayer.getState().setSyncMode('host');
          } else if (!remote && oldestSpeaker && oldestSpeaker.deviceId === myDeviceId) {
            void updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });
            usePlayer.getState().setSyncMode('host');
          }
        } else if (!hasRemote && active.length > 1) {
          // Kalau nggak ada Remote, Speaker tertua naik jadi Remote
          const oldestSpeaker = [...active].filter(d => d.role === 'speaker').sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
          if (oldestSpeaker && oldestSpeaker.deviceId === myDeviceId) {
            void updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'remote' });
            usePlayer.getState().setSyncMode('remote');
            usePlayer.getState()._forceSyncWithHost();
          }
        }

        // Sinkronin state lokal kalau database bilang role kita beda
        if (myDbDevice.role !== usePlayer.getState().syncMode) {
          usePlayer.getState()._handleRoleChange(myDbDevice.role);
        }
      }

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

    const devices = get().devices;
    const myDevice = devices.find(d => d.deviceId === myDeviceId);
    if (!myDevice) return;

    if (newRole === 'host') {
      const currentHost = devices.find(d => d.role === 'host');
      const currentRemote = devices.find(d => d.role === 'remote');

      if (myDevice.role === 'remote') {
        // Tukar posisi Host <-> Remote
        if (currentHost) {
          await updateDoc(doc(db, 'users', user, 'active_devices', currentHost.deviceId), { role: 'remote' });
        }
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });
      } else if (myDevice.role === 'speaker') {
        if (currentHost && currentRemote) {
          useNotification.getState().show('Hanya Remote yang bisa menjadi Host', 'error');
          return;
        }
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });
      }
    } else if (newRole === 'remote') {
      if (myDevice.role === 'host') {
        const currentRemote = devices.find(d => d.role === 'remote');
        if (currentRemote) {
          await updateDoc(doc(db, 'users', user, 'active_devices', currentRemote.deviceId), { role: 'host' });
        }
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'remote' });
      } else if (myDevice.role === 'speaker') {
        const currentRemote = devices.find(d => d.role === 'remote');
        if (currentRemote) {
          useNotification.getState().show('Remote sudah ada', 'error');
          return;
        }
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'remote' });
      }
    } else if (newRole === 'speaker') {
      if (myDevice.role === 'host') {
        const currentRemote = devices.find(d => d.role === 'remote');
        if (currentRemote) {
          await updateDoc(doc(db, 'users', user, 'active_devices', currentRemote.deviceId), { role: 'host' });
        } else {
          useNotification.getState().show('Harus ada minimal 1 Host', 'error');
          return;
        }
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'speaker' });
      } else if (myDevice.role === 'remote') {
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'speaker' });
      }
    }
  }
}));
