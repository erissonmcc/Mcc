import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import jwt from 'jsonwebtoken';
import {
    WebSocket,
    WebSocketServer
} from 'ws';
import admin from 'firebase-admin';

import cookieParser from 'cookie-parser';

// Inicialização do Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com/',
        storageBucket: 'nail-art-by-gessica.appspot.com',
    });
}

const app = express();

app.use(cookieParser());

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:36189',
      'http://app.127.0.0.1.nip.io:8080',
      'http://192.168.3.230:37993',
      'https://curso.dominio.com',
      'http://192.168.3.230:8080',
      'https://nailsgessyca.com.br',
      'https://e2f2-2804-ec8-56-62b8-245b-7fe1-924e-d054.ngrok-free.app',
      'https://3abb-2804-ec8-56-62b8-245b-7fe1-924e-d054.ngrok-free.app',
      ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida pelo CORS'));
    }
  },
  credentials: true
}));

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );
    next();
});

import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const message = JSON.stringify({
    error: "Request blocked due to excessive use of the API",
    code: 429,
    status: "Too Many Requests",
    timestamp: new Date().toISOString(),
    retryAfter: "15m",
    suggestion: "Reduce the frequency of requests to avoid stricter blocks."
});

const jsonMessage = JSON.parse(message);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 200,
    message: jsonMessage,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(compression());

import {
    processWebhook
} from './controllers/webhook.js';
import {
    processCheckout
} from './controllers/checkout.js';
import {
    processGetVideo
} from './controllers/getVideo.js';
import {
    processRegister
} from './controllers/register.js';
import {
    processPolarities
} from './controllers/polarities.js';
import {
    processVerifytoken
} from './controllers/verifytoken.js';
import {
    processSendEmail
} from './controllers/sendEmail.js';
import {
    processSupport
} from './controllers/support.js';
import {
    processGetAllUsers
} from './controllers/getUsers-admin.js';
import {
    processGetSupport
} from './controllers/getSupport-admin.js';
import {
    uploadVideo
} from './controllers/upload.js';

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  processWebhook
);

app.use(express.json());
app.post('/checkout', processCheckout);
app.get('/getVideo', processGetVideo);
app.post('/register', processRegister);
app.get('/polarities', processPolarities);
app.post('/verifytoken', processVerifytoken);
app.get('/sendEmail', processSendEmail);
app.post('/support', processSupport);
app.get('/getUsers-admin', processGetAllUsers);
app.get('/getSupport-admin', processGetSupport);
app.post('/upload', uploadVideo);

import {
    processTeste
} from './controllers/teste.js';

app.get('/teste', processTeste);

// WebSocket Authentication and Server setup
const server = app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

const db = admin.firestore();
const database = admin.database();

const wss = new WebSocketServer({
    server
});

const handleAuthentication = async (ws, message) => {
    try {
        const {
            chatId,
            token,
            userIdChat
        } = JSON.parse(message);

        if (!chatId || !token) {
            throw new Error('Token ou tipo de mensagem inválido');
        }


        // Verificando o token JWT com o Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('Usuário autenticado com UID:', userId);
        if (decodedToken.admin && !userIdChat) {
            ws.send(JSON.stringify({
                status: 'auth_failed',
                error: error.message || 'userIdChat inválido',
            }));
            ws.close();
            return;
        }
        // Enviar uma resposta de sucesso de autenticação
        ws.send(JSON.stringify({
            status: 'auth_success'
        }));

        return {
            userId,
            chatId,
            decodedToken,
            userIdChat
        };
    } catch (error) {
        console.error('Falha na autenticação:', error);
        ws.send(JSON.stringify({
            status: 'auth_failed',
            error: error.message || 'Token inválido',
        }));
        ws.close();
        throw error; // Re-throw to handle invalid message format
    }
};

const handleNewMessage = async (ws, messagesRef, decodedToken, snapshot) => {
    try {
        const newMessage = snapshot.val();
        console.log('Nova mensagem adicionada', newMessage);

        const shouldUpdateViewed =
        (!decodedToken.admin && newMessage.user !== 'user') ||
        (decodedToken.admin && newMessage.user === 'user');

        if (shouldUpdateViewed) {
            await messagesRef.child(snapshot.key).update({
                viewed: true
            });

            ws.send(JSON.stringify({
                message: newMessage.message,
                timestamp: newMessage.timestamp,
                user: newMessage.user
            }));
        }
    } catch (error) {
        console.error("Erro ao processar a mensagem:", error);
    }
};

wss.on('connection', (ws) => {
    console.log('Novo cliente conectado');

    ws.on('message', async (message) => {
        try {
            const {
                userId, chatId, decodedToken, userIdChat
            } = await handleAuthentication(ws, message);

            let messagesRef;
            if (decodedToken.admin) {
                messagesRef = database.ref(`support/${userIdChat}/${chatId}/messages`);
                const userToUpdate = "user"; // o valor do campo "user" que você quer comparar

                messagesRef.once('value')
                .then((snapshot) => {
                    const updates = {};
                    snapshot.forEach((childSnapshot) => {
                        const key = childSnapshot.key;
                        const data = childSnapshot.val();

                        if (data.user === userToUpdate) {
                            updates[`${key}/viewed`] = true;
                        }
                    });

                    ws.send(JSON.stringify({
                        status: 'messages',
                        dados: snapshot.val()
                    }));
                    return messagesRef.update(updates);
                })
                .then(() => {
                    console.log("Mensagens atualizadas com sucesso.");
                })
                .catch((error) => {
                    console.error("Erro ao atualizar mensagens:",
                        error);
                });
            } else {
                messagesRef = database.ref(`support/${userId}/${chatId}/messages`);
            }
            // Escutar novas mensagens
            const onNewMessage = (snapshot) => handleNewMessage(ws, messagesRef, decodedToken, snapshot);
            messagesRef.on('child_added', onNewMessage);

            // Desinscrever o listener quando a conexão for fechada
            ws.on('close', () => {
                messagesRef.off('child_added', onNewMessage);
            });

        } catch (error) {
            // Se houver erro, a conexão já foi fechada dentro do handleAuthentication
        }
    });
});