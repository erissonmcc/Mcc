import dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
  storageBucket: "nail-art-by-gessica.appspot.com"
});

const db = admin.firestore();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

export const processCheckout = async (req, res) => {
    console.log('Nova solicitação recebida:', req.method, req.url);

    // Configurar cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Verificar se é uma solicitação OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        return res.status(200).json({ message: 'OPTIONS recebido' });
    }

    // Verificar método HTTP
    if (req.method !== 'GET') {
        console.log('Solicitação não permitida:', req.method);
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        // Obter o token de autenticação
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            console.error('Token de autenticação não encontrado');
            return res.status(401).json({ error: 'Token de autenticação não encontrado!' });
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        const { productId } = req.query;
        console.log('Dados do usuário:', { userId, productId });

        // Obter dados do Firestore
        const userRef = db.collection('users').doc(userId);
        const productRef = db.collection('products').doc(productId);

        const [userDoc, productDoc, existingSessionSnapshot] = await Promise.all([
            userRef.get(),
            productRef.get(),
            db.collection('checkout_sessions')
                .where('uid', '==', userId)
                .where('productId', '==', productId)
                .where('expiresAt', '>', new Date())
                .limit(1)
                .get(),
        ]);

        if (!productDoc.exists) {
            console.log('Produto não encontrado');
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const productData = productDoc.data();
        if (!productData) {
            console.log('Dados do produto inválidos');
            return res.status(400).json({ error: 'Dados do produto inválidos' });
        }

        if (!existingSessionSnapshot.empty) {
            const sessionData = existingSessionSnapshot.docs[0].data();
            console.log('Sessão existente encontrada:', sessionData.id);
            return res.status(200).json({ id: sessionData.id, url: sessionData.url });
        }


        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        // Criar a sessão no Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: productData.currency || 'brl',
                    product_data: { name: productData.name },
                    unit_amount: productData.priceAvista,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: productData.successUrl || 'http://localhost:2435/success',
            cancel_url: productData.cancelUrl || 'http://localhost:2435/cancel',
            billing_address_collection: 'required',
            metadata: {
                ip: userIp,
                productName: productData.name,
                uid: userId,
                productId: productData.productId,
            },
        });

        console.log('Sessão criada com sucesso:', session);

        // Salvar a sessão no Firestore
        await db.collection('checkout_sessions').doc(session.id).set({
            uid: userId,
            productId,
            productName: productData.name,
            id: session.id,
            url: session.url,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas a partir de agora
        });

        console.log('Sessão criada com sucesso:', session);
        return res.status(200).json({ id: session.id, url: session.url });
    } catch (error) {
        console.error('Erro ao criar sessão de checkout:', error);
        return res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
    }
}
