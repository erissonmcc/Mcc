const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db, admin } = require('./firebaseAdmin');
const nodemailer = require('nodemailer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
    const stripeSignature = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        // Aqui, usamos o event.body em seu formato bruto para preservar a integridade do payload
        stripeEvent = stripe.webhooks.constructEvent(event.body, stripeSignature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro ao verificar assinatura do webhook:', err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`,
        };
    }

    const session = stripeEvent.data.object;
    const userName = session.customer_details.name;
    const userEmail = session.customer_email;
    const productName = session.metadata.productName;

    if (stripeEvent.type === 'checkout.session.completed') {
        let uid = session.metadata.uid;
        console.log('Email do usuário:', userEmail);
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
                        productName: session.metadata.productName,
                        purchaseDate: admin.firestore.Timestamp.now(),
                        sessionId: session.id,
                        amount: session.amount_total,
                        currency: session.currency,
                    }),
                });

                console.log(`Compra registrada para o usuário ${uid}`);
                
                // Verifica se o produto é o VIP e atribui o cargo no Discord
                if (session.metadata.productId  === 'qUemZpeFAYIoZMDV4Jpp') {
                    const discordUserId = session.metadata.discordId;
                    await assignDiscordRole(discordUserId);
                }

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: userEmail,
                    subject: `Bem-vindo ao ${productName}!`,
                    text: `Olá ${userName}!\n\nQue prazer ter você a bordo! 🎉 Parabéns pela decisão de investir no ${productName}. Estamos entusiasmados por ter você nesta jornada conosco.\n\nSe você tiver alguma dúvida ou precisar de ajuda, não hesite em nos contatar. Estamos aqui para apoiá-lo.\n\nAproveite cada momento e lembre-se: todo desafio é uma oportunidade de aprender. Estamos ansiosos para ver seu progresso e sucesso!\n\nCom amor,\nGessyca Nails!`,
                };

                await transporter.sendMail(mailOptions);
                console.log('E-mail de boas-vindas enviado para o aluno');

                const adminUsersRef = db.collection('users').where('role', '==', 'admin');
                const adminUsersSnapshot = await adminUsersRef.get();

                const notificationPromises = [];

                adminUsersSnapshot.forEach(adminUserDoc => {
                    const adminUserData = adminUserDoc.data();
                    const adminUserToken = adminUserData.token;

                    const message = {
                        token: adminUserToken,
                        notification: {
                            title: 'Nova Compra Realizada',
                            body: `Uma nova compra foi realizada por ${userName}. Valor: R$${(session.amount_total / 100).toFixed(2)}. Produto: ${productName}.`,
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
                            productName: productName,
                            purchaseDate: admin.firestore.Timestamp.now().toString(),
                            amount: session.amount_total.toString(),
                            currency: session.currency,
                        },
                    };

                    notificationPromises.push(admin.messaging().send(message));
                });

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
    } else if (stripeEvent.type === 'checkout.session.expired') {
        console.log(`Sessão expirada para o usuário ${userName} (${userEmail})`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Parece que você não concluiu sua matrícula',
            text: `Olá, ${userName}!\n\nPercebi que você começou a se matricular em nosso site, mas algo te impediu de finalizar. Vamos resolver isso juntos?\n\nResponda com o plano desejado e a forma de pagamento (cartão de crédito ou boleto) que eu te ajudo a finalizar a matrícula.\n\nCom carinho,\nGessyca 💖`,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('Email enviado para o usuário sobre a sessão expirada');
        } catch (error) {
            console.error('Erro ao enviar email para o usuário sobre a sessão expirada:', error);
            return {
                statusCode: 500,
                body: `Erro ao enviar email para o usuário sobre a sessão expirada: ${error.message}`,
            };
        }
    } else if (stripeEvent.type === 'charge.refunded') {
        const refund = stripeEvent.data.object;
        const chargeId = refund.charge;

        try {
            // Buscar a sessão de checkout original
            const charge = await stripe.charges.retrieve(chargeId);
            const session = await stripe.checkout.sessions.retrieve(charge.metadata.session_id);
            const userName = session.customer_details.name;
            const userEmail = session.customer_email;
            const uid = session.metadata.uid;

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
                subject: 'Seu reembolso foi processado',
                text: `Olá ${userName},\n\nInformamos que seu reembolso foi processado com sucesso. O valor de R$${(refund.amount / 100).toFixed(2)} foi reembolsado para o seu método de pagamento original.\n\nSe você tiver alguma dúvida ou precisar de mais informações, não hesite em nos contatar.\n\nCom amor,\nGessyca Nails ♥️`,
            };

            // Enviar o e-mail
            await transporter.sendMail(mailOptions);
            console.log('E-mail de reembolso enviado para o usuário');

            // Remover a compra do Firestore
            const userRef = db.collection('users').doc(uid);
            const userDoc = await userRef.get();
            const purchases = userDoc.data().purchases;

            const updatedPurchases = purchases.filter(purchase => purchase.sessionId !== session.id);

            await userRef.update({
                purchases: updatedPurchases
            });

            console.log(`Compra removida do Firestore para o usuário ${uid}`);
        } catch (error) {
            console.error('Erro ao processar evento de reembolso:', error);
            return {
                statusCode: 500,
                body: `Erro ao processar evento de reembolso: ${error.message}`,
            };
        }
    }

    return {
        statusCode: 200,
        body: 'Evento de webhook processado com sucesso',
    };
};


async function assignDiscordRole(discordUserId) {
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roles: ['1294348086113468536'], // Array de cargos a serem adicionados
            }),
        });

        if (!response.ok) {
            const errorMsg = await response.text(); // Pegue a mensagem de erro detalhada
            throw new Error(`Erro ao atribuir cargo: ${errorMsg}`);
        }
        sendEmbedMessage(discordUserId);
        console.log(`Cargo atribuído com sucesso ao usuário Discord ID: ${discordUserId}`);
    } catch (error) {
        console.error('Erro ao atribuir cargo no Discord:', error);
    }
}

// Função para enviar mensagem com embed
async function sendEmbedMessage(discordUserId) {
    try {
        // Primeiro, abrir o canal de DM com o usuário
        const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient_id: discordUserId // O ID do usuário do Discord
            })
        });

        const channelData = await channelResponse.json();
        if (!channelResponse.ok) {
            throw new Error(`Erro ao abrir canal de DM: ${channelData.message}`);
        }

        // Em seguida, enviar a mensagem embed no canal de DM
        const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channelData.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [
                    {
                        title: "Bem-vindo ao VIP Discord Gessyca Nails!",
                        description: "Você agora tem acesso ao conteúdo exclusivo do servidor. Aproveite!",
                        color: 0xFF69B4, // Cor rosa (hexadecimal para decimal)
                        fields: [
                            {
                                name: "Instruções",
                                value: "Verifique os novos canais desbloqueados e aproveite os benefícios!"
                            },
                            {
                                name: "Suporte",
                                value: "Se precisar de ajuda, envie uma mensagem para nossa equipe de suporte."
                            }
                        ],
                        footer: {
                            text: "Gessyca Nails VIP",
                        },
                        timestamp: new Date().toISOString(),
                    }
                ]
            })
        });

        if (!messageResponse.ok) {
            const errorData = await messageResponse.json();
            throw new Error(`Erro ao enviar mensagem embed: ${errorData.message}`);
        }

        console.log(`Mensagem embed enviada com sucesso ao usuário Discord ID: ${discordUserId}`);
    } catch (error) {
        console.error('Erro ao enviar mensagem embed no Discord:', error);
    }
}
