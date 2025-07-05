import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10' // use a versão atual da sua conta
});

/**
 * Função para reembolsar um boleto (via Payment Intent)
 * @param {string} paymentIntentId - ID do PaymentIntent a ser reembolsado
 */
async function reembolsarBoleto(paymentIntentId) {
  try {
    // Buscar o payment intent (opcional, para checagem extra)
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== 'succeeded') {
      console.error('Pagamento ainda não foi concluído. Não é possível reembolsar.');
      return;
    }

    // Criar o reembolso
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer'
    });

    console.log('Reembolso solicitado com sucesso!');
    console.log(`ID do reembolso: ${refund.id}`);
    console.log(`Status do reembolso: ${refund.status}`);
  } catch (error) {
    console.error('Erro ao solicitar reembolso:', error.message);
  }
}

// Exemplo de uso
const paymentIntentId = 'pi_3Rh8cHEuDtdGrglw0RXZpCp0'; // Substitua pelo ID real
reembolsarBoleto(paymentIntentId);
