#!/bin/bash
# Setup script for n8n on Oracle Cloud Free Tier
# Run this AFTER creating your Oracle VM

set -e

echo "=== Atualizando sistema ==="
sudo apt-get update -y
sudo apt-get upgrade -y

echo "=== Instalando Docker ==="
sudo apt-get install -y docker.io docker-compose-v2

echo "=== Iniciando Docker ==="
sudo systemctl enable docker
sudo systemctl start docker

echo "=== Adicionando usuario ao grupo docker ==="
sudo usermod -aG docker ubuntu

echo "=== Criando diretorio para n8n ==="
mkdir -p ~/n8n

echo "=== Copiando docker-compose.yml ==="
cp docker-compose.yml ~/n8n/

echo "=== Iniciando n8n + PostgreSQL ==="
cd ~/n8n
sudo docker compose up -d

echo "=== Aguardando n8n iniciar ==="
sleep 10

echo ""
echo "=== VERIFICANDO ==="
sudo docker compose ps

echo ""
echo "=== LOGS ==="
sudo docker compose logs --tail=20 n8n

echo ""
echo "============================================"
echo "  SETUP COMPLETO!"
echo "============================================"
echo ""
echo "  Acesse n8n: http://SEU_IP:5678"
echo ""
echo "  Para ver logs: sudo docker compose logs -f"
echo "  Para parar:    sudo docker compose down"
echo "  Para atualizar: sudo docker compose pull && sudo docker compose up -d"
echo ""
echo "  IMPORTANTE:"
echo "  - Abra a porta 5678 no firewall da Oracle"
echo "  - Va em Rede -> Regras de entrada -> Adicionar"
echo "  - Porta: 5678, Protocolo: TCP, Origem: 0.0.0.0/0"
echo "============================================"
