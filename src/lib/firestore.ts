import { collection, doc, setDoc, getDocs, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Track, Playlist, SyncPlaybackState } from '@/types';

// Fungsi buat ngehapus field yang undefined biar Firestore nggak error
const cleanUndefined = <T extends object>(obj: T): T => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key as keyof T] === undefined) delete newObj[key as keyof T];
  });
  return newObj;
};

export async function saveTrackToCloud(username: string, track: Track) {
  await setDoc(doc(db, 'users', username, 'tracks', track.id), cleanUndefined(track));
}

export async function deleteTrackFromCloud(username: string, trackId: string) {
  await deleteDoc(doc(db, 'users', username, 'tracks', trackId));
}

export async function getTracksFromCloud(username: string): Promise<Track[]> {
  const snap = await getDocs(collection(db, 'users', username, 'tracks'));
  return snap.docs.map((d) => d.data() as Track).sort((a, b) => b.addedAt - a.addedAt);
}

export async function savePlaylistToCloud(username: string, playlist: Playlist) {
  await setDoc(doc(db, 'users', username, 'playlists', playlist.id), cleanUndefined(playlist));
}

export async function getPlaylistsFromCloud(username: string): Promise<Playlist[]> {
  const snap = await getDocs(collection(db, 'users', username, 'playlists'));
  return snap.docs.map((d) => d.data() as Playlist).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deletePlaylistFromCloud(username: string, playlistId: string) {
  await deleteDoc(doc(db, 'users', username, 'playlists', playlistId));
}

export async function saveSettingsToCloud(username: string, settings: any) {
  await setDoc(doc(db, 'users', username, 'settings', 'player'), cleanUndefined(settings));
}

export async function getSettingsFromCloud(username: string): Promise<any> {
  const snap = await getDoc(doc(db, 'users', username, 'settings', 'player'));
  return snap.exists() ? snap.data() : null;
}

// ---- Sync Playback (Remote, Receiver, Host) ----
export async function updateSyncPlayback(username: string, state: SyncPlaybackState) {
  await setDoc(doc(db, 'users', username, 'sync', 'playback'), cleanUndefined(state));
}

export async function getSyncPlayback(username: string): Promise<SyncPlaybackState | null> {
  const snap = await getDoc(doc(db, 'users', username, 'sync', 'playback'));
  return snap.exists() ? (snap.data() as SyncPlaybackState) : null;
}

export function onSyncPlaybackChange(username: string, callback: (state: SyncPlaybackState) => void) {
  return onSnapshot(doc(db, 'users', username, 'sync', 'playback'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as SyncPlaybackState);
    }
  });
}