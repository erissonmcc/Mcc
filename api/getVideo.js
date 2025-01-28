import admin from 'firebase-admin';
import ffmpeg from 'fluent-ffmpeg';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: 'nail-art-by-gessica.appspot.com',
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Tratamento de requisição OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        return res.status(200).json({ message: 'OPTIONS recebido' });
    }

    // Verifica se o método da requisição é GET
    if (req.method !== 'GET') {
        console.log('Solicitação não permitida:', req.method);
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token não fornecido', code: 'auth/no-token' });
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        const { moduleId, videoId } = req.query;

        // Referência do documento do vídeo
        const docRef = db.collection('courses')
            .doc('NIh3vZVa7NbthalQl9U3')
            .collection('modules')
            .doc(moduleId)
            .collection('video')
            .doc(videoId);

        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
            console.log('Documento não encontrado');
            return res.status(400).json({ error: 'Vídeo não encontrado', code: 'video/does-not-exist' });
        }

        console.log('Documento encontrado:', docSnapshot.data());
        const data = docSnapshot.data();

        // Função para gerar URL assinada e obter a duração do vídeo
        const { url, duration } = await getVideoUrlAndDuration(data);

        // Retorna a URL e a duração do vídeo
        res.status(200).json({
            url: url,
            duration: duration,
        });
    } catch (error) {
        console.error('Erro ao fornecer o link do usuário:', error);
        res.status(500).json({ error: 'Erro interno ao processar a solicitação' });
    }
}

// Função para gerar URL assinada
async function generateSignedUrl(filePath) {
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hora de validade
    };

    try {
        const [url] = await bucket.file(filePath).getSignedUrl(options);
        return url;
    } catch (error) {
        console.error('Erro ao gerar URL assinada:', error);
        throw new Error('Erro ao gerar URL assinada');
    }
}

// Função para obter a duração do vídeo
async function getVideoDurationFromUrl(url) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(url, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}

// Função que combina a geração da URL e obtenção da duração
async function getVideoUrlAndDuration(data) {
    try {
        const url = await generateSignedUrl(`course/${data.name}`);
        console.log('URL assinada gerada:', url);

        const duration = await getVideoDurationFromUrl(url);
        console.log('Duração do vídeo:', duration);

        return { url, duration };
    } catch (error) {
        console.error('Erro ao obter URL e duração do vídeo:', error);
        throw new Error('Erro ao obter URL e duração do vídeo');
    }
}
