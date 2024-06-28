const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
  const stripeSignature = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, stripeSignature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Erro ao verificar assinatura do webhook:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // Tente obter o UID do metadata
    let uid = session.metadata ? session.metadata.uid : null;

    if (!uid) {
      // Tente obter o UID a partir do email do usuário no Firestore
      const email = session.customer_email;
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).get();
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
      }
    }

    if (uid) {
      // Registro da compra no Firestore
      const userRef = db.collection('users').doc(uid);
      await userRef.update({
        purchases: admin.firestore.FieldValue.arrayUnion({
          productName: 'Postiça realista iniciante e aperfeiçoamento',
          purchaseDate: admin.firestore.Timestamp.now(),
          sessionId: session.id,
          amount: session.amount_total,
          currency: session.currency,
        }),
      });

      console.log(`Compra registrada para o usuário ${uid}`);
    } else {
      console.error('UID não encontrado para o email:', session.customer_email);
    }
  }

  return {
    statusCode: 200,
    body: 'Evento processado com sucesso',
  };
};
