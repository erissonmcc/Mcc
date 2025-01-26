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
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'Token de autenticação não encontrado!'
                }),
            };
        }
        const {
            email,
            password,
            isEmail
        } = JSON.parse(event.body);
        // Verificar se o email já está registrado em outra conta
        console.log('Verificando se o email já está registrado:', email);
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            if (existingUser) {
                console.error('O email já está associado a outra conta:', existingUser.uid);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'O email já está registrado em outra conta!',
                        code: 'auth/email-in-use'
                    }),
                };
            }
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                console.error('Usuário não encontrado!:', error);
            } else {
                console.error('Erro ao verificar conta:', error);
            }
        }

        let userId;
        if (isEmail === true) {
            const userData = validateTokenAndGetUserData(token, event);
            if (userData.expired) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Token Expirado!',
                        code: 'auth/token-expired'
                    }),
                };
            } else if (userData.code === 'auth/unauthorized-ip') {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({
                        code: 'auth/unauthorized-ip'
                    }),
                };
            } else {
                userId = userData.uid;
            }

        } else {
            console.log('Token encontrado, verificando ID do usuário');
            const decodedToken = await admin.auth().verifyIdToken(token);
            userId = decodedToken.uid;
            console.log('ID do usuário:', userId);
        }

        // Atualiza o usuário anônimo com o e-mail e senha
        console.log('Atualizando o usuário anônimo:', userId);
        const userRecord = await admin.auth().updateUser(userId, {
            email: email,
            password: password,
        });

        console.log("Conta migrada com sucesso:", userRecord.toJSON());
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: 'Usuário autenticado e conta migrada com sucesso!'
            }),
        };
    } catch (e) {
        console.error('Erro ao registrar usuário:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Erro interno ao processar a solicitação.'
            }),
        };
    }
};

async function validateTokenAndGetUserData(token, event) {
    const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

    if (snapshot.empty) {
        throw new Error('Token inválido ou expirado.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Verificar se o token ainda é válido
    const now = new Date();
    if (new Date(data.expiresAt) < now) {
        return {
            expired: true,
        }
    }

    const userIp = event.headers['x-forwarded-for'] || (event.requestContext && event.requestContext.identity ? event.requestContext.identity.sourceIp: null);
    console.log('Ip do usuário:', userIp);
    if (data.ip !== userIp) {
        return {
            code: 'auth/unauthorized-ip'
        };
    }

    return {
        uid: doc.uid,
        email: data.email,
        expired: false,
    };
}
