import { db, admin } from './firebaseAdmin';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
  storageBucket: "nail-art-by-gessica.appspot.com"
});
}

const db = admin.firestore();

async function renewToken(email) {
    // Buscar a conta pendente pelo e-mail
    const snapshot = await db.collection('pendingAccounts').where('email', '==', email).get();

    if (snapshot.empty) {
        throw new Error('Conta pendente não encontrada para este e-mail.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Gerar um novo token
    const newToken = crypto.randomBytes(64).toString('hex');

    // Atualizar o token e o prazo de validade
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Renovar por mais 1 hora

    await db.collection('pendingAccounts').doc(doc.id).update({
        token: newToken,
        expiresAt: expiresAt.toISOString(),
    });

    console.log('Token renovado com sucesso!');
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Enviar o novo link por e-mail
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: data.email,
        subject: 'Criar sua conta',
        text: 'O link para completar sua conta expirou!',
        html: `
        <html>
        <body>
        <h1 style="color: #fff; text-align: center;">O link para completar sua conta expirou</h1>
        <p style="font-size: 16px; font-family: Arial, sans-serif;">Olá, <strong>${data.name}</strong>,</p>
        <p style="font-size: 16px; font-family: Arial, sans-serif;">Percebemos que o link anterior para criar sua conta expirou! Não se preocupe, isso é completamente normal. Por motivos de segurança, os links têm um limite de validade. Geramos um novo link para você! Clique no botão abaixo para criar sua conta.</p>
        <a href="http://localhost:8080/?register=true&token=${newToken}" style="text-decoration: none;">
        <button style="background-color: #b780ff; color: white; font-size: 16px; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-family: Arial, sans-serif;">
        Criar uma conta
        </button>
        </a>
        </body>
        </html>
        `,
    };
    await transporter.sendMail(mailOptions);

    return { code: 'auth/new-link' };
}

export default async function handler(req, res) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        res.set(headers).status(200).json({ message: 'OPTIONS recebido' });
        return;
    }

    if (req.method !== 'GET') {
        console.log('Solicitação não permitida:', req.method);
        res.set(headers).status(405).json({ error: 'Método não permitido' });
        return;
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            res.set(headers).status(401).json({ message: 'Token não fornecido', code: 'auth/no-token' });
            return;
        }

        const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

        if (snapshot.empty) {
            res.set(headers).status(401).json({ message: 'Token inválido', code: 'auth/invalid-token' });
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        console.log('Ip do usuário:', userIp);

        if (data.ip !== userIp) {
            res.set(headers).status(401).json({ code: 'auth/unauthorized-ip' });
            return;
        }

        // Verificar se o token ainda é válido
        const now = new Date();
        if (new Date(data.expiresAt) < now) {
            const dataRenewToken = await renewToken(data.email);
            if (dataRenewToken.code === 'auth/new-link') {
                res.set(headers).status(401).json({ code: 'auth/new-link' });
                return;
            }
        }

        res.set(headers).status(200).json({ code: 'auth/authorized-access' });
    } catch (error) {
        console.error('Erro ao processar a solicitação:', error);
        res.set(headers).status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
}
