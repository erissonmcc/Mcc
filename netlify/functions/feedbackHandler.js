const { db, admin } = require('./firebaseAdmin');

exports.handler = async function (event, context) {
  try {
    console.log('Iniciando a função do Netlify para likes/dislikes...');
    console.log('Método HTTP:', event.httpMethod);

    if (event.httpMethod === 'OPTIONS') {
      console.log('Resposta para OPTIONS');
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: '',
      };
    }

    if (event.httpMethod !== 'POST') {
      console.log('Método não permitido:', event.httpMethod);
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      console.log('Corpo da solicitação:', requestBody);
    } catch (parseError) {
      console.error('Erro ao analisar o corpo da solicitação:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Corpo da solicitação inválido' }),
      };
    }

    const { videoId, userId, action, authToken, courseId } = requestBody;

    if (!videoId || !userId || !action || !authToken || !courseId) {
      console.error('Parâmetros inválidos:', { videoId, userId, action, authToken });
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Parâmetros inválidos' }),
      };
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(authToken);
      console.log('Token decodificado:', decodedToken);
    } catch (authError) {
      console.error('Erro ao verificar o token:', authError);
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Token inválido ou usuário não autorizado' }),
      };
    }

    if (decodedToken.uid !== userId) {
      console.error('Token inválido ou usuário não autorizado:', { uid: decodedToken.uid, userId });
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Token inválido ou usuário não autorizado' }),
      };
    }

    const likeDocRef = db.collection('videoLikes').doc(`${videoId}_${userId}`);
    const dislikeDocRef = db.collection('videoDislikes').doc(`${videoId}_${userId}`);
    const videoDocRef = db.collection('courses').doc(courseId).collection('videos').doc(videoId);

    try {
      await db.runTransaction(async (transaction) => {
        // Leituras
        const likeDoc = await transaction.get(likeDocRef);
        const dislikeDoc = await transaction.get(dislikeDocRef);
        const videoDoc = await transaction.get(videoDocRef);
        const videoData = videoDoc.data() || { likes: 0, dislikes: 0 };

        // Lógica de like/dislike
        if (action === 'like') {
          if (likeDoc.exists) {
            throw new Error('Você já curtiu este vídeo.');
          }
          transaction.set(likeDocRef, {
            videoId,
            userId,
            timestamp: new Date(),
          });

          if (dislikeDoc.exists) {
            transaction.delete(dislikeDocRef);
          }
        } else if (action === 'unlike') {
          if (!likeDoc.exists) {
            throw new Error('Você ainda não curtiu este vídeo.');
          }
          transaction.delete(likeDocRef);
        } else if (action === 'dislike') {
          if (dislikeDoc.exists) {
            throw new Error('Você já descurtiu este vídeo.');
          }
          transaction.set(dislikeDocRef, {
            videoId,
            userId,
            timestamp: new Date(),
          });

          if (likeDoc.exists) {
            transaction.delete(likeDocRef);
          }
        } else if (action === 'undislike') {
          if (!dislikeDoc.exists) {
            throw new Error('Você ainda não descurtiu este vídeo.');
          }
          transaction.delete(dislikeDocRef);
        } else {
          throw new Error('Ação inválida');
        }

        // Atualização dos contadores
        if (action === 'like') {
          transaction.update(videoDocRef, {
            likes: admin.firestore.FieldValue.increment(1),
            dislikes: admin.firestore.FieldValue.increment(dislikeDoc.exists ? -1 : 0),
          });
        } else if (action === 'dislike') {
          transaction.update(videoDocRef, {
            dislikes: admin.firestore.FieldValue.increment(1),
            likes: admin.firestore.FieldValue.increment(likeDoc.exists ? -1 : 0),
          });
        }
      });

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ success: true }),
      };
    } catch (transactionError) {
      console.error('Erro ao processar a transação:', transactionError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Erro ao processar a transação' }),
      };
    }
  } catch (error) {
    console.error('Erro na função do Netlify:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  }
};
