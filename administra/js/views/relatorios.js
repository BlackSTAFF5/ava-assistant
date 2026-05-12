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
                    <div class="desc">leads convertidos</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Leads esta semana</h3>
                    <div class="value" id="metricsWeekly">0</div>
                    <div class="desc">últimos 7 dias</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Receita Potencial</h3>
                    <div class="value" id="metricsRevenue">R$ 0</div>
                    <div class="desc">leads qualificados × R$2.500</div>
                </div>
            </div>
            <div class="card analytics-card">
                <div class="analytics-info">
                    <h3>Total Geral</h3>
                    <div class="value" id="metricsTotal">0</div>
                    <div class="desc">todos os leads</div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-top: 24px;">
            <div class="card" style="overflow: hidden;">
                <h3 style="margin-bottom: 20px;">Crescimento de Leads (Últimos 7 dias)</h3>
                <div style="position: relative; height: 300px; width: 100%;">
                    <canvas id="chartGrowth"></canvas>
                </div>
            </div>
            <div class="card" style="overflow: hidden;">
                <h3 style="margin-bottom: 20px;">Distribuição por Status</h3>
                <div style="position: relative; height: 300px; width: 100%;">
                    <canvas id="chartStatus"></canvas>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top: 24px; overflow: hidden;">
            <h3 style="margin-bottom: 20px;">Leads por Segmento</h3>
            <div style="position: relative; height: 300px; width: 100%;">
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

    const conversion = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;
    document.getElementById('metricsConversion').innerText = `${conversion}%`;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyCount = allLeads.filter(l => l.timestamp && new Date(l.timestamp) >= oneWeekAgo).length;
    document.getElementById('metricsWeekly').innerText = weeklyCount;

    const revenue = qualificados * 2500;
    document.getElementById('metricsRevenue').innerText = `R$ ${revenue.toLocaleString('pt-BR')}`;

    document.getElementById('metricsTotal').innerText = total;
}

function renderCharts() {
    const isLight = document.body.classList.contains('light-mode');
    const textColor = isLight ? '#1a1a1a' : '#e2e8f0';
    const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

    // Defaults globais do Chart.js
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    // 1. Gráfico de Crescimento
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        counts.push(allLeads.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === d.toDateString()).length);
    }

    if (charts.growth) charts.growth.destroy();
    charts.growth = new Chart(document.getElementById('chartGrowth'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Novos Leads',
                data: counts,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249,115,22,0.12)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });

    // 2. Gráfico de Status
    const statusGroups = {};
    allLeads.forEach(l => {
        const s = (l.status || 'novo').toLowerCase();
        statusGroups[s] = (statusGroups[s] || 0) + 1;
    });

    if (charts.status) charts.status.destroy();
    charts.status = new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusGroups).map(s => s.toUpperCase()),
            datasets: [{
                data: Object.values(statusGroups),
                backgroundColor: ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, padding: 20 } }
            }
        }
    });

    // 3. Gráfico de Segmentos
    const segmentGroups = {};
    allLeads.forEach(l => {
        const s = l.segment || 'Geral';
        segmentGroups[s] = (segmentGroups[s] || 0) + 1;
    });

    if (charts.segments) charts.segments.destroy();
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
                x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                y: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

function exportToCSV() {
    if (allLeads.length === 0) return;
    const headers = ['Nome', 'Empresa', 'WhatsApp', 'Email', 'Segmento', 'Status', 'Data'];
    const rows = allLeads.map(l => [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        l.whatsapp || '',
        l.email || '',
        `"${(l.segment || '').replace(/"/g, '""')}"`,
        l.status || 'novo',
        l.timestamp ? new Date(l.timestamp).toLocaleDateString('pt-BR') : ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `leads_ava_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
