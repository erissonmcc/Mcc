const { db, admin } = require('./firebaseAdmin');

exports.handler = async function (event, context) {
  try {
    console.log('Iniciando a função do Netlify...');

    // Habilitar CORS para o domínio local
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:26543',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ message: 'OPTIONS recebido' }),
      };
    }

    // Verificar se o método HTTP é POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:26543',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    console.log('Verificando dados da solicitação...');
    const requestBody = JSON.parse(event.body);
    const { videoId, courseId, authToken } = requestBody;

    // Verificar se todos os parâmetros necessários foram fornecidos
    if (!videoId || !courseId || !authToken) {
      console.log('Parâmetros inválidos:', requestBody);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:26543',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Parâmetros inválidos' }),
      };
    }

    // Verificar token de autenticação
    const decodedToken = await admin.auth().verifyIdToken(authToken);
    const userUID = decodedToken.uid;

    // Obter o IP e o User-Agent do usuário
    const userIP = (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '0.0.0.0').split(',')[0].trim();
    const userAgent = event.headers['user-agent'];

    console.log('User IP:', userIP);
    console.log('User Agent:', userAgent);

    // Verificação de User-Agent suspeito
    const botUserAgents = ['bot', 'spider', 'crawl']; // lista de bots conhecidos
    if (botUserAgents.some(bot => userAgent.toLowerCase().includes(bot))) {
      console.log('User-Agent suspeito detectado:', userAgent);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:26543',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'User-Agent suspeito detectado.' }),
      };
    }

    // Verificar e registrar a visualização
    const videoHistoryRef = db.collection('videoHistory').doc(`${videoId}_${userUID}`);
    const videoHistorySnap = await videoHistoryRef.get();

    if (videoHistorySnap.exists) {
      const data = videoHistorySnap.data();
      const lastViewTimestamp = data.timestamp.toDate(); // Certifique-se de que isso converte corretamente
      const currentTime = new Date();
      const minTimeBetweenViews = 60 * 60 * 1000; // 1 hora em milissegundos

      // Verificar a diferença de tempo
      const timeDiff = currentTime - lastViewTimestamp;
      if (videoId === data.videoId && timeDiff < minTimeBetweenViews) {
        console.log('Visualização recente já registrada para este vídeo pelo mesmo usuário.');
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:26543',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
          body: JSON.stringify({ success: false, message: 'Visualização recente já registrada para este vídeo.' }),
        };
      }
    }

    // Registrar a nova visualização
    await videoHistoryRef.set({
      videoId: videoId,
      userId: userUID,
      timestamp: new Date(),
      userAgent: userAgent,
      userIP: userIP
    });

    // Verificar e criar o documento do vídeo, se necessário
    const videoDocRef = db.collection('courses').doc(courseId).collection('videos').doc(videoId);
    const videoDocSnap = await videoDocRef.get();
    
    if (!videoDocSnap.exists) {
      await videoDocRef.set({ views: 0 });
    }

    // Atualizar o número de visualizações
    await videoDocRef.update({
      views: admin.firestore.FieldValue.increment(1)
    });

    console.log('Visualização registrada e contagem atualizada com sucesso!');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:26543',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Erro na função do Netlify:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:26543',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  }
};
