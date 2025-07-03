import dotenv from 'dotenv';
dotenv.config();
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import crypto from "crypto";

// Inicializa o Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
        storageBucket: "nail-art-by-gessica.appspot.com"
    });
}

const db = admin.firestore();
const auth = admin.auth();

// Função para validar o token de registro e verificar os dados do usuário
const validateToken = async (token, req) => {
    const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

    if (snapshot.empty) {
        throw new Error('Token inválido ou expirado.');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Verifica se o token ainda é válido
    const now = new Date();
    if (new Date(data.expiresAt) < now) {
        return {
            expired: true,
        };
    }
    const { visitorId } = req.body;

    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Ip do usuário:', userIp);
    if (data.visitorId !== visitorId) {
        return {
            code: 'auth/unauthorized-ip',
        };
    }

    return {
        uid: data.uid,
        email: data.email,
        expired: false,
    };
}

// Função principal para o processo de registro e login
export async function processRegister(req, res) {
    // Define os cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Trata a requisição OPTIONS para checagens prévias
    if (req.method === 'OPTIONS') {
        console.log('Solicitação OPTIONS recebida');
        res.status(200).json({
            message: 'OPTIONS recebido'
        });
        return;
    }

    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
        console.error('Token de autenticação não encontrado | teste');
        return res.status(401).json({
            error: 'Token de autenticação não encontrado!'
        });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken;

    try {

        // Obtém os dados da requisição
        const {
            email,
            password,
            isEmail
        } = req.body;

        // Verifica se o email já está registrado em outra conta
        console.log('Verificando se o email já está registrado:', email);

        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            console.error('O email já está associado a outra conta:', existingUser.uid);
            return res.status(400).json({
                error: 'O email já está registrado em outra conta!',
                code: 'auth/email-in-use',
            });

        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('Email ainda não está registrado, continuando o processo...');
            } else {
                console.error('Erro ao verificar conta:', error);
                return res.status(500).json({
                    error: 'Erro ao verificar conta!',
                    code: error.code || 'internal-error',
                });
            }
        }
        let userId;
        const userData = await validateToken(token, req);
        console.log(userData);
        if (userData.expired) {
            res.status(400).json({
                error: 'Token Expirado!',
                code: 'auth/token-expired',
            });
            return;
        } else if (userData.code === 'auth/unauthorized-ip') {
            res.set(headers).status(401).json({
                code: 'auth/unauthorized-ip'
            });
            return;
        } else {
            userId = userData.uid;
        }

        console.log('Atualizando o usuário anônimo:', userId);
        const userRecord = await admin.auth().updateUser(userId, {
            email: email,
            password: password,
            displayName: name
        });

        if (isEmail) {
            console.log('Conta migrada com sucesso:', userRecord.toJSON());
            const snapshot = await db.collection('pendingAccounts').where('token', '==', token).get();

            if (snapshot.empty) {
                console.error('Token inválido.');
            } else {

                const doc = snapshot.docs[0];
                await doc.ref.delete();

                console.log('Documento deletado com sucesso.');
            }

        }
        res.status(200).json({
            response: 'Usuário autenticado e conta migrada com sucesso!'
        });
    } catch (e) {
        console.error('Erro ao registrar usuário:', e);
        res.status(500).json({
            error: 'Erro interno ao processar a solicitação.'
        });
    }
}