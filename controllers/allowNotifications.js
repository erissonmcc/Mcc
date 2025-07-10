import dotenv from 'dotenv'; 
dotenv.config();

import admin from 'firebase-admin';
const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString();

const serviceAccount = JSON.parse(json);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount), 
        databaseURL: 'https://nails-gessyca-default-rtdb.firebaseio.com', 
    });
} 

const db = admin.firestore(); 

export const processToken = async (req, res) => {
    console.log('Nova solicitação recebida:', req.method, req.url);

    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({
            message: 'OPTIONS recebido'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Método não permitido'
        });
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({
                error: 'Token de autenticação não encontrado!'
            });
        }

        // Verifica e decodifica o token Firebase Auth
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        // Pega o token de notificação (FCM token) enviado no corpo da requisição
        const fcmToken = req.body.fcmToken;

        if (!fcmToken) {
            return res.status(400).json({
                error: 'Token de notificação (fcmToken) não fornecido no corpo da requisição'
            });
        }

        // Atualiza ou cria o campo 'token' no documento do usuário no Firestore
        await db.collection('users').doc(userId).set({
            token: fcmToken
        }, { merge: true });

        console.log('Token de notificação salvo com sucesso');

        return res.status(200).json({
            message: 'Token de notificação salvo com sucesso'
        });

    } catch (error) {
        console.error('Erro ao processar a requisição:', error.message);

        return res.status(500).json({
            error: 'Erro ao salvar token ou processar checkout. Tente novamente mais tarde.',
            message: error.message,
        });
    }
};