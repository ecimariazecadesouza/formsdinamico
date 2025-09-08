// Configuração da URL do Google Apps Script
// IMPORTANTE: Substitua pela URL do seu Google Apps Script Web App
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzq789ichA-ODURHYaORVZdBV-n2TvS09hOfqtfL8aAK_XC8Lr_nOCB7h22RhAlbhdA/exec";

// Variáveis globais
let perguntas = [];
let configuracoes = [];
let turmaSelecionada = '';

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    carregarFormulario();
});

// Função principal para carregar o formulário
async function carregarFormulario() {
    try {
        showLoading();
        
        // Testar conexão primeiro
        const conexaoOk = await testarConexao();
        if (!conexaoOk) {
            throw new Error('Não foi possível conectar ao servidor. Verifique a URL do script.');
        }
        
        // Carregar perguntas e configurações em paralelo
        const [perguntasData, configuracoesData] = await Promise.all([
            carregarPerguntas(),
            carregarConfiguracoes()
        ]);
        
        perguntas = perguntasData;
        configuracoes = configuracoesData;
        
        // Renderizar o formulário
        renderizarFormulario();
        
        hideLoading();
        showForm();
        
    } catch (error) {
        console.error('Erro ao carregar formulário:', error);
        showError('Erro ao carregar o formulário: ' + error.message);
    }
}

// Testar conexão com o servidor
async function testarConexao() {
    try {
        const response = await fetch(SCRIPT_URL);
        const text = await response.text();
        console.log('Teste de conexão:', response.status, text.substring(0, 100) + '...');
        return response.ok;
    } catch (error) {
        console.error('Erro no teste de conexão:', error);
        return false;
    }
}

// Carregar perguntas do Google Apps Script
async function carregarPerguntas() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getPerguntas`);
        if (!response.ok) {
            throw new Error('Erro ao carregar perguntas: ' + response.status);
        }
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Erro ao carregar perguntas');
        }
        
        return data.perguntas || [];
    } catch (error) {
        console.error('Erro em carregarPerguntas:', error);
        throw error;
    }
}

// Carregar configurações do Google Apps Script
async function carregarConfiguracoes() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getConfiguracoes`);
        if (!response.ok) {
            throw new Error('Erro ao carregar configurações: ' + response.status);
        }
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Erro ao carregar configurações');
        }
        
        return data.configuracoes || [];
    } catch (error) {
        console.error('Erro em carregarConfiguracoes:', error);
        throw error;
    }
}

// Renderizar o formulário dinamicamente
function renderizarFormulario() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    console.log('Renderizando formulário com', perguntas.length, 'perguntas');
    
    perguntas.forEach((pergunta, index) => {
        const questionBlock = criarBlocoPergunta(pergunta, index);
        container.appendChild(questionBlock);
    });
    
    // Adicionar listener para mudanças na turma (primeira pergunta)
    if (perguntas.length > 0 && perguntas[0].Tipo === 'Dropdown') {
        const primeiroSelect = container.querySelector('select');
        if (primeiroSelect) {
            primeiroSelect.addEventListener('change', function() {
                turmaSelecionada = this.value;
                console.log('Turma selecionada:', turmaSelecionada);
                aplicarRestricoesPorTurma();
            });
        }
    }
    
    // Configurar envio do formulário
    const form = document.getElementById('dynamicForm');
    form.addEventListener('submit', enviarFormulario);
}

// Criar bloco de pergunta
function criarBlocoPergunta(pergunta, index) {
    const questionBlock = document.createElement('div');
    questionBlock.className = 'question-block';
    questionBlock.id = `question-${pergunta.ID}`;
    
    const title = document.createElement('div');
    title.className = `question-title ${pergunta.Obrigatoria === 'Sim' ? 'required' : ''}`;
    title.textContent = pergunta['Texto da Pergunta'];
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';
    
    // Criar input baseado no tipo
    switch (pergunta.Tipo) {
        case 'Texto':
            inputContainer.appendChild(criarInputTexto(pergunta));
            break;
        case 'Dropdown':
            inputContainer.appendChild(criarDropdown(pergunta));
            break;
        case 'Radio':
            inputContainer.appendChild(criarRadioGroup(pergunta));
            break;
        case 'Checkbox':
            inputContainer.appendChild(criarCheckboxGroup(pergunta));
            break;
        default:
            console.warn('Tipo de pergunta desconhecido:', pergunta.Tipo);
    }
    
    questionBlock.appendChild(title);
    questionBlock.appendChild(inputContainer);
    
    return questionBlock;
}

// Criar input de texto
function criarInputTexto(pergunta) {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = pergunta.ID;
    input.id = pergunta.ID;
    input.className = 'text-input';
    input.placeholder = 'Digite sua resposta...';
    input.required = pergunta.Obrigatoria === 'Sim';
    
    return input;
}

// Criar dropdown
function criarDropdown(pergunta) {
    const select = document.createElement('select');
    select.name = pergunta.ID;
    select.id = pergunta.ID;
    select.className = 'dropdown-select';
    select.required = pergunta.Obrigatoria === 'Sim';
    
    // Opção padrão
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecione uma opção...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Adicionar opções
    if (pergunta.Opcoes) {
        const opcoes = pergunta.Opcoes.split(',');
        opcoes.forEach(opcao => {
            const option = document.createElement('option');
            option.value = opcao.trim();
            option.textContent = opcao.trim();
            select.appendChild(option);
        });
    }
    
    return select;
}

// Criar grupo de radio buttons
function criarRadioGroup(pergunta) {
    const radioGroup = document.createElement('div');
    radioGroup.className = 'radio-group';
    
    if (pergunta.Opcoes) {
        const opcoes = pergunta.Opcoes.split(',');
        opcoes.forEach((opcao, index) => {
            const opcaoTrim = opcao.trim();
            const radioOption = document.createElement('div');
            radioOption.className = 'radio-option';
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = pergunta.ID;
            input.value = opcaoTrim;
            input.id = `${pergunta.ID}_${index}`;
            input.className = 'radio-input';
            input.required = pergunta.Obrigatoria === 'Sim';
            
            const label = document.createElement('label');
            label.htmlFor = `${pergunta.ID}_${index}`;
            label.className = 'radio-label';
            label.textContent = opcaoTrim;
            
            // Verificar se a opção está esgotada
            const limite = obterLimiteOpcao(pergunta['Texto da Pergunta'], opcaoTrim);
            if (limite && limite.esgotado) {
                input.disabled = true;
                radioOption.classList.add('disabled');
                
                const status = document.createElement('span');
                status.className = 'option-status';
                status.textContent = '(Esgotado)';
                label.appendChild(status);
            }
            
            radioOption.appendChild(input);
            radioOption.appendChild(label);
            radioGroup.appendChild(radioOption);
        });
    }
    
    return radioGroup;
}

// Criar grupo de checkboxes
function criarCheckboxGroup(pergunta) {
    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'checkbox-group';
    
    if (pergunta.Opcoes) {
        const opcoes = pergunta.Opcoes.split(',');
        opcoes.forEach((opcao, index) => {
            const opcaoTrim = opcao.trim();
            const checkboxOption = document.createElement('div');
            checkboxOption.className = 'checkbox-option';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = pergunta.ID;
            input.value = opcaoTrim;
            input.id = `${pergunta.ID}_${index}`;
            input.className = 'checkbox-input';
            
            const label = document.createElement('label');
            label.htmlFor = `${pergunta.ID}_${index}`;
            label.className = 'checkbox-label';
            label.textContent = opcaoTrim;
            
            checkboxOption.appendChild(input);
            checkboxOption.appendChild(label);
            checkboxGroup.appendChild(checkboxOption);
        });
    }
    
    return checkboxGroup;
}

// Aplicar restrições por turma
function aplicarRestricoesPorTurma() {
    if (!turmaSelecionada) return;
    
    console.log('Aplicando restrições para turma:', turmaSelecionada);
    
    // Obter restrições para a turma selecionada
    const restricoes = configuracoes.filter(config => 
        config.Tipo === 'Restricao' && 
        config.Identificador === turmaSelecionada &&
        config.Status === 'Ativo'
    );
    
    console.log('Restrições encontradas:', restricoes.length);
    
    // Mostrar todas as perguntas primeiro
    perguntas.forEach(pergunta => {
        const questionBlock = document.getElementById(`question-${pergunta.ID}`);
        if (questionBlock) {
            questionBlock.classList.remove('hidden');
        }
    });
    
    // Aplicar restrições (ocultar perguntas)
    restricoes.forEach(restricao => {
        const perguntaParaOcultar = perguntas.find(p => p['Texto da Pergunta'] === restricao.Pergunta);
        if (perguntaParaOcultar) {
            const questionBlock = document.getElementById(`question-${perguntaParaOcultar.ID}`);
            if (questionBlock) {
                questionBlock.classList.add('hidden');
                
                // Limpar valores dos campos ocultos
                const inputs = questionBlock.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'radio' || input.type === 'checkbox') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                    input.required = false;
                });
            }
        }
    });
}

// Obter limite de uma opção
function obterLimiteOpcao(pergunta, opcao) {
    const limite = configuracoes.find(config => 
        config.Tipo === 'Limite' && 
        config.Pergunta === pergunta &&
        config.Opcao === opcao
    );
    
    if (limite) {
        return {
            limite: parseInt(limite.Valor),
            esgotado: limite.Status === 'Esgotado'
        };
    }
    
    return null;
}

// Enviar formulário
async function enviarFormulario(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Enviando...';
    
    try {
        // Coletar dados do formulário
        const formData = coletarDadosFormulario();
        console.log('Dados a serem enviados:', formData);
        
        // Validar dados obrigatórios
        const validacao = validarFormulario(formData);
        if (!validacao.valido) {
            throw new Error(validacao.mensagem || 'Por favor, preencha todos os campos obrigatórios.');
        }
        
        // Enviar para o Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        console.log('Resposta do servidor - Status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Resultado do servidor:', result);
        
        if (result.success) {
            showSuccess();
        } else {
            throw new Error(result.error || 'Erro desconhecido ao processar resposta');
        }
        
    } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        showError('Erro ao enviar as respostas: ' + error.message);
        
        // Reabilitar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Validar formulário antes do envio
function validarFormulario(formData) {
    for (const pergunta of perguntas) {
        // Pular perguntas ocultas
        const questionBlock = document.getElementById(`question-${pergunta.ID}`);
        if (questionBlock && questionBlock.classList.contains('hidden')) {
            continue;
        }
        
        // Verificar campos obrigatórios
        if (pergunta.Obrigatoria === 'Sim') {
            const valor = formData.respostas[pergunta.ID];
            if (!valor || valor.toString().trim() === '') {
                return {
                    valido: false,
                    mensagem: `Por favor, preencha o campo: "${pergunta['Texto da Pergunta']}"`
                };
            }
        }
    }
    
    return { valido: true };
}

// Coletar dados do formulário
function coletarDadosFormulario() {
    const formData = {
        timestamp: new Date().toISOString(),
        respostas: {}
    };
    
    perguntas.forEach(pergunta => {
        const questionBlock = document.getElementById(`question-${pergunta.ID}`);
        
        // Pular perguntas ocultas
        if (questionBlock && questionBlock.classList.contains('hidden')) {
            console.log(`Pergunta ${pergunta.ID} oculta, pulando`);
            formData.respostas[pergunta.ID] = '';
            return;
        }
        
        let value = '';
        
        try {
            if (pergunta.Tipo === 'Checkbox') {
                // Para checkboxes, coletar todas as opções selecionadas
                const selecionados = [];
                const checkboxes = document.querySelectorAll(`input[name="${pergunta.ID}"]:checked`);
                checkboxes.forEach(checkbox => {
                    selecionados.push(checkbox.value);
                });
                value = selecionados.join(', ');
                
            } else if (pergunta.Tipo === 'Radio') {
                // Para radio buttons, pegar o selecionado
                const radioSelecionado = document.querySelector(`input[name="${pergunta.ID}"]:checked`);
                value = radioSelecionado ? radioSelecionado.value : '';
                
            } else {
                // Para texto e dropdown
                const input = document.querySelector(`[name="${pergunta.ID}"]`);
                value = input ? input.value : '';
            }
        } catch (error) {
            console.error(`Erro ao coletar dados da pergunta ${pergunta.ID}:`, error);
            value = '';
        }
        
        formData.respostas[pergunta.ID] = value;
        console.log(`Pergunta ${pergunta.ID} (${pergunta['Texto da Pergunta']}):`, value);
    });
    
    return formData;
}

// Funções de UI
function showLoading() {
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('dynamicForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingContainer').style.display = 'none';
}

function showForm() {
    document.getElementById('dynamicForm').style.display = 'block';
}

function showSuccess() {
    document.getElementById('dynamicForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function showError(message) {
    hideLoading();
    document.getElementById('dynamicForm').style.display = 'none';
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

// Função de debug para teste
function debugForm() {
    console.log('=== DEBUG DO FORMULÁRIO ===');
    console.log('Perguntas:', perguntas);
    console.log('Configurações:', configuracoes);
    console.log('Turma selecionada:', turmaSelecionada);
    console.log('Dados coletados:', coletarDadosFormulario());
    
    // Testar conexão
    testarConexao().then(result => {
        console.log('Conexão testada:', result);
    });
    
    // Testar endpoint de perguntas
    fetch(`${SCRIPT_URL}?action=getPerguntas`)
        .then(response => response.json())
        .then(data => console.log('Resposta getPerguntas:', data))
        .catch(error => console.error('Erro getPerguntas:', error));
}

// Adicionar botão de debug se não existir
if (!document.getElementById('debugButton')) {
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debugButton';
    debugBtn.textContent = 'Debug';
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '10px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '1000';
    debugBtn.style.padding = '5px 10px';
    debugBtn.style.background = '#f0f0f0';
    debugBtn.style.border = '1px solid #ccc';
    debugBtn.style.borderRadius = '3px';
    debugBtn.style.cursor = 'pointer';
    debugBtn.onclick = debugForm;
    document.body.appendChild(debugBtn);
}
