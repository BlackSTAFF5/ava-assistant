/**
 * views/leads.js - Gerenciamento de Leads
 */
import { db, showToast, confirmAction, handleFirestoreError } from '../app.js';

let unsubscribe = null;
let allLeads = [];

export function renderLeadsView(container, actions) {
    // 1. Botões de Ação no Header
    actions.innerHTML = `
        <button class="btn btn-secondary" id="btnRefreshLeads">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Atualizar
        </button>
    `;

    // 2. Estrutura da View
    container.innerHTML = `
        <!-- Cards Analíticos -->
        <div class="analytics-grid">
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
                <div class="analytics-info">
                    <h3>Total de Leads</h3>
                    <div class="value" id="countTotal">0</div>
                    <div class="desc">Todos os leads</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20m10-10H2"></path></svg></div>
                <div class="analytics-info">
                    <h3>Novos Hoje</h3>
                    <div class="value" id="countToday">0</div>
                    <div class="desc">Recebidos hoje</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div>
                <div class="analytics-info">
                    <h3>Contatados</h3>
                    <div class="value" id="countContacted">0</div>
                    <div class="desc">Já em contato</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                <div class="analytics-info">
                    <h3>Reuniões</h3>
                    <div class="value" id="countMeetings">0</div>
                    <div class="desc">Agendadas</div>
                </div>
            </div>
        </div>

        <!-- Barra de Filtros -->
        <div class="filters-bar">
            <div class="search-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="leadSearch" class="form-control search-input" placeholder="Buscar por nome, empresa ou telefone...">
            </div>
            <select id="filterSegment" class="form-control" style="width: 200px;">
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
                    <!-- Skeletons iniciais -->
                    ${Array(5).fill('<tr><td colspan="7"><div class="skeleton" style="height:40px; margin: 10px 0;"></div></td></tr>').join('')}
                </tbody>
            </table>
        </div>
    `;

    // 3. Listeners de UI
    document.getElementById('btnRefreshLeads').onclick = (e) => {
        const btn = e.currentTarget;
        btn.querySelector('svg').classList.add('spinning');
        setTimeout(() => btn.querySelector('svg').classList.remove('spinning'), 1000);
        startRealtimeLeads();
        showToast("Leads atualizados!", "success");
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
    const search = document.getElementById('leadSearch').value.toLowerCase();
    const segment = document.getElementById('filterSegment').value;
    const status = document.getElementById('filterStatus').value;

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
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                        <p>Nenhum lead encontrado</p>
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
        
        return `
            <tr>
                <td><strong>${l.name || 'Sem nome'}</strong><br><small style="color:var(--text-secondary)">${l.company || '—'}</small></td>
                <td>${l.whatsapp || '—'}</td>
                <td>${l.email || '—'}</td>
                <td><span class="badge" style="background: var(--bg-hover)">${l.segment || 'Geral'}</span></td>
                <td>${date}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.viewLead('${l.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                        <button class="btn-icon delete" onclick="window.deleteLead('${l.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Funções globais para botões na tabela (SPA needs them on window)
window.deleteLead = (id) => {
    confirmAction("Tem certeza que deseja excluir este lead permanentemente?", async () => {
        try {
            await db.collection('leads').doc(id).delete();
            showToast("Lead removido com sucesso", "success");
        } catch (e) { handleFirestoreError(e); }
    });
};

window.viewLead = (id) => {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;
    
    // Criar modal dinâmico de detalhes
    const modalHtml = `
        <div id="leadModal" class="modal-overlay">
            <div class="modal-card" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Detalhes do Lead</h2>
                    <button class="btn-close-modal" onclick="document.getElementById('leadModal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div><label style="color:var(--text-secondary); font-size: 12px;">NOME</label><p>${lead.name || '—'}</p></div>
                    <div><label style="color:var(--text-secondary); font-size: 12px;">EMPRESA</label><p>${lead.company || '—'}</p></div>
                    <div><label style="color:var(--text-secondary); font-size: 12px;">WHATSAPP</label><p>${lead.whatsapp || '—'}</p></div>
                    <div><label style="color:var(--text-secondary); font-size: 12px;">E-MAIL</label><p>${lead.email || '—'}</p></div>
                    <div><label style="color:var(--text-secondary); font-size: 12px;">SEGMENTO</label><p>${lead.segment || '—'}</p></div>
                    <div><label style="color:var(--text-secondary); font-size: 12px;">STATUS ATUAL</label>
                        <select class="form-control" onchange="window.updateLeadStatus('${lead.id}', this.value)">
                            <option value="novo" ${lead.status==='novo'?'selected':''}>Novo</option>
                            <option value="em contato" ${lead.status==='em contato'?'selected':''}>Em contato</option>
                            <option value="qualificado" ${lead.status==='qualificado'?'selected':''}>Qualificado</option>
                            <option value="perdido" ${lead.status==='perdido'?'selected':''}>Perdido</option>
                            <option value="convertido" ${lead.status==='convertido'?'selected':''}>Convertido</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <label style="color:var(--text-secondary); font-size: 12px;">NECESSIDADE / OBSERVAÇÕES</label>
                    <p style="background: var(--bg-hover); padding: 12px; border-radius: 8px; margin-top: 8px;">${lead.necessidade || 'Nenhuma observação registrada.'}</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.updateLeadStatus = async (id, newStatus) => {
    try {
        await db.collection('leads').doc(id).update({ status: newStatus });
        showToast("Status atualizado", "success");
    } catch (e) { handleFirestoreError(e); }
};
