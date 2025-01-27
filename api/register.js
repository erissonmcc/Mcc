import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
  storageBucket: "nail-art-by-gessica.appspot.com"
});
}

const db = admin.firestore();
const auth = admin.auth();

async function validateTokenAndGetUserData(token, req) {
    const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

    if (snapshot.empty) {
        throw new Error('Token inválido ou expirado.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Verificar se o token ainda é válido
    const now = new Date();
    if (new Date(data.expiresAt) < now) {
        return {
            expired: true,
        };
    }

    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Ip do usuário:', userIp);
    if (data.ip !== userIp) {
        return {
            code: 'auth/unauthorized-ip',
        };
    }

    return {
        uid: data.uid,
        email: data.email,
        expired: false,
    };
}

export default async function handler(req, res) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        res.set(headers).status(200).json({ message: 'OPTIONS recebido' });
        return;
    }

    if (req.method !== 'POST') {
        console.log('Solicitação não permitida:', req.method);
        res.set(headers).status(405).json({ error: 'Método não permitido' });
        return;
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            console.error('Token de autenticação não encontrado');
            res.set(headers).status(401).json({ error: 'Token de autenticação não encontrado!' });
            return;
        }

        const { email, password, isEmail } = req.body;

        // Verificar se o email já está registrado em outra conta
        console.log('Verificando se o email já está registrado:', email);
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            if (existingUser) {
                console.error('O email já está associado a outra conta:', existingUser.uid);
                res.set(headers).status(400).json({
                    error: 'O email já está registrado em outra conta!',
                    code: 'auth/email-in-use',
                });
                return;
            }
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                console.error('Usuário não encontrado!:', error);
            } else {
                console.error('Erro ao verificar conta:', error);
            }
        }

        let userId;
        if (isEmail === true) {
            const userData = await validateTokenAndGetUserData(token, req);
            console.log(userData);
            if (userData.expired) {
                res.set(headers).status(400).json({
                    error: 'Token Expirado!',
                    code: 'auth/token-expired',
                });
                return;
            } else if (userData.code === 'auth/unauthorized-ip') {
                res.set(headers).status(401).json({ code: 'auth/unauthorized-ip' });
                return;
            } else {
                userId = userData.uid;
            }
        } else {
            console.log('Token encontrado, verificando ID do usuário');
            const decodedToken = await admin.auth().verifyIdToken(token);
            userId = decodedToken.uid;
            console.log('ID do usuário:', userId);
        }

        console.log('Atualizando o usuário anônimo:', userId);
        const userRecord = await admin.auth().updateUser(userId, {
            email: email,
            password: password,
        });

        console.log('Conta migrada com sucesso:', userRecord.toJSON());
        const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

        if (snapshot.empty) {
            throw new Error('Token inválido.');
        }

        const doc = snapshot.docs[0];
        await doc.ref.delete();

        console.log('Documento deletado com sucesso.');
        res.set(headers).status(200).json({ response: 'Usuário autenticado e conta migrada com sucesso!' });
    } catch (e) {
        console.error('Erro ao registrar usuário:', e);
        res.set(headers).status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
}
