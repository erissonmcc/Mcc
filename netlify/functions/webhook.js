const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db, admin } = require('./firebaseAdmin');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const stripeSignature = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, stripeSignature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro ao verificar assinatura do webhook:', err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`,
        };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const userName = session.customer_details.name;
        let uid = session.metadata.uid;

        if (!uid) {
            const email = session.customer_email;
            const usersRef = db.collection('users');
            
            try {
                const snapshot = await usersRef.where('email', '==', email).get();
                if (!snapshot.empty) {
                    uid = snapshot.docs[0].id;
                }
            } catch (error) {
                console.error('Erro ao buscar UID pelo email:', error);
                return {
                    statusCode: 500,
                    body: `Erro ao buscar UID pelo email: ${error.message}`,
                };
            }
        }

        if (uid) {
            const userRef = db.collection('users').doc(uid);

            try {
                await userRef.update({
                    purchases: admin.firestore.FieldValue.arrayUnion({
                        productName: 'Postiça realista iniciante e aperfeiçoamento',
                        purchaseDate: admin.firestore.Timestamp.now(),
                        sessionId: session.id,
                        amount: session.amount_total,
                        currency: session.currency,
                    }),
                });

                console.log(`Compra registrada para o usuário ${uid}`);

                // Buscar usuários admin e enviar notificação
                const adminUsersRef = db.collection('users').where('role', '==', 'admin');
                const adminUsersSnapshot = await adminUsersRef.get();

                const notificationPromises = [];

                adminUsersSnapshot.forEach(adminUserDoc => {
                    const adminUserData = adminUserDoc.data();
                    const adminUserToken = adminUserData.token;

                    // Definir mensagem da notificação com ícone e informações adicionais
                    const message = {
                        token: adminUserToken,
                        notification: {
                            title: 'Nova Compra Realizada',
                            body: `Uma nova compra foi realizada por ${userName}. Valor: R$${(session.amount_total / 100).toFixed(2)}. Produto: Postiça realista iniciante e aperfeiçoamento.`,
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
                        data: {
                            productName: 'Postiça realista iniciante e aperfeiçoamento',
                            purchaseDate: admin.firestore.Timestamp.now().toString(),
                            amount: session.amount_total.toString(),
                            currency: session.currency,
                        },
                    };

                    // Enviar notificação
                    notificationPromises.push(admin.messaging().send(message));
                });

                // Aguardar o envio de todas as notificações
                await Promise.all(notificationPromises);

                console.log('Notificações enviadas para administradores');
            } catch (error) {
                console.error('Erro ao registrar compra no Firestore ou enviar notificações:', error);
                return {
                    statusCode: 500,
                    body: `Erro ao registrar compra no Firestore ou enviar notificações: ${error.message}`,
                };
            }
        } else {
            console.error('UID não encontrado para o email:', session.customer_email);
            return {
                statusCode: 400,
                body: 'UID não encontrado para o email fornecido',
            };
        }
    }

    return {
        statusCode: 200,
        body: 'Evento processado com sucesso',
    };
};
