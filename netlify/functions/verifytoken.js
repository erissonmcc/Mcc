const {
    db,
    admin
} = require('./firebaseAdmin');
const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    if (event.httpMethod !== 'GET') {
        console.log('Solicitação não permitida:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Método não permitido'
            }),
        };
    }
    
    const token = event.headers.authorization?.split('Bearer ')[1];
        
    const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

    if (snapshot.empty) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                message: 'Token inválido',
                code: 'auth/invalid-token'
            }),
        };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Verificar se o token ainda é válido
    const now = new Date();
    if (new Date(data.expiresAt) < now) {
        renewToken(data.email);
    }

    return {
        uid: doc.id,
        email: data.email,
        expired: false,
    };
}

async function renewToken(email) {
    // Buscar a conta pendente pelo e-mail
    const snapshot = await db.collection('pendingAccounts').where('email', '==', email).get();

    if (snapshot.empty) {
        throw new Error('Conta pendente não encontrada para este e-mail.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Gerar um novo token
    const newToken = crypto.randomBytes(32).toString('hex');

    // Atualizar o token e o prazo de validade
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Renovar por mais 7 dias

    await db.collection('pendingAccounts').doc(doc.id).update({
        token: newToken,
        expiresAt: expiresAt.toISOString(),
    });

    console.log('Token renovado com sucesso!');
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Enviar o novo link por e-mail
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Criar sua conta',
        text: 'O link para completar sua conta expirou!',
        html: `
        <html>
        <body>
        <h1 style="color: #fff; text-align: center;">O link para completar sua conta expirou </h1>
        <p style="font-size: 16px; font-family: Arial, sans-serif;">Olá, <strong>${name}</strong>,</p>
        <p style="font-size: 16px; font-family: Arial, sans-serif;">Percebemos que o link anterior para criar sua conta expirou! Não se preocupe isso é completamente normal, por motivos de segurança, os links tem um limite de validade. Geramos um novo link para completar sua conta!</p>
        <a href="http://localhost:8080/?register=true&token=${newToken}" style="text-decoration: none;">
        <button style="background-color: #b780ff; color: white; font-size: 16px; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-family: Arial, sans-serif;">
        Criar uma conta!
        </button>
        </a>
        </body>
        </html>
        `,
    };
    await transporter.sendMail(mailOptions);

    return 'Novo link enviado para o e-mail.';
}
