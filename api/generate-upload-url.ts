import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    const { filename, contentType } = req.body;
    const key = `${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      // ContentType: contentType, <--- SUDAH DIHAPUS BIAR CORS LOLOS
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    
    return res.status(200).json({
      uploadUrl,
      publicUrl: `${process.env.R2_PUBLIC_URL}/${key}`
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Gagal generate URL' });
  }
}
