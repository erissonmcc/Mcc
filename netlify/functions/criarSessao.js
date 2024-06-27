const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { uid, email, displayName } = JSON.parse(event.body);

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
        displayName: displayName
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao criar sessão de checkout' }),
    };
  }
};
