const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db, admin } = require('./firebaseAdmin');
const nodemailer = require('nodemailer'); // Adicionando o módulo Nodemailer
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
        const userEmail = session.customer_email;
        let uid = session.metadata.uid;
        console.log('Email do usuario', userEmail);
        if (!uid) {
            const usersRef = db.collection('users');
            
            try {
                const snapshot = await usersRef.where('email', '==', userEmail).get();
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

                // Configurar o transporte de e-mail
                const transporter = nodemailer.createTransport({
                    service: 'gmail', // ou outro serviço de e-mail
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });

                // Definir a mensagem do e-mail
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: userEmail,
                    subject: 'Bem-vindo ao curso de Postiça Realista!',
                    text: `Olá ${userName}!\n\nQue prazer ter você a bordo! 🎉 Parabéns pela decisão de investir no curso "Postiça Realista Iniciante e Aperfeiçoamento para Iniciantes". Estamos entusiasmados por ter você nesta jornada conosco.\n\nNossos cursos são cuidadosamente planejados para ajudá-lo a dominar as técnicas de postiça de forma prática e divertida. Sabemos que você está ansioso para começar e queremos garantir que você tenha a melhor experiência possível.\n\nNeste primeiro módulo você encontrará conteúdos essenciais e dicas valiosas para ajudá-lo a seguir em frente com confiança. Se você tiver alguma dúvida ou precisar de ajuda, não hesite em nos contatar. Estamos aqui para apoiá-lo.\n\nAproveite cada momento e lembre-se: todo desafio é uma oportunidade de aprender. Estamos ansiosos para ver seu progresso e sucesso!\n\nBem-vindo ao nosso time e vamos arrasar juntos!\n\nCom amor,\nUnhas Jéssica!`,
                };

                // Enviar o e-mail
                await transporter.sendMail(mailOptions);

                console.log('E-mail de boas-vindas enviado para o aluno');

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
                console.error('Erro ao registrar compra no Firestore, enviar e-mail ou notificações:', error);
                return {
                    statusCode: 500,
                    body: `Erro ao registrar compra no Firestore, enviar e-mail ou notificações: ${error.message}`,
                };
            }
        } else {
            console.error('UID não encontrado para o email:', userEmail);
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
