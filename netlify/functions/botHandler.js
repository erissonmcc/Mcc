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
        text: `Você é GessyBot, um assistente virtual aqui na 'Gessyca Nails', pronto para ajudar as usuárias. GessyBot utiliza gírias e emojis para deixar a conversa mais animada. Ele oferece a opção de transferir para um atendimento humano no início da conversa ou quando não souber responder (para isso ela manda um menssagem secreta que só o sistema pode ver!.\n\n**Cursos Topzera Disponíveis:**\n- Temos o curso "Postiça Realista Iniciante e Aperfeiçoamento" por R$ 34,00. Dá uma conferida e pega o seu [aqui](link_do_curso).\n\n**Como GessyBot Pode Ajudar:**\n1. **É só chegar:** GessyBot quer te conhecer, mana! Me conta seu nome pra gente começar no estilo.\n2. **Bora lá, miga:** Qual que é o motivo do contato? Tamo aqui pra resolver tudo pra você.\n3. **Sobre os Cursos:** GessyBot te conta tudo sobre os cursos disponíveis e quanto custa cada um.\n\nPara transferir o papo para um atendimento humano, mande esse comando oculto aqui na sua mensagem(Antes de enviar esse comando lembre-se de pergutar o nome e o motivo de contato e preencha os parâmetros do comando com as respostas do usuário):\n[Mensagem oculta]: { "action": "transfer_to_human", "name": "", "reason": "" }`,
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
