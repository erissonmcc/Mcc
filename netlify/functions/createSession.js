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
    const { uid, email, displayName, token, fullName } = requestBody;

    console.log('Dados do usuário:', { uid, email, displayName, fullName });

    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.uid !== uid) {
      console.log('UID no token JWT não corresponde ao UID fornecido');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'UID não autorizado' }),
      };
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

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

    if (userData.purchases && userData.purchases.some(purchase => purchase.productName === 'Postiça realista iniciante e aperfeiçoamento')) {
      console.log('Usuário já comprou o curso. Recusando a criação da sessão.');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Usuário já comprou o curso' }),
      };
    }

    const existingSession = await db.collection('checkout_sessions')
                                   .where('uid', '==', uid)
                                   .where('productName', '==', 'Postiça realista iniciante e aperfeiçoamento')
                                   .where('expiresAt', '>', new Date())
                                   .limit(1)
                                   .get();

    if (!existingSession.empty) {
      const sessionData = existingSession.docs[0].data();
      console.log('Sessão existente encontrada:', sessionData.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ id: sessionData.id }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'boleto'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: 'Postiça realista iniciante e aperfeiçoamento',
          },
          unit_amount: 3400,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      cancel_url: 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      customer_email: email,
      billing_address_collection: {
        requested: ['name'],
      },
      metadata: {
        uid: uid,
        displayName: displayName,
      },
    });

    await db.collection('checkout_sessions').doc(session.id).set({
      uid: uid,
      productName: 'Postiça realista iniciante e aperfeiçoamento',
      id: session.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas a partir de agora
    });

    console.log('Sessão criada com sucesso:', session);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id }),
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
