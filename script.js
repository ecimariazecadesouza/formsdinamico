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
        showError('Erro ao carregar o formulário. Verifique sua conexão e tente novamente.');
    }
}

// Carregar perguntas do Google Apps Script
async function carregarPerguntas() {
    const response = await fetch(`${SCRIPT_URL}?action=getPerguntas`);
    if (!response.ok) {
        throw new Error('Erro ao carregar perguntas');
    }
    const data = await response.json();
    return data.perguntas || [];
}

// Carregar configurações do Google Apps Script
async function carregarConfiguracoes() {
    const response = await fetch(`${SCRIPT_URL}?action=getConfiguracoes`);
    if (!response.ok) {
        throw new Error('Erro ao carregar configurações');
    }
    const data = await response.json();
    return data.configuracoes || [];
}

// Renderizar o formulário dinamicamente
function renderizarFormulario() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
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
    input.className = 'text-input';
    input.placeholder = 'Digite sua resposta...';
    input.required = pergunta.Obrigatoria === 'Sim';
    
    return input;
}

// Criar dropdown
function criarDropdown(pergunta) {
    const select = document.createElement('select');
    select.name = pergunta.ID;
    select.className = 'dropdown-select';
    select.required = pergunta.Obrigatoria === 'Sim';
    
    // Opção padrão
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecione uma opção...';
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
    
    // Obter restrições para a turma selecionada
    const restricoes = configuracoes.filter(config => 
        config.Tipo === 'Restricao' && 
        config.Identificador === turmaSelecionada &&
        config.Status === 'Ativo'
    );
    
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
                const inputs = questionBlock.querySelectorAll('input, select');
                inputs.forEach(input => {
                    if (input.type === 'radio' || input.type === 'checkbox') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
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
        config.Opcao === opcao &&
        config.Status === 'Ativo'
    );
    
    if (limite) {
        return {
            limite: parseInt(limite.Valor),
            esgotado: limite.Valor === '0' || limite.Status === 'Esgotado'
        };
    }
    
    return null;
}

// Enviar formulário
async function enviarFormulario(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Enviando...';
    
    try {
        // Coletar dados do formulário
        const formData = coletarDadosFormulario();
        
        // Enviar para o Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('Erro ao enviar formulário');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess();
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
        
    } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        showError('Erro ao enviar as respostas. Tente novamente.');
        
        // Reabilitar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">send</span> Enviar Respostas';
    }
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
            return;
        }
        
        const inputs = document.querySelectorAll(`[name="${pergunta.ID}"]`);
        
        if (pergunta.Tipo === 'Checkbox') {
            // Para checkboxes, coletar todas as opções selecionadas
            const selecionados = [];
            inputs.forEach(input => {
                if (input.checked) {
                    selecionados.push(input.value);
                }
            });
            formData.respostas[pergunta.ID] = selecionados.join(', ');
        } else if (pergunta.Tipo === 'Radio') {
            // Para radio buttons, pegar o selecionado
            const selecionado = Array.from(inputs).find(input => input.checked);
            formData.respostas[pergunta.ID] = selecionado ? selecionado.value : '';
        } else {
            // Para texto e dropdown
            formData.respostas[pergunta.ID] = inputs[0] ? inputs[0].value : '';
        }
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
}

function showError(message) {
    hideLoading();
    document.getElementById('dynamicForm').style.display = 'none';
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'block';
}

