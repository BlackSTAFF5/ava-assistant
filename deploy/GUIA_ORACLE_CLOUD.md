# Guia de Migração para Oracle Cloud Free Tier

## Passo 1: Criar conta Oracle Cloud

1. Acesse https://www.oracle.com/cloud/free/
2. Clique em "Start for free"
3. Preencha os dados (pede cartão só para verificação, não cobra)
4. Verifique o e-mail e telefone

## Passo 2: Criar uma VM (Instância)

1. No dashboard, vá em **Compute → Instances**
2. Clique **Create instance**
3. **Nome:** `n8n-ava` (ou qualquer nome)
4. **Image:** Canônical Ubuntu 22.04 (ou 24.04)
5. **Shape:** Escolha **ARM** (Ampere A1) — 4 CPUs, 24 GB RAM grátis
6. **SSH Keys:** Faça download da chave privada
7. Clique **Create**

## Passo 3: Liberar porta 5678 no firewall

1. No menu, vá em **Networking → Virtual Cloud Networks**
2. Clique na VNC da sua instância
3. Clique no **Security List** (lista de segurança)
4. Clique **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - Destination Port Range: `5678`
   - Description: `n8n`

## Passo 4: Conectar na VM e instalar n8n

```bash
# Conectar via SSH (use a chave que baixou)
ssh -i ~/caminho/chave.key ubuntu@SEU_IP

# Copiar os arquivos
# Primeiro faça upload do deploy/ pra VM usando SCP:
```

No seu computador (PowerShell):
```powershell
scp -i chave.key C:\Users\João Gabriel\Desktop\AVA\ SITE\deploy\docker-compose.yml ubuntu@SEU_IP:~/n8n/
scp -i chave.key C:\Users\João Gabriel\Desktop\AVA\ SITE\deploy\setup-oracle.sh ubuntu@SEU_IP:~/n8n/
```

Na VM:
```bash
cd ~/n8n
chmod +x setup-oracle.sh
./setup-oracle.sh
```

## Passo 5: Acessar n8n

Abra no navegador: `http://SEU_IP:5678`

- Crie sua conta de admin na primeira tela
- Vá em **Settings → Credentials** e recrie as credenciais (veja `CREDENCIAIS_N8N.md`)

## Passo 6: Importar workflows

1. Vá em **Workflows → Import from File**
2. Selecione o arquivo `n8n_workflows.json` da pasta do projeto
3. Associe as credenciais aos nós que pedirem

## Passo 7: Atualizar webhooks no site

No arquivo `ava-chat.js`, atualize as URLs:
```javascript
CHAT_WEBHOOK_URL: 'http://SEU_IP:5678/webhook/ava-chat',
LEAD_WEBHOOK_URL: 'http://SEU_IP:5678/webhook/ava-lead-capture',
```

## (Opcional) Colocar SSL/domínio

- **Opção A: Cloudflare Tunnel (grátis)**
  - Instale `cloudflared` na VM
  - `cloudflared tunnel --url http://localhost:5678`
  
- **Opção B: Nginx + Let's Encrypt (se tiver domínio)**
  - Instale nginx e certbot
  - Configure proxy reverso com SSL

## Dicas

- Para ver logs: `ssh ubuntu@SEU_IP` e depois `docker compose logs -f`
- Para reiniciar: `docker compose restart`
- Para atualizar n8n: `docker compose pull && docker compose up -d`
