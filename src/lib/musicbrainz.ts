export async function searchMusicBrainz(title: string, artist: string): Promise<{ album?: string; coverUrl?: string } | null> {
  try {
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    // MusicBrainz API (Gratis & Legal)
    const res = await fetch(`https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=1`);
    const data = await res.json();
    
    if (!data.recordings || data.recordings.length === 0) return null;
    
    const rec = data.recordings[0];
    const album = rec.releases?.[0]?.title;
    const releaseId = rec.releases?.[0]?.id;
    
    let coverUrl = undefined;
    if (releaseId) {
      // Cek Cover Art Archive
      const caaRes = await fetch(`https://coverartarchive.org/release/${releaseId}`);
      if (caaRes.ok) {
        const caaData = await caaRes.json();
        const frontImg = caaData.images?.find((img: any) => img.front) || caaData.images?.[0];
        if (frontImg) coverUrl = frontImg.image; 
      }
    }
    
    return { album, coverUrl };
  } catch (error) {
    console.error("MusicBrainz error:", error);
    return null;
  }
}