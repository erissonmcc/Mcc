const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
    db,
    auth,
    admin
} = require('./firebaseAdmin');

exports.handler = async (event, context) => {
    console.log('Nova solicitação recebida:', event.httpMethod, event.path);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'OPTIONS recebido'
            }),
        };
    }

    if (event.httpMethod !== 'GET') {
        console.log('Solicitação não permitida:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Método não permitido'
            }),
        };
    }

    try {
        const token = event.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            console.error('Token de autenticação não encontrado');
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({
                    error: 'Token de autenticação não encontrado!'
                }),
            };
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        const {
            productId
        } = event.queryStringParameters;

        console.log('Dados do usuário:', {
            userId, productId
        });

        // Verificar se o usuário existe e obter dados do Firestore
        const userRef = db.collection('users').doc(userId);
        const productRef = db.collection('products').doc(productId);
        console.log('Id do produto', productId);
        const [userDoc,
            productDoc,
            existingSessionSnapshot] = await Promise.all([
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
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'Produto não encontrado'
                }),
            };
        }

        const productData = productDoc.data();
        if (!productData) {
            console.log('Dados do produto inválidos');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Dados do produto inválidos'
                }),
            };
        }

        if (!existingSessionSnapshot.empty) {
            const sessionData = existingSessionSnapshot.docs[0].data();
            console.log('Sessão existente encontrada:', sessionData.id);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    id: sessionData.id, url: sessionData.url
                }),
            };
        }


        let session;
        const tokenParts = [
            token.substring(0, 500),
            // Primeira parte (até 500 caracteres)
            token.substring(500, 1000),
            // Segunda parte (próximos 500 caracteres)
            token.substring(1000, 1500) // Terceira parte (últimos 500 caracteres)
        ];

        // Sessão para pagamento único
        session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: productData.currency || 'brl',
                    product_data: {
                        name: productData.name,
                    },
                    unit_amount: productData.priceAvista,
                },
                quantity: 1,
            },
            ],
            mode: 'payment', // Modo para pagamento único
            success_url: productData.successUrl || 'http://localhost:2435/success',
            cancel_url: productData.cancelUrl || 'http://localhost:2435/cancel',
            billing_address_collection: 'required',
            metadata: {
                productName: productData.name,
                token_part1: tokenParts[0], // Primeira parte do token
                token_part2: tokenParts[1], // Segunda parte do token
                token_part3: tokenParts[2], // Terceira parte do token
                productId: productData.productId,
            },
        });

        console.log('Sessão criada com sucesso:', session);

        await db.collection('checkout_sessions').doc(session.id).set({
            uid: userId,
            productId: productId,
            productName: productData.name,
            id: session.id,
            url: session.url,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas a partir de agora
        });

        console.log('Sessão criada com sucesso:', session);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: session.id, url: session.url
            }),
        };
    } catch (error) {
        console.error('Erro ao criar sessão de checkout:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Erro ao criar sessão de checkout'
            }),
        };
    }
};
