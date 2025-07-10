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
export const processGetAllUsers = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Tratamento de requisição OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).json({
            message: 'OPTIONS recebido'
        });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Método não permitido'
        });
    }
    // Autenticação do usuário
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        console.error('Token de autenticação não encontrado');
        return res.status(401).json({
            error: 'Token de autenticação não encontrado!'
        });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log('Usuário autenticado:', userId);

    if (!decodedToken.admin) {
        console.log('Usuário não é administrador');
        return res.status(403).json({
            error: 'Acesso negado para não administradores'
        });
    }

    try {
        let allUsers = [];
        let nextPageToken = undefined;

        do {
            const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
            allUsers = allUsers.concat(listUsersResult.users.map(user => ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                phoneNumber: user.phoneNumber,
                photoURL: user.photoURL,
                disabled: user.disabled,
                metadata: user.metadata
            })));
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        return res.status(200).json({
            users: allUsers
        });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return res.status(500).json({
            error: 'Erro ao buscar usuários'
        });
    }
};