import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsing de JSON
app.use(express.json());

// Importando as rotas
import checkoutRoutes from './routes/checkout.js';

// Prefixando todas as rotas com /api
app.use('/api/checkout', checkoutRoutes);

// Iniciando o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
