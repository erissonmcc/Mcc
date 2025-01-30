const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsing de JSON
app.use(express.json());

// Importando as rotas
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');

// Prefixando todas as rotas com /api
app.use('/api/checkout', checkoutRoutes);
app.use('/api/webhook', webhookRoutes);

// Iniciando o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
