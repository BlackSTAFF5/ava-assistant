-- ============================================
-- Script para criar a tabela ava_leads
-- Execute este script no seu PostgreSQL
-- ============================================

CREATE TABLE IF NOT EXISTS ava_leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  whatsapp VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  segment VARCHAR(100),
  message TEXT,
  source VARCHAR(100) DEFAULT 'ava-assistant-chat',
  "sessionId" VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_ava_leads_timestamp ON ava_leads(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ava_leads_status ON ava_leads(status);
CREATE INDEX IF NOT EXISTS idx_ava_leads_segment ON ava_leads(segment);

-- Comentário na tabela
COMMENT ON TABLE ava_leads IS 'Leads capturados pelo AvaAssistant - Interface de chat com Gemini';
