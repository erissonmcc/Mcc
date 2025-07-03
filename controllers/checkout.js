import dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
import admin from 'firebase-admin';
import pkg from 'google-libphonenumber';
import { randomUUID } from 'crypto';

const { PhoneNumberUtil, PhoneNumberFormat } = pkg;
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: "nail-art-by-gessica.appspot.com"
    });
}
const db = admin.firestore();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

export const processCheckout = async (req, res) => {
    console.log('Nova solicitação recebida:', req.method, req.url);

    // CORS
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin); // <- pega dinamicamente do request
res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'OPTIONS recebido' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token de autenticação não encontrado!' });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        const { productId, phone, visitorId } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'O número de telefone é obrigatório.' });
        }

        let e164Phone;
        try {
            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parseAndKeepRawInput(phone, null);

            if (!phoneUtil.isValidNumber(phoneNumber)) {
                throw new Error('Número de telefone inválido.');
            }

            e164Phone = phoneUtil.format(phoneNumber, PhoneNumberFormat.E164);
        } catch (e) {
            console.error('Erro de validação do telefone:', e.message);
            return res.status(400).json({
                error: 'Formato de número de telefone inválido. Verifique o número e o código do país.'
            });
        }

        let productName, amount;
        if (productId === 'PR20-X9A7G1ZK') {
            productName = 'Portiça Realista 2.0';
            amount = 50;
        } else {
            return res.status(404).json({
                error: 'Erro ao processar o pagamento. Produto não encontrado.',
            });
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'brl',
            metadata: {
                uid: userId,
                productId: productId,
                productName: productName,
                phone: e164Phone,
                visitorId: visitorId,
            }
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error) {
        console.error('Erro ao processar a requisição:', error.message);

        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
        }

        res.status(500).json({
            error: 'Erro ao processar o pagamento. Tente novamente mais tarde.',
            message: error.message,
        });
    }
}