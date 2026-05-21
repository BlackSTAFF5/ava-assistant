/**
 * views/configuracoes.js - Preferências e Sistema
 */
import { db, showToast, confirmAction, handleFirestoreError, auth, escapeHTML } from '../app.js';

export function renderConfiguracoesView(container, actions) {
    actions.innerHTML = ''; // Sem ações no header para esta view

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Configurações do Prompt da IA -->
            <div class="card">
                <h3 style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Prompt do Assistente (Ava)
                </h3>
                <div class="input-group">
                    <label>Instruções do Sistema</label>
                    <textarea id="configPrompt" class="form-control" rows="10" placeholder="Carregando prompt..."></textarea>
                    <small style="color:var(--text-secondary); margin-top: 8px;">Este prompt define a personalidade e o comportamento da IA no chat.</small>
                </div>
                <button class="btn btn-primary" id="btnSavePrompt">Salvar Prompt</button>
            </div>

            <!-- Gestão de Administradores -->
            <div class="card">
                <h3 style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                    Gerenciar Administradores
                </h3>
                <div id="adminList" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                    <!-- Carregado via JS -->
                </div>
                <div style="display: flex; gap: 12px;">
                    <input type="email" id="newAdminEmail" class="form-control" placeholder="E-mail do novo admin">
                    <button class="btn btn-secondary" id="btnAddAdmin" style="white-space: nowrap;">Conceder Acesso</button>
                </div>
            </div>

            <!-- Dados da Empresa -->
            <div class="card">
                <h3 style="margin-bottom: 16px;">Geral</h3>
                <div class="input-group">
                    <label>Nome da Empresa</label>
                    <input type="text" id="configCompanyName" class="form-control" placeholder="Ex: Ava Assistant Cloud">
                </div>
                <button class="btn btn-primary" id="btnSaveGeneral">Salvar Alterações</button>
            </div>

        </div>
    `;

    loadConfigs();
    loadAdmins();

    document.getElementById('btnSavePrompt').onclick = savePrompt;
    document.getElementById('btnAddAdmin').onclick = addAdmin;
    document.getElementById('btnSaveGeneral').onclick = saveGeneral;
}

async function loadConfigs() {
    try {
        const promptDoc = await db.collection('configuracoes').doc('promptIA').get();
        if (promptDoc.exists) {
            document.getElementById('configPrompt').value = promptDoc.data().text || '';
        }

        const generalDoc = await db.collection('configuracoes').doc('geral').get();
        if (generalDoc.exists) {
            document.getElementById('configCompanyName').value = generalDoc.data().nomeEmpresa || '';
        }
    } catch (e) { handleFirestoreError(e); }
}

async function savePrompt() {
    const text = document.getElementById('configPrompt').value;
    try {
        await db.collection('configuracoes').doc('promptIA').set({ text, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast("Prompt da IA atualizado com sucesso!", "success");
    } catch (e) { handleFirestoreError(e); }
}

async function saveGeneral() {
    const nomeEmpresa = document.getElementById('configCompanyName').value;
    try {
        await db.collection('configuracoes').doc('geral').set({ nomeEmpresa }, { merge: true });
        showToast("Configurações salvas!", "success");
    } catch (e) { handleFirestoreError(e); }
}

async function loadAdmins() {
    const list = document.getElementById('adminList');
    try {
        const snap = await db.collection('users').where('isAdmin', '==', true).get();
        list.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            const emailEscaped = escapeHTML(data.email || '');
            const isMe = data.email === auth.currentUser.email;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-hover); padding: 12px 16px; border-radius: 8px;">
                    <div>
                        <p style="font-weight: 500;">${emailEscaped}</p>
                        <small style="color: var(--text-secondary)">${isMe ? '(Você)' : 'Administrador'}</small>
                    </div>
                    ${!isMe ? `<button class="btn btn-icon delete" onclick="window.revokeAdmin('${escapeHTML(doc.id)}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg></button>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) { handleFirestoreError(e); }
}

async function addAdmin() {
    const email = document.getElementById('newAdminEmail').value.trim().toLowerCase();
    if (!email) return;

    try {
        // Nota: Em um sistema real, isso exigiria uma Cloud Function para setar isAdmin em um usuário por e-mail.
        // Aqui estamos assumindo que o documento do usuário na coleção 'users' controla isso.
        const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (userSnap.empty) {
            showToast("Usuário não encontrado. Peça para o admin se cadastrar primeiro.", "warning");
            return;
        }
        await db.collection('users').doc(userSnap.docs[0].id).update({ isAdmin: true });
        showToast(`Acesso concedido a ${email}`, "success");
        document.getElementById('newAdminEmail').value = '';
        loadAdmins();
    } catch (e) { handleFirestoreError(e); }
}

window.revokeAdmin = (id) => {
    confirmAction("Deseja revogar o acesso deste administrador?", async () => {
        try {
            await db.collection('users').doc(id).update({ isAdmin: false });
            showToast("Acesso revogado", "success");
            loadAdmins();
        } catch (e) { handleFirestoreError(e); }
    });
};
