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
    const videoRef = db.collection("teste").doc('123');

    videoRef.set({
        campo1: "valor1",
        campo2: "valor2",
        campo3: "valor3"
    })
    .then(() => {
        console.log("Documento adicionado com sucesso!");
    })
    .catch((error) => {
        console.error("Erro ao adicionar documento: ", error);
    });
};
