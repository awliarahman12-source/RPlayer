export type SyncMode = 'host' | 'remote' | 'speaker';

export interface ActiveDevice {
  deviceId: string;
  deviceType: 'mobile' | 'desktop';
  role: SyncMode;
  lastActive: number;
  joinedAt: number; // <-- Tambahan
}

export interface SyncPlaybackState {
  deviceId: string;
  hostId: string;
  trackId: string | null;
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  originMode?: SyncMode;
  repeat?: 'off' | 'all' | 'one';
  shuffle?: boolean;
  queue?: string[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  coverDataUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
  addedAt: number;
  lastPlayedAt?: number;
  liked: boolean;
  likedAt?: number;
  audioUrl?: string;
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
  parentId?: string | null;
  description?: string;
}

export interface PartyQueueItem {
  trackId: string;
  requestedBy: string;
  addedAt: number;
  votes?: number;
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
  position: number;
  queue: string[];
  sleepTimerEnd?: number | null;
  crossfade?: boolean;
  playbackRate: number;
  volumeBoost: number;
}
