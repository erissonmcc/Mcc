import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: 'nail-art-by-gessica.appspot.com',
    });
}

// Configuração do S3 v3
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Configuração do multer para upload de vídeo
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB máx
});

export const uploadVideo = [
    upload.single('video'),

    async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            return res.status(200).send('OK');
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }

        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token de autenticação não encontrado!' });
        }

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        if (!decodedToken.admin) {
            return res.status(403).json({ error: 'Apenas administradores podem enviar vídeos' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const file = req.file;
        const fileName = `videos/${Date.now()}_${file.originalname}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        });

        try {
            await s3.send(command);

            
            const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
    }),
    { expiresIn: 3600 } // URL válida por 1 hora
);
            return res.status(200).json({
                message: 'Vídeo enviado com sucesso',
                url: signedUrl,
            });
        } catch (err) {
            console.error('Erro no upload:', err);
            return res.status(500).json({ error: 'Erro ao enviar o vídeo para o S3' });
        }
    }
];