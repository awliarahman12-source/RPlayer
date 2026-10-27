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

        // --- LOGIKA AUTO ASSIGN ---
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

    // Listener buat mantau device lain & auto-promote
    const unsub = onSnapshot(collection(db, 'users', user, 'active_devices'), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => d.data() as ActiveDevice)
        .filter(d => now - d.lastActive < 60000);
      
      const myDbDevice = active.find(d => d.deviceId === myDeviceId);

      if (myDbDevice) {
        // --- LOGIKA AUTO-PROMOTE ---
        const hasHost = active.some(d => d.role === 'host');
        const hasRemote = active.some(d => d.role === 'remote');

        if (!hasHost && active.length > 0) {
          // Host mati, cari Remote atau Speaker tertua buat naik
          const remote = active.find(d => d.role === 'remote');
          const oldestSpeaker = [...active].filter(d => d.role === 'speaker').sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];

          const candidate = remote || oldestSpeaker;
          if (candidate && candidate.deviceId === myDeviceId) {
            void updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });
            usePlayer.getState().setSyncMode('host');
          }
        } else if (!hasRemote && active.length > 1) {
          // Remote mati, cari Speaker tertua buat naik
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
      // Siapapun bisa jadi Host. Host lama turun jadi Remote (kalo remote ada, jadi Speaker)
      const currentHost = devices.find(d => d.role === 'host');
      const currentRemote = devices.find(d => d.role === 'remote');

      if (currentHost && currentHost.deviceId !== myDeviceId) {
        // Host lama turun jadi Speaker (biar aman)
        await updateDoc(doc(db, 'users', user, 'active_devices', currentHost.deviceId), { role: 'speaker' });
      }

      // Kalau aku dulu Speaker dan Remote masih ada, jadikan aku Host, Remote tetep
      await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'host' });

    } else if (newRole === 'remote') {
      // Cuma boleh 1 Remote. Kalau ada Remote lama, dia jadi Host (tukar posisi)
      const currentRemote = devices.find(d => d.role === 'remote');
      const currentHost = devices.find(d => d.role === 'host');

      if (currentRemote && currentRemote.deviceId !== myDeviceId) {
        // Remote lama naik jadi Host, aku jadi Remote
        await updateDoc(doc(db, 'users', user, 'active_devices', currentRemote.deviceId), { role: 'host' });
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'remote' });
      } else {
        // Kalau belum ada remote, Host turun jadi speaker dan aku jadi Remote?
        // Lebih aman: Host tetep, aku jadi Remote
        await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'remote' });
        if (currentHost && currentHost.deviceId === myDeviceId) {
          // Kalau aku tadinya Host, aku turun jadi Remote, Host lama kosong? Harusnya ada Host lain
          // Kalau nggak ada, otomatis nanti ada yang naik
        }
      }
    } else if (newRole === 'speaker') {
      await updateDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { role: 'speaker' });
      // Host tetep, Remote tetep
    }
  }
}));