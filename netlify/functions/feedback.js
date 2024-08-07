const { db, admin, auth } = require('./firebaseAdmin');
const Groq = require('groq-sdk');

const groq = new Groq();

exports.handler = async (event) => {
  console.log(`Received request: ${event.httpMethod}`);

  // Suporte para requisições OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*', // Permitir todas as origens, ajuste conforme necessário
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Apenas permite requisições POST
  if (event.httpMethod !== 'POST') {
    console.log('Invalid method');
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ message: 'Método não permitido' }),
    };
  }

  const { userId, feedback } = JSON.parse(event.body);

  if (!userId || !feedback) {
    console.log('Missing token or feedback');
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ message: 'Token e feedback são necessários' }),
    };
  }

  // Enviar feedback para o bot Groq
const prompt = `
Você é um assistente de IA especializado em análise de sentimentos. Sua tarefa é determinar se o sentimento expresso em uma frase é positivo, negativo ou neutro e também atribuir uma prioridade a esse sentimento, que varia de 0 a 100. A prioridade deve refletir a intensidade do sentimento, onde 0 indica baixa prioridade e 100 indica alta prioridade. 

Além disso, inclua uma mensagem adicional que explica o sentimento e a prioridade atribuídos. 

Responda usando o formato:
{
  "feeling": "",
  "priority": "",
  "message": ""
}

O feeling só suporta apenas os valores "positivo", "negativo" e "neutro". Por favor, determine o sentimento, a prioridade e a mensagem adicional para a seguinte frase:

"${feedback}"

Responda apenas com o JSON no formato indicado, sem explicações adicionais fora do JSON.
`;

  try {
    console.log('Sending feedback to Groq');
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama3-8b-8192',
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
      stream: false, // Use `false` para simplificar o processamento de resposta
    });

    console.log('Received response from Groq');
    const responseContent = chatCompletion.choices[0]?.message?.content.trim();
    console.log(`Bot response: ${responseContent}`);
    const { feeling, priority } = JSON.parse(responseContent);

    // Obter timestamp atual
    const timestamp = new Date().toISOString();

    // Salvar feedback no Firestore
    console.log('Saving feedback to Firestore');
    await db.collection('feedbacks').add({
      userId,
      feedback,
      feeling,
      priority,
      timestamp,
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ message: 'Feedback registrado com sucesso' }),
    };
  } catch (error) {
    console.error('Erro ao processar o feedback:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ message: 'Erro ao processar o feedback' }),
    };
  }
};
