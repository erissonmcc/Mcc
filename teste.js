import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
    storageBucket: "nail-art-by-gessica.appspot.com"
  });
}

async function enviarNotificacao() {
  try {
    const token = "dA4uLrK3fqkq41bHKAKMOn:APA91bHCNAc2OwNRqTXmpqtxgqA23oxw448YtVtz94S6j5C-XynJTvnxfMoGyjroX4RP2_-TljMqAc_MfdgTCVCWMAJwkJXY67V3YLEXkEdILN24oDE8-ZU";

    const message = {
      token: token,
      notification: {
        title: 'Nova Compra Realizada',
        body: 'Uma nova compra foi realizada por Maria Silva. Valor: R$149,90. Produto: Curso de Unhas Profissional.',
      },
      android: {
        priority: 'high',
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          icon: 'https://admin.nailsgessyca.com.br/assets/images/nailsyca.png',
          click_action: 'https://admin.nailsgessyca.com.br'  
        },
      },
      data: {
        productName: 'Curso de Unhas Profissional',
        purchaseDate: admin.firestore.Timestamp.now().toDate().toISOString(),
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notificação enviada com sucesso:', response);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error.message);
  }
}

enviarNotificacao();
