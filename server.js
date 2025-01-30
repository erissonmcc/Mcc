import express from 'express';
import cors from 'cors'; 

app.use(cors({
  origin: 'http://localhost:8080',
}));

const rateLimit = require('express-rate-limit');

const app = express();

// Defina o limite de requisições, por exemplo, 100 requisições por 15 minutos.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'blocked-requests',
  headers: true,
});

app.use(limiter);

import { processWebhook } from './controllers/webhook.js';
import { processCheckout } from './controllers/checkout.js';
import { processGetVideo } from './controllers/getVideo.js';
import { processRegister } from './controllers/register.js';

import { processPolarities } from './controllers/polarities.js';
import { processVerifytoken } from './controllers/verifytoken.js';
import { processSendEmail } from './controllers/sendEmail.js';
import { processBotHandler } from './controllers/botHandler.js';

const app = express();
app.use(cors());

app.get('/webhook', processWebhook);
app.get('/checkout', processCheckout);
app.get('/getVideo', processGetVideo);
app.get('/register', processRegister);

app.get('/polarities', processPolarities);
app.get('/verifytoken', processVerifytoken);
app.get('/sendEmail', processSendEmail);
app.get('/botHandler', processBotHandler);

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});