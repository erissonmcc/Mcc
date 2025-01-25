const {
    db,
    auth,
    admin
} = require('./firebaseAdmin');

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

    if (event.httpMethod !== 'POST') {
        console.log('Solicitação não permitida:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Método não permitido'
            }),
        };
    }
    try {

        const token = event.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            console.error('Token de autenticação não encontrado');
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({
                    error: 'Token de autenticação não encontrado!'
                }),
            };
        }

        console.log('Token encontrado, verificando ID do usuário');
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('ID do usuário:', userId);
        const {
            email,
            password
        } = JSON.parse(event.body);
        // Atualiza o usuário anônimo com o e-mail e senha
        const userRecord = await admin.auth().updateUser(userId, {
            email: email,
            password: password,
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: 'Usuário autenticado!'
            }),
        };
        console.log("Conta migrada com sucesso:", userRecord.toJSON());
    } catch (e) {
        console.log('Error ao registrar usuário', e);
    }
};
