// functions/sendEmail.js

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OPTIONS recebido' }),
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: 'Method Not Allowed',
        };
    }

    const data = JSON.parse(event.body);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: 'gessycanailsart@gmail.com',
        to: 'gessycanailsart@gmail.com',
        subject: `Suporte: ${data.subject}`,
        text: `Mensagem de: ${data.userEmail}\n\n${data.message}`,
        replyTo: data.userEmail, // Isso permitirá responder diretamente ao usuário
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('E-mail enviado:', info.response);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'E-mail enviado com sucesso!' }),
        };
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro ao enviar e-mail.' }),
        };
    }
};
