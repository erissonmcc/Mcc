import dotenv from 'dotenv';
import {
    v4 as uuidv4
} from 'uuid';
import admin from 'firebase-admin';

// Configuração do dotenv
dotenv.config();

// Inicialização do Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: 'nail-art-by-gessica.appspot.com',
    });
}

const db = admin.firestore();
const database = admin.database();

// Função para processar suporte
export const processSupport = async (req, res) => {
    // Configuração dos cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({
            message: 'OPTIONS recebido'
        });
    }

    try {
        // Autenticação do usuário
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({
                error: 'Token de autenticação não encontrado!'
            });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const {
            chat,
            message,
        } = req.body;

        // Verifica se o usuário é administrador
        if (decodedToken.admin) {
            const {
                chatUserId,
                type
            } = req.body;
            if (!chatUserId || !type) {
                return res.status(400).json({
                    error: 'Formato Inválido!'
                });
            }
            const chatRef = database.ref(`support/${chatUserId}/${chat}`);
            const messageRef = chatRef.child('messages');

            if (type === 'message') {
                const newMessageRef = await messageRef.push({
                    message,
                    user: decodedToken.name,
                    viewed: false,
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });

                const key = newMessageRef.key;
                console.log('Chave gerada:', key);
                return res.status(200).json({
                    ok: `Mensagem enviada para o chat: ${chat}`,
                    key: key
                });
            } else if (type === 'to-enter') {
                const chatSnapshot = await chatRef.once('value');
                if (chatSnapshot.exists()) {
                    const chatData = chatSnapshot.val();
                    if (!chatData.responsibleAdmin) {
                        
                    
                    chatRef.update({
                        responsibleAdmin: decodedToken.uid,
                        adminName: decodedToken.name
                    });

                    const newMessageRef = await messageRef.push({
                        message: `Olá! Meu nome é ${decodedToken.name} e estarei cuidando do seu caso. Tudo bem com você?`,
                        user: decodedToken.name,
                        viewed: false,
                        timestamp: admin.database.ServerValue.TIMESTAMP,
                    });
                    const key = newMessageRef.key;

                    return res.status(200).json({
                        ok: `Você entrou no chat: ${chat}`,
                        key
                    });
                 } else {
                    return res.status(400).json({
                        error: `Esse caso já há um responsável!`,
                    });
                 }
                } else {
                    return res.status(400).json({
                        error: `Esse chat não existe!`,
                    });
                }
            }
        }


        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                error: 'Mensagem inválida ou ausente'
            });
        }

        // Se não houver chat, cria um novo protocolo
        if (!chat) {
            const protocolId = uuidv4();
            const chatRef = database.ref(`support/${userId}/${protocolId}`);
            const messageRef = chatRef.child('messages');
            await messageRef.push({
                message,
                user: 'user',
                timestamp: admin.database.ServerValue.TIMESTAMP,
            });
            if (decodedToken.name && decodedToken.name.trim() !== '') {
                await chatRef.update({
                    userName: decodedToken.name
                });
                await messageRef.push({
                    message: `👋 Olá, ${decodedToken.name}! Bem-vinda ao nosso suporte web.`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
                await messageRef.push({
                    message: `🎉 Sua mensagem já foi enviado, Nós entraremos em contato o mais rápido possível, enquanto isso você pode descrever melhor o seu poblema.`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
                await messageRef.push({
                    message: `🆔 Protocolo desse atendimento é: ${protocolId}`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
            } else {
                await chatRef.update({
                    status: 'waiting-name'
                });

                await messageRef.push({
                    message: '🏷️ Antes de continuar, como podemos te chamar? (Somente o nome)',
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
            }

            return res.status(200).json({
                chatId: protocolId, protocol: protocolId
            });
        }

        // Se o chat já existe, valida o ID e adiciona a mensagem
        if (!chat || typeof chat !== 'string' || chat.trim() === '') {
            return res.status(400).json({
                error: 'ID do chat inválido'
            });
        }

        const chatRef = database.ref(`support/${userId}/${chat}`);
        const messageRef = chatRef.child('messages');

        const snapshot = await messageRef.once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({
                error: `Chat ${chat} não encontrado.`
            });
        }

        const chatSnapshot = await chatRef.once('value');
        if (chatSnapshot.exists()) {
            const chatData = chatSnapshot.val();
            const status = chatData.status || '';

            if (status === 'waiting-name') {
                await chatRef.update({
                    userName: message, status: ''
                });
                await chatRef.push({
                    message: `👋 Olá, ${message}!`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
                await messageRef.push({
                    message: `🎉 Sua mensagem já foi enviado, Nós entraremos em contato o mais rápido possível, enquanto isso você pode descrever melhor o seu poblema:`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
                await messageRef.push({
                    message: `🆔 Protocolo desse atendimento é: ${chat}`,
                    user: 'Nailsyca',
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                });
            }

            await messageRef.push({
                message,
                user: 'user',
                timestamp: admin.database.ServerValue.TIMESTAMP,
            });
        } else {
            return res.status(404).json({
                error: `Chat ${chat} não encontrado.`
            });
        }

        return res.status(200).json({
            ok: `Mensagem enviada para o chat: ${chat}`, protocol: chat
        });

    } catch (error) {
        console.error('Erro:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor'
        });
    }
};