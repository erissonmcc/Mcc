const { admin } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
  try {
    // Token para enviar a mensagem de notificação (pode vir da solicitação HTTP ou ser fixo)
    const deviceToken = 'dmfGG1Os5vm9qCeCiIvaki:APA91bHvmGVbEAELdSXLPfJlALqw72JFvFqHTGDnrxI-DOYanXPgPjYSb30g3Z1VH65OYgRc3GHOo5QPykUIygZpbYxp9GyQFW7tgaPoUYI_YtgEo4YWPvQW6mZiLPRZ6avnqycz4HB6';

          // Definir mensagem da notificação com ícone
                    const message = {
                        token: deviceToken,
                        notification: {
                            title: 'Nova Compra Realizada',
                            body: `Uma nova compra foi realizada por Erisson`,
                        },
                        android: {
                            notification: {
                                icon: 'https://firebasestorage.googleapis.com/v0/b/nail-art-by-gessica.appspot.com/o/icon%2Ffavicon.png?alt=media&token=b25cc938-d6c1-44f6-8748-143882fb33dd',
                            },
                        },
                        webpush: {
                            notification: {
                                icon: 'https://firebasestorage.googleapis.com/v0/b/nail-art-by-gessica.appspot.com/o/icon%2Ffavicon.png?alt=media&token=b25cc938-d6c1-44f6-8748-143882fb33dd',
                            },
                        },
                    };

    // Envia a mensagem via Firebase Admin SDK
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);

    // Resposta de sucesso
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Notification sent successfully' })
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    // Resposta de erro
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification' })
    };
  }
};
