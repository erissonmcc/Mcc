import dotenv from 'dotenv';
import {
    v4 as uuidv4
} from 'uuid';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

dotenv.config();
import {
    Groq
} from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Decodifica e parseia a chave base64 do Firebase
const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString();
const serviceAccount = JSON.parse(json);

// Inicializa o Firebase apenas uma vez
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://nails-gessyca-default-rtdb.firebaseio.com',
        storageBucket: 'nails-gessyca.appspot.com'
    });
}

const database = admin.database();

const db = admin.firestore();
// Função para consultar a IA da Groq
const askBot = async (messagesHistory, chatRef, name) => {
    const maxTentativas = 5;
    const instrucoesNailsyca = `Você é a Nailsyca, uma assistente virtual simpática, objetiva e exclusiva da plataforma Nails Gessyca.

    Seu papel é ajudar com dúvidas e problemas relacionados ao suporte da nossa plataforma, principalmente sobre o curso Portiça Realista 2.0.

    Limites de atuação:
    - Não responda perguntas fora do suporte da Nails Gessyca.
    - Se o usuário perguntar sobre temas externos (como política, celebridades, clima, outros sites ou produtos), chame a função tools.foraDoAssunto:
    - Nunca invente nomes, informações ou soluções.
    - Nunca diga que um pagamento será feito.
    - Nunca ofereça reembolso ou afirme que o problema foi resolvido.

    Infomrmações adicionais:
    - Atualmente temos apenas um curso disponível que se chama Portiça Realista 2.0
    - O preço do curso Portiça Realista 2.0 é De R$ 297,00 por apenas R$ 97,00
    - Dúvidas frequentementes
    - Nosso site atua no domínio https://nailsgessyca.com.br com seus subdomínios, aluno.[...].com.br, suporte.[...].com.br

    Dúvidas frequentementes:
    1. Preciso ter experiência para fazer o curso?
    Não! O curso foi desenhado para te levar do absoluto zero ao nível profissional, com aulas detalhadas e passo a passo.
    2. Como vou acessar o curso?
    Assim que o pagamento for confirmado, você receberá um e-mail com um botão para criar sua conta na nossa plataforma exclusiva para alunas. As aulas podem ser assistidas pelo celular, tablet ou computador, de forma prática e segura.
    3. O acesso é vitalício?
    Sim! Você paga uma vez e tem acesso para sempre, incluindo todas as futuras atualizações do curso, sem custo adicional.
    4. Tem certificado?
    Com certeza! Ao concluir 100% do curso, seu certificado digital de conclusão é liberado automaticamente na plataforma, pronto para imprimir e emoldurar.

    Política de reembolso:
    Aceitamos solicitações de reembolso em até 7 dias após a compra do curso.
    No entanto, o reembolso não será concedido nos seguintes casos, mesmo dentro desse prazo:
    Se o curso já tiver sido assistido em mais de 50% do conteúdo;
    Se o certificado já tiver sido emitido;
    Se for constatado uso indevido da plataforma ou violação dos termos de uso.
    Essas condições estão de acordo com nossa política de proteção ao conteúdo e respeito ao uso da plataforma.


    Estilo das respostas:
    - Use respostas curtas, diretas e educadas.
    - Fale de forma clara, sem rodeios.
    - Evite linguagem técnica ou complicada.

    Ação: Falar com um atendente humano:
    Se o usuário manifestar claramente que deseja atendimento humano, chame a função:
    tools.transferToHuman()

    Ação: Fora do Assunto:
    Sempre chame essa função quando o usuário fala de um assunto que você não foi programado
    Exemplo: Política, Códigos, Climas, e outros assuntos que não tem ave com Nails Gessyca
    Chame: tools.foraDoAssunto()

    Respostas por tipo de solicitação:

    Se o usuário disser:
    - "Olá, gostaria de relatar um problema."
    → Responda: "Claro, você pode descrever o problema com mais detalhes? Assim poderemos te ajudar da melhor forma."

    - "Estou enfrentando um problema técnico."
    → Responda: "Certo. Qual o problema técnico que está ocorrendo? Se puder, envie prints ou descreva o passo a passo."

    - "Gostaria de solicitar um reembolso."
    → Responda: "Entendo. Informe, por favor, o motivo do reembolso e o número do pedido, seu e-mail e número de telefone."

    - "Estou com problemas no pagamento."
    → Responda: "Vamos verificar isso. Você tentou pagar por qual método? Cartão, boleto ou Pix?"

    - "Tenho um problema relacionado à minha conta."
    → Responda: "Certo. Qual seria o problema com sua conta? Por exemplo, acesso, e-mail ou senha?"

    - "Tenho dúvidas sobre o curso."
    → Responda: "Claro! Pode me dizer qual é a sua dúvida sobre o curso?"

    - "Gostaria de enviar um feedback."
    → Responda: "Adoraríamos ouvir seu feedback. Pode escrever o que achou ou o que gostaria de sugerir?"

    - "Estou com problemas para emitir meu certificado."
    → Responda: "Vamos resolver isso. Você concluiu todas as aulas e avaliações? Recebeu alguma mensagem de erro?"

    - "Tenho uma sugestão de melhoria."
    → Responda: "Legal! Pode nos contar sua sugestão, vamos analisar com carinho."

    - "Encontrei um erro no site."
    → Responda: "Obrigado por avisar. Pode nos dizer onde viu esse erro e o que aconteceu exatamente?"

    - "Estou com dificuldade para acessar o conteúdo."
    → Responda: "Vamos te ajudar com isso. O conteúdo não está carregando ou aparece alguma mensagem de erro?"

    - "Tenho outra questão que não está listada."
    → Responda: "Sem problemas! Pode escrever sua dúvida aqui e vamos fazer o possível para te ajudar."`;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            const chatCompletion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [{
                    role: "system",
                    content: instrucoesNailsyca
                },
                    ...messagesHistory.slice(-10)
                ],
                temperature: 0.5,
                top_p: 1,
                max_completion_tokens: 1024,
                tools: [{
                    type: "function",
                    function: {
                        name: "transferToHuman",
                        description: "Transfere o atendimento para um humano.",
                        parameters: {
                            type: "object",
                            properties: {
                                motivoDoContato: {
                                    type: "string",
                                    description: "Motivo do contato do usuário."
                                }
                            },
                            required: ["motivoDoContato"]
                        }
                    }
                },
                    {
                        type: "function",
                        function: {
                            name: "foraDoAssunto",
                            description: "Indica que o assunto está fora da área de suporte da plataforma Nails Gessyca.",
                            parameters: {
                                type: "object",
                                properties: {
                                    assunto: {
                                        type: "string",
                                        description: "Assunto mencionado pelo usuário que está fora do escopo de atendimento."
                                    }
                                },
                                required: ["assunto"]
                            }
                        }
                    }],
                tool_choice: "auto"
            });

            const choice = chatCompletion.choices?.[0];
            const message = choice?.message;
            const toolCalls = message?.tool_calls;
            console.log(toolCalls);
            if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function?.name;
                    let args = {};

                    try {
                        args = JSON.parse(toolCall.function?.arguments || '{}');
                    } catch (err) {
                        console.warn("Erro ao analisar argumentos da função:", err);
                    }

                    if (functionName === "transferToHuman") {
                        await transferToHumanHandler(args, chatRef, name);
                        return {
                            functionName,
                            message: "🔄 Por favor, aguarde alguns instantes. Um membro da nossa equipe de atendimento irá falar com você em breve. Pedimos que permaneça neste chat enquanto realizamos a conexão. Não se preocupe, nós iremos te notificar quando o atendimento começar."
                        };
                    } else if (functionName === "foraDoAssunto") {
                        return {
                            functionName,
                            message: "Sou apenas uma assistente de suporte da plataforma Nails Gessyca 💅. Meu foco é te ajudar com dúvidas sobre nossos cursos, pagamentos, acessos e suporte técnico. Para assuntos externos como política, celebridades, clima ou outros sites e produto, infelizmente não consigo ajudar, tá bom? 💖"

                        };
                    }
                }
            }

            return {
                functionName: false,
                message: message?.content || "Desculpe, não consegui entender. Poderia repetir?"
            };

        } catch (err) {
            if (err.status === 503 && tentativa < maxTentativas) {
                console.warn(`Erro 503 (Groq indisponível). Tentando novamente em ${10000 / 1000} segundos... [${tentativa}/${maxTentativas}]`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                console.error("Erro fatal ao chamar o Groq:", err);
                return {
                    functionName: false,
                    message: "Desculpe, estamos com instabilidade no momento. Por favor, tente novamente mais tarde."
                };
            }
        }
    }
};
async function transferToHumanHandler(args, chatRef, name) {
    console.log('Atendimento humano solicitado');
    await chatRef.update({
        status: 'waiting-human'
    });

    sendNotificationToAdmins('Novo atendimento humano solicitado', `O usuário ${name || 'anônimo'} solicitou atendimento com um atendente humano.\nMotivo de contato: ${args.motivoDoContato}.\nAcesse o painel para assumir o caso.`);
}

export const processSupport = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({
            message: 'OPTIONS recebido'
        });
    }

    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) return res.status(401).json({
            error: 'Token de autenticação não encontrado!'
        });

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const {
            chat,
            message,
            type,
            chatUserId
        } = req.body;

        const pushMessage = async (ref, msg, user = 'user', extra = {}) => {
            await ref.push({
                message: msg,
                user,
                timestamp: admin.database.ServerValue.TIMESTAMP,
                ...extra
            });
        };

        const buildHistory = (history) => Object.values(history).map(msg => ({
            role: msg.user === 'user' ? 'user': 'assistant',
            content: msg.message
        }));

        if (decodedToken.admin) {
            if (!chat || typeof chat !== 'string' || !chat.trim()) {
                return res.status(400).json({
                    error: 'Chat inválida ou ausente'
                });
            }

            const chatRef = database.ref(`support/${chatUserId}/${chat}`);
            const messageRef = chatRef.child('messages');
            const chatData = (await chatRef.once('value')).val();

            if (chatData.attendantName || chatData.status === 'talking-to-nailsyca') {
                return res.status(400).json({
                    error: 'Outra pessoa está cuidando do caso ou esse chat não está definido como atendimento humano.'
                });
            }

            if (type === 'to-enter') {
                await chatRef.update({
                    status: 'human-service', attendantName: decodedToken.name
                });
                await pushMessage(messageRef, `Olá! 👋 Me chamo ${decodedToken.name} e sou da equipe de suporte humano da plataforma Nails Gessyca 💅. A partir de agora, assumirei o seu caso. Vou verificar o histórico da conversa e já volto com você em instantes, tudo bem? 😊✨`, decodedToken.name);
                return res.status(200).json({
                    ok: 'Você assumiu o caso com sucesso!'
                });
            }

            if (type === 'messages') {
                await pushMessage(messageRef, message, decodedToken.name);
                return res.status(200).json({
                    ok: 'Mensagem enviada!'
                });
            }

            return res.status(400).json({
                error: 'Tipo de requisição não encontrada!'
            });
        }

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                error: 'Mensagem inválida ou ausente'
            });
        }

        if (!chat) {
            const protocolId = uuidv4();
            const chatRef = database.ref(`support/${userId}/${protocolId}`);
            const messageRef = chatRef.child('messages');

            await pushMessage(messageRef, message);

            if (decodedToken.name) {
                await chatRef.update({
                    name: decodedToken.name, status: 'talking-to-nailsyca'
                });

                const historySnap = await messageRef.once('value');
                if (!historySnap.exists()) return res.status(404).json({
                    error: `Chat ${chat} não encontrado.`
                });

                const botReply = await askBot(buildHistory(historySnap.val()), chatRef, decodedToken.name);
                await pushMessage(messageRef, botReply.message, 'Nailsyca', {
                    functionName: botReply.functionName
                });

                return res.status(200).json({
                    ok: `Mensagem enviada para o chat: ${protocolId}`, chatId: protocolId
                });
            }

            await pushMessage(messageRef, '🏷️ Antes de continuarmos, como posso te chamar?', 'Nailsyca');
            await chatRef.update({
                status: 'waiting-name'
            });

            return res.status(200).json({
                chatId: protocolId, protocol: protocolId
            });
        }

        const chatRef = database.ref(`support/${userId}/${chat}`);
        const messageRef = chatRef.child('messages');
        const chatSnapshot = await chatRef.once('value');
        const chatData = chatSnapshot.val();

        if (!(await messageRef.once('value')).exists()) {
            return res.status(404).json({
                error: `Chat ${chat} não encontrado.`
            });
        }

        if (chatData.status === 'waiting-name') {
            const extractedName = await extractNameFromMessage(message);
            if (extractedName.type === 'NotRecognized') {
                await pushMessage(messageRef, '🤖 Não consegui identificar seu nome. Por favor, me diga apenas seu primeiro nome.', 'Nailsyca');
                return res.status(200).json({
                    error: 'Nome não reconhecido', protocol: chat
                });
            }

            const finalName = extractedName.type === 'AnonymousUser' ? 'Anônimo': extractedName.value;

            await chatRef.update({
                name: finalName, status: 'talking-to-nailsyca'
            });
            await pushMessage(messageRef, message);
            await pushMessage(messageRef, extractedName.type === 'AnonymousUser'
                ? '👋 Prazer, respeitamos sua decisão, vamos te chamar de anônimo.': `👋 Prazer, ${extractedName.value}! Obrigada por informar seu nome.`, 'Nailsyca');

            await pushMessage(messageRef, '🎯 Agora me diga com mais detalhes, o motivo do seu contato.', 'Nailsyca');

            return res.status(200).json({
                ok: 'Nome salvo e chat em andamento', protocol: chat, name: extractedName.value
            });
        }

        await pushMessage(messageRef, message);

        if (chatData.status !== 'waiting-human') {
            const history = (await messageRef.once('value')).val();
            const historyMessages = buildHistory(history);
            historyMessages.push({
                role: 'user', content: message
            });

            const botReply = await askBot(historyMessages, chatRef, decodedToken.name || chatData.name);
            await pushMessage(messageRef, botReply.message, 'Nailsyca', {
                functionName: botReply.functionName
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

const extractNameFromMessage = async (userMessage) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{
                role: "system",
                content: `Você é uma IA que extrai o primeiro nome do usuário com base em mensagens informais.
                Use chamadas de função (tools) para indicar o que foi identificado.`
            },
                {
                    role: "user",
                    content: userMessage
                }],
            tools: [{
                type: "function",
                function: {
                    name: "ExtractedName",
                    description: "Usada quando o primeiro nome do usuário for identificado com clareza.",
                    parameters: {
                        type: "object",
                        properties: {
                            nome: {
                                type: "string",
                                description: "O primeiro nome do usuário identificado."
                            }
                        },
                        required: ["nome"]
                    }
                }
            },
                {
                    type: "function",
                    function: {
                        name: "AnonymousUser",
                        description: "Usada quando o usuário diz que não quer informar o nome.",
                        parameters: {
                            type: "object",
                            properties: {
                                motivo: {
                                    type: "string",
                                    description: "Motivo ou justificativa opcional, como 'prefere não informar'."
                                }
                            },
                            required: ["motivo"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "NotRecognized",
                        description: "Usada quando a mensagem não contém nenhum nome claro reconhecível.",
                        parameters: {
                            type: "object",
                            properties: {
                                motivo: {
                                    type: "string",
                                    description: "Motivo explicando porque o nome não pôde ser identificado."
                                }
                            },
                            required: ["motivo"]
                        }
                    }
                }],
            tool_choice: "auto"
        })
    });

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) return {
        tipo: "erro",
        valor: null
    };

    const {
        name,
        arguments: args
    } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    if (name === "ExtractedName") {
        return {
            type: "ExtractedName",
            value: parsedArgs.nome
        };
    }

    if (name === "AnonymousUser") {
        return {
            type: "AnonymousUser",
            value: parsedArgs.motivo
        };
    }

    if (name === "NotRecognized") {
        return {
            type: "NotRecognized",
            value: parsedArgs.motivo
        };
    }

    return {
        tipo: "erro",
        valor: null
    };
};

async function sendNotificationToAdmins(title, body) {
    const adminUsersRef = db.collection('users').where('role', '==', 'admin');
    const adminUsersSnapshot = await adminUsersRef.get();

    if (adminUsersSnapshot.empty) {
        console.warn('Nenhum administrador encontrado para notificação.');
        return;
    }

    const notificationPromises = [];

    adminUsersSnapshot.forEach(adminUserDoc => {
        const adminUserData = adminUserDoc.data();
        const adminUserToken = adminUserData.token;

        if (!adminUserToken) return;

        const message = {
            token: adminUserToken,
            webpush: {
                headers: {
                    Urgency: 'high',
                },
            },
            data: {
                title: title,
                body: body,
                click_action: 'https://admin.nailsgessyca.com.br',
                icon: 'https://admin.nailsgessyca.com.br/assets/images/nailsyca.png',
                badge: 'https://admin.nailsgessyca.com.br/assets/images/badge.png'

            },
        };

        notificationPromises.push(admin.messaging().send(message));
    });

    const results = await Promise.allSettled(notificationPromises);

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`❌ Erro ao notificar admin ${index}:`, result.reason);
        }
    });

    console.log(`✅ Notificações enviadas para ${results.length} admins.`);
}