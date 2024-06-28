const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
  console.log('Nova solicitação recebida:', event.httpMethod, event.path);

  // Configuração dos cabeçalhos padrão
  const headers = {
    'Access-Control-Allow-Origin': '*', // Permitir todas as origens. Modifique conforme necessário.
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Verificar o método da solicitação
  if (event.httpMethod === 'OPTIONS') {
    // Responder a solicitação OPTIONS sem processar a função
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
    // Obter dados do corpo da solicitação (dados do usuário)
    const requestBody = JSON.parse(event.body);
    const { uid, email, displayName } = requestBody;

    console.log('Dados do usuário:', { uid, email, displayName });

    // Verificar se o usuário já comprou o curso
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.purchases && userData.purchases.some(purchase => purchase.productName === 'Postiça realista iniciante e aperfeiçoamento')) {
        console.log('Usuário já comprou o curso. Recusando a criação da sessão.');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Usuário já comprou o curso' }),
        };
      }
    }

    // Verificar se já existe uma sessão de checkout válida para este usuário
    const sessionRef = db.collection('checkoutSessions').doc(uid);
    const sessionDoc = await sessionRef.get();

    if (sessionDoc.exists) {
      const sessionData = sessionDoc.data();
      const now = new Date();
      const sessionCreationTime = new Date(sessionData.created);
      const sessionExpirationTime = new Date(sessionCreationTime.getTime() + 24 * 60 * 60 * 1000);

      if (now < sessionExpirationTime) {
        console.log('Sessão de checkout existente encontrada e ainda válida:', sessionData.id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ id: sessionData.id }),
        };
      } else {
        console.log('Sessão de checkout existente encontrada, mas expirou.');
      }
    }

    // Criar nova sessão de checkout na Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'boleto'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: 'Postiça realista iniciante e aperfeiçoamento',
          },
          unit_amount: 3400, // Valor em centavos (R$ 34,00)
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      cancel_url: 'http://localhost:2435/storage/emulated/0/gessica/public/index.html',
      customer_email: email,
      billing_address_collection: 'required',
      metadata: {
        uid: uid,
        displayName: displayName,
      },
    });

    console.log('Sessão criada com sucesso:', session);

    // Salvar a sessão de checkout no Firestore
    await sessionRef.set({
      id: session.id,
      created: new Date().toISOString(),
    });

    // Retornar ID da sessão criada
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
