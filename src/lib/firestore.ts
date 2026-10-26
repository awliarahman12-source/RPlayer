import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Track, Playlist } from '@/types';

export async function saveTrackToCloud(username: string, track: Track) {
  await setDoc(doc(db, 'users', username, 'tracks', track.id), track);
}

export async function deleteTrackFromCloud(username: string, trackId: string) {
  await deleteDoc(doc(db, 'users', username, 'tracks', trackId));
}

export async function getTracksFromCloud(username: string): Promise<Track[]> {
  const snap = await getDocs(collection(db, 'users', username, 'tracks'));
  return snap.docs.map((d) => d.data() as Track).sort((a, b) => b.addedAt - a.addedAt);
}

export async function savePlaylistToCloud(username: string, playlist: Playlist) {
  await setDoc(doc(db, 'users', username, 'playlists', playlist.id), playlist);
}

export async function getPlaylistsFromCloud(username: string): Promise<Playlist[]> {
  const snap = await getDocs(collection(db, 'users', username, 'playlists'));
  return snap.docs.map((d) => d.data() as Playlist).sort((a, b) => a.createdAt - b.createdAt);
}