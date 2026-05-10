/**
 * views/reunioes.js - Gerenciamento de Reuniões
 */
import { db, showToast, confirmAction, handleFirestoreError } from '../app.js';

let unsubscribe = null;
let allReunioes = [];
let allLeads = [];

export function renderReunioesView(container, actions) {
    actions.innerHTML = `
        <button class="btn btn-primary" id="btnNewReuniao">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nova Reunião
        </button>
    `;

    container.innerHTML = `
        <div class="analytics-grid">
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                <div class="analytics-info">
                    <h3>Total de Reuniões</h3>
                    <div class="value" id="reuniaoTotal">0</div>
                    <div class="desc">Agendamentos totais</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
                <div class="analytics-info">
                    <h3>Hoje</h3>
                    <div class="value" id="reuniaoHoje">0</div>
                    <div class="desc">Reuniões para hoje</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon" style="color: var(--success); background: rgba(34, 197, 94, 0.1);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
                <div class="analytics-info">
                    <h3>Confirmadas</h3>
                    <div class="value" id="reuniaoConfirmadas">0</div>
                    <div class="desc">Status: confirmada</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-icon" style="color: var(--warning); background: rgba(234, 179, 8, 0.1);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
                <div class="analytics-info">
                    <h3>Pendentes</h3>
                    <div class="value" id="reuniaoPendentes">0</div>
                    <div class="desc">Status: pendente</div>
                </div>
            </div>
        </div>

        <div class="filters-bar">
            <input type="text" id="reuniaoSearch" class="form-control" placeholder="Buscar por lead..." style="flex:1">
            <select id="reuniaoStatusFilter" class="form-control" style="width: 180px;">
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="confirmada">Confirmada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
            </select>
            <input type="date" id="reuniaoDateFilter" class="form-control" style="width: 160px;">
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Lead</th>
                        <th>Data / Hora</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Observações</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="reunioesTableBody"></tbody>
            </table>
        </div>
    `;

    document.getElementById('btnNewReuniao').onclick = () => openReuniaoModal();
    document.getElementById('reuniaoSearch').oninput = filterReunioes;
    document.getElementById('reuniaoStatusFilter').onchange = filterReunioes;
    document.getElementById('reuniaoDateFilter').onchange = filterReunioes;

    startRealtimeReunioes();
}

function startRealtimeReunioes() {
    if (unsubscribe) unsubscribe();

    // Carregar leads para o autocomplete
    db.collection('leads').get().then(snap => {
        allLeads = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
    });

    unsubscribe = db.collection('reunioes')
        .orderBy('data', 'asc')
        .onSnapshot(snapshot => {
            allReunioes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateStats();
            filterReunioes();
        }, handleFirestoreError);
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reuniaoTotal').innerText = allReunioes.length;
    document.getElementById('reuniaoHoje').innerText = allReunioes.filter(r => r.data === today).length;
    document.getElementById('reuniaoConfirmadas').innerText = allReunioes.filter(r => r.status === 'confirmada').length;
    document.getElementById('reuniaoPendentes').innerText = allReunioes.filter(r => r.status === 'pendente').length;
}

function filterReunioes() {
    const search = document.getElementById('reuniaoSearch').value.toLowerCase();
    const status = document.getElementById('reuniaoStatusFilter').value;
    const date = document.getElementById('reuniaoDateFilter').value;

    const filtered = allReunioes.filter(r => {
        const matchesSearch = !search || (r.leadNome || '').toLowerCase().includes(search);
        const matchesStatus = !status || r.status === status;
        const matchesDate = !date || r.data === date;
        return matchesSearch && matchesStatus && matchesDate;
    });

    renderTable(filtered);
}

function renderTable(reunioes) {
    const tbody = document.getElementById('reunioesTableBody');
    if (!tbody) return;

    if (reunioes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma reunião encontrada.</td></tr>';
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    tbody.innerHTML = reunioes.map(r => {
        const isPast = r.data < today;
        const statusClass = `badge-${r.status}`;
        
        return `
            <tr style="opacity: ${isPast ? 0.6 : 1}">
                <td><strong>${r.leadNome}</strong></td>
                <td>${r.data.split('-').reverse().join('/')} às ${r.hora}</td>
                <td><span class="badge" style="background:var(--bg-hover)">${r.tipo}</span></td>
                <td><span class="badge ${statusClass}">${r.status}</span></td>
                <td title="${r.observacoes || ''}">${(r.observacoes || '—').substring(0, 30)}${(r.observacoes || '').length > 30 ? '...' : ''}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon delete" onclick="window.deleteReuniao('${r.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openReuniaoModal() {
    const modalHtml = `
        <div id="reuniaoModal" class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header">
                    <h2>Agendar Reunião</h2>
                    <button class="btn-close-modal" onclick="document.getElementById('reuniaoModal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="formReuniao">
                    <div class="input-group">
                        <label>Lead</label>
                        <select id="fieldLead" class="form-control" required>
                            <option value="">Selecione o lead...</option>
                            ${allLeads.map(l => `<option value="${l.id}|${l.name}">${l.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="input-group">
                            <label>Data</label>
                            <input type="date" id="fieldData" class="form-control" required>
                        </div>
                        <div class="input-group">
                            <label>Hora</label>
                            <input type="time" id="fieldHora" class="form-control" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Tipo</label>
                        <select id="fieldTipo" class="form-control">
                            <option value="Videochamada">Videochamada</option>
                            <option value="Presencial">Presencial</option>
                            <option value="Telefone">Telefone</option>
                            <option value="WhatsApp">WhatsApp</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Observações</label>
                        <textarea id="fieldObs" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('reuniaoModal').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Agendamento</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('formReuniao').onsubmit = async (e) => {
        e.preventDefault();
        const [leadId, leadNome] = document.getElementById('fieldLead').value.split('|');
        const data = {
            leadId,
            leadNome,
            data: document.getElementById('fieldData').value,
            hora: document.getElementById('fieldHora').value,
            tipo: document.getElementById('fieldTipo').value,
            observacoes: document.getElementById('fieldObs').value,
            status: 'pendente',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('reunioes').add(data);
            await db.collection('leads').doc(leadId).update({ reuniaoAgendada: true, status: 'qualificado' });
            showToast("Reunião agendada com sucesso!", "success");
            document.getElementById('reuniaoModal').remove();
        } catch (e) { handleFirestoreError(e); }
    };
}

window.deleteReuniao = (id) => {
    confirmAction("Deseja cancelar esta reunião?", async () => {
        try {
            await db.collection('reunioes').doc(id).delete();
            showToast("Reunião removida", "success");
        } catch (e) { handleFirestoreError(e); }
    });
};
