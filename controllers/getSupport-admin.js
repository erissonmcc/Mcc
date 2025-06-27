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

const database = admin.database();

export const processGetSupport = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'OPTIONS recebido' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido' });
    }
    
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
        console.error('Token de autenticação não encontrado | teste');
        return res.status(401).json({
            error: 'Token de autenticação não encontrado!'
        });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    try {
        const userId = decodedToken.uid;

        if (!decodedToken.admin) {
            console.log('Usuário não é administrador');
            return res.status(403).json({ error: 'Acesso restrito. Para acessar essa rota você precisa que um administrador autorize seu acesso.' });
        }

        const ref = database.ref('support');
        const snapshot = await ref.once('value');
        const usersData = snapshot.val();

        return res.status(200).json(usersData || {});
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
};
