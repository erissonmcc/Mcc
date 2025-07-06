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

    const paymentIntent = stripeEvent.data.object;

    if (paymentIntent.metadata && paymentIntent.metadata.uid) {
        var {
            visitorId,
            uid,
            productName
        } = paymentIntent.metadata;
        console.log('ID do usuário:', uid);
    } else {
        return res.sendStatus(200);
    }
    const paymentMethodId = paymentIntent.payment_method;

    if (stripeEvent.type === 'payment_intent.succeeded') {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        const name = paymentMethod.billing_details.name;
        const userEmail = paymentMethod.billing_details.email;
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

            const sessionId = paymentIntent.id;
            const amount = paymentIntent.amount;
            const currency = paymentIntent.currency;
            try {
                await userRef.set({
                    purchases: admin.firestore.FieldValue.arrayUnion({
                        productName: productName,
                        purchaseDate: admin.firestore.Timestamp.now(),
                        sessionId,
                        amount,
                        currency
                    }),
                    phone: paymentIntent.metadata.phone
                }, {
                    merge: true
                });

                await admin.auth().setCustomUserClaims(uid, {
                    course_purchased: true,
                });

                console.log("Claim de role adicionado com sucesso!");

                console.log(`Compra registrada para o usuário ${uid}`);

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
                const pi = stripeEvent.data.object;
                const charge = pi.charges.data[0];
                const method = charge.payment_method_details;
                let halfway;
                if (method.card) {
                    halfway = 'Cartão';
                } else if (method.boleto) {
                    halfway = 'Boleto';
                } else if (method.pix) {
                    halfway = 'Pix';
                } else {
                    halfway = '[Metado não reconhecido]'
                    console.log('Outro método:', Object.keys(paymentMethodDetails));
                }
                adminUsersSnapshot.forEach(adminUserDoc => {
                    const adminUserData = adminUserDoc.data();
                    const adminUserToken = adminUserData.token;

                    const message = {
                        token: adminUserToken,
                        notification: {
                            title: `Venda realizada via ${halfway}`,
                            body: `Nome do comprador: ${name}. Valor: R$${(amount / 100).toFixed(2)}. Produto: ${productName}.`,
                        },
                        android: {
                            notification: {
                                icon: 'https://admin.nailsgessyca.com.br/assets/images/nailsyca.png',
                            },
                        },
                        webpush: {
                            headers: {
                                Urgency: 'high'
                            },
                            notification: {
                                click_action: 'https://admin.nailsgessyca.com.br',
                                icon: 'https://admin.nailsgessyca.com.br/assets/images/nailsyca.png',
                            },
                        },
                        data: {
                            productName: productName,
                            purchaseDate: admin.firestore.Timestamp.now().toString(),
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
        const paymentIntent = stripeEvent.data.object;

        // Verifica se há charges associadas
        const charges = paymentIntent.charges?.data;
        if (!charges || charges.length === 0) {
            console.error('Nenhuma charge encontrada no paymentIntent.');
            return;
        }

        const charge = charges[0];

        // Extrai dados do cliente
        const userName = charge.billing_details?.name || 'Cliente';
        const userEmail = charge.billing_details?.email;
        const uid = paymentIntent.metadata?.uid;

        // Verifica se foi realmente reembolsado
        if (charge.refunded || charge.amount_refunded > 0) {
            // Envia e-mail
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const valorReembolsado = (charge.amount_refunded / 100).toFixed(2);

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: 'Reembolso processado',
                text: `Olá ${userName},\n\nSeu reembolso no valor de R$ ${valorReembolsado} foi processado com sucesso. O valor será devolvido para o método de pagamento original.\n\nCom carinho,\nGessyca Nails ♥️`,
            };

            await transporter.sendMail(mailOptions);
            console.log(`E-mail enviado para ${userEmail}`);

            // Remove compra do Firestore
            const userRef = db.collection('users').doc(uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.error('Usuário não encontrado:', uid);
                return;
            }

            const purchases = userDoc.data().purchases || [];
            const updatedPurchases = purchases.filter(p => p.sessionId !== charge.metadata?.session_id);

            await userRef.update({
                purchases: updatedPurchases
            });

            // Remove claims personalizadas se necessário
            await admin.auth().setCustomUserClaims(uid, {
                course_purchased: false
            });

            console.log(`Compra removida do Firestore para o usuário ${uid}`);
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