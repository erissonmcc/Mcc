// netlify/functions/server.js
const express = require('express');
const serverless = require('serverless-http');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Adicione suas rotas aqui
app.get('/', (req, res) => {
  res.send('Servidor Express está rodando na porta 3000');
});

// Adicione outras rotas conforme necessário

module.exports.handler = serverless(app);
