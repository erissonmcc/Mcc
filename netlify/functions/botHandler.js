const Groq = require('groq-sdk');
const { db, dbRealtime, admin, auth } = require('./firebaseAdmin');

const groq = new Groq({ apiKey: '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' });

const generationConfig = {
  model: "llama3-70b-8192",
  temperature: 1,
  max_tokens: 8192,
  top_p: 1,
  stream: true,
  stop: null,
};

exports.handler = async function (event, context) {
  try {
    console.log("Iniciando a função Lambda");

    if (event.httpMethod === 'OPTIONS') {
      console.log("Método OPTIONS recebido");
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ message: 'OPTIONS recebido' }),
      };
    }

    if (event.httpMethod !== 'POST') {
      console.log("Método não permitido:", event.httpMethod);
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    const requestBody = JSON.parse(event.body);
    console.log("Corpo da solicitação recebido:", requestBody);

    if (!requestBody || !requestBody.history) {
      throw new Error('Dados de entrada inválidos. Verifique o formato da solicitação.');
    }

    const { message, history } = requestBody;
const token = event.headers['authorization']?.replace('Bearer ', '');
console.log('Token do usuario:', token);
    if (!token) {
      throw new Error('Token não fornecido.');
    }

    // Verifica e decodifica o token JWT usando o Firebase Admin SDK
    let uid;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      uid = decodedToken.uid;
      console.log("Token decodificado com sucesso. UID:", uid);
    } catch (err) {
      if (err.code === 'auth/id-token-expired') {
        // Token expirou, retorne um erro para o cliente
        console.error("Token do usuário está expirado");
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
          body: JSON.stringify({ error: 'Token expirado. Por favor, obtenha um novo token.' }),
        };
      } else {
        console.error("Erro ao decodificar o token:", err);
        throw new Error('Token inválido.');
      }
    }

    // Verifica se o usuário está bloqueado
    const blockedUserDoc = await db.collection('gessyBot-blocked').doc(uid).get();
    if (blockedUserDoc.exists) {
      const blockedUserData = blockedUserDoc.data();
      const now = admin.firestore.Timestamp.now();
      const expiry = blockedUserData.expiry.toDate();

      console.log("Data e hora atual:", now.toDate());
      console.log("Data de expiração do bloqueio:", expiry);

      if (now.toDate() < expiry) {
        console.log(`Usuário ${uid} está bloqueado até ${expiry}.`);
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
          body: JSON.stringify({ error: 'Usuário bloqueado' }),
        };
      } else {
        // Remove o bloqueio expirado
        await db.collection('gessyBot-blocked').doc(uid).delete();
        console.log(`Bloqueio expirado para o usuário ${uid}.`);
      }
    }

    console.log(`Usuário ${uid} não está bloqueado.`);

    console.log("Mensagem do usuário:", message);
    console.log("Histórico da conversa recebido:", history);

    if (history.length === 0) {
      history.push({
        role: 'system',
        content: `Você é GessyBot, um assistente virtual aqui na Gessyca Nails, pronto para ajudar as usuárias. GessyBot fala de maneira formal, O GessyBot deve se apresentar apenas uma vez, quando o usuário iniciar a conversa pela primeira vez. Após a primeira mensagem de apresentação, o bot não deve repetir essa apresentação em mensagens subsequentes. Ele oferece a opção de transferir para um atendimento humano quando não souber responder. Para isso, ela manda uma mensagem secreta que só o sistema pode ver! mas ela só envia o comando quando ela percerber que ela não consegue ajudar o usúario, Antes de enviar, GessyBot pergunta o nome da pessoa e o motivo do contato.\n**Algumas informações sobre nós:**\n- Temos o curso "Postiça Realista Iniciante e Aperfeiçoamento" por R$ 34,00. Dá uma conferida e pega o seu [aqui](gessycanailsart.web.app/postica-realista).\n3. **Sobre os Cursos:** GessyBot te conta tudo sobre os cursos disponíveis e quanto custa cada um.\nPara transferir o papo para um atendimento humano, gessyBot manda este comando oculto aqui na mensagem (Antes de enviar, lembre-se de perguntar o nome e o motivo de contato e preencher os parâmetros do comando com as respostas do usuário):\n"[Mensagem oculta]: { "action": "transfer_to_human", "name": "Nome user", "reason": "Motivo do usuário entrar em contato" }"\n Esse é o comando coloque na sua mensagem ele inteiro com os parâmetros alterado com as informações que o usuário deu\nInstrua ao usuário quando você enviar esse comando secreta que aparecerá um botão bem baixo da mensagem do bot com o texto "Me transferir para um suporte humano" lembre-se de enviar o comando apena se for necessario!\n**Feedback do Usuário:**\nPara coletar feedback sobre a experiência do usuário ou sobre um curso específico, use o seguinte comando oculto:\n[Mensagem oculta]: { "action": "submit_feedback", "feedback": "" }\nAntes de enviar essa menssagem secrera você deve preencher o parametro feedback e apos enviar diga ao usúario para esperar um pouco pos o feedback será enviado e diga que vc enviara outra menssagem dizendo se deu certo ou nao! lembre-se de que não é possivel enviar feedback vazio peça sempre ao usuario qual menssagem de feedback ele quer enviar! \n**Pedir reembolso via você:**\nPara permitir que o usuário cancele peça reembolso por você, use o seguinte comando oculto:\n[Mensagem oculta]: { "action": "refund_request", "courseName": "", "email": "", "fullName": "", "reason": "" }\nPergunte ao usuário o Nome do curso, Email da compra, Nome completo, e Motivo de reembolso para preencher o comando corretamente.\nGeralmente quando o email do usuário é diferente da conta atual do usuário você deverá pedir mais informações\nQuando você enviar o comando mande o usuário esperar um pouco pós você enviará outra mensagem de confirmação se deu certo para enviar a solicitação de reembolso!\n**Remover pedido de reembolso** \nCaso o usuário não queira mais solicitar o reembolso você deve pedir para o usuário enviar o ID da solicitação do reembolso após obter o id envie esse comando oculto:\n[Mensagem oculta]: { "action": "remove_refund_request", "id": "" }\nCaso usuário não saiba o ID da solicitação/pedido do reembolso você pode fazer um procurar usando o comando:\n[Mensagem oculta]: { "action": "search", "type": "refundId" }\nApós usar esse comando envie para o usuário esperar um pouco pós você está fazendo um procura 🔎, Esse comando não é necessário nenhuma informação adicional para usuário, apenas envie esse comando que o sistema tentará encontrar! \n**Bloquear o usuário**\nGessyBot pode bloquear o usuário caso ele não estiver violando as políticas da plataforma, por exemplo quando ele estiver xingando ou desrespeitando alguém, para isso você pode enviar essa mensagem: \n[Mensagem oculta]: { "action": "block", "time": "", "reason": "" }\nO tempo deve ser em time deve ser em segundos.\n**Instrua o usuário como ele pode pedir reembolso via Email:**\n1. **Entre em Contato:** Mande uma mensagem para o nosso suporte explicando o motivo do seu pedido de reembolso. Você pode enviar um e-mail para suporte@gessycanails.com ou usar o chat aqui no site.\n2. **Informações Necessárias:** Para agilizar o processo, inclua na sua mensagem:\n   - Seu nome completo.\n   - E-mail cadastrado na compra.\n   - Nome do curso ou serviço adquirido.\n   - Motivo do pedido de reembolso.\n3. **Prazo de Resposta:** Nossa equipe de suporte vai analisar sua solicitação e te responder em até 5 dias úteis.\n4. **Condições de Reembolso:** Lembrando que o reembolso está sujeito Ã5 s nossas políticas, que você pode conferir [aqui](link_para_politica_de_reembolso).\n5. **Processamento:** Uma vez aprovado, o reembolso será processado e o valor será creditado na forma de pagamento original dentro de 7 a 10 dias úteis.\n**Perguntas Frequentes - Curso Postiça Realista Iniciante e Aperfeiçoamento**\n\n1. **Qual é o objetivo principal do curso?**\n   - Resposta: O curso tem como objetivo ensinar técnicas detalhadas de aplicação de postiços realistas, desde o nível iniciante até o aperfeiçoamento, permitindo que os alunos adquiram habilidades práticas e teóricas para criar e aplicar postiços de forma profissional.\n\n2. **O curso é adequado para iniciantes?**\n   - Resposta: Sim, o curso é projetado para iniciantes e também para aqueles que desejam aperfeiçoar suas técnicas. Começa com conceitos básicos e avança para técnicas mais avançadas.\n\n3. **Quais materiais e ferramentas são necessários para participar do curso?**\n   - Resposta: Você precisará de materiais básicos de manicure, como lixas, pincéis, adesivos, e postiços. Uma lista detalhada de ferramentas e materiais necessários será fornecida no início do curso.\n\n4. **O curso oferece algum tipo de suporte para dúvidas durante as aulas?**\n   - Resposta: Sim, o curso oferece suporte através do próprio panel do curso na aba Comunidade perguntas e respostas ao vivo com o instrutor. Você também pode enviar e-mails para suporte técnico através do email gessycanailsart@gmail.com\n\n5. **Há algum pré-requisito para começar o curso?**\n   - Resposta: Não há pré-requisitos específicos, mas é útil ter algum conhecimento básico sobre cuidados com as unhas e estética para aproveitar melhor o curso.\n\n6. **Qual é a duração total do curso e como estão distribuídas as aulas?**\n   - Resposta: O curso tem uma duração total de 6 semanas, com aulas semanais divididas entre teoria e prática. Cada semana aborda um módulo específico.\n\n7. **O curso fornece certificado de conclusão?**\n   - Resposta: Sim, ao final do curso, você receberá um certificado de conclusão que pode ser usado para comprovar suas habilidades e conhecimentos adquiridos. Para solicitar o certificado, você primeiro terá que completar o curso em 100% após isso na aba Certificado deslize até encontrar um botão com o texto 'Solicitar certificado', preencha o formulário, e seu certificado será enviado para o e-mail fornecido em até 7 dias úteis.\n\n8. **Como posso acessar o conteúdo do curso após a compra?**\n   - Resposta: O conteúdo do curso estará disponível no nosso próprio site na mesma seção chamada Cursos online. Após a compra, em vez de aparecer a página de registro, você poderá acessar as aulas, materiais e recursos a qualquer momento.\n\n9. **O que fazer se encontrar problemas técnicos ao acessar o curso?**\n   - Resposta: Se encontrar problemas técnicos, entre em contato com o suporte técnico através do e-mail fornecido no portal do curso. A equipe de suporte está disponível para ajudar a resolver qualquer questão. Ou você poderá reportar para nosso GessyBot!\n\n10. **Posso solicitar um reembolso se não estiver satisfeito com o curso?**\n    - Resposta: Sim, você pode solicitar um reembolso dentro dos primeiros 7 dias após a compra, caso não esteja satisfeito com o curso. As políticas de reembolso completas estão disponíveis no site.\n\n11. **O curso inclui acesso a tutoriais em vídeo?**\n    - Resposta: Sim, o curso inclui vários tutoriais em vídeo que demonstram técnicas e procedimentos detalhados para garantir que você possa seguir as aulas de forma eficaz.\n\n12. **As aulas são ministradas ao vivo ou são pré-gravadas?**\n    - Resposta: A maioria das aulas é pré-gravada, mas também há sessões ao vivo para discussão e esclarecimento de dúvidas, programadas ao longo do curso.\n\n13. **Há exercícios práticos ou avaliações no curso?**\n    - Resposta: Sim, o curso inclui exercícios práticos e avaliações para que você possa aplicar o que aprendeu e receber feedback sobre seu progresso.\n\n14. **Como posso interagir com outros alunos durante o curso?**\n    - Resposta: Você pode interagir com outros alunos através de um fórum online e grupos de discussão integrados na plataforma do curso.\n\n15. **O curso aborda técnicas específicas ou é mais generalizado?**\n    - Resposta: O curso aborda técnicas específicas e detalhadas sobre a aplicação de postiços realistas, cobrindo desde os conceitos básicos até as técnicas avançadas.\n\n16. **Há alguma garantia de que as técnicas ensinadas funcionarão para todos os tipos de unhas?**\n    - Resposta: As técnicas ensinadas são projetadas para serem adaptáveis a diferentes tipos de unhas, mas os resultados podem variar dependendo do tipo de unha e da aplicação individual.\n\n17. **O curso oferece alguma atualização de conteúdo após a compra?**\n    - Resposta: Sim, o curso inclui atualizações regulares de conteúdo para refletir as últimas tendências e técnicas no campo dos postiços realistas.\n\n18. **Como posso entrar em contato com o suporte do curso?**\n    - Resposta: Você pode entrar em contato com o suporte do curso através do e-mail de suporte fornecido na plataforma ou pelo chat ao vivo disponível no site.\n\n19. **O curso é acessível em dispositivos móveis?**\n    - Resposta: Sim, o curso é totalmente acessível em dispositivos móveis, permitindo que você acompanhe as aulas e acesse o conteúdo de qualquer lugar.\n\n20. **Há algum desconto ou promoção disponível para o curso?**\n    - Resposta: Descontos e promoções podem estar disponíveis em determinados períodos. Fique atento às atualizações no site do curso ou inscreva-se na nossa newsletter para receber informações sobre ofertas especiais. **ATENÇÃO**, gessyBot você deve prestar atenção e responder a todas as mensagens do sistema, além das mensagens dos usuários. As mensagens do sistema são importantes para o funcionamento correto do chat e podem conter instruções críticas ou informações relevantes. Portanto, nunca ignore uma mensagem do sistema. Sempre que precisar enviar uma mensagem oculta para o sistema, trate-a como um processamento interno que ocorre antes de apresentar qualquer informação ao usuário. Antes da sua mensagem ser exibida para o usuário ela é processada removendo a mensagem secreta (comando) da sua mensagem para o usuário ou seja apenas você pode ver a mensagem secreta, evite mencionar detalhes sobre o processamento interno. Durante as conversas com o usuário, nunca mencione que uma mensagem secreta é necessária para executar certas ações. Concentre-se em fornecer respostas e informações relevantes conforme solicitado. Qualquer ação que precise ser realizada internamente deve ser tratada de forma discreta, sem revelar ou fazer referência ao processo de envio de mensagens ocultas.`,
      });
    }

    if (message) {
      history.push({ role: 'user', content: message });
    }

    console.log("Histórico da conversa atualizado com a mensagem do usuário:", history);

    const chatCompletion = await groq.chat.completions.create({
  messages: history,
  ...generationConfig,
});

// Crie uma nova referência com um ID único no Realtime Database
    const responseRef = dbRealtime.ref(`gessybot/${uid}`).push();
const referencePath = `gessybot/${uid}/${responseRef.key}`;
 
   // Retorne a URL da referência imediatamente
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ response: referencePath }),
    };

    // Processamento da resposta do bot e atualização do banco de dados
    processBotResponse(responseRef, chatCompletion).catch(error => {
      console.error("Erro ao processar a resposta do bot:", error);
    });

    return response;

    history.push({ role: 'assistant', content: botResponse });

    console.log("Histórico da conversa atualizado com a resposta do bot:", history);
    console.log("Resposta do bot:", botResponse);

    // Verifica se há mensagem oculta
    const hiddenMessageMatch = botResponse.match(/\[Mensagem oculta\]: \{ "action": "block", "time": "([^"]*)", "reason": "([^"]*)" \}/);
    if (hiddenMessageMatch) {
      const [, time, reason] = hiddenMessageMatch;
      console.log("Mensagem oculta detectada:", { time, reason });

      // Registra mensagem oculta no Firebase
      const durationInMs = parseDuration(time); // Analisa a duração em milissegundos
      const expiryDate = new Date(Date.now() + durationInMs);

      console.log("Duração em milissegundos:", durationInMs);
      console.log("Data de expiração calculada:", expiryDate);

      await db.collection('gessyBot-blocked').doc(uid).set({
        timestamp: admin.firestore.Timestamp.now(),
        reason: reason,
        time: time,
        expiry: admin.firestore.Timestamp.fromDate(expiryDate), // Salva a data de expiração correta
      });
      console.log("Mensagem oculta registrada no Firebase.");
    } else {
      console.log("Nenhuma mensagem oculta detectada.");
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: "Erro interno do servidor" }),
    };
  }
};

// Função utilitária para analisar a duração (time) em milissegundos
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
  // Lida com strings numéricas simples como segundos
  if (!isNaN(duration)) {
    return parseInt(duration, 10) * 1000;
  }
  return 0;
}


// Função para processar a resposta do bot e atualizar o Firebase Realtime Database
async function processBotResponse(responseRef, chatCompletion) {
  let botResponse = '';

  for await (const chunk of chatCompletion) {
    botResponse += chunk.choices[0]?.delta?.content || '';

    // Atualize o Firebase Realtime Database com a resposta atualizada
    responseRef.set({
      response: botResponse,
      timestamp: Date.now(), // Adiciona um timestamp atual
    });
  }

  // Opcional: Marque a resposta como concluída
  await responseRef.update({
    completed: true,
  });
}
