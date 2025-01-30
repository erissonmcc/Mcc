const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');

// Endpoint simples para checkout
router.post('/', checkoutController.processCheckout);

module.exports = router;
