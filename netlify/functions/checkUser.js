const { db, admin } = require('./firebaseAdmin');
const fetch = require('node-fetch');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    try {
        const { token, code } = JSON.parse(event.body);
        console.log('Código de autorização recebido:', code);

        // Decodificar e verificar o token JWT
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email; // Obtendo o email do usuário do token
        console.log('Token verificado, ID do usuário:', userId, 'Email do usuário:', userEmail);

        // Informações sensíveis são obtidas de variáveis de ambiente
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        const redirectUri = process.env.DISCORD_REDIRECT_URI;
        const botToken = process.env.BOT_TOKEN; // Token do bot para atribuir o cargo

        // Trocar o código pelo token de acesso do Discord
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'client_id': clientId,
                'client_secret': clientSecret,
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirectUri
            })
        });

        if (!tokenResponse.ok) {
            console.error('Erro ao obter o token:', await tokenResponse.text());
            return { statusCode: tokenResponse.status, headers, body: JSON.stringify({ error: 'Erro ao obter o token' }) };
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log('Token de acesso obtido com sucesso.');

        // Obter informações do usuário do Discord
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!userResponse.ok) {
            console.error('Erro ao obter informações do usuário:', await userResponse.text());
            return { statusCode: userResponse.status, headers, body: JSON.stringify({ error: 'Erro ao obter informações do usuário' }) };
        }

        const discordUser = await userResponse.json();
        console.log('Informações do Discord obtidas:', discordUser);

        // Salvar as informações do Discord no Firestore no caminho users/${userId}/connections/discord
        const userRef = db.collection('users').doc(userId).collection('connections').doc('discord');
        await userRef.set({
            id: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator,
            avatar: discordUser.avatar,
            accessToken: accessToken
        });

        console.log('Informações do Discord salvas no Firestore.');

        // Verificar compras do usuário
        const usersRef = db.collection('users');
        const userQuery = await usersRef.where('email', '==', userEmail).get();

        if (userQuery.empty) {
            console.warn('Usuário não encontrado no Firestore:', userEmail);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Usuário não encontrado no Firestore' })
            };
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        const purchases = userData.purchases || [];
        console.log('Dados do usuário encontrados:', userData);

        const hasPurchased = purchases.length > 0;
        console.log('Verificação de compras:', hasPurchased ? 'Usuário possui compras.' : 'Usuário não possui compras.');

        if (hasPurchased) {
            await addDiscordRole(discordUser.id, botToken);
            await sendDirectMessage(discordUser.id, '🎉 Você teve acesso ao servidor exclusivo para alunos! Aproveite!');
            await sendDirectMessage('ID_DA_ADM', `🔔 A conta do usuário ${discordUser.username} foi conectada à Gessyca Nails.`); // Envie uma mensagem para a ADM
            
            console.log('Cargo de aluno atribuído ao usuário:', discordUser.id);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Acesso concedido e cargo de aluno atribuído.' })
            };
        } else {
            console.warn('Acesso negado: compra não encontrada para o usuário:', userEmail);
            await sendDirectMessage(discordUser.id, `Compra não encontrada para o e-mail ${userEmail}, certifique-se de que o endereço de e-mail da sua conta Discord seja igual ao endereço de e-mail que você usa na sua conta em nosso site.`);
    
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Acesso negado: compra não encontrada.' })
            };
        }
    } catch (error) {
        console.error('Erro na função:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function addDiscordRole(userId, botToken) {
    const roleId = '1287454240159301662'; // Substitua pela ID do cargo de aluno
    const guildId = '1287398248457441320'; // Substitua pela ID do servidor

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bot ${botToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Erro ao adicionar o cargo: ' + response.statusText);
    }
}

async function sendDirectMessage(userId, message) {
    const botToken = process.env.BOT_TOKEN; // Token do bot

    const response = await fetch(`https://discord.com/api/v10/users/${userId}/channels`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            recipient_id: userId
        })
    });

    if (!response.ok) {
        throw new Error('Erro ao criar DM: ' + response.statusText);
    }

    const channelData = await response.json();

    await fetch(`https://discord.com/api/v10/channels/${channelData.id}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: message
        })
    });
}
