const nodemailer = require('nodemailer');

async function obterLocalizacaoIP(ip) {
    const token = '4fd49878ba7c93'; // Substitua pelo seu token de acesso da ipinfo.io
    const fetch = (await import('node-fetch')).default;
    
    try {
        const response = await fetch(`https://ipinfo.io/${ip}/json?token=${token}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao obter localização do IP:', error);
        return { city: 'Não disponível', region: 'Não disponível', country: 'Não disponível' }; // Valor de fallback
    }
}

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

    // Obtenção da localização do IP
    const localizacao = await obterLocalizacaoIP(data.userIP);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: 'contatogessycanails@gmail.com',
        to: 'gessycanailsart@gmail.com',
        subject: `Suporte: ${data.subject}`,
        html: `
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            color: #333;
                            margin: 20px;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        h2 {
                            color: #ff69b4;
                            border-bottom: 2px solid #ff69b4;
                            padding-bottom: 10px;
                        }
                        p {
                            line-height: 1.6;
                        }
                        .highlight {
                            background-color: #e0f7fa;
                            padding: 10px;
                            border-left: 5px solid #00bcd4;
                            margin-bottom: 20px;
                        }
                        .footer {
                            font-size: 0.9em;
                            color: #666;
                            margin-top: 20px;
                            border-top: 1px solid #ddd;
                            padding-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <h2>Mensagem de Suporte</h2>
                    <p><strong>De:</strong> ${data.userEmail}</p>
                    <p><strong>Assunto:</strong> ${data.subject}</p>
                    <p><strong>IP do Usuário:</strong> ${data.userIP}</p>
                    <p><strong>Localização do IP:</strong></p>
                    <p>Cidade: ${localizacao.city || 'Não disponível'}</p>
                    <p>Região: ${localizacao.region || 'Não disponível'}</p>
                    <p>País: ${localizacao.country || 'Não disponível'}</p>
                    <p><strong>User Agent:</strong> ${data.userAgent || 'Não disponível'}</p>
                    <div class="highlight">
                        <p><strong>Mensagem:</strong></p>
                        <p>${data.message}</p>
                    </div>
                    <div class="footer">
                        <p>As cidades mostradas são estimativas e não refletem endereços exatos. Esta informação é baseada no IP do usuário e pode não ser 100% precisa..</p>
                    </div>
                </body>
            </html>
        `,
        replyTo: data.userEmail, // Isso permite responder diretamente ao usuário
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
