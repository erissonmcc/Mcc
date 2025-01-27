const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
    db,
    auth
} = require('./firebaseAdmin');

exports.handler = async (event, context) => {
    console.log('Nova solicitação recebida:', event.httpMethod, event.path);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (event.httpMethod !== 'POST') {
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
            return res.status(400).json({
                error: 'Token de autenticação não encontrado',
            });
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);

        const requestBody = JSON.parse(event.body);
        const {
            productId
        } = requestBody;

        console.log('Dados do usuário:', {
            uid, productId, token, email
        });

        // Verificar se o usuário existe e obter dados do Firestore
        const userRef = db.collection('users').doc(uid);
        const productRef = db.collection('products').doc(productId);
        console.log('Id do produto', productId);
        const [userDoc,
            productDoc,
            existingSessionSnapshot] = await Promise.all([
                userRef.get(),
                productRef.get(),
                db.collection('checkout_sessions')
                .where('uid', '==', uid)
                .where('productId', '==', productId)
                .where('expiresAt', '>', new Date())
                .limit(1)
                .get(),
            ]);

        if (!userDoc.exists) {
            console.log('Usuário não encontrado');
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'Usuário não encontrado'
                }),
            };
        }

        const userData = userDoc.data();

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


        // Cria a sessão do Stripe Checkout dinamicamente com as opções de pagamento
        const session = await stripe.checkout.sessions.create({
            payment_method_types: productData.paymentMethods || ['card'], // Métodos de pagamento (do Firestore ou 'card')
            line_items: [{
                price_data: {
                    currency: productData.currency || 'brl', // Moeda do produto (ou 'brl' por padrão)
                    product_data: {
                        name: productData.name, // Nome do produto
                    },
                    unit_amount: priceAvista, // Valor à vista
                },
                quantity: 1,
            },
                {
                    price_data: {
                        currency: productData.currency || 'brl', // Moeda do produto (ou 'brl' por padrão)
                        product_data: {
                            name: productData.name, // Nome do produto
                        },
                        unit_amount: priceParcelado, // Preço por parcela
                        recurring: {
                            interval: 'month', // Intervalo mensal para parcelamento
                            interval_count: 1, // Intervalo de 1 mês
                        },
                    },
                    quantity: numParcelas, // Número de parcelas (6x, por exemplo)
                },
            ],
            mode: 'payment',
            success_url: productData.successUrl || 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
            cancel_url: productData.cancelUrl || 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
            customer_email: email,
            billing_address_collection: 'required',
            metadata: {
                uid: uid,
                productId: productData.productId, // ID do produto
                productName: productData.name, // Nome do produto
                email: email, // Email do cliente
            },
        });

        await db.collection('checkout_sessions').doc(session.id).set({
            uid: uid,
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
