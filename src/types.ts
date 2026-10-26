export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // seconds
  coverDataUrl?: string; // base64 cover art
  fileName: string;
  mimeType: string;
  size: number;
  addedAt: number; // timestamp
  lastPlayedAt?: number;
  liked: boolean;
  likedAt?: number;
  audioUrl?: string; // URL MP3 dari R2 (Cuma butuh satu)
  playCount?: number;
  isDownloaded?: boolean; 
  genre?: string;
  notes?: string;
  isExternal?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
  coverDataUrl?: string;
  parentId?: string | null; // Cuma butuh satu
  description?: string;
}

export interface PartyQueueItem {
  trackId: string;
  requestedBy: string;
  addedAt: number;
  votes?: number; // <-- Tambahan buat Voting
}

export interface PartyRoom {
  host: string;
  roomCode: string;
  queue: PartyQueueItem[];
  createdAt: number;
  isActive: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerSettings {
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTrackId: string | null;
  position: number; // seconds
  queue: string[];
  sleepTimerEnd?: number | null;
  crossfade?: boolean;
  playbackRate: number;
  volumeBoost: number;
}