export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0 menit';
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} jam ${rem} mnt` : `${h} jam`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Selamat malam';
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}
