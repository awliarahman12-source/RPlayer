import { create } from 'zustand';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PartyRoom, PartyQueueItem, Track } from '@/types';
import { useAuth } from './auth';

interface PartyState {
  room: PartyRoom | null;
  isHost: boolean;
  loading: boolean;
  startParty: () => Promise<string>;
  joinParty: (roomCode: string) => Promise<boolean>;
  leaveParty: () => void;
  addTrackToQueue: (track: Track, guestName: string) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  voteTrack: (trackId: string, amount: number) => Promise<void>;
  endParty: () => Promise<void>;
}

export const useParty = create<PartyState>((set, get) => ({
  room: null,
  isHost: false,
  loading: false,

  startParty: async () => {
    const user = useAuth.getState().user;
    if (!user) return '';
    set({ loading: true });
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: PartyRoom = { host: user, roomCode, queue: [], createdAt: Date.now(), isActive: true };
    try {
      await setDoc(doc(db, 'parties', roomCode), newRoom);
      set({ room: newRoom, isHost: true, loading: false });
      onSnapshot(doc(db, 'parties', roomCode), (docSnap) => {
        if (docSnap.exists()) set({ room: docSnap.data() as PartyRoom });
      });
      return roomCode;
    } catch (e) { console.error(e); set({ loading: false }); return ''; }
  },

  joinParty: async (roomCode) => {
    set({ loading: true });
    try {
      const docRef = doc(db, 'parties', roomCode.toUpperCase());
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) { set({ loading: false }); return false; }
      set({ room: docSnap.data() as PartyRoom, isHost: false, loading: false });
      onSnapshot(docRef, (snap) => { if (snap.exists()) set({ room: snap.data() as PartyRoom }); });
      return true;
    } catch (e) { console.error(e); set({ loading: false }); return false; }
  },

  leaveParty: () => set({ room: null, isHost: false }),

  addTrackToQueue: async (track, guestName) => {
    const { room } = get();
    if (!room) return;
    const newItem: PartyQueueItem = { trackId: track.id, requestedBy: guestName, addedAt: Date.now() };
    await updateDoc(doc(db, 'parties', room.roomCode), { queue: [...room.queue, newItem] });
  },

  removeFromQueue: async (index) => {
    const { room } = get();
    if (!room) return;
    await updateDoc(doc(db, 'parties', room.roomCode), { queue: room.queue.filter((_, i) => i !== index) });
  },

  voteTrack: async (trackId, amount) => {
    const { room } = get();
    if (!room) return;
    
    const newQueue = room.queue.map(q => 
      q.trackId === trackId ? { ...q, votes: (q.votes || 0) + amount } : q
    );
    
    // Otomatis sortir: vote terbanyak naik ke atas
    newQueue.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    
    await updateDoc(doc(db, 'parties', room.roomCode), { queue: newQueue });
  },

  endParty: async () => {
    const { room } = get();
    if (!room) return;
    await deleteDoc(doc(db, 'parties', room.roomCode));
    set({ room: null, isHost: false });
  }
}));