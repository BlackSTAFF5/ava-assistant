const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: ['https://avaassistant.cloud', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '1mb' }));

const RETELL_API_KEY = process.env.RETELL_API_KEY || 'key_06812c4e95a5f639aaa550233237';
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID || 'agent_62d3c4cb72c0a7cd6dc3c5f1c7';

const voiceCallLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas requisições. Aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/start-voice-call', voiceCallLimiter, async (req, res) => {
  try {
    if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
      return res.status(503).json({ error: 'Serviço de voz não configurado.' });
    }

    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ agent_id: RETELL_AGENT_ID })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro da API do Retell:', response.status, errText);
      return res.status(response.status).json({ error: 'Erro ao iniciar chamada de voz.' });
    }

    const data = await response.json();
    res.json({ access_token: data.access_token });
  } catch (error) {
    console.error('Erro interno no servidor proxy:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor ao iniciar a chamada.', detail: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 AVA - Servidor Proxy de Voz ativo na porta ${PORT}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/api/start-voice-call`);
  console.log(`==================================================`);
});
