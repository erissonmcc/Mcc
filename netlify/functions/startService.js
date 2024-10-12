const { dbRealtime, auth } = require('./firebaseAdmin');

function gerarProtocolo() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const numeroAleatorio = Math.floor(1000000000 + Math.random() * 9000000000);
    return `${ano}${mes}${dia}${numeroAleatorio}`;
}

exports.handler = async (event) => {
    // Permitir métodos OPTIONS para CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: JSON.stringify({ message: 'OPTIONS recebido' }),
        };
    }

    if (event.httpMethod === 'POST') {
        try {
            // Verifica e decodifica o token de autenticação
            const token = event.headers.authorization?.split('Bearer ')[1];
            if (!token) {
                return {
                    statusCode: 401,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    },
                    body: JSON.stringify({ message: 'Token de autenticação ausente.' }),
                };
            }

            console.log('Decodificando token');
            const decodedToken = await auth.verifyIdToken(token);
            console.log('Token decodificado', decodedToken);
            const userUID = decodedToken.uid;

            const protocolo = gerarProtocolo();
            const atendimentoRef = dbRealtime.ref(`gessybot/${protocolo}`);

            await atendimentoRef.set({
                usuarioId: userUID,
                dataAbertura: new Date().toISOString(),
            });

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                },
                body: JSON.stringify({ protocolo }),
            };
        } catch (error) {
            console.error('Erro ao iniciar o atendimento:', error); // Log adicional para ajudar na depuração
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                },
                body: JSON.stringify({ message: 'Erro ao iniciar o atendimento.', error: error.message }),
            };
        }
    }

    return {
        statusCode: 405,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ message: 'Método não permitido.' }),
    };
};
