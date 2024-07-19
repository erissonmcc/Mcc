const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

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

    if (stripeEvent.type === 'checkout.session.expired') {
        const session = stripeEvent.data.object;
        const userName = session.metadata.displayName;
        const userEmail = session.customer_email;

        // Configurar o transporte de e-mail
        const transporter = nodemailer.createTransport({
            service: 'gmail', // ou outro serviço de e-mail
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Definir a mensagem do e-mail
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Finalização da Matrícula',
            text: `Olá, ${userName}!\n\nPercebi que você começou a se matricular em nosso site, mas algo te impediu de finalizar. Vamos resolver isso juntos?\n\nResponda com o plano desejado e a forma de pagamento (cartão de crédito ou boleto) que eu te ajudo a finalizar a matrícula.\n\nCom carinho,\nGessyca 💅`,
        };

        // Enviar o e-mail
        try {
            await transporter.sendMail(mailOptions);
            console.log('E-mail enviado para o usuário:', userEmail);
        } catch (error) {
            console.error('Erro ao enviar e-mail:', error);
            return {
                statusCode: 500,
                body: `Erro ao enviar e-mail: ${error.message}`,
            };
        }
    }

    return {
        statusCode: 200,
        body: 'Evento processado com sucesso',
    };
};
