import { create } from 'zustand';
import { doc, setDoc, onSnapshot, collection, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ActiveDevice } from '@/types';
import { useAuth } from './auth';

interface PresenceState {
  devices: ActiveDevice[];
  deviceId: string;
  startPresence: () => void;
  stopPresence: () => void;
}

const myDeviceId = Math.random().toString(36).substring(7);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const usePresence = create<PresenceState>((set, get) => ({
  devices: [],
  deviceId: myDeviceId,

  startPresence: () => {
    const user = useAuth.getState().user;
    if (!user) return;

    // 1. Daftarin device ini ke Firestore
    const deviceRef = doc(db, 'users', user, 'active_devices', myDeviceId);
    const updatePresence = () => {
      void setDoc(deviceRef, {
        deviceId: myDeviceId,
        deviceType: isMobile ? 'mobile' : 'desktop',
        lastActive: Date.now()
      });
    };
    
    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Update tiap 30 detik

    // 2. Dengerin device lain
    const unsub = onSnapshot(collection(db, 'users', user, 'active_devices'), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => d.data() as ActiveDevice)
        .filter(d => now - d.lastActive < 60000); // Anggap aktif kalau update < 1 menit lalu
      set({ devices: active });
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  },

  stopPresence: () => {
    const user = useAuth.getState().user;
    if (!user) return;
    void setDoc(doc(db, 'users', user, 'active_devices', myDeviceId), { lastActive: 0 }, { merge: true });
  }
}));