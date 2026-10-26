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
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
  coverDataUrl?: string;
  parentId?: string | null;
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