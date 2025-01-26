const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
    db,
    admin
} = require('./firebaseAdmin');
const nodemailer = require('nodemailer');
const fetch = (...args) => import('node-fetch').then(({
    default: fetch
    }) => fetch(...args));

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

        const session = stripeEvent.data.object;
        const name = session.customer_details.name;
        const userEmail = session.customer_details.email;
        const productName = session.metadata.productName;
        const token1 = session.metadata.token_part1;
        const token2 = session.metadata.token_part2;
        const token3 = session.metadata.token_part3;
        const userIp = session.metadata.ip;
        const token = token1 + token2 + token3
        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        console.log('ID do usuário:', uid);

        if (stripeEvent.type === 'checkout.session.completed') {
            console.log(`Email do cliente: ${userEmail}`);
            console.log(`Nome do produto: ${productName}`);
            console.log(`Nome do titular do cartão: ${name}`);

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
                    await userRef.set({
                        purchases: admin.firestore.FieldValue.arrayUnion({
                            productName: session.metadata.productName,
                            purchaseDate: admin.firestore.Timestamp.now(),
                            sessionId: session.id,
                            amount: session.amount_total,
                            currency: session.currency,
                        }),
                    }, {
                        merge: true
                    });

                    await admin.auth().setCustomUserClaims(uid, {
                        course_purchased: true,
                    });

                    console.log("Claim de role adicionado com sucesso!");

                    console.log(`Compra registrada para o usuário ${uid}`);

                    // Verifica se o produto é o VIP e atribui o cargo no Discord
                    if (session.metadata.productId === 'qUemZpeFAYIoZMDV4Jpp') {
                        const discordUserId = session.metadata.discordId;
                        await assignDiscordRole(discordUserId);
                    }

                    const transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 465,
                        secure: true,
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        },
                    });

                    const tokenPendingAccount = await savePendingAccount(uid, userEmail, userIp);

                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: userEmail,
                        subject: 'Compra realizada com sucesso!',
                        text: 'Obrigado pela sua compra!',
                        html: `
                        <html>
                        <body>
                        <h1 style="color: #fff; text-align: center;">Compra Realizada com Sucesso!</h1>
                        <p style="font-size: 16px; font-family: Arial, sans-serif;">Olá, <strong>${name}</strong>,</p>
                        <p style="font-size: 16px; font-family: Arial, sans-serif;">Agradecemos pela sua compra! Seu pedido foi processado com sucesso. Agora falta pouco para concluímos, clique no botão abaixo para criar uma conta na plataforma para você ter acesso a todos os conteúdos do curso!</p>
                        <a href="http://localhost:8080/?register=true&token=${tokenPendingAccount}" style="text-decoration: none;">
                        <button style="background-color: #b780ff; color: white; font-size: 16px; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-family: Arial, sans-serif;">
                        Criar uma conta!
                        </button>
                        </a>
                        </body>
                        </html>
                        `,
                    };
                    await transporter.sendMail(mailOptions);

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
                                body: `Uma nova compra foi realizada por ${name}. Valor: R$${(session.amount_total / 100).toFixed(2)}. Produto: ${productName}.`,
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
            console.log(`Sessão expirada para o usuário ${name} (${userEmail})`);

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
                text: `Olá!\n\nPercebi que você começou a se matricular em nosso site, mas algo te impediu de finalizar. Vamos resolver isso juntos?\n\nResponda com o plano desejado e a forma de pagamento (cartão de crédito ou boleto) que eu te ajudo a finalizar a matrícula.\n\nCom carinho,\nGessyca 💖`,
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

                await admin.auth().setCustomUserClaims(uid, {
                    course_purchased: false,
                });

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
            // Primeiro, busque os detalhes do membro do servidor (incluindo os cargos atuais)
            const getUserResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!getUserResponse.ok) {
                const errorMsg = await getUserResponse.text();
                throw new Error(`Erro ao obter detalhes do usuário: ${errorMsg}`);
            }

            const userData = await getUserResponse.json();

            // Adicione o novo cargo ao array de cargos do usuário, sem duplicar
            const roleId = '1294348086113468536'; // ID do cargo a ser atribuído
            const updatedRoles = new Set(userData.roles); // Converta os cargos atuais em um Set para evitar duplicatas
            updatedRoles.add(roleId); // Adicione o novo cargo

            // Atualize o usuário com a lista de cargos atualizada
            const updateResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: Array.from(updatedRoles), // Converta o Set de volta para um array
                }),
            });

            if (!updateResponse.ok) {
                const errorMsg = await updateResponse.text();
                throw new Error(`Erro ao atribuir cargo: ${errorMsg}`);
            }

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
                    embeds: [{
                        title: "Bem-vindo ao VIP Discord Gessyca Nails!",
                        description: "Você agora tem acesso ao conteúdo exclusivo do servidor. Aproveite!",
                        color: 0xFF69B4, // Cor rosa (hexadecimal para decimal)
                        fields: [{
                            name: "Instruções",
                            value: "Verifique os novos canais desbloqueados e aproveite os benefícios!"
                        },
                            {
                                name: "Suporte",
                                value: "Se precisar de ajuda, envie uma mensagem para nossa equipe de suporte."
                            }],
                        footer: {
                            text: "Gessyca Nails VIP",
                        },
                        timestamp: new Date().toISOString(),
                    }]
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


    const crypto = require('crypto');

    async function savePendingAccount(userId, email, ip) {
        // Gerar um token único
        const token = crypto.randomBytes(64).toString('hex');

        // Definir o tempo de expiração (1 hora)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Adiciona 1 hora à data atual

        console.log('Expiração:', expiresAt);
        // Salvar os dados no Firestore
        await db.collection('pendingAccounts').doc(userId).set({
            email: email,
            token: token,
            uid: userId,
            ip: ip,
            expiresAt: expiresAt.toISOString(),
        });

        console.log('Conta pendente salva com sucesso!');
        return token;
    }
