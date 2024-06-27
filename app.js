const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const app = express();

// Configurar CORS e body-parser
app.use(cors());
app.use(bodyParser.json());

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://project-527236456282.firebaseio.com"
});

// Definir a porta do servidor
const PORT = process.env.PORT || 3000;

// Rota para criar uma sessão de checkout
app.post('/criar-sessao', async (req, res) => {
  const { uid, email, displayName } = req.body;
  console.log('Dados do usuário:', { uid, email, displayName });

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

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
  }
});

// Webhook para tratar eventos da Stripe
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Erro ao validar assinatura do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manipular o evento
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Ações para lidar com pagamento bem-sucedido
        console.log('Pagamento bem-sucedido:', paymentIntent);
        break;
      case 'invoice.payment_failed':
        const invoice = event.data.object;
        // Ações para lidar com falha de pagamento de fatura
        console.log('Falha no pagamento da fatura:', invoice);
        break;
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        // Ações para lidar com falha de pagamento
        console.log('Falha no pagamento:', failedPaymentIntent);
        break;
      case 'charge.refunded':
        const refundedCharge = event.data.object;
        // Ações para lidar com reembolso de cobrança
        console.log('Cobrança reembolsada:', refundedCharge);
        break;
      default:
        console.warn(`Evento não tratado: ${event.type}`);
    }
  } catch (error) {
    console.error('Erro ao processar evento:', error);
    return res.status(500).send(`Erro ao processar evento: ${error.message}`);
  }

  res.status(200).send('Evento recebido');
});

// Inicia o servidor na porta especificada
app.listen(PORT, () => {
  console.log(`Servidor Express está rodando na porta ${PORT}`);
});