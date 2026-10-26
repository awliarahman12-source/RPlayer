import { create } from 'zustand';

interface NotificationState {
  isVisible: boolean;
  type: 'success' | 'error' | 'info' | 'upload' | null;
  message: string;
  progress: number;
  filename: string;
  
  show: (message: string, type?: 'success' | 'error' | 'info') => void;
  startUpload: (filename: string) => void;
  updateProgress: (progress: number) => void;
  endUpload: (success: boolean) => void;
  hide: () => void;
}

let hideTimeout: ReturnType<typeof setTimeout>;

export const useNotification = create<NotificationState>((set) => ({
  isVisible: false,
  type: null,
  message: '',
  progress: 0,
  filename: '',

  show: (message, type = 'info') => {
    if (hideTimeout) clearTimeout(hideTimeout);
    set({ isVisible: true, type, message, progress: 0 });
    hideTimeout = setTimeout(() => set({ isVisible: false }), 3000);
  },

  startUpload: (filename) => {
    if (hideTimeout) clearTimeout(hideTimeout);
    set({ isVisible: true, type: 'upload', filename, progress: 0 });
  },

  updateProgress: (progress) => set({ progress }),

  endUpload: (success) => {
    set({ 
      type: success ? 'success' : 'error', 
      message: success ? 'Upload berhasil!' : 'Upload gagal',
      progress: 100 
    });
    hideTimeout = setTimeout(() => set({ isVisible: false }), 3000);
  },

  hide: () => set({ isVisible: false }),
}));