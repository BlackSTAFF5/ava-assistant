/**
 * views/leads.js - Gerenciamento de Leads (Premium SaaS Version)
 */
import { db, showToast, confirmAction, handleFirestoreError, escapeHTML } from '../app.js';

let unsubscribe = null;
let allLeads = [];

export function renderLeadsView(container, actions) {
    // 1. Botões de Ação no Header
    actions.innerHTML = `
        <button class="btn btn-secondary" id="btnRefreshLeads">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Atualizar
        </button>
    `;

    // 2. Estrutura da View
    container.innerHTML = `
        <!-- Cards Analíticos Premium -->
        <div class="analytics-grid">
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
                <div class="analytics-info">
                    <h3>Total de Leads</h3>
                    <div class="value" id="countTotal">0</div>
                    <div class="desc">Ecossistema completo</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20m10-10H2"></path></svg></div>
                <div class="analytics-info">
                    <h3>Novos Hoje</h3>
                    <div class="value" id="countToday" style="color: var(--accent)">0</div>
                    <div class="desc">Oportunidades recentes</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div>
                <div class="analytics-info">
                    <h3>Contatados</h3>
                    <div class="value" id="countContacted">0</div>
                    <div class="desc">Em negociação</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                <div class="analytics-info">
                    <h3>Reuniões</h3>
                    <div class="value" id="countMeetings">0</div>
                    <div class="desc">Agendamentos</div>
                </div>
            </div>
        </div>

        <!-- Filtros e Busca Modernos -->
        <div class="filters-bar">
            <div class="search-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="leadSearch" class="form-control search-input" placeholder="Buscar leads por nome, empresa ou telefone...">
            </div>
            <select id="filterSegment" class="form-control" style="width: 220px;">
                <option value="">Todos os segmentos</option>
            </select>
            <select id="filterStatus" class="form-control" style="width: 200px;">
                <option value="">Todos os status</option>
                <option value="novo">Novo</option>
                <option value="em contato">Em contato</option>
                <option value="qualificado">Qualificado</option>
                <option value="perdido">Perdido</option>
                <option value="convertido">Convertido</option>
            </select>
        </div>

        <!-- Tabela -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nome / Empresa</th>
                        <th>WhatsApp</th>
                        <th>E-mail</th>
                        <th>Segmento</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="leadsTableBody">
                    ${Array(5).fill('<tr><td colspan="7"><div class="skeleton" style="height:48px; margin: 8px 0;"></div></td></tr>').join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('btnRefreshLeads').onclick = (e) => {
        const btn = e.currentTarget;
        btn.querySelector('svg').style.animation = 'loading 1s linear infinite';
        setTimeout(() => btn.querySelector('svg').style.animation = '', 1000);
        startRealtimeLeads();
        showToast("Leads atualizados com sucesso", "success");
    };

    document.getElementById('leadSearch').oninput = filterLeads;
    document.getElementById('filterSegment').onchange = filterLeads;
    document.getElementById('filterStatus').onchange = filterLeads;

    startRealtimeLeads();
}

function startRealtimeLeads() {
    if (unsubscribe) unsubscribe();

    unsubscribe = db.collection('leads')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            allLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateStats();
            updateSegmentsDropdown();
            filterLeads();
        }, handleFirestoreError);
}

function updateStats() {
    const today = new Date().toDateString();
    document.getElementById('countTotal').innerText = allLeads.length;
    document.getElementById('countToday').innerText = allLeads.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === today).length;
    document.getElementById('countContacted').innerText = allLeads.filter(l => l.status === 'em contato').length;
    document.getElementById('countMeetings').innerText = allLeads.filter(l => l.reuniaoAgendada === true).length;
}

function updateSegmentsDropdown() {
    const select = document.getElementById('filterSegment');
    if (!select) return;
    const currentVal = select.value;
    const segments = [...new Set(allLeads.map(l => l.segment).filter(Boolean))];
    select.innerHTML = '<option value="">Todos os segmentos</option>' + 
        segments.map(s => `<option value="${s}" ${s === currentVal ? 'selected' : ''}>${s}</option>`).join('');
}

function filterLeads() {
    const searchInput = document.getElementById('leadSearch');
    const segmentSelect = document.getElementById('filterSegment');
    const statusSelect = document.getElementById('filterStatus');
    
    if (!searchInput) return;

    const search = searchInput.value.toLowerCase();
    const segment = segmentSelect.value;
    const status = statusSelect.value;

    const filtered = allLeads.filter(l => {
        const matchesSearch = !search || 
            (l.name || '').toLowerCase().includes(search) || 
            (l.company || '').toLowerCase().includes(search) || 
            (l.whatsapp || '').includes(search);
        const matchesSegment = !segment || l.segment === segment;
        const matchesStatus = !status || (l.status || 'novo').toLowerCase() === status.toLowerCase();
        return matchesSearch && matchesSegment && matchesStatus;
    });

    renderTable(filtered);
}

function renderTable(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    if (leads.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14l2 2 4-4"></path></svg>
                        <h2>Nenhum lead cadastrado ainda</h2>
                        <p>Os leads aparecerão aqui automaticamente quando novos contatos preencherem a ficha.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = leads.map(l => {
        const date = l.timestamp ? new Date(l.timestamp).toLocaleDateString('pt-BR') : '—';
        const status = (l.status || 'novo').toLowerCase();
        const statusClass = `badge-${status.replace(/\s+/g, '-')}`;
        const name = escapeHTML(l.name || 'Lead sem nome');
        const company = escapeHTML(l.company || 'Empresa não informada');
        const whatsapp = escapeHTML(l.whatsapp || '—');
        const email = escapeHTML(l.email || '—');
        const segment = escapeHTML(l.segment || 'Geral');
        
        return `
            <tr onclick="window.viewLead('${l.id}')" style="cursor: pointer">
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; color: var(--text-primary)">${name}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary)">${company}</span>
                    </div>
                </td>
                <td style="font-family: monospace; font-weight: 500;">${whatsapp}</td>
                <td>${email}</td>
                <td><span class="badge" style="background: var(--bg-main); color: var(--text-secondary); border: 1px solid var(--border)">${segment}</span></td>
                <td style="color: var(--text-secondary)">${date}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation()">
                        <button class="btn-icon" style="color: var(--accent)" onclick="window.viewLead('${l.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                        <button class="btn-icon" style="color: var(--danger)" onclick="window.deleteLead('${l.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============ PREMIUM MODAL LOGIC ============
window.viewLead = async (id) => {
    // 1. Mostrar Backdrop e Loading Initial
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-overlay';
    backdrop.id = 'leadModalOverlay';
    backdrop.innerHTML = `
        <div class="modal-premium" style="align-items: center; justify-content: center;">
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <p style="margin-top: 20px; color: var(--text-secondary)">Carregando inteligência do lead...</p>
        </div>
    `;
    document.body.appendChild(backdrop);

    // 2. Fetch Fresh Data
    try {
        const doc = await db.collection('leads').doc(id).get();
        if (!doc.exists) {
            backdrop.remove();
            showToast("Lead não encontrado", "error");
            return;
        }
        const lead = { id: doc.id, ...doc.data() };
        renderPremiumModalContent(lead, backdrop);
    } catch (e) {
        backdrop.remove();
        handleFirestoreError(e);
    }
};

function renderPremiumModalContent(lead, container) {
    const status = (lead.status || 'novo').toLowerCase();
    const date = lead.timestamp ? new Date(lead.timestamp).toLocaleString('pt-BR') : '—';
    const temp = lead.temperature || (lead.score > 70 ? 'hot' : lead.score > 30 ? 'warm' : 'cold');
    const tempLabel = temp === 'hot' ? '🔥 Lead Quente' : temp === 'warm' ? '🟠 Lead Morno' : '🔵 Lead Frio';
    const tempClass = `temp-${temp}`;
    
    // Iniciais para o Avatar e sanitização
    const initials = escapeHTML((lead.name || 'L').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase());
    const name = escapeHTML(lead.name || 'Lead sem nome');
    const segment = escapeHTML(lead.segment || 'Geral');
    const aiSummary = escapeHTML(lead.aiSummary || lead.necessidade || lead.message || 'A IA está processando o resumo desta conversa...');
    const painPoints = escapeHTML(lead.painPoints || 'Não identificadas');
    const objectives = escapeHTML(lead.objectives || lead.objective || 'Melhorar operação');
    const interestLevel = escapeHTML(lead.interestLevel || 'Em análise');
    const necessity = escapeHTML(lead.necessity || 'Padrão');
    const closingChance = escapeHTML(lead.closingChance || '45');
    const aiAnalysis = escapeHTML(lead.aiAnalysis || 'Lead com bom potencial, mas requer follow-up imediato.');
    const priority = escapeHTML(lead.priority || 'Média');
    const potential = escapeHTML(lead.potential || 'R$ 2.500 - R$ 5.000');
    const whatsapp = escapeHTML(lead.whatsapp || '—');
    const email = escapeHTML(lead.email || '—');
    const city = escapeHTML(lead.city || 'Não informada');
    const revenue = escapeHTML(lead.revenue || '—');
    const employees = escapeHTML(lead.employees || '—');
    const source = escapeHTML(lead.source || 'Bot Ava');

    container.innerHTML = `
        <div class="modal-premium">
            <!-- HEADER -->
            <div class="modal-premium-header">
                <div class="lead-profile-info">
                    <div class="lead-avatar-large">${initials}</div>
                    <div class="lead-main-data">
                        <h2>${name}</h2>
                        <div class="lead-badges">
                            <span class="badge badge-${status.replace(/\s+/g, '-')}">${status}</span>
                            <span class="badge" style="background: var(--bg-hover)">${segment}</span>
                            <span class="temp-tag ${tempClass}">${tempLabel}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="text-align: right; margin-right: 20px;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary)">Capturado em</div>
                        <div style="font-weight: 600;">${date}</div>
                    </div>
                    <button class="btn-icon" onclick="document.getElementById('leadModalOverlay').remove()">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <!-- BODY -->
            <div class="modal-premium-body">
                <!-- COLUNA ESQUERDA: IA & DADOS -->
                <div class="modal-left">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                        Resumo Inteligente da Conversa
                    </div>
                    
                    <div class="ai-summary-box">
                        <p style="line-height: 1.8; font-size: 1.05rem; color: #fff;">
                            ${aiSummary}
                        </p>
                        
                        <div class="ai-grid">
                            <div class="ai-item">
                                <label>Dores do Cliente</label>
                                <p>${painPoints}</p>
                            </div>
                            <div class="ai-item">
                                <label>Objetivo</label>
                                <p>${objectives}</p>
                            </div>
                            <div class="ai-item">
                                <label>Interesse</label>
                                <p>${interestLevel}</p>
                            </div>
                            <div class="ai-item">
                                <label>Necessidades</label>
                                <p>${necessity}</p>
                            </div>
                        </div>
                    </div>

                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        Análise Estratégica
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
                        <div class="card" style="padding: 20px; background: rgba(255,255,255,0.02)">
                            <div class="score-container">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.8rem; color: var(--text-secondary)">Chance de Fechamento</span>
                                    <span style="font-weight: 800; color: var(--accent)">${closingChance}%</span>
                                </div>
                                <div class="score-bar-bg"><div class="score-bar-fill" style="width: ${closingChance}%"></div></div>
                            </div>
                            <p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-secondary)">
                                ${aiAnalysis}
                            </p>
                        </div>
                        <div class="card" style="padding: 20px; background: rgba(255,255,255,0.02)">
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div class="detail-item">
                                    <label>Prioridade</label>
                                    <span style="color: ${priority === 'Alta' ? 'var(--danger)' : 'var(--success)'}">${priority}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Potencial Financeiro</label>
                                    <span>${potential}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="section-title">Dados Detalhados</div>
                    <div class="details-grid">
                        <div class="detail-item"><label>WhatsApp</label><span>${whatsapp}</span></div>
                        <div class="detail-item"><label>E-mail</label><span>${email}</span></div>
                        <div class="detail-item"><label>Cidade</label><span>${city}</span></div>
                        <div class="detail-item"><label>Faturamento</label><span>${revenue}</span></div>
                        <div class="detail-item"><label>Funcionários</label><span>${employees}</span></div>
                        <div class="detail-item"><label>Origem</label><span>${source}</span></div>
                    </div>
                </div>

                <!-- COLUNA DIREITA: TIMELINE -->
                <div class="modal-right">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Timeline da Conversa
                    </div>
                    
                    <div class="timeline-container">
                        ${renderTimeline(lead)}
                    </div>
                </div>
            </div>

            <!-- FOOTER -->
            <div class="modal-premium-footer">
                <div style="display: flex; gap: 16px;">
                    <a href="https://wa.me/${whatsapp.replace(/\D/g, '')}" target="_blank" class="btn btn-primary" style="background: #25D366; border: none; padding: 12px 24px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        Chamar no WhatsApp
                    </a>
                    <button class="btn btn-secondary" onclick="window.scheduleMeeting('${lead.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Marcar Reunião
                    </button>
                </div>
                
                <div style="display: flex; gap: 12px; align-items: center;">
                    <select class="form-control" style="width: 180px;" onchange="window.updateLeadStatus('${lead.id}', this.value)">
                        <option value="novo" ${status==='novo'?'selected':''}>Novo</option>
                        <option value="em contato" ${status==='em contato'?'selected':''}>Em contato</option>
                        <option value="qualificado" ${status==='qualificado'?'selected':''}>Qualificado</option>
                        <option value="convertido" ${status==='convertido'?'selected':''}>Convertido</option>
                        <option value="perdido" ${status==='perdido'?'selected':''}>Perdido</option>
                    </select>
                    <button class="btn-icon delete" onclick="window.deleteLead('${lead.id}')" style="background: rgba(239,68,68,0.1); padding: 10px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderTimeline(lead) {
    if (lead.timeline && Array.isArray(lead.timeline)) {
        return lead.timeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-dot" style="border-color: ${item.sender === 'bot' ? 'var(--accent)' : '#3b82f6'}"></div>
                <div class="timeline-time">${escapeHTML(item.time || 'agora')}</div>
                <div class="timeline-content">${escapeHTML(item.content)}</div>
            </div>
        `).join('');
    }
    
    // Fallback: Mostrar a mensagem inicial como primeiro item da timeline
    return `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-time">${lead.timestamp ? new Date(lead.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '—'}</div>
            <div class="timeline-content">
                <strong>Lead capturado:</strong><br>
                ${escapeHTML(lead.necessidade || lead.message || 'Nenhuma mensagem inicial registrada.')}
            </div>
        </div>
        <div class="timeline-item" style="opacity: 0.5">
            <div class="timeline-dot" style="border-color: var(--border)"></div>
            <div class="timeline-content">Aguardando novas interações...</div>
        </div>
    `;
}

// Funções globais auxiliares
window.scheduleMeeting = (id) => {
    showToast("Função de agendamento em integração com Google Calendar", "info");
};

window.deleteLead = (id) => {
    confirmAction("Deseja excluir este lead permanentemente do CRM?", async () => {
        try {
            await db.collection('leads').doc(id).delete();
            const modal = document.getElementById('leadModalOverlay');
            if (modal) modal.remove();
            showToast("Lead removido com sucesso", "success");
        } catch (e) { handleFirestoreError(e); }
    });
};

window.updateLeadStatus = async (id, newStatus) => {
    try {
        await db.collection('leads').doc(id).update({ status: newStatus });
        showToast(`Status atualizado: ${newStatus.toUpperCase()}`, "success");
    } catch (e) { handleFirestoreError(e); }
};
