import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Selisih jam perangkat ini dengan jam server Firebase (ms).
 * Dipakai supaya perhitungan posisi lagu antar-perangkat tidak meleset gara-gara jam HP dan PC berbeda.
 */
let offset = 0;

export const serverNow = () => Date.now() + offset;

/** Ukur selisih jam beberapa kali, pakai sampel dengan RTT terkecil (paling akurat). */
export async function syncClock(username: string, deviceId: string) {
  try {
    const ref = doc(db, 'users', username, 'sync', `clock_${deviceId}`);
    let best: { rtt: number; off: number } | null = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await setDoc(ref, { t: serverTimestamp() });
      const snap = await getDoc(ref);
      const t1 = Date.now();
      const ts = snap.data()?.t as { toMillis?: () => number } | undefined;
      if (ts && typeof ts.toMillis === 'function') {
        const rtt = t1 - t0;
        const off = ts.toMillis() - (t0 + t1) / 2;
        if (!best || rtt < best.rtt) best = { rtt, off };
      }
    }
    if (best) offset = best.off;
  } catch {
    // Rules Firestore menolak / offline: pakai jam perangkat apa adanya (offset 0)
  }
}
