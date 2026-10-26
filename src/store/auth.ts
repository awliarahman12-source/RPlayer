import { create } from 'zustand';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AuthState {
  user: string | null;
  loading: boolean;
  login: (username: string, passcode: string) => Promise<{ success: boolean; message: string }>;
  register: (username: string, passcode: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: localStorage.getItem('current-user') || null,
  loading: false,

  login: async (username, passcode) => {
    set({ loading: true });
    try {
      const normalizedUser = username.toLowerCase().trim();
      const userDoc = await getDoc(doc(db, 'users', normalizedUser));
      
      set({ loading: false });
      if (!userDoc.exists()) {
        return { success: false, message: 'Username tidak ditemukan' };
      }

      if (userDoc.data().passcode !== passcode) {
        return { success: false, message: 'Passcode salah' };
      }

      localStorage.setItem('current-user', normalizedUser);
      set({ user: normalizedUser });
      return { success: true, message: 'Login berhasil' };
    } catch (error) {
      set({ loading: false });
      return { success: false, message: 'Koneksi ke Firebase gagal' };
    }
  },

  register: async (username, passcode) => {
    set({ loading: true });
    const normalizedUser = username.toLowerCase().trim();
    
    try {
      const userDoc = await getDoc(doc(db, 'users', normalizedUser));
      
      if (userDoc.exists()) {
        set({ loading: false });
        return { success: false, message: 'Username sudah dipakai' };
      }

      // Simpan ke Firestore
      await setDoc(doc(db, 'users', normalizedUser), {
        username: normalizedUser,
        passcode: passcode,
        createdAt: Date.now()
      });

      localStorage.setItem('current-user', normalizedUser);
      set({ user: normalizedUser, loading: false });
      return { success: true, message: 'Akun berhasil dibuat' };
    } catch (error) {
      set({ loading: false });
      return { success: false, message: 'Gagal membuat akun, cek internet' };
    }
  },

  logout: () => {
    localStorage.removeItem('current-user');
    set({ user: null });
  },
}));