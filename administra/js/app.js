/**
 * app.js - Motor Principal do Ava Painel (SPA)
 */

import { renderLeadsView } from './views/leads.js';
import { renderReunioesView } from './views/reunioes.js';
import { renderRelatoriosView } from './views/relatorios.js';
import { renderConfiguracoesView } from './views/configuracoes.js';

// ==========================================
// CONFIGURAÇÃO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDL5xzJ7wgTlUf6aVe-Wb83ryHzCzr5Y_g",
  authDomain: "avaassistant-188d7.firebaseapp.com",
  projectId: "avaassistant-188d7",
  storageBucket: "avaassistant-188d7.firebasestorage.app",
  messagingSenderId: "804180515719",
  appId: "1:804180515719:web:7329dede43c1da02ff9122"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db };

const state = {
    user: null,
    currentView: 'leads'
};

// ==========================================
// UI GLOBAL
// ==========================================
export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

export function showLoading(show) {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

export function confirmAction(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmText');
    if (!modal || !text) return;

    text.innerText = message;
    modal.style.display = 'flex';

    document.getElementById('confirmCancel').onclick = () => modal.style.display = 'none';
    document.getElementById('confirmOk').onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
}

export function handleFirestoreError(error) {
    console.error("Firestore Error:", error);
    showToast("Erro na sincronização de dados", "error");
}

// ==========================================
// ROTEAMENTO SPA
// ==========================================
function loadView(viewName) {
    state.currentView = viewName;
    const container = document.getElementById('view-container');
    const titleEl = document.getElementById('currentViewTitle');
    const actions = document.getElementById('viewActions');

    if (!container) return;

    // Limpeza
    actions.innerHTML = '';
    container.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';

    // Update Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Títulos amigáveis
    const titles = {
        leads: 'Gestão de Leads',
        conversas: 'Histórico de Conversas',
        reunioes: 'Agendamentos',
        relatorios: 'Análise de Performance',
        configuracoes: 'Configurações do Sistema'
    };
    if (titleEl) titleEl.innerText = titles[viewName] || 'Painel';

    // Render
    switch(viewName) {
        case 'leads': renderLeadsView(container, actions); break;
        case 'reunioes': renderReunioesView(container, actions); break;
        case 'relatorios': renderRelatoriosView(container, actions); break;
        case 'configuracoes': renderConfiguracoesView(container, actions); break;
        default:
            container.innerHTML = `<div class="empty-state"><h2>Módulo em breve</h2><p>Estamos trabalhando na funcionalidade de ${viewName}.</p></div>`;
    }
}

// Listeners de Navegação
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1) || 'leads';
    loadView(hash);
});

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
        const view = item.getAttribute('data-view');
        window.location.hash = view;
    });
});

// Mobile Sidebar
const mobileBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
if (mobileBtn && sidebar) {
    mobileBtn.style.display = window.innerWidth < 768 ? 'block' : 'none';
    mobileBtn.onclick = () => sidebar.classList.toggle('mobile-open');
}

// Tema
document.getElementById('themeToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('ava_theme', isLight ? 'light' : 'dark');
    showToast(`Modo ${isLight ? 'Claro' : 'Escuro'} ativado`, "info");
});

// ==========================================
// AUTH FLOW
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const appContainer = document.querySelector('.app-container');

function showApp() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function showLogin() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

// Iniciar com app oculto até verificar auth
if (appContainer) appContainer.style.display = 'none';

auth.onAuthStateChanged(async (user) => {
    if (user) {
        showLoading(true);
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().isAdmin === true) {
                state.user = user;
                showApp();
                const hash = window.location.hash.substring(1) || 'leads';
                loadView(hash);
            } else {
                throw new Error("Privilégios insuficientes");
            }
        } catch (err) {
            console.error(err);
            auth.signOut();
            showLogin();
            showToast("Acesso restrito a administradores.", "error");
        } finally {
            showLoading(false);
        }
    } else {
        showLogin();
    }
});

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const pass = document.getElementById('adminPassword').value;
        const btn = document.getElementById('loginBtn');
        const errEl = document.getElementById('loginError');

        btn.disabled = true;
        btn.textContent = 'Autenticando...';
        if (errEl) errEl.style.display = 'none';

        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (error) {
            console.error('Login error:', error);
            if (errEl) {
                errEl.textContent = 'E-mail ou senha incorretos.';
                errEl.style.display = 'block';
            }
            btn.disabled = false;
            btn.textContent = 'Entrar no Painel';
        }
    });
}

// Logout
document.getElementById('btnLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => window.location.reload());
});

// Init Tema
if (localStorage.getItem('ava_theme') === 'light') {
    document.body.classList.add('light-mode');
}
