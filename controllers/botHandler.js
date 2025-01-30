import dotenv from 'dotenv';
dotenv.config();

const Groq = require('groq-sdk');
const { db, dbRealtime, admin, auth } = require('./firebaseAdmin');

// Configurações do Groq
const groq = new Groq({ apiKey: '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' });
const generationConfig = {
  model: "llama-3.1-70b-versatile",
  temperature: 1,
  max_tokens: 8000,
  top_p: 1,
  stream: true,
  stop: null,
};

export const processBotHandler = async (req, res) => {
    
  try {
    console.log("Iniciando a função Lambda");

    // Configuração de CORS e método HTTP
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OPTIONS recebido' });
    }

    if (event.httpMethod !== 'POST') {
      return createResponse(405, { error: 'Método não permitido' });
    }

    const requestBody = JSON.parse(event.body);
    console.log("Corpo da solicitação recebido:", requestBody);

    if (!requestBody?.history) {
      throw new Error('Dados de entrada inválidos.');
    }

    const { message, history } = requestBody;
    const token = event.headers['authorization']?.replace('Bearer ', '');
    console.log('Token do usuário:', token);

    if (!token) {
      throw new Error('Token não fornecido.');
    }

    const { uid, name } = await verifyToken(token);

    await checkUserBlockStatus(uid);

    console.log("Mensagem do usuário:", message);
    console.log("Histórico da conversa recebido:", history);

    const protocolo = await buscarProtocolosPorUsuarioId(uid);
    console.log('Protocolo encontrado:', protocolo);

    if (message) {
      await saveUserMessage(protocolo, message, name);
    }

    const responseRef = dbRealtime.ref(`gessybot/${protocolo}/messages`).push();
    const referencePath = `gessybot/${protocolo}/messages/${responseRef.key}`;

    processBotResponse(responseRef, message, history).catch(error => {
      console.error("Erro ao processar a resposta do bot:", error);
    });

    return createResponse(200, { response: referencePath });

  } catch (error) {
    console.error("Erro:", error);
    return createResponse(500, { error: "Erro interno do servidor" });
  }
};

// Função utilitária para criar respostas HTTP
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// Função para verificar e decodificar o token JWT
async function verifyToken(token) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    console.log('Token decodificado:', decodedToken);
    return { uid: decodedToken.uid, name: decodedToken.name };
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      console.error("Token expirado");
      throw new Error('Token expirado. Por favor, obtenha um novo token.');
    }
    console.error("Erro ao decodificar o token:", err);
    throw new Error('Token inválido.');
  }
}

// Função para verificar se o usuário está bloqueado
async function checkUserBlockStatus(uid) {
  const blockedUserDoc = await db.collection('gessyBot-blocked').doc(uid).get();
  if (blockedUserDoc.exists) {
    const blockedUserData = blockedUserDoc.data();
    const now = admin.firestore.Timestamp.now();
    const expiry = blockedUserData.expiry.toDate();

    console.log("Data e hora atual:", now.toDate());
    console.log("Data de expiração do bloqueio:", expiry);

    if (now.toDate() < expiry) {
      console.log(`Usuário ${uid} está bloqueado até ${expiry}.`);
      throw new Error('Usuário bloqueado');
    } else {
      await db.collection('gessyBot-blocked').doc(uid).delete();
      console.log(`Bloqueio expirado para o usuário ${uid}.`);
    }
  }
}

// Função para salvar a mensagem do usuário
async function saveUserMessage(protocolo, message, name) {
  const userRef = dbRealtime.ref(`gessybot/${protocolo}/messages`).push();
  await userRef.set({
    message,
    user: name,
    timestamp: Date.now(),
  });
}

// Função para processar a resposta do bot e atualizar o Firebase Realtime Database
async function processBotResponse(responseRef, message, history) {
  if (message) {
    history.push({ role: 'user', content: message });
  }
  console.log("Histórico da conversa atualizado:", history);

  const chatCompletion = await groq.chat.completions.create({
    messages: history,
    ...generationConfig,
  });

  let botResponse = '';

  for await (const chunk of chatCompletion) {
    botResponse += chunk.choices[0]?.delta?.content || '';
    responseRef.set({
      response: botResponse,
      user: 'gessyBot',
      timestamp: Date.now(),
    });
  }

  await handleHiddenMessage(botResponse);

  await responseRef.update({ completed: true });
}

// Função para lidar com mensagens ocultas
async function handleHiddenMessage(botResponse) {
  const hiddenMessageMatch = botResponse.match(/\[Mensagem oculta\]: \{ "action": "block", "time": "([^"]*)", "reason": "([^"]*)" \}/);
  if (hiddenMessageMatch) {
    const [, time, reason] = hiddenMessageMatch;
    console.log("Mensagem oculta detectada:", { time, reason });

    const durationInMs = parseDuration(time);
    const expiryDate = new Date(Date.now() + durationInMs);

    console.log("Duração em milissegundos:", durationInMs);
    console.log("Data de expiração calculada:", expiryDate);

    await db.collection('gessyBot-blocked').doc(uid).set({
      timestamp: admin.firestore.Timestamp.now(),
      reason,
      time,
      expiry: admin.firestore.Timestamp.fromDate(expiryDate),
    });
    console.log("Mensagem oculta registrada no Firebase.");
  } else {
    console.log("Nenhuma mensagem oculta detectada.");
  }
}

// Função para analisar a duração em milissegundos
function parseDuration(duration) {
  const match = duration.match(/(\d+)([smhd])/);
  if (match) {
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60000;
      case 'h': return num * 3600000;
      case 'd': return num * 86400000;
      default: return 0;
    }
  }
  return isNaN(duration) ? 0 : parseInt(duration, 10) * 1000;
}

// Função para buscar protocolos por ID de usuário
async function buscarProtocolosPorUsuarioId(userUID) {
  try {
    const protocolosRef = dbRealtime.ref('gessybot');
    const snapshot = await protocolosRef.once('value');
    const protocolosData = snapshot.val();

    const protocolosEncontrados = Object.keys(protocolosData || {}).find(protocoloId => {
      return protocolosData[protocoloId].usuarioId === userUID;
    });

    if (protocolosEncontrados) {
      return protocolosEncontrados;
    } else {
      throw new Error('Nenhum protocolo encontrado para o usuário.');
    }
  } catch (error) {
    console.error('Erro ao buscar protocolos:', error);
    throw new Error('Erro ao buscar protocolos.');
  }
}
