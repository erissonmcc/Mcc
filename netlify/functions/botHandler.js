const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

exports.handler = async function (event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ message: 'OPTIONS recebido' }),
      };
    }

    if (event.httpMethod !== 'POST') {
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

    const requestBody = JSON.parse(event.body);

    if (!requestBody || !requestBody.message || !requestBody.history) {
      throw new Error('Dados de entrada inválidos. Verifique o formato da solicitação.');
    }

    const { message, history } = requestBody;

    console.log("Mensagem do usuário:", message);
    console.log("Histórico da conversa recebido:", history);

     // Adiciona uma mensagem de sistema no início do histórico se ele estiver vazio
if (history.length === 0) {
  history.push({
    role: 'system',
    text: `Você é um assistente virtual que ajuda os usuários a navegarem pelo suporte da 'Gessyca nails'. Peça o nome do usuário e o motivo do contato, e ofereça para transferir para um atendente humano, se necessário. Lembre-se de falar de forma mais discontraida e com girias, não seja repetitivo \nPara transferir o usuário para um atendimento humano, utilize o seguinte comando: [Mensagem oculta]: { "action": "transfer_to_human", "name": "", "reason": "" }`
  });
}

    // Adiciona a mensagem de entrada do usuário ao histórico
    history.push({ role: 'user', text: message });

    console.log("Histórico da conversa atualizado com a mensagem do usuário:", history);

    // Converte o histórico em partes compreensíveis pelo modelo
    const parts = history.map(item => {
      return { text: `${item.role === 'user' ? 'input' : item.role === 'system' ? 'input' : 'output'}: ${item.text}` };
    });

    console.log("Partes formatadas para o modelo:", parts);

    // Gerar conteúdo usando o modelo generativo
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig,
    });

    // Adiciona a resposta do bot ao histórico
    const botResponse = result.response.text();
    history.push({ role: 'assistant', text: botResponse });

    console.log("Histórico da conversa atualizado com a resposta do bot:", history);
    console.log("Resposta do bot:", botResponse);

    // Retornar a resposta do bot junto com o histórico atualizado
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ response: botResponse, history }),
    };
  } catch (error) {
    console.error("Erro:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: "Erro interno do servidor" }),
    };
  }
};
