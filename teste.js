import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';

const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString();
const serviceAccount = JSON.parse(json);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
    storageBucket: "nail-art-by-gessica.appspot.com"
  });
}
const db = admin.firestore();
		
async function enviarNotificacao() {

    const adminUsersRef = db.collection('users').where('role', '==', 'admin');
    const adminUsersSnapshot = await adminUsersRef.get();

    if (adminUsersSnapshot.empty) {
        console.warn('Nenhum administrador encontrado para notificação.');
        return;
    }

    const notificationPromises = [];

    adminUsersSnapshot.forEach(adminUserDoc => {
        const adminUserData = adminUserDoc.data();
        const adminUserToken = adminUserData.token;

        if (!adminUserToken) return;

        const message = {
            token: adminUserToken,
            webpush: {
                headers: {
                    Urgency: 'high',
                },
            },
            data: {
                title: 'Teste',
                body: 'Teste',
                click_action: 'https://admin.nailsgessyca.com.br',
                icon: 'https://admin.nailsgessyca.com.br/assets/images/nailsyca.png',
                badge: `https://admin.nailsgessyca.com.br/assets/images/badge.png`
            
            },
        };

        notificationPromises.push(admin.messaging().send(message));
    });

    const results = await Promise.allSettled(notificationPromises);

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`❌ Erro ao notificar admin ${index}:`, result.reason);
        }
    });

    console.log(`✅ Notificações enviadas para ${results.length} admins.`);

}

enviarNotificacao();
