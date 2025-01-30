import admin from 'firebase-admin';

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Tratamento de requisição OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        return res.status(200).json({
            message: 'OPTIONS recebido'
        });
    }

    // Verifica se o método da requisição é GET
    if (req.method !== 'GET') {
        console.log('Solicitação não permitida:', req.method);
        return res.status(405).json({
            error: 'Método não permitido'
        });
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({
                message: 'Token não fornecido', code: 'auth/no-token'
            });
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const coursePurchased = decodedToken.course_purchased;

        if (coursePurchased) {
            console.log('O usuário comprou o curso.');
        } else {
            return res.status(401).json({
                message: 'Usuário não autorizado!', code: 'user/unauthorized'
            });
        }
        console.log('ID do usuário:', userId);

        const {
            moduleId,
            videoId
        } = req.query;

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
            return res.status(400).json({
                error: 'Vídeo não encontrado', code: 'video/does-not-exist'
            });
        }

        console.log('Documento encontrado:', docSnapshot.data());
        const data = docSnapshot.data();

        // Função para gerar URL assinada
        const {
            url
        } = await getVideoUrl(data);
        const docInfoRef = db.collection('polarities')
        .doc(videoId)
        const docInfoRefSnapshot = await docInfoRef.get();

        if (docInfoRefSnapshot.exists) {
            var dataInfo = docInfoRefSnapshot.data();
            var likedAccount = dataInfo.likes.length;
            var dislikeAccount = dataInfo.dislikes.length;
            var marked
            if (dataInfo.likes.includes(userId)) {
                marked = 'like';
            } else if (dataInfo.dislikes.includes(userId)) {
                marked = 'dislike';
            }
        }
        console.log(dataInfo);
        console.log(likedAccount, dislikeAccount);

        // Retorna a URL do vídeo
        res.status(200).json({
            url: url,
            liked: likedAccount || '0',
            dislike: dislikeAccount || '0',
            marked: marked || false
        });
    } catch (error) {
        console.error('Erro ao fornecer o link do usuário:', error);
        res.status(500).json({
            error: 'Erro interno ao processar a solicitação'
        });
    }
}

    // Função para gerar URL assinada
    async function generateSignedUrl(filePath) {
        const options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000,
            // 1 hora de validade
        };

        try {
            const [url] = await bucket.file(filePath).getSignedUrl(options);
            return url;
        } catch (error) {
            console.error('Erro ao gerar URL assinada:', error);
            throw new Error('Erro ao gerar URL assinada');
        }
    }

    // Função que gera a URL do vídeo
    async function getVideoUrl(data) {
        try {
            const url = await generateSignedUrl(`course/${data.name}`);
            console.log('URL assinada gerada:', url);
            return {
                url
            };
        } catch (error) {
            console.error('Erro ao gerar URL:', error);
            throw new Error('Erro ao gerar URL');
        }
    }
