/**
 * views/relatorios.js - Dashboards e Métricas
 */
import { db, handleFirestoreError } from '../app.js';

let allLeads = [];
let charts = {};

export function renderRelatoriosView(container, actions) {
    actions.innerHTML = `
        <button class="btn btn-secondary" id="btnExportCSV">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Exportar CSV
        </button>
    `;

    container.innerHTML = `
        <div class="analytics-grid">
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Taxa de Conversão</h3>
                    <div class="value" id="metricsConversion">0%</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Leads esta semana</h3>
                    <div class="value" id="metricsWeekly">0</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Receita Potencial</h3>
                    <div class="value" id="metricsRevenue">R$ 0</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Total Geral</h3>
                    <div class="value" id="metricsTotal">0</div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-top: 24px;">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Crescimento de Leads (Últimos 7 dias)</h3>
                <div style="position: relative; height: 260px;">
                    <canvas id="chartGrowth"></canvas>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 20px;">Distribuição por Status</h3>
                <div style="position: relative; height: 260px;">
                    <canvas id="chartStatus"></canvas>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top: 24px;">
            <h3 style="margin-bottom: 20px;">Leads por Segmento</h3>
            <div style="position: relative; height: 220px;">
                <canvas id="chartSegments"></canvas>
            </div>
        </div>
    `;

    document.getElementById('btnExportCSV').onclick = exportToCSV;

    loadData();
}

async function loadData() {
    try {
        const snap = await db.collection('leads').get();
        allLeads = snap.docs.map(doc => doc.data());
        updateMetrics();
        renderCharts();
    } catch (e) { handleFirestoreError(e); }
}

function updateMetrics() {
    const total = allLeads.length;
    const converted = allLeads.filter(l => (l.status || '').toLowerCase() === 'convertido').length;
    const qualificados = allLeads.filter(l => (l.status || '').toLowerCase() === 'qualificado').length;
    
    // Taxa de Conversão
    const conversion = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;
    document.getElementById('metricsConversion').innerText = `${conversion}%`;
    
    // Leads na semana
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyCount = allLeads.filter(l => l.timestamp && new Date(l.timestamp) >= oneWeekAgo).length;
    document.getElementById('metricsWeekly').innerText = weeklyCount;

    // Receita Potencial (R$ 2.500 por lead qualificado conforme prompt)
    const revenue = qualificados * 2500;
    document.getElementById('metricsRevenue').innerText = `R$ ${revenue.toLocaleString('pt-BR')}`;
    
    document.getElementById('metricsTotal').innerText = total;
}

function renderCharts() {
    // Cores do Tema
    const isLight = document.body.classList.contains('light-mode');
    const textColor = isLight ? '#1a1a1a' : '#ffffff';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    // 1. Gráfico de Crescimento (Últimos 7 dias)
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        days.push(dateStr);
        counts.push(allLeads.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === d.toDateString()).length);
    }

    if(charts.growth) charts.growth.destroy();
    charts.growth = new Chart(document.getElementById('chartGrowth'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Novos Leads',
                data: counts,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });

    // 2. Gráfico de Status (Donut)
    const statusGroups = {};
    allLeads.forEach(l => {
        const s = (l.status || 'novo').toLowerCase();
        statusGroups[s] = (statusGroups[s] || 0) + 1;
    });

    if(charts.status) charts.status.destroy();
    charts.status = new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusGroups).map(s => s.toUpperCase()),
            datasets: [{
                data: Object.values(statusGroups),
                backgroundColor: ['#3b82f6', '#eab308', '#22c55e', '#ef4444', '#f97316'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'bottom', labels: { color: textColor } }
            }
        }
    });

    // 3. Gráfico de Segmentos (Barras)
    const segmentGroups = {};
    allLeads.forEach(l => {
        const s = l.segment || 'Geral';
        segmentGroups[s] = (segmentGroups[s] || 0) + 1;
    });

    if(charts.segments) charts.segments.destroy();
    charts.segments = new Chart(document.getElementById('chartSegments'), {
        type: 'bar',
        data: {
            labels: Object.keys(segmentGroups),
            datasets: [{
                label: 'Quantidade',
                data: Object.values(segmentGroups),
                backgroundColor: '#f97316'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor } },
                y: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

function exportToCSV() {
    if (allLeads.length === 0) return;

    const headers = ['Nome', 'Empresa', 'WhatsApp', 'Email', 'Segmento', 'Status', 'Data'];
    const rows = allLeads.map(l => [
        l.name || '',
        l.company || '',
        l.whatsapp || '',
        l.email || '',
        l.segment || '',
        l.status || 'novo',
        l.timestamp ? new Date(l.timestamp).toLocaleDateString('pt-BR') : ''
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_ava_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
