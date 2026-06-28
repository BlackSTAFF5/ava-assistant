const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Retell = require('retell-sdk');

const app = express();

app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

app.use(cors({
  origin: ['https://avaassistant.cloud', 'https://ava-assistant-production.up.railway.app', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:5500', 'https://n8n2.omelhorvendedoronline.com.br'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '1mb' }));

app.use(express.static(__dirname));

const RETELL_API_KEY = process.env.RETELL_API_KEY || 'key_06812c4e95a5f639aaa550233237';
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID || 'agent_62d3c4cb72c0a7cd6dc3c5f1c7';

const client = new Retell({ apiKey: RETELL_API_KEY });

const voiceCallLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas requisições. Aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function checkRetellConcurrency() {
  try {
    const concurrency = await client.concurrency.retrieve();
    return concurrency;
  } catch {
    return null;
  }
}

async function createWebCallWithRetry(agentId, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.retellai.com/v2/create-web-call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_id: agentId })
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get('retry-after-ms') || response.headers.get('Retry-After') || '1000');
        const delay = Math.min(retryAfter, 5000) + Math.random() * 1000;
        console.log(`Rate limited (429). Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
        lastError = { status: response.status, body: await response.text() };
        continue;
      }

      const errBody = await response.text();
      throw { status: response.status, body: errBody };
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) continue;
      throw err;
    }
  }

  throw lastError || { status: 429, body: 'Concurrency limit reached after retries.' };
}

async function createVoiceCall(req, res) {
  try {
    if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
      return res.status(503).json({ error: 'Serviço de voz não configurado.' });
    }

    const concurrency = await checkRetellConcurrency();
    if (concurrency) {
      const { current_concurrency, concurrency_limit } = concurrency;
      if (current_concurrency >= concurrency_limit) {
        console.warn(`Concorrência no limite: ${current_concurrency}/${concurrency_limit}`);
        return res.status(503).json({
          error: 'Limite de chamadas simultâneas atingido. Tente novamente em alguns instantes.',
          current_concurrency,
          concurrency_limit
        });
      }
      console.log(`Concorrência Retell: ${current_concurrency}/${concurrency_limit}`);
    }

    const data = await createWebCallWithRetry(RETELL_AGENT_ID);
    res.json({ access_token: data.access_token });
  } catch (error) {
    if (error.status === 429) {
      console.error('Concorrência excedida após retries:', error.body);
      return res.status(503).json({
        error: 'Serviço temporariamente indisponível. Muitas chamadas simultâneas. Tente novamente mais tarde.'
      });
    }
    console.error('Erro ao criar chamada Retell:', error.status || error.message, error.body || '');
    res.status(error.status || 500).json({
      error: 'Erro ao criar chamada de voz.',
      detail: error.body || error.message
    });
  }
}

app.post('/api/start-voice-call', voiceCallLimiter, createVoiceCall);
app.post('/create-web-call', voiceCallLimiter, createVoiceCall);

const N8N_CHAT_URL = process.env.N8N_CHAT_URL || 'https://avaassistant.cloud/webhook/ava-chat';
const N8N_AUTH_HEADER = 'X-AVA-Auth';
const N8N_AUTH_VALUE = process.env.N8N_AUTH_VALUE || 'ava-sec-k8x9Qm7Zp3wR5nL2vJ6';

async function forwardToN8n(payload, signal) {
  const response = await fetch(N8N_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [N8N_AUTH_HEADER]: N8N_AUTH_VALUE
    },
    body: JSON.stringify(payload),
    signal
  });
  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n HTTP ${response.status}: ${rawText.substring(0, 200)}`);
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { reply: rawText };
  }
  if (Array.isArray(data)) data = data[0]?.json || data[0] || {};
  return data.reply || data.output || data.text || '';
}

async function chatFallbackHandler(req, res) {
  const { message, sessionId, history } = req.body;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 25000);

  try {
    const reply = await forwardToN8n(
      { message, sessionId, timestamp: new Date().toISOString(), history: history || [] },
      ac.signal
    );
    clearTimeout(timeout);
    return res.json({ reply });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('[chat-fallback] n8n timeout');
    } else {
      console.error('[chat-fallback] n8n error:', err.message);
    }

    const replies = [
      'Olá! Recebi sua mensagem. No momento estou com instabilidade na minha conexão principal, mas já anotei o que você disse. Pode repetir ou reformular?',
      'Entendi! Estou passando por uma instabilidade temporária. Pode me perguntar de novo? Já estou me recuperando!',
      'Recebi sua mensagem! Minha conexão deu uma instabilidade, mas estou aqui. Pode me contar de novo?',
      'Ops! Nosso servidor de IA está instável agora, mas não se preocupe — sua mensagem não foi perdida. Pode tentar novamente?',
    ];
    const fallbackReply = replies[Math.floor(Math.random() * replies.length)];
    res.json({ reply: fallbackReply, _fallback: true });
  }
}

app.post('/api/chat', chatFallbackHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 AVA - Servidor ativo na porta ${PORT}`);
  console.log(`🔗 Endpoints: /api/start-voice-call, /api/chat`);
  console.log(`==================================================`);
});
