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
const database = admin.database();

export const processTeste = async (req, res) => {
    console.log('Nova solicitação recebida:', req.method, req.url);

    // Configurar cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    await admin.auth().setCustomUserClaims("yzA7cpfZHBNGzkU2knX8Tp2UG4H2", { admin: true });
    console.log("Usuário agora é administrador.");
};