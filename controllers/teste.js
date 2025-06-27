import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com/',
        storageBucket: "nail-art-by-gessica.appspot.com"
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
    
    await admin.auth().setCustomUserClaims("dx1UPqs8jwVdjr6NVTN9S3FG0Vz1", { admin: true });
    console.log("Usuário agora é administrador.");
};