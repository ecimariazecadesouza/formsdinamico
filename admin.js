// Configuração da URL do Google Apps Script
// IMPORTANTE: Substitua pela mesma URL usada no formulário
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwn5N68CO8pMmQymocOveZQnHEcu-h0yKB2QVgSHBjwgcvRtS0LGd2HoC7AApNuI_QM/exec";

// Variáveis globais
let todasRespostas = [];
let respostasFiltradas = [];
let paginaAtual = 1;
let itensPorPagina = 25;
let charts = {};

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    inicializarPainel();
    configurarEventListeners();
});

// Inicializar o painel
async function inicializarPainel() {
    try {
        showLoading();
        await carregarDados();
        hideLoading();
        showMain();
    } catch (error) {
        console.error('Erro ao inicializar painel:', error);
        showError('Erro ao carregar o painel administrativo. Verifique sua conexão e tente novamente.');
    }
}

// Configurar event listeners
function configurarEventListeners() {
    // Botões do header
    document.getElementById('refreshBtn').addEventListener('click', () => {
        inicializarPainel();
    });
    
    document.getElementById('exportBtn').addEventListener('click', exportarCSV);
    
    // Filtros
    document.getElementById('filterTurma').addEventListener('change', aplicarFiltros);
    document.getElementById('filterDataInicio').addEventListener('change', aplicarFiltros);
    document.getElementById('filterDataFim').addEventListener('change', aplicarFiltros);
    document.getElementById('filterPergunta').addEventListener('change', aplicarFiltros);
    document.getElementById('clearFiltersBtn').addEventListener('click', limparFiltros);
    
    // Busca e paginação
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    document.getElementById('pageSize').addEventListener('change', function() {
        itensPorPagina = parseInt(this.value);
        paginaAtual = 1;
        renderizarTabela();
    });
}

// Carregar dados do Google Apps Script
async function carregarDados() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getRespostas`);
        if (!response.ok) {
            throw new Error('Erro ao carregar respostas');
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido');
        }
        
        todasRespostas = data.respostas || [];
        respostasFiltradas = [...todasRespostas];
        
        // Atualizar interface
        atualizarEstatisticas();
        configurarFiltros();
        renderizarGraficos();
        renderizarTabela();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        throw error;
    }
}

// Atualizar estatísticas
function atualizarEstatisticas() {
    const total = todasRespostas.length;
    const hoje = new Date().toDateString();
    const respostasHoje = todasRespostas.filter(resposta => {
        const dataResposta = new Date(resposta['Carimbo de Data/Hora']).toDateString();
        return dataResposta === hoje;
    }).length;
    
    // Contar turmas únicas
    const turmas = new Set();
    todasRespostas.forEach(resposta => {
        if (resposta.P1) turmas.add(resposta.P1);
    });
    
    // Calcular média por dia
    const diasComRespostas = new Set();
    todasRespostas.forEach(resposta => {
        const data = new Date(resposta['Carimbo de Data/Hora']).toDateString();
        diasComRespostas.add(data);
    });
    const mediaPorDia = diasComRespostas.size > 0 ? Math.round(total / diasComRespostas.size) : 0;
    
    // Atualizar elementos
    document.getElementById('totalRespostas').textContent = total;
    document.getElementById('respostasHoje').textContent = respostasHoje;
    document.getElementById('totalTurmas').textContent = turmas.size;
    document.getElementById('mediaRespostas').textContent = mediaPorDia;
}

// Configurar opções dos filtros
function configurarFiltros() {
    // Filtro de turmas
    const selectTurma = document.getElementById('filterTurma');
    const turmas = new Set();
    todasRespostas.forEach(resposta => {
        if (resposta.P1) turmas.add(resposta.P1);
    });
    
    selectTurma.innerHTML = '<option value="">Todas as turmas</option>';
    Array.from(turmas).sort().forEach(turma => {
        const option = document.createElement('option');
        option.value = turma;
        option.textContent = turma;
        selectTurma.appendChild(option);
    });
    
    // Filtro de perguntas
    const selectPergunta = document.getElementById('filterPergunta');
    selectPergunta.innerHTML = '<option value="">Todas as perguntas</option>';
    
    if (todasRespostas.length > 0) {
        const colunas = Object.keys(todasRespostas[0]);
        colunas.forEach(coluna => {
            if (coluna !== 'Carimbo de Data/Hora') {
                const option = document.createElement('option');
                option.value = coluna;
                option.textContent = coluna;
                selectPergunta.appendChild(option);
            }
        });
    }
}

// Aplicar filtros
function aplicarFiltros() {
    const filtroTurma = document.getElementById('filterTurma').value;
    const filtroDataInicio = document.getElementById('filterDataInicio').value;
    const filtroDataFim = document.getElementById('filterDataFim').value;
    const filtroPergunta = document.getElementById('filterPergunta').value;
    const termoBusca = document.getElementById('searchInput').value.toLowerCase();
    
    respostasFiltradas = todasRespostas.filter(resposta => {
        // Filtro por turma
        if (filtroTurma && resposta.P1 !== filtroTurma) {
            return false;
        }
        
        // Filtro por data
        const dataResposta = new Date(resposta['Carimbo de Data/Hora']);
        if (filtroDataInicio) {
            const dataInicio = new Date(filtroDataInicio);
            if (dataResposta < dataInicio) return false;
        }
        if (filtroDataFim) {
            const dataFim = new Date(filtroDataFim);
            dataFim.setHours(23, 59, 59, 999); // Incluir o dia inteiro
            if (dataResposta > dataFim) return false;
        }
        
        // Filtro por pergunta específica
        if (filtroPergunta && !resposta[filtroPergunta]) {
            return false;
        }
        
        // Busca textual
        if (termoBusca) {
            const textoResposta = Object.values(resposta).join(' ').toLowerCase();
            if (!textoResposta.includes(termoBusca)) {
                return false;
            }
        }
        
        return true;
    });
    
    paginaAtual = 1;
    renderizarTabela();
    renderizarGraficos();
}

// Limpar filtros
function limparFiltros() {
    document.getElementById('filterTurma').value = '';
    document.getElementById('filterDataInicio').value = '';
    document.getElementById('filterDataFim').value = '';
    document.getElementById('filterPergunta').value = '';
    document.getElementById('searchInput').value = '';
    
    respostasFiltradas = [...todasRespostas];
    paginaAtual = 1;
    renderizarTabela();
    renderizarGraficos();
}

// Renderizar gráficos
function renderizarGraficos() {
    renderizarGraficoTurmas();
    renderizarGraficoTimeline();
}

// Gráfico de distribuição por turma
function renderizarGraficoTurmas() {
    const ctx = document.getElementById('turmasChart').getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (charts.turmas) {
        charts.turmas.destroy();
    }
    
    // Contar respostas por turma
    const contadorTurmas = {};
    respostasFiltradas.forEach(resposta => {
        const turma = resposta.P1 || 'Não informado';
        contadorTurmas[turma] = (contadorTurmas[turma] || 0) + 1;
    });
    
    const labels = Object.keys(contadorTurmas);
    const data = Object.values(contadorTurmas);
    const cores = [
        '#667eea', '#764ba2', '#f093fb', '#f5576c',
        '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
        '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
    ];
    
    charts.turmas = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: cores.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// Gráfico de timeline (respostas por dia)
function renderizarGraficoTimeline() {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (charts.timeline) {
        charts.timeline.destroy();
    }
    
    // Agrupar respostas por dia
    const contadorDias = {};
    respostasFiltradas.forEach(resposta => {
        const data = new Date(resposta['Carimbo de Data/Hora']).toDateString();
        contadorDias[data] = (contadorDias[data] || 0) + 1;
    });
    
    // Ordenar por data
    const diasOrdenados = Object.keys(contadorDias).sort((a, b) => new Date(a) - new Date(b));
    const labels = diasOrdenados.map(dia => {
        const data = new Date(dia);
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const data = diasOrdenados.map(dia => contadorDias[dia]);
    
    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Respostas por Dia',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Renderizar tabela
function renderizarTabela() {
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    // Limpar tabela
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    if (respostasFiltradas.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #666;">Nenhuma resposta encontrada</td></tr>';
        atualizarPaginacao();
        return;
    }
    
    // Criar cabeçalho
    const colunas = Object.keys(respostasFiltradas[0]);
    colunas.forEach(coluna => {
        const th = document.createElement('th');
        th.textContent = coluna;
        th.addEventListener('click', () => ordenarTabela(coluna));
        tableHeader.appendChild(th);
    });
    
    // Calcular itens da página atual
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = respostasFiltradas.slice(inicio, fim);
    
    // Criar linhas
    itensPagina.forEach(resposta => {
        const tr = document.createElement('tr');
        colunas.forEach(coluna => {
            const td = document.createElement('td');
            let valor = resposta[coluna];
            
            // Formatação especial para data/hora
            if (coluna === 'Carimbo de Data/Hora' && valor) {
                valor = new Date(valor).toLocaleString('pt-BR');
            }
            
            td.textContent = valor || '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
    
    atualizarPaginacao();
}

// Ordenar tabela
function ordenarTabela(coluna) {
    respostasFiltradas.sort((a, b) => {
        let valorA = a[coluna] || '';
        let valorB = b[coluna] || '';
        
        // Tratamento especial para datas
        if (coluna === 'Carimbo de Data/Hora') {
            valorA = new Date(valorA);
            valorB = new Date(valorB);
        }
        
        if (valorA < valorB) return -1;
        if (valorA > valorB) return 1;
        return 0;
    });
    
    renderizarTabela();
}

// Atualizar paginação
function atualizarPaginacao() {
    const totalItens = respostasFiltradas.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(inicio + itensPorPagina - 1, totalItens);
    
    // Atualizar informações
    const paginationInfo = document.getElementById('paginationInfo');
    paginationInfo.textContent = `Mostrando ${inicio} a ${fim} de ${totalItens} registros`;
    
    // Criar controles de paginação
    const paginationControls = document.getElementById('paginationControls');
    paginationControls.innerHTML = '';
    
    // Botão anterior
    const btnAnterior = document.createElement('button');
    btnAnterior.className = 'pagination-btn';
    btnAnterior.textContent = 'Anterior';
    btnAnterior.disabled = paginaAtual === 1;
    btnAnterior.addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarTabela();
        }
    });
    paginationControls.appendChild(btnAnterior);
    
    // Números das páginas
    const maxBotoes = 5;
    let inicioRange = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
    let fimRange = Math.min(totalPaginas, inicioRange + maxBotoes - 1);
    
    if (fimRange - inicioRange < maxBotoes - 1) {
        inicioRange = Math.max(1, fimRange - maxBotoes + 1);
    }
    
    for (let i = inicioRange; i <= fimRange; i++) {
        const btnPagina = document.createElement('button');
        btnPagina.className = `pagination-btn ${i === paginaAtual ? 'active' : ''}`;
        btnPagina.textContent = i;
        btnPagina.addEventListener('click', () => {
            paginaAtual = i;
            renderizarTabela();
        });
        paginationControls.appendChild(btnPagina);
    }
    
    // Botão próximo
    const btnProximo = document.createElement('button');
    btnProximo.className = 'pagination-btn';
    btnProximo.textContent = 'Próximo';
    btnProximo.disabled = paginaAtual === totalPaginas;
    btnProximo.addEventListener('click', () => {
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarTabela();
        }
    });
    paginationControls.appendChild(btnProximo);
}

// Exportar dados para CSV
function exportarCSV() {
    if (respostasFiltradas.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }
    
    const colunas = Object.keys(respostasFiltradas[0]);
    let csv = colunas.join(',') + '\n';
    
    respostasFiltradas.forEach(resposta => {
        const linha = colunas.map(coluna => {
            let valor = resposta[coluna] || '';
            // Escapar aspas e adicionar aspas se necessário
            if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"') || valor.includes('\n'))) {
                valor = '"' + valor.replace(/"/g, '""') + '"';
            }
            return valor;
        });
        csv += linha.join(',') + '\n';
    });
    
    // Criar e baixar arquivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `respostas_formulario_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Funções de UI
function showLoading() {
    document.getElementById('loadingContainer').style.display = 'flex';
    document.getElementById('adminMain').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingContainer').style.display = 'none';
}

function showMain() {
    document.getElementById('adminMain').style.display = 'block';
}

function showError(message) {
    hideLoading();
    document.getElementById('adminMain').style.display = 'none';
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'flex';
}

