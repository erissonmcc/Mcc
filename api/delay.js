// netlify/functions/delay-function.js

exports.handler = async (event, context) => {
  // Introduz um atraso de 15 segundos
  await new Promise(resolve => setTimeout(resolve, 15000));

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Permite acesso de qualquer origem
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Métodos permitidos
      'Access-Control-Allow-Headers': 'Content-Type', // Cabeçalhos permitidos
    },
    body: JSON.stringify({ message: 'This response took 15 seconds to send!' }),
  };
};
