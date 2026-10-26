import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Track, Playlist, PlayerSettings } from '@/types';

interface MusicDB extends DBSchema {
  tracks: {
    key: string;
    value: Track;
    indexes: { 'by-addedAt': number; 'by-lastPlayed': number; 'by-liked': number };
  };
  audio: {
    key: string;
    value: { id: string; blob: Blob };
  };
  playlists: {
    key: string;
    value: Playlist;
    indexes: { 'by-createdAt': number };
  };
  settings: {
    key: string;
    value: PlayerSettings & { id: 'player' };
  };
}

let dbPromise: Promise<IDBPDatabase<MusicDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MusicDB>('liquid-music', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const store = db.createObjectStore('tracks', { keyPath: 'id' });
          store.createIndex('by-addedAt', 'addedAt');
          store.createIndex('by-lastPlayed', 'lastPlayedAt');
          store.createIndex('by-liked', 'likedAt');
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          const store = db.createObjectStore('playlists', { keyPath: 'id' });
          store.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------------- Tracks ----------------
export async function putTrack(track: Track, blob: Blob) {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audio'], 'readwrite');
  await tx.objectStore('tracks').put(track);
  await tx.objectStore('audio').put({ id: track.id, blob });
  await tx.done;
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDB();
  return db.getAllFromIndex('tracks', 'by-addedAt');
}

export async function getTrack(id: string): Promise<Track | undefined> {
  const db = await getDB();
  return db.get('tracks', id);
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const rec = await db.get('audio', id);
  return rec?.blob;
}

export async function deleteTrack(id: string) {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audio', 'playlists'], 'readwrite');
  await tx.objectStore('tracks').delete(id);
  await tx.objectStore('audio').delete(id);
  // Remove from all playlists
  const playlists = await tx.objectStore('playlists').getAll();
  for (const p of playlists) {
    if (p.trackIds.includes(id)) {
      p.trackIds = p.trackIds.filter((t) => t !== id);
      await tx.objectStore('playlists').put(p);
    }
  }
  await tx.done;
}

export async function updateTrack(id: string, patch: Partial<Track>) {
  const db = await getDB();
  const track = await db.get('tracks', id);
  if (!track) return;
  await db.put('tracks', { ...track, ...patch });
}

// ---------------- Playlists ----------------
export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  return db.getAllFromIndex('playlists', 'by-createdAt');
}

export async function putPlaylist(p: Playlist) {
  const db = await getDB();
  await db.put('playlists', p);
}

export async function deletePlaylist(id: string) {
  const db = await getDB();
  await db.delete('playlists', id);
}

// ---------------- Settings ----------------
export async function getSettings(): Promise<PlayerSettings | undefined> {
  const db = await getDB();
  return db.get('settings', 'player');
}

export async function putSettings(s: PlayerSettings) {
  const db = await getDB();
  await db.put('settings', { ...s, id: 'player' });
}

export async function clearAllData() {
  const db = await getDB();
  await db.clear('tracks');
  await db.clear('audio');
  await db.clear('playlists');
  await db.clear('settings');
}

export async function saveAudioBlob(id: string, blob: Blob) {
  const db = await getDB();
  await db.put('audio', { id, blob });
}