const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Permitir solicitações de qualquer origem temporariamente (CORS)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Verificar o método da solicitação
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  // Obter dados do corpo da solicitação (dados do usuário)
  const requestBody = JSON.parse(event.body);
  const { uid, email, displayName } = requestBody;

  // Log dos dados do usuário
  console.log('Dados do usuário:', { uid, email, displayName });

  // Criar sessão de checkout na Stripe
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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

    // Log da sessão criada
    console.log('Sessão criada com sucesso:', session);

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
