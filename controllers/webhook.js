import dotenv from 'dotenv';
dotenv.config();
import stripePackage from 'stripe';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: "nail-art-by-gessica.appspot.com"
    });
}
const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

const db = admin.firestore();
const auth = admin.auth();


export const processWebhook = async (req, res) => {

    let stripeEvent;
    const sig = req.headers['stripe-signature'];

    try {
        stripeEvent = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log('⚠️  Assinatura inválida:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = stripeEvent.data.object;
    
    if (session.metadata && session.metadata.uid) {
        var {
            visitorId,
            uid
        } = session.metadata;
        console.log('ID do usuário:', uid);
    } else {
        return res.sendStatus(200);
    }

    const sessionId = stripeEvent.data.object.id;

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        expand: ['data.price.product'],
    });
    let productName;
    lineItems.data.forEach((item) => {
        productName = item.price.product.name;
        console.log('✅ Produto comprado:', productName);
    });

    if (stripeEvent.type === 'checkout.session.completed') {
        const name = session.customer_details.name;
        const userEmail = session.customer_details.email;
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

                res.status(500).json({
                    error: `Erro ao buscar UID pelo email: ${error.message}`,
                });
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
                        currency: session.currency
                    }),
                    phone: session.metadata.phone
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
                    host: "smtp.umbler.com",
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });
                const tokenPendingAccount = await savePendingAccount(uid, userEmail, name, visitorId);

                const mailOptions = {
                    from: '"Nails Gessyca" <contato@nailsgessyca.com.br>',
                    to: userEmail,
                    subject: 'Compra realizada com sucesso!',
                    text: 'Obrigado pela sua compra!',
                    html: `
                    <html>
                    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); min-height: 100vh;">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0; padding: 0;">
                    <tr>
                    <td style="padding: 40px 20px;">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">

                    <!-- Header de sucesso -->
                    <tr>
                    <td style="background: linear-gradient(135deg, #00c851 0%, #00ff88 100%); padding: 40px 30px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 40px;">✅</div>
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">Compra Realizada!</h1>
                    <p style="color: rgba(255, 255, 255, 0.95); font-size: 18px; margin: 10px 0 0 0; font-weight: 500;">Parabéns! Seu pedido foi processado com sucesso 🎉</p>
                    </td>
                    </tr>

                    <!-- Conteúdo principal -->
                    <tr>
                    <td style="padding: 40px 30px;">

                    <div style="text-align: left;">
                    <p style="font-size: 20px; color: #333333; margin: 0 0 20px 0; font-weight: 600;">Olá, <strong style="color: #00c851;">${name}</strong>! 🚀</p>

                    <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
                    Muito obrigado pela sua compra! Ficamos extremamente felizes em tê-lo(a) conosco. Seu pedido foi processado com sucesso e agora você está a apenas um passo de acessar todo o conteúdo exclusivo.
                    </p>

                    <!-- Card de destaque -->
                    <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 2px solid #f39c12; border-radius: 12px; padding: 25px; margin: 0 0 30px 0; text-align: center;">
                    <div style="font-size: 32px; margin: 0 0 15px 0;">🎓</div>
                    <h3 style="color: #d68910; font-size: 18px; font-weight: 700; margin: 0 0 10px 0;">Próximo Passo</h3>
                    <p style="font-size: 15px; color: #8d6e00; margin: 0; line-height: 1.5;">
                    Crie sua conta na plataforma para ter acesso completo a todos os conteúdos do curso!
                    </p>
                    </div>

                    <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0 0 35px 0;">
                    Clique no botão abaixo para criar sua conta e começar sua jornada de aprendizado. Todo o material já está esperando por você! 📚
                    </p>
                    </div>

                    <!-- Botão de ação principal -->
                    <div style="text-align: center; margin: 0 0 30px 0;">
                    <a href="${process.env.URL_REGISTER}/?tokenRegister=${tokenPendingAccount}" style="display: inline-block; text-decoration: none; background: linear-gradient(135deg, #b780ff 0%, #9f5aff 100%); color: #ffffff; font-size: 18px; font-weight: 700; padding: 18px 45px; border-radius: 50px; box-shadow: 0 10px 30px rgba(183, 128, 255, 0.4); transition: all 0.3s ease;">
                    🎯 Criar Minha Conta Agora
                    </a>
                    </div>

                    <!-- Informações adicionais -->
                    <div style="background: #f8f9ff; border-radius: 10px; padding: 20px; margin: 0 0 20px 0;">
                    <h4 style="color: #333333; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">📋 O que você receberá:</h4>
                    <div style="font-size: 14px; color: #555555; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">✨ Acesso completo ao curso</p>
                    <p style="margin: 0 0 8px 0;">📱 Plataforma disponível 24/7</p>
                    <p style="margin: 0 0 8px 0;">🎓 Certificado de conclusão</p>
                    <p style="margin: 0;">🚀 Suporte da comunidade</p>
                    </div>
                    </div>

                    <div style="text-align: center;">
                    <p style="font-size: 13px; color: #999999; margin: 0;">
                    Este link de criação de conta é válido por 48 horas. Não compartilhe com terceiros.
                    </p>
                    </div>

                    </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                    <td style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px; text-align: center;">
                    <div style="margin: 0 0 15px 0;">
                    <p style="font-size: 16px; color: #ffffff; margin: 0; font-weight: 600;">Bem-vindo(a) à nossa comunidade! 🤝</p>
                    </div>
                    <p style="font-size: 14px; color: #bdc3c7; margin: 0 0 10px 0;">
                    Dúvidas? Nossa equipe está aqui para ajudar!
                    </p>
                    <p style="font-size: 12px; color: #95a5a6; margin: 0;">
                    Este é um email automático. Por favor, não responda diretamente.
                    </p>
                    </td>
                    </tr>

                    </table>

                    </td>
                    </tr>
                    </table>

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

                res.status(500).json({
                    error: `Erro ao registrar compra no Firestore, enviar e-mail ou notificações: ${error.message}`,
                });
            }
        } else {
            console.error('UID não encontrado para o email:', userEmail);

            res.status(500).json({
                error: `UID não encontrado para o email fornecido`,
            });
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
            res.status(500).json({
                error: `Erro ao processar evento de reembolso: ${error.message}`,
            });

            res.status(200).send('');
        }
    }

    res.status(200).send('Evento de webhook processado com sucesso');

};


async function assignDiscordRole(discordUserId) {
    try {
        // Primeiro, busque os detalhes do membro do servidor (incluindo os cargos atuais)
        const getUserResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
            {
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

import crypto from 'crypto';

async function savePendingAccount(userId, email, name, visitorId) {
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
        name: name,
        visitorId: visitorId,
        expiresAt: expiresAt.toISOString(),
    });

    console.log('Conta pendente salva com sucesso!');
    return token;
}