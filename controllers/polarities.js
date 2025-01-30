import dotenv from 'dotenv';
dotenv.config();
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

export const processPolarities = async (req, res) => {
    console.log('Solicitação:', req.method);

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
        const { videoId, moduleId, intention } = req.query;
        const token = req.headers.authorization?.split('Bearer ')[1];
        
        if (!videoId || !token || !["like", "dislike"].includes(intention) || !moduleId) {
            return res.status(400).json({ error: "Parâmetros inválidos" });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        
        console.log('Token decodificado:', userId);
        
        const videoRef = db.collection("polarities").doc(videoId);
        const courseId = 'NIh3vZVa7NbthalQl9U3';
        const courseVideoRef = db.collection('courses').doc(courseId)
            .collection('modules').doc(moduleId)
            .collection('video').doc(videoId);

        await db.runTransaction(async (transaction) => {
            const polaritiesDoc = await transaction.get(videoRef);
            if (!polaritiesDoc.exists) {
                throw new Error('Vídeo não encontrado');
            }
           const courseVideoDoc = await transaction.get(courseVideoRef);
            if (!courseVideoDoc.exists) {
                throw new Error('Vídeo do curso não encontrado');
            }

            const polaritiesData = polaritiesDoc.data();
            const currentLikes = polaritiesData.likes || [];
            const currentDislikes = polaritiesData.dislikes || [];

            const isLiked = currentLikes.includes(userId);
            const isDisliked = currentDislikes.includes(userId);

            let likesDelta = 0;
            let dislikesDelta = 0;
            const updates = {};

            if (intention === 'like') {
                if (!isLiked) {
                    updates.likes = admin.firestore.FieldValue.arrayUnion(userId);
                    likesDelta += 1;
                }
                if (isDisliked) {
                    updates.dislikes = admin.firestore.FieldValue.arrayRemove(userId);
                    dislikesDelta -= 1;
                }
            } else {
                if (!isDisliked) {
                    updates.dislikes = admin.firestore.FieldValue.arrayUnion(userId);
                    dislikesDelta += 1;
                }
                if (isLiked) {
                    updates.likes = admin.firestore.FieldValue.arrayRemove(userId);
                    likesDelta -= 1;
                }
            }

            // Atualização na coleção polarities
            if (Object.keys(updates).length > 0) {
                transaction.update(videoRef, updates);
            }

            // Atualização na coleção courses
            transaction.update(courseVideoRef, {
                likesCount: admin.firestore.FieldValue.increment(likesDelta),
                dislikesCount: admin.firestore.FieldValue.increment(dislikesDelta)
            });
        });
        console.log('Sucesso nas transações');
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro na transação:', error);
        res.status(500).json({ error: error.message || "Erro interno do servidor" });
    }
}
