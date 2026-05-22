const express = require('express');
const cors = require('cors');

const app = express();

// Habilitar CORS para permitir requisições do seu frontend estático
app.use(cors());
app.use(express.json());

// Suas credenciais do Retell AI fornecidas com segurança no backend
const RETELL_API_KEY = 'key_06812c4e95a5f639aaa550233237';
const RETELL_AGENT_ID = 'agent_62d3c4cb72c0a7cd6dc3c5f1c7';

/**
 * Endpoint para iniciar a chamada de voz.
 * Este endpoint faz o POST seguro na API da Retell AI para obter o access_token,
 * evitando expor sua API Key no frontend do navegador.
 */
app.post('/api/start-voice-call', async (req, res) => {
  try {
    console.log('Recebida solicitação de chamada de voz...');

    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro da API do Retell:', response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    console.log('Web call criada com sucesso no Retell. ID:', data.call_id);
    
    // Retorna o access_token para o frontend iniciar a chamada em tempo real
    res.json({ access_token: data.access_token });
  } catch (error) {
    console.error('Erro interno no servidor proxy:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao iniciar a chamada.' });
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 AVA - Servidor Proxy de Voz ativo na porta ${PORT}`);
  console.log(`🔗 Endpoint local: http://localhost:${PORT}/api/start-voice-call`);
  console.log(`==================================================`);
});
