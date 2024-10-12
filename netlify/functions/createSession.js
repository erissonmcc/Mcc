const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db, auth } = require('./firebaseAdmin');

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
      body: JSON.stringify({ message: 'OPTIONS recebido' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    console.log('Solicitação não permitida:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { uid, email, displayName, token, productId } = requestBody;

    console.log('Dados do usuário:', { uid, email, displayName, productId, token });

    // Verificar se o usuário existe e obter dados do Firestore
    const userRef = db.collection('users').doc(uid);
    const productRef = db.collection('products').doc(productId);
    console.log('Id do produto', productId);
    const [userDoc, productDoc, existingSessionSnapshot] = await Promise.all([
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
        body: JSON.stringify({ error: 'Usuário não encontrado' }),
      };
    }

    const userData = userDoc.data();
    if (userData.email !== email) {
      console.log('Email ou nome de usuário não correspondem');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Email ou nome de usuário não autorizado' }),
      };
    }

    if (!productDoc.exists) {
      console.log('Produto não encontrado');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Produto não encontrado' }),
      };
    }

    const productData = productDoc.data();
    if (!productData) {
      console.log('Dados do produto inválidos');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Dados do produto inválidos' }),
      };
    }

    if (!existingSessionSnapshot.empty) {
      const sessionData = existingSessionSnapshot.docs[0].data();
      console.log('Sessão existente encontrada:', sessionData.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ id: sessionData.id }),
      };
    }

    // Criar sessão de checkout com base nos dados do produto
    const session = await stripe.checkout.sessions.create({
      payment_method_types: productData.paymentMethods || ['card'], // Use o método de pagamento do produto ou 'card' por padrão
      line_items: [{
        price_data: {
          currency: productData.currency || 'brl',
          product_data: {
            name: productData.name,
          },
          unit_amount: productData.price,
        },
        quantity: productData.quantity || 1, // Use a quantidade do produto ou 1 por padrão
      }],
      mode: 'payment',
      success_url: productData.successUrl || 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      cancel_url: productData.cancelUrl || 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      customer_email: email,
      billing_address_collection: 'required',
      metadata: {
        uid: uid,
        displayName: displayName,
        productId: productId,
      },
    });

    await db.collection('checkout_sessions').doc(session.id).set({
      uid: uid,
      productId: productId,
      productName: productData.name,
      id: session.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas a partir de agora
    });

    console.log('Sessão criada com sucesso:', session);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id, url: session.url }),
    };
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro ao criar sessão de checkout' }),
    };
  }
};
