import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Track, Playlist } from '@/types';

// Fungsi buat ngehapus field yang undefined
const cleanUndefined = <T extends object>(obj: T): T => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key as keyof T] === undefined) {
      delete newObj[key as keyof T];
    }
  });
  return newObj;
};

export async function saveTrackToCloud(username: string, track: Track) {
  const cleanTrack = cleanUndefined(track);
  await setDoc(doc(db, 'users', username, 'tracks', track.id), cleanTrack);
}

export async function deleteTrackFromCloud(username: string, trackId: string) {
  await deleteDoc(doc(db, 'users', username, 'tracks', trackId));
}

export async function getTracksFromCloud(username: string): Promise<Track[]> {
  const snap = await getDocs(collection(db, 'users', username, 'tracks'));
  return snap.docs.map((d) => d.data() as Track).sort((a, b) => b.addedAt - a.addedAt);
}

export async function savePlaylistToCloud(username: string, playlist: Playlist) {
  const cleanPlaylist = cleanUndefined(playlist);
  await setDoc(doc(db, 'users', username, 'playlists', playlist.id), cleanPlaylist);
}

export async function getPlaylistsFromCloud(username: string): Promise<Playlist[]> {
  const snap = await getDocs(collection(db, 'users', username, 'playlists'));
  return snap.docs.map((d) => d.data() as Playlist).sort((a, b) => a.createdAt - b.createdAt);
}

// Tambahan buat hapus playlist dari cloud
export async function deletePlaylistFromCloud(username: string, playlistId: string) {
  await deleteDoc(doc(db, 'users', username, 'playlists', playlistId));
}
