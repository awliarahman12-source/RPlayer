import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const audioUrl = String(body?.audioUrl || '');
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

    // Hanya boleh hapus file yang memang ada di bucket R2 app ini
    if (!base || !audioUrl.startsWith(`${base}/`)) {
      return res.status(400).json({ error: 'URL bukan file R2 milik app ini' });
    }

    const key = decodeURIComponent(audioUrl.slice(base.length + 1).split('?')[0]);
    // Key dibuat generate-upload-url: <timestamp>-<nama_aman>. Tolak path aneh.
    if (!/^[\w.\-]+$/.test(key)) {
      return res.status(400).json({ error: 'Key tidak valid' });
    }

    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Gagal hapus file' });
  }
}
