import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';
import crypto from 'crypto';

import admin from 'firebase-admin';
const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString();

const serviceAccount = JSON.parse(json);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nails-gessyca-default-rtdb.firebaseio.com',
    });
}
const db = admin.firestore();

async function renewToken(doc, data) {
    // Gerar um novo token
    const newToken = crypto.randomBytes(64).toString('hex');

    // Atualizar o token e o prazo de validade
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Renovar por mais 1 hora

    await db.collection('pendingAccounts').doc(doc.id).update({
        token: newToken,
        expiresAt: expiresAt.toISOString(),
        numberOfAttempts: 0
    });

    console.log('Token renovado com sucesso!');
    const transporter = nodemailer.createTransport({
        host: "smtp.umbler.com",
        port: 587,
        secure: false,
        auth: {
            user: "contato@nailsgessyca.com.br",
            pass: process.env.EMAIL_PASS,
        },
    });

    // Enviar o novo link por e-mail
    const mailOptions = {
        from: '"Nails Gessyca" <contato@nailsgessyca.com.br>',
        to: data.email,
        subject: 'Link Expirou ou Bloqueado',
        text: 'O link para criar sua conta expirou ou foi bloqueado!',
        html: `
        <html>
        <body>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0; padding: 0;">
        <tr>
        <td style="padding: 40px 20px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">

        <!-- Header com ícone -->
        <tr>
        <td style="background: linear-gradient(135deg, #b780ff 0%, #9f5aff 100%); padding: 40px 30px; text-align: center;">
        <div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px;">⚠️</div>
        <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0; line-height: 1.3;">Link Expirado ou Bloqueado</h1>
        <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 10px 0 0 0;">Não se preocupe, vamos resolver isso!</p>
        </td>
        </tr>

        <!-- Conteúdo principal -->
        <tr>
        <td style="padding: 40px 30px;">

        <div style="text-align: left;">
        <p style="font-size: 18px; color: #333333; margin: 0 0 15px 0; font-weight: 500;">Olá, <strong style="color: #b780ff;">${data.name}</strong>! 👋</p>

        <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0 0 25px 0;">
        Percebemos que o link anterior para criar sua conta expirou ou foi bloqueado! Isso é completamente normal e acontece por motivos de segurança.
        </p>

        <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f2ff 100%); border-left: 4px solid #b780ff; padding: 20px; border-radius: 8px; margin: 0 0 30px 0;">
        <p style="font-size: 14px; color: #555555; margin: 0; line-height: 1.5;">
        <strong>💡 Por que isso acontece?</strong><br>
        Os links têm limite de validade e são bloqueados quando acessados de locais diferentes por segurança.
        </p>
        </div>

        <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0 0 35px 0;">
        Geramos um novo link especialmente para você! Clique no botão abaixo para criar sua conta com segurança.
        </p>
        </div>

        <!-- Botão de ação -->
        <div style="text-align: center; margin: 0 0 20px 0;">
        <a href="${process.env.URL_REGISTER}/?tokenRegister=${newToken}" style="display: inline-block; text-decoration: none; background: linear-gradient(135deg, #b780ff 0%, #9f5aff 100%); color: #ffffff; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 50px; box-shadow: 0 8px 25px rgba(183, 128, 255, 0.4); transition: all 0.3s ease;">
        ✨ Criar Minha Conta
        </a>
        </div>

        <div style="text-align: center;">
        <p style="font-size: 12px; color: #999999; margin: 0;">
        Este link é válido por 1 hora e deve ser usado apenas por você.
        </p>
        </div>

        </td>
        </tr>

        <!-- Footer -->
        <tr>
        <td style="background: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
        <p style="font-size: 14px; color: #666666; margin: 0 0 10px 0;">
        Precisa de ajuda? Entre em contato conosco! 💬
        </p>
        <p style="font-size: 12px; color: #999999; margin: 0;">
        Este é um email automático, por favor não responda.
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

    return {
        code: 'auth/new-link'
    };
}

export const processVerifytoken = async (req, res) => {

    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        res.status(200).json({
            message: 'OPTIONS recebido'
        });
        return;
    }

    if (req.method !== 'POST') {
        console.log('Solicitação não permitida:', req.method);
        res.status(405).json({
            error: 'Método não permitido'
        });
        return;
    }


    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            res.status(401).json({
                message: 'Token não fornecido', code: 'auth/no-token'
            });
            return;
        }

        const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

        if (snapshot.empty) {
            res.status(401).json({
                message: 'Token inválido', code: 'auth/invalid-token'
            });
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        if (data.numberOfAttempts > 2) {
            renewToken(doc, data);

            res.status(401).json({
                code: 'auth/unauthorized-block'
            });
            return;
        }
        const {
            visitorId
        } = req.body;

        if (data.visitorId !== visitorId || !data.visitorId) {
            await db.collection('pendingAccounts').doc(doc.id).update({
                numberOfAttempts: admin.firestore.FieldValue.increment(1)
            });

            res.status(401).json({
                code: 'auth/unauthorized-ip'
            });
            return;
        }

        // Verificar se o token ainda é válido
        const now = new Date();
        if (new Date(data.expiresAt) < now) {
            const dataRenewToken = await renewToken(doc, data);
            if (dataRenewToken.code === 'auth/new-link') {
                res.status(401).json({
                    code: 'auth/new-link'
                });
                return;
            }
        }

        res.status(200).json({
            code: 'auth/authorized-access'
        });
    } catch (error) {
        console.error('Erro ao processar a solicitação:', error);
        res.status(500).json({
            error: 'Erro interno ao processar a solicitação.'
        });
    }
}