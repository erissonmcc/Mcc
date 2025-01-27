
exports.handler = async (event, context) => {
  try {
    // Obtém a data e hora atual do servidor
    const serverDate = new Date();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Permite todas as origens. Ajuste conforme necessário.
        'Access-Control-Allow-Methods': 'GET, OPTIONS', // Permite métodos GET e OPTIONS
        'Access-Control-Allow-Headers': 'Content-Type', // Permite cabeçalhos específicos
      },
      body: JSON.stringify({
        serverTime: serverDate.toISOString(), // Envia a data em formato ISO 8601
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Erro ao obter a data e hora do servidor',
      }),
    };
  }
};
