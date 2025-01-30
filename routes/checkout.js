import express from 'express';  // Importando express
import { processCheckout } from '../controllers/checkout.js';  // Importando o controller

const router = express.Router();

// Defina suas rotas e use o controller
router.get('/', processCheckout);

export default router;  // Exportando as rotas
