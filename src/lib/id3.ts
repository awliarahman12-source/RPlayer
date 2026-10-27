/**
 * Parser ID3 ringan (v2.2 / v2.3 / v2.4 + ID3v1) tanpa dependency.
 * Dipakai sebagai cadangan kalau music-metadata-browser gagal jalan di browser
 * (biasanya karena Buffer/process tidak tersedia), supaya judul, artis, album,
 * dan cover tetap kebaca dari file MP3.
 */

export interface RawTags {
  title?: string;
  artist?: string;
  album?: string;
  picture?: { data: Uint8Array; mime: string };
}

const synchsafe = (b: Uint8Array, i: number) =>
  ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);

const uint32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

const ascii = (b: Uint8Array) => String.fromCharCode(...Array.from(b));

function removeUnsync(b: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    out.push(b[i]);
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return Uint8Array.from(out);
}

function decodeBytes(bytes: Uint8Array, enc: number): string {
  try {
    if (enc === 1) {
      if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
      if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
      return new TextDecoder('utf-16le').decode(bytes);
    }
    if (enc === 2) return new TextDecoder('utf-16be').decode(bytes);
    if (enc === 3) return new TextDecoder('utf-8').decode(bytes);
    return new TextDecoder('iso-8859-1').decode(bytes);
  } catch {
    return '';
  }
}

/** Frame teks: byte pertama = encoding. Nilai ganda (dipisah null) digabung dengan koma. */
function decodeText(data: Uint8Array): string {
  if (!data.length) return '';
  const text = decodeBytes(data.subarray(1), data[0]);
  return text.split('\u0000').map((s) => s.trim()).filter(Boolean).join(', ');
}

function skipTerminated(d: Uint8Array, start: number, enc: number): number {
  let i = start;
  if (enc === 1 || enc === 2) {
    while (i + 1 < d.length && !(d[i] === 0 && d[i + 1] === 0)) i += 2;
    return i + 2;
  }
  while (i < d.length && d[i] !== 0) i++;
  return i + 1;
}

function sniffMime(d: Uint8Array, fallback: string): string {
  if (d[0] === 0xff && d[1] === 0xd8) return 'image/jpeg';
  if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) return 'image/png';
  if (d[0] === 0x47 && d[1] === 0x49 && d[2] === 0x46) return 'image/gif';
  if (d[0] === 0x52 && d[1] === 0x49 && d[2] === 0x46 && d[3] === 0x46) return 'image/webp';
  return fallback || 'image/jpeg';
}

function parsePicture(data: Uint8Array, v22: boolean): RawTags['picture'] | undefined {
  if (data.length < 8) return undefined;
  const enc = data[0];
  let i = 1;
  let mime = '';
  if (v22) {
    mime = 'image/' + ascii(data.subarray(1, 4)).toLowerCase().replace('jpg', 'jpeg');
    i = 4;
  } else {
    const end = skipTerminated(data, 1, 0);
    mime = ascii(data.subarray(1, Math.max(1, end - 1))).toLowerCase();
    i = end;
  }
  i += 1; // picture type
  i = skipTerminated(data, i, enc); // description
  const img = data.subarray(i);
  if (img.length < 16) return undefined;
  return { data: img, mime: sniffMime(img, mime) };
}

async function readID3v2(file: File): Promise<RawTags | null> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null; // "ID3"
  const ver = head[3];
  if (ver < 2 || ver > 4) return null;
  const flags = head[5];
  const tagSize = synchsafe(head, 6);
  if (tagSize <= 0) return null;

  let buf: Uint8Array = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  if (flags & 0x80 && ver < 4) buf = removeUnsync(buf);

  let pos = 0;
  if (flags & 0x40 && ver >= 3) pos += ver === 4 ? synchsafe(buf, 0) : 4 + uint32(buf, 0);

  const idLen = ver === 2 ? 3 : 4;
  const hdrLen = ver === 2 ? 6 : 10;
  const tags: RawTags = {};

  while (pos + hdrLen <= buf.length) {
    const id = ascii(buf.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break; // sudah masuk padding
    let size: number;
    if (ver === 2) size = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
    else if (ver === 4) size = synchsafe(buf, pos + 4);
    else size = uint32(buf, pos + 4);
    const fflags = ver === 2 ? 0 : (buf[pos + 8] << 8) | buf[pos + 9];
    const start = pos + hdrLen;
    const end = start + size;
    if (size <= 0 || end > buf.length) break;
    pos = end;

    // Lewati frame yang dikompres/dienkripsi
    if (ver === 3 && fflags & 0x00c0) continue;
    if (ver === 4 && fflags & 0x000c) continue;

    let data = buf.subarray(start, end);
    if (ver === 4 && fflags & 0x0001) data = data.subarray(4); // data length indicator
    if (ver === 4 && fflags & 0x0002) data = removeUnsync(data);

    switch (id) {
      case 'TIT2': case 'TT2': tags.title = tags.title || decodeText(data); break;
      case 'TPE1': case 'TP1': tags.artist = tags.artist || decodeText(data); break;
      case 'TPE2': case 'TP2': if (!tags.artist) tags.artist = decodeText(data); break;
      case 'TALB': case 'TAL': tags.album = tags.album || decodeText(data); break;
      case 'APIC': case 'PIC':
        if (!tags.picture) tags.picture = parsePicture(data, id === 'PIC');
        break;
      default: break;
    }
  }
  return tags;
}

async function readID3v1(file: File): Promise<RawTags | null> {
  if (file.size < 128) return null;
  const b = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
  if (b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return null; // "TAG"
  const field = (from: number, to: number) => decodeBytes(b.subarray(from, to), 0).replace(/\u0000/g, '').trim();
  const tags: RawTags = { title: field(3, 33), artist: field(33, 63), album: field(63, 93) };
  return tags.title || tags.artist ? tags : null;
}

/** Baca tag dari file MP3. Mengembalikan null kalau bukan MP3 / tidak ada tag. */
export async function readTagsFallback(file: File): Promise<RawTags | null> {
  try {
    const v2 = await readID3v2(file);
    if (v2 && (v2.title || v2.artist || v2.picture)) return v2;
  } catch { /* lanjut ke ID3v1 */ }
  try {
    return await readID3v1(file);
  } catch {
    return null;
  }
}
