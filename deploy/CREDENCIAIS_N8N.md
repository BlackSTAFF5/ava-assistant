# Credenciais para recriar no n8n

Após migrar o n8n para Oracle Cloud, você precisa recriar estas credenciais:

## 1. HTTP Header Auth (usado nos webhooks)
- **Nome sugerido:** "AVA Site Webhook Auth"
- **Usado em:** AvaAssistant (Chatbot, Captura de Leads, Listar Leads), 22. AVA Concessionárias, etc.
- **Valor:** `X-AVA-Auth: ava-sec-k8x9Qm7Zp3wR5nL2vJ6`

## 2. OpenAI API
- **Nome sugerido:** "Amanda - OpenAI"
- **Usado em:** Transcrição de áudio, Chat Amanda, AVA Concessionárias
- **Valor:** Sua chave OpenAI

## 3. DeepSeek API (NOVO - substituiu Gemini)
- **Nome sugerido:** "DeepSeek API"
- **Chave:** `sk-63987fca26f94143a4b5103af37db47d`
- **Usado em:** AvaAssistant - Chatbot (já configurado no código, mas precisa recriar se usar em outros nós)

## 4. Google Gemini (não precisa mais)
- **Motivo:** Substituído pelo DeepSeek
- Pode ignorar

## 5. Google Calendar OAuth2
- **Nome sugerido:** "Google Agenda"
- **Usado em:** Agendamentos, consulta de janelas, lembretes

## 6. Google Drive OAuth2
- **Nome sugerido:** "Google Drive Fotos"
- **Usado em:** Envio de fotos, busca de imagens

## 7. Google Sheets OAuth2
- **Usado em:** Prospecção de leads

## 8. PostgreSQL (banco de dados principal)
- **Nome sugerido:** "Amanda - PostgreSQL"
- **Usado em:** Quase todos os workflows
- **Host:** (o novo host do banco, se migrar também)
- **Nota:** Esse banco estava no VPS antigo. Os dados foram perdidos se não tiver backup.

## 9. Chatwoot API
- **Nome sugerido:** "Chatwoot API"
- **Usado em:** Envio/recebimento de mensagens
- **Valor:** URL + Token da sua instância Chatwoot

## 10. Pinecone (memória vetorial Amanda)
- **Usado em:** Memória vetorial da Amanda

## 11. Twilio (se tiver)
- **Usado em:** Envio de mensagens SMS/WhatsApp
