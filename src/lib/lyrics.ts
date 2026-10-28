export async function fetchLyricsFromLRCLIB(title: string, artist: string, duration: number): Promise<string | null> {
  try {
    const query = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: Math.round(duration).toString()
    });
    // Menggunakan API gratis dari LRCLIB
    const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.syncedLyrics || data.plainLyrics || null;
  } catch (error) {
    console.error("LRCLIB error:", error);
    return null;
  }
}