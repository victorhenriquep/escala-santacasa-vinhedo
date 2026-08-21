// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD_dQkkgOSdPRUP9RGlsGdb0GDC5Lu0_6M",
  authDomain: "escala-medica-21ecd.firebaseapp.com",
  projectId: "escala-medica-21ecd",
  storageBucket: "escala-medica-21ecd.firebasestorage.app",
  messagingSenderId: "837545747370",
  appId: "1:837545747370:web:efabd1646faa98c76641d3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let modoCadastro = false;
let usuarioAtualDados = null;
let plantoesDaNuvem = [];
let medicosCadastradosList = [];
let plantaoEmEdicaoId = null;

// Controle de Paginação
let paginaAtual = 1;
const plantoesPorPagina = 6;

// Controle de Calendário
let dataCalendarioView = new Date();

function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    
    const elemTitulo = document.getElementById('titulo-auth');
    if (elemTitulo) {
        elemTitulo.innerText = modoCadastro ? 'Criar Conta' : 'Acessar o Sistema';
    }
    document.getElementById('btn-submit-auth').innerText = modoCadastro ? 'Cadastrar' : 'Entrar';
    document.getElementById('texto-alternar').innerText = modoCadastro ? 'Já possui uma conta?' : 'Não tem uma conta?';
    document.getElementById('btn-alternar').innerText = modoCadastro ? 'Faça Login' : 'Cadastre-se';
    
    document.getElementById('campo-nome').classList.toggle('hidden', !modoCadastro);
    document.getElementById('campo-papel').classList.toggle('hidden', !modoCadastro);
    
    const btnEsqueceu = document.getElementById('btn-esqueceu-senha');
    if (btnEsqueceu) {
        btnEsqueceu.classList.toggle('hidden', modoCadastro);
    }
}

// Redefinição de Senha Nativa Gratuita (Firebase Auth)
function esqueciMinhaSenha() {
    const emailInput = document.getElementById('auth-email').value.trim();

    Swal.fire({
        title: '🔑 Redefinição de Senha',
        text: 'Informe seu e-mail cadastrado para receber o link de redefinição de senha:',
        input: 'email',
        inputValue: emailInput,
        inputPlaceholder: 'seu@email.com',
        showCancelButton: true,
        confirmButtonText: 'Enviar Link',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3f62ad',
        cancelButtonColor: '#6b7280',
        customClass: { popup: 'swal2-responsive-popup' },
        inputValidator: (value) => {
            if (!value) {
                return 'Por favor, digite seu e-mail!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const emailParaEnviar = result.value.trim();
            auth.sendPasswordResetEmail(emailParaEnviar)
                .then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'E-mail Enviado!',
                        text: `Um link para redefinição de senha foi enviado para ${emailParaEnviar}. Verifique sua caixa de entrada e spam.`,
                        confirmButtonColor: '#3f62ad',
                        customClass: { popup: 'swal2-responsive-popup' }
                    });
                })
                .catch((error) => {
                    let mensagemErro = 'Não foi possível enviar o e-mail de redefinição.';
                    if (error.code === 'auth/user-not-found') {
                        mensagemErro = 'Não existe usuário cadastrado com este e-mail.';
                    } else if (error.code === 'auth/invalid-email') {
                        mensagemErro = 'O formato do e-mail informado é inválido.';
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro ao Enviar',
                        text: mensagemErro,
                        confirmButtonColor: '#3f62ad',
                        customClass: { popup: 'swal2-responsive-popup' }
                    });
                });
        }
    });
}

function manipularAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const senha = document.getElementById('auth-senha').value;

    if (modoCadastro) {
        const nome = document.getElementById('auth-nome').value;
        const papel = document.getElementById('auth-papel').value;

        if (!nome) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, preencha o nome completo.', customClass: { popup: 'swal2-responsive-popup' } });
            return;
        }

        auth.createUserWithEmailAndPassword(email, senha)
            .then((credenciais) => {
                return db.collection('usuarios').doc(credenciais.user.uid).set({
                    nome: nome,
                    papel: papel,
                    email: email
                });
            })
            .then(() => {
                Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Conta criada com sucesso na Santa Casa de Vinhedo!', customClass: { popup: 'swal2-responsive-popup' } });
            })
            .catch((error) => {
                Swal.fire({ icon: 'error', title: 'Erro ao criar conta', text: error.message, customClass: { popup: 'swal2-responsive-popup' } });
            });
    } else {
        auth.signInWithEmailAndPassword(email, senha)
            .catch((error) => {
                Swal.fire({ icon: 'error', title: 'Erro ao fazer login', text: error.message, customClass: { popup: 'swal2-responsive-popup' } });
            });
    }
}

function fazerLogout() {
    auth.signOut();
}

auth.onAuthStateChanged((user) => {
    const secaoAuth = document.getElementById('secao-auth');
    const secaoApp = document.getElementById('secao-app');
    const infoUsuario = document.getElementById('info-usuario');
    const painelRelatorio = document.getElementById('painel-relatorio-medico');
    const campoSelMedico = document.getElementById('campo-selecionar-medico-relatorio');

    if (user) {
        db.collection('usuarios').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                usuarioAtualDados = doc.data();
                
                document.getElementById('nome-usuario-logado').innerText = usuarioAtualDados.nome;
                document.getElementById('papel-usuario-logado').innerText = usuarioAtualDados.papel === 'admin' ? 'Administrador(a)' : 'Médico(a)';
                
                if (infoUsuario) infoUsuario.classList.remove('hidden');

                if (usuarioAtualDados.papel === 'admin') {
                    document.getElementById('painel-admin').classList.remove('hidden');
                    if (painelRelatorio) painelRelatorio.classList.remove('hidden');
                    if (campoSelMedico) campoSelMedico.classList.remove('hidden');
                } else {
                    document.getElementById('painel-admin').classList.add('hidden');
                    if (painelRelatorio) painelRelatorio.classList.remove('hidden');
                    if (campoSelMedico) campoSelMedico.classList.add('hidden');
                }

                definirMesEAnoAtualRelatorio();
                secaoAuth.classList.add('hidden');
                secaoApp.classList.remove('hidden');
                
                definirDataMinimaInputs();
                escutarMedicosCadastrados();
                escutarPlantoes();
            }
        });
    } else {
        usuarioAtualDados = null;
        if (infoUsuario) infoUsuario.classList.add('hidden');
        if (painelRelatorio) painelRelatorio.classList.add('hidden');
        secaoAuth.classList.remove('hidden');
        secaoApp.classList.add('hidden');
    }
});

function definirMesEAnoAtualRelatorio() {
    const hoje = new Date();
    const mesStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoStr = String(hoje.getFullYear());

    const selectMes = document.getElementById('relatorio-mes');
    const inputAno = document.getElementById('relatorio-ano');

    if (selectMes) selectMes.value = mesStr;
    if (inputAno) inputAno.value = anoStr;
}

function definirDataMinimaInputs() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('nova-data').setAttribute('min', hoje);
    document.getElementById('edit-data').setAttribute('min', hoje);
}

function isDataPassado(dataStr, horaInicioStr) {
    const agora = new Date();
    const [ano, mes, dia] = dataStr.split('-');
    const [hora, min] = horaInicioStr ? horaInicioStr.split(':') : [0, 0];
    const dataPlantao = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), parseInt(hora), parseInt(min));
    return dataPlantao < agora;
}

function converterParaMinutos(horaStr) {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(':');
    return parseInt(h) * 60 + parseInt(m);
}

function verificaLimiteEConflito(data, turno, tipo, ignorarId = null, medico = null) {
    const plantoesNoTurno = plantoesDaNuvem.filter(plantao => {
        if (ignorarId && plantao.id === ignorarId) return false;
        if (plantao.data !== data) return false;

        const pTurno = plantao.turno || (plantao.horaInicio === '07:00' ? 'dia' : 'noite');
        return pTurno === turno;
    });

    if (medico) {
        const mesmoMedico = plantoesNoTurno.some(p => p.medico === medico);
        if (mesmoMedico) {
            return { conflito: true, motivo: 'Este médico já possui um plantão agendado neste mesmo turno.' };
        }
    }

    const mesmoTipoCount = plantoesNoTurno.filter(p => (p.tipo || 'comum') === tipo).length;

    if (tipo === 'emergencia' && mesmoTipoCount >= 1) {
        return { conflito: true, motivo: `Limite atingido: já existe 1 médico de Emergência escalado para o turno da ${turno === 'dia' ? 'Dia' : 'Noite'}.` };
    }

    if (tipo === 'comum' && mesmoTipoCount >= 2) {
        return { conflito: true, motivo: `Limite atingido: já existem 2 médicos Comuns escalados para o turno da ${turno === 'dia' ? 'Dia' : 'Noite'}.` };
    }

    return { conflito: false };
}

function formatarNomeMedicoCalendario(nomeCompleto) {
    if (!nomeCompleto) return 'Médico';
    const palavras = nomeCompleto.trim().split(/\s+/);
    const titulos = ['dr', 'dr.', 'dra', 'dra.', 'drª', 'drº'];

    if (palavras.length > 1 && titulos.includes(palavras[0].toLowerCase())) {
        return `${palavras[0]} ${palavras[1]}`;
    }
    return palavras[0];
}

function escutarMedicosCadastrados() {
    db.collection('usuarios').where('papel', '==', 'medico').onSnapshot((snapshot) => {
        medicosCadastradosList = [];
        snapshot.forEach(doc => {
            medicosCadastradosList.push(doc.data());
        });

        medicosCadastradosList.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
        atualizarSelectsMedicos();
    });
}

function atualizarSelectsMedicos() {
    const selectNovo = document.getElementById('novo-medico');
    const selectRelatorio = document.getElementById('relatorio-medico-select');

    const optionsHTML = medicosCadastradosList.length === 0
        ? '<option value="">Nenhum médico cadastrado</option>'
        : '<option value="">Selecione o(a) médico(a)...</option>' + medicosCadastradosList.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');

    if (selectNovo) selectNovo.innerHTML = optionsHTML;

    if (selectRelatorio) {
        const optionsRelatorio = medicosCadastradosList.length === 0
            ? '<option value="">Nenhum médico cadastrado</option>'
            : '<option value="todos">-- Todos os Médicos --</option>' + medicosCadastradosList.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
        selectRelatorio.innerHTML = optionsRelatorio;
    }
}

function formatarDatasPlantao(dataStr, horaInicio, horaFim) {
    if (!dataStr) return { inicio: '', legendaTermino: '' };
    
    const [ano, mes, dia] = dataStr.split('-');
    const dataInicioFormatada = `${dia}/${mes}/${ano}`;

    const minInicio = converterParaMinutos(horaInicio);
    const minFim = converterParaMinutos(horaFim);

    if (minFim <= minInicio && horaInicio && horaFim) {
        const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        dataObj.setDate(dataObj.getDate() + 1);
        
        const diaFim = String(dataObj.getDate()).padStart(2, '0');
        const mesFim = String(dataObj.getMonth() + 1).padStart(2, '0');

        return {
            inicio: dataInicioFormatada,
            legendaTermino: `➔ Término em ${diaFim}/${mesFim} às ${horaFim}`
        };
    }

    return {
        inicio: dataInicioFormatada,
        legendaTermino: ''
    };
}

function criarPlantao() {
    if (!usuarioAtualDados || usuarioAtualDados.papel !== 'admin') {
        Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Apenas administradores podem criar plantões.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const dataInput = document.getElementById('nova-data').value;
    const turnoInput = document.getElementById('novo-turno').value;
    const tipoInput = document.getElementById('novo-tipo').value || 'comum';
    const medicoInput = document.getElementById('novo-medico').value;

    if (!dataInput || !medicoInput) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Preencha todos os campos da escala.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const horaInicio = turnoInput === 'dia' ? '07:00' : '19:00';
    const horaFim = turnoInput === 'dia' ? '19:00' : '07:00';

    if (isDataPassado(dataInput, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível cadastrar um plantão em uma data/horário passados.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const checagem = verificaLimiteEConflito(dataInput, turnoInput, tipoInput, null, medicoInput);
    if (checagem.conflito) {
        Swal.fire({ icon: 'error', title: 'Regra de Escala', text: checagem.motivo, customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const eAdmin = usuarioAtualDados.papel === 'admin';
    const eProprioMedico = medicoInput.trim().toLowerCase() === usuarioAtualDados.nome.trim().toLowerCase();

    const aprovadoAdmin = eAdmin;
    const aprovadoMedico = eProprioMedico;
    const statusCalculado = (aprovadoAdmin && aprovadoMedico) ? 'CONFIRMADO' : 'PENDENTE';

    const horarioFormatado = `${horaInicio} às ${horaFim}`;

    db.collection('plantoes').add({
        data: dataInput,
        turno: turnoInput,
        horaInicio: horaInicio,
        horaFim: horaFim,
        horario: horarioFormatado,
        tipo: tipoInput,
        medico: medicoInput,
        solicitadoPor: usuarioAtualDados.nome,
        aprovadoAdmin: aprovadoAdmin,
        aprovadoMedico: aprovadoMedico,
        status: statusCalculado,
        solicitouRemocao: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        Swal.fire({ icon: 'success', title: 'Escalado!', text: 'Plantão cadastrado com sucesso!', customClass: { popup: 'swal2-responsive-popup' } });
        document.getElementById('nova-data').value = '';
        document.getElementById('novo-medico').value = '';
    })
    .catch((error) => {
        Swal.fire({ icon: 'error', title: 'Erro ao cadastrar', text: error.message, customClass: { popup: 'swal2-responsive-popup' } });
    });
}

async function escalarSlotVago(dataStr, turno, tipo) {
    if (!usuarioAtualDados || usuarioAtualDados.papel !== 'admin') {
        Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Apenas administradores podem adicionar plantões.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const horaInicio = turno === 'dia' ? '07:00' : '19:00';
    if (isDataPassado(dataStr, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível escalar em uma data/horário passados.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    if (!medicosCadastradosList || medicosCadastradosList.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Nenhum médico cadastrado no sistema.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const optionsHtml = medicosCadastradosList.map(m => {
        return `<option value="${m.nome}">${m.nome}</option>`;
    }).join('');

    const turnoTexto = turno === 'dia' ? 'Dia (07:00 às 19:00)' : 'Noite (19:00 às 07:00)';
    const [ano, mes, dia] = dataStr.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    const { value: medicoSelecionado } = await Swal.fire({
        title: '➕ Escalar Plantão Vago',
        html: `
            <div class="text-left text-xs sm:text-sm space-y-1.5 mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <p><strong>Data:</strong> ${dataFormatada}</p>
                <p><strong>Turno:</strong> ${turnoTexto}</p>
                <p><strong>Tipo:</strong> <span class="uppercase font-bold text-indigo-700">${tipo}</span></p>
            </div>
            <label class="block text-left text-xs sm:text-sm font-bold text-gray-700 mb-1">Selecione o Médico(a):</label>
            <select id="swal-select-medico" class="w-full border border-gray-300 p-2 rounded-md text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-[#3f62ad]">
                ${optionsHtml}
            </select>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar Escala',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3f62ad',
        customClass: { popup: 'swal2-responsive-popup' },
        focusConfirm: false,
        preConfirm: () => {
            const select = document.getElementById('swal-select-medico');
            return select ? select.value : null;
        }
    });

    if (medicoSelecionado) {
        const horaFim = turno === 'dia' ? '19:00' : '07:00';
        const checagem = verificaLimiteEConflito(dataStr, turno, tipo, null, medicoSelecionado);
        if (checagem.conflito) {
            Swal.fire({ icon: 'error', title: 'Regra de Escala', text: checagem.motivo, customClass: { popup: 'swal2-responsive-popup' } });
            return;
        }

        const eAdmin = usuarioAtualDados.papel === 'admin';
        const eProprioMedico = medicoSelecionado.trim().toLowerCase() === usuarioAtualDados.nome.trim().toLowerCase();

        const aprovadoAdmin = eAdmin;
        const aprovadoMedico = eProprioMedico;

        const statusCalculado = (aprovadoAdmin && aprovadoMedico) ? 'CONFIRMADO' : 'PENDENTE';

        db.collection('plantoes').add({
            data: dataStr,
            turno: turno,
            horaInicio: horaInicio,
            horaFim: horaFim,
            horario: `${horaInicio} às ${horaFim}`,
            tipo: tipo,
            medico: medicoSelecionado,
            solicitadoPor: usuarioAtualDados.nome,
            aprovadoAdmin: aprovadoAdmin,
            aprovadoMedico: aprovadoMedico,
            status: statusCalculado,
            solicitouRemocao: false,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            Swal.fire({ icon: 'success', title: 'Escalado!', text: 'Plantão cadastrado com sucesso!', customClass: { popup: 'swal2-responsive-popup' } });
        })
        .catch((err) => {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, customClass: { popup: 'swal2-responsive-popup' } });
        });
    }
}

function abrirModalEditar(id) {
    const plantao = plantoesDaNuvem.find(p => p.id === id);
    if (!plantao) return;

    plantaoEmEdicaoId = id;
    document.getElementById('edit-data').value = plantao.data || '';
    
    const turnoCalculado = plantao.turno || (plantao.horaInicio === '07:00' ? 'dia' : 'noite');
    document.getElementById('edit-turno').value = turnoCalculado;
    document.getElementById('edit-tipo').value = plantao.tipo || 'comum';

    const selectEdit = document.getElementById('edit-medico');
    selectEdit.innerHTML = '<option value="">Selecione o(a) médico(a)...</option>';
    medicosCadastradosList.forEach(m => {
        const option = document.createElement('option');
        option.value = m.nome;
        option.textContent = m.nome;
        if (m.nome === plantao.medico) {
            option.selected = true;
        }
        selectEdit.appendChild(option);
    });

    document.getElementById('modal-editar').classList.remove('hidden');
}

function fecharModalEditar() {
    plantaoEmEdicaoId = null;
    document.getElementById('modal-editar').classList.add('hidden');
}

function salvarEdicaoPlantao(event) {
    event.preventDefault();
    if (!plantaoEmEdicaoId) return;

    const novaData = document.getElementById('edit-data').value;
    const novoTurno = document.getElementById('edit-turno').value;
    const novoTipo = document.getElementById('edit-tipo').value || 'comum';
    const novoMedico = document.getElementById('edit-medico').value;

    if (!novaData || !novoMedico) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Por favor, preencha todos os campos.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const horaInicio = novoTurno === 'dia' ? '07:00' : '19:00';
    const horaFim = novoTurno === 'dia' ? '19:00' : '07:00';

    if (isDataPassado(novaData, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível alterar um plantão para uma data passada.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const checagem = verificaLimiteEConflito(novaData, novoTurno, novoTipo, plantaoEmEdicaoId, novoMedico);
    if (checagem.conflito) {
        Swal.fire({ icon: 'error', title: 'Regra de Escala', text: checagem.motivo, customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const plantaoAntigo = plantoesDaNuvem.find(p => p.id === plantaoEmEdicaoId);
    if (!plantaoAntigo) return;

    const medicoMudou = plantaoAntigo.medico !== novoMedico;
    const eAdmin = usuarioAtualDados.papel === 'admin';

    let aprovadoMedico = false;
    let aprovadoAdmin = false;

    if (eAdmin) {
        aprovadoAdmin = true;
        aprovadoMedico = false;
    } else {
        if (medicoMudou) {
            aprovadoMedico = false;
            aprovadoAdmin = false;
        } else {
            aprovadoMedico = true;
            aprovadoAdmin = false;
        }
    }

    const horarioFormatado = `${horaInicio} às ${horaFim}`;

    const dadosAtualizados = {
        data: novaData,
        turno: novoTurno,
        horaInicio: horaInicio,
        horaFim: horaFim,
        horario: horarioFormatado,
        tipo: novoTipo,
        medico: novoMedico,
        medicoAnterior: plantaoAntigo.medico,
        solicitadoPor: usuarioAtualDados.nome,
        aprovadoMedico: aprovadoMedico,
        aprovadoAdmin: aprovadoAdmin,
        status: (aprovadoMedico && aprovadoAdmin) ? 'CONFIRMADO' : 'PENDENTE',
        solicitouRemocao: false,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('plantoes').doc(plantaoEmEdicaoId).update(dadosAtualizados)
        .then(() => {
            Swal.fire({ icon: 'success', title: 'Atualizado', text: 'Alteração salva com sucesso.', customClass: { popup: 'swal2-responsive-popup' } });
            fecharModalEditar();
        })
        .catch(err => {
            Swal.fire({ icon: 'error', title: 'Erro ao salvar', text: err.message, customClass: { popup: 'swal2-responsive-popup' } });
        });
}

function aceitarPlantaoPeloMedico(id) {
    Swal.fire({
        title: 'Aceitar Plantão?',
        text: 'Você confirmará sua presença neste plantão.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, aceitar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'swal2-responsive-popup' }
    }).then((result) => {
        if (result.isConfirmed) {
            const plantao = plantoesDaNuvem.find(p => p.id === id);
            const apAdmin = plantao.aprovadoAdmin || false;
            const novoStatus = apAdmin ? 'CONFIRMADO' : 'PENDENTE';

            db.collection('plantoes').doc(id).update({
                aprovadoMedico: true,
                status: novoStatus,
                confirmadoPorMedico: usuarioAtualDados.nome
            }).then(() => {
                Swal.fire({ title: 'Confirmado!', text: 'O plantão foi aceito com sucesso.', icon: 'success', customClass: { popup: 'swal2-responsive-popup' } });
            });
        }
    });
}

function aprovarPlantaoPeloAdmin(id) {
    Swal.fire({
        title: 'Aprovar Solicitação?',
        text: 'Você confirmará esta escala no sistema.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, aprovar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'swal2-responsive-popup' }
    }).then((result) => {
        if (result.isConfirmed) {
            const plantao = plantoesDaNuvem.find(p => p.id === id);
            const apMedico = plantao.aprovadoMedico || false;
            const novoStatus = apMedico ? 'CONFIRMADO' : 'PENDENTE';

            db.collection('plantoes').doc(id).update({
                aprovadoAdmin: true,
                status: novoStatus,
                confirmadoPorAdmin: usuarioAtualDados.nome
            }).then(() => {
                Swal.fire({ title: 'Aprovado!', text: 'Alteração aprovada com sucesso.', icon: 'success', customClass: { popup: 'swal2-responsive-popup' } });
            });
        }
    });
}

function solicitarRemocaoPlantao(id) {
    Swal.fire({
        title: 'Solicitar Remoção?',
        text: 'Exigirá a aprovação da outra parte para exclusão.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, remover',
        cancelButtonText: 'Manter',
        customClass: { popup: 'swal2-responsive-popup' }
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).update({
                solicitouRemocao: true,
                remocaoSolicitadaPor: usuarioAtualDados.nome,
                statusRemocao: 'PENDENTE_REMOCAO'
            }).then(() => {
                Swal.fire({ title: 'Solicitado!', text: 'Solicitação de remoção registrada.', icon: 'info', customClass: { popup: 'swal2-responsive-popup' } });
            });
        }
    });
}

function aprovarRemocaoPlantao(id) {
    Swal.fire({
        title: 'Excluir Definitivamente?',
        text: 'O plantão será removido.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Excluir',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'swal2-responsive-popup' }
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).delete().then(() => {
                Swal.fire({ title: 'Excluído!', text: 'Plantão removido com sucesso.', icon: 'success', customClass: { popup: 'swal2-responsive-popup' } });
            });
        }
    });
}

function rejeitarRemocaoPlantao(id) {
    Swal.fire({
        title: 'Manter Plantão?',
        text: 'Cancela o pedido de remoção.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Manter',
        cancelButtonText: 'Voltar',
        customClass: { popup: 'swal2-responsive-popup' }
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).update({
                solicitouRemocao: false,
                remocaoSolicitadaPor: firebase.firestore.FieldValue.delete(),
                statusRemocao: firebase.firestore.FieldValue.delete()
            }).then(() => {
                Swal.fire({ title: 'Mantido!', text: 'Pedido de remoção cancelado.', icon: 'success', customClass: { popup: 'swal2-responsive-popup' } });
            });
        }
    });
}

function escutarPlantoes() {
    db.collection('plantoes').orderBy('data', 'asc').onSnapshot((snapshot) => {
        plantoesDaNuvem = [];
        snapshot.forEach((doc) => {
            plantoesDaNuvem.push({
                id: doc.id,
                ...doc.data()
            });
        });
        renderizarPlantoes();
        renderizarCalendario();
    });
}

function mudarPagina(delta) {
    paginaAtual += delta;
    renderizarPlantoes();
}

function renderizarPlantoes() {
    const conteiner = document.getElementById('lista-plantoes');
    const contador = document.getElementById('contador-plantoes');
    const tituloSecao = document.querySelector('#lista-plantoes')?.parentElement?.querySelector('h3');
    if (!conteiner || !contador) return;

    conteiner.innerHTML = ''; 

    const nomeUsuario = usuarioAtualDados.nome.trim().toLowerCase();
    const eAdmin = usuarioAtualDados.papel === 'admin';

    if (tituloSecao) {
        tituloSecao.innerText = eAdmin ? 'Plantões Pendentes de Atenção' : 'Meus Plantões / Escala';
    }

    let plantoesVisiveis = plantoesDaNuvem.filter(plantao => {
        const apAdmin = plantao.aprovadoAdmin !== undefined ? plantao.aprovadoAdmin : (plantao.status === 'CONFIRMADO');
        const apMedico = plantao.aprovadoMedico !== undefined ? plantao.aprovadoMedico : (plantao.status === 'CONFIRMADO');
        const estaConfirmado = (plantao.status === 'CONFIRMADO' || (apAdmin && apMedico)) && !plantao.solicitouRemocao;

        if (eAdmin) {
            return !estaConfirmado;
        }

        const eMedicoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const eMedicoAnterior = plantao.medicoAnterior && plantao.medicoAnterior.trim().toLowerCase() === nomeUsuario;
        const eSolicitante = plantao.solicitadoPor && plantao.solicitadoPor.trim().toLowerCase() === nomeUsuario;

        return eMedicoAtual || eMedicoAnterior || eSolicitante;
    });

    contador.innerText = `${plantoesVisiveis.length} pendência(s)`;

    if (plantoesVisiveis.length === 0) {
        const msgVazia = eAdmin ? "Nenhum plantão pendente de aprovação ou remoção." : "Nenhum plantão agendado.";
        conteiner.innerHTML = `<p class="text-gray-500 text-xs md:text-sm lg:text-base col-span-full bg-white p-4 rounded-lg shadow-sm text-center">${msgVazia}</p>`;
        document.getElementById('paginacao-container').classList.add('hidden');
        return;
    }

    const totalPaginas = Math.ceil(plantoesVisiveis.length / plantoesPorPagina);
    if (paginaAtual < 1) paginaAtual = 1;
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

    const inicio = (paginaAtual - 1) * plantoesPorPagina;
    const plantoesPagina = plantoesVisiveis.slice(inicio, inicio + plantoesPorPagina);

    document.getElementById('paginacao-container').classList.remove('hidden');
    document.getElementById('info-paginacao').innerText = `Pág. ${paginaAtual} de ${totalPaginas}`;
    document.getElementById('btn-pag-anterior').disabled = (paginaAtual === 1);
    document.getElementById('btn-pag-proxima').disabled = (paginaAtual === totalPaginas);

    plantoesPagina.forEach(plantao => {
        const apAdmin = plantao.aprovadoAdmin !== undefined ? plantao.aprovadoAdmin : (plantao.status === 'CONFIRMADO');
        const apMedico = plantao.aprovadoMedico !== undefined ? plantao.aprovadoMedico : (plantao.status === 'CONFIRMADO');
        const estaConfirmado = plantao.status === 'CONFIRMADO' || (apAdmin && apMedico);
        const remocaoPendente = plantao.solicitouRemocao === true;
        const pTurno = plantao.turno || (plantao.horaInicio === '07:00' ? 'dia' : 'noite');
        const isEmergencia = plantao.tipo === 'emergencia';

        let corFundo = 'bg-white';
        let corBorda = 'border-gray-300';
        let badgeStatus = '';
        let botoesAcao = '';
        let infoAdicional = '';

        const tipoPlantao = isEmergencia ? 'EMERGÊNCIA' : 'COMUM';
        const badgeTipoColor = isEmergencia ? 'bg-red-100 text-red-800 border-red-300' : 'bg-blue-100 text-blue-800 border-blue-300';
        const tagTipo = `<span class="text-[9px] md:text-xs font-extrabold px-2 py-0.5 rounded border ${badgeTipoColor}">${tipoPlantao}</span>`;

        const eMeuPlantaoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const euSoliciteiRemocao = plantao.remocaoSolicitadaPor && plantao.remocaoSolicitadaPor.trim().toLowerCase() === nomeUsuario;

        if (remocaoPendente) {
            corFundo = 'bg-red-50';
            corBorda = 'border-red-500';
            badgeStatus = '<span class="bg-red-200 text-red-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">⚠️ REMOÇÃO</span>';

            if (euSoliciteiRemocao && !eAdmin) {
                botoesAcao = `<p class="text-[10px] md:text-xs text-red-800 font-semibold mt-2">Remoção solicitada por você.</p>`;
            } else {
                botoesAcao = `
                    <div class="mt-3 flex gap-1.5 w-full">
                        <button onclick="aprovarRemocaoPlantao('${plantao.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">Aprovar Exclusão</button>
                        <button onclick="rejeitarRemocaoPlantao('${plantao.id}')" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs md:text-sm font-bold transition">Manter</button>
                    </div>
                `;
            }
        } else if (estaConfirmado) {
            if (isEmergencia) {
                corFundo = 'bg-red-50/60';
                corBorda = 'border-red-500';
                badgeStatus = '<span class="bg-red-200 text-red-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">CONFIRMADO (EMERGÊNCIA)</span>';
            } else if (pTurno === 'dia') {
                corFundo = 'bg-blue-50/60';
                corBorda = 'border-blue-500';
                badgeStatus = '<span class="bg-blue-200 text-blue-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">CONFIRMADO (DIA)</span>';
            } else {
                corFundo = 'bg-green-50/60';
                corBorda = 'border-green-500';
                badgeStatus = '<span class="bg-green-200 text-green-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">CONFIRMADO (NOITE)</span>';
            }
            
            if (eMeuPlantaoAtual || eAdmin) {
                botoesAcao = `
                    <div class="mt-3 flex gap-1.5 w-full">
                        <button onclick="abrirModalEditar('${plantao.id}')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">
                            ✏️ Repassar/Editar
                        </button>
                        <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">
                            🗑️
                        </button>
                    </div>
                `;
            }
        } else {
            corFundo = 'bg-amber-50/50';
            corBorda = 'border-amber-400';

            if (plantao.medicoAnterior && plantao.medicoAnterior !== plantao.medico) {
                infoAdicional = `<p class="text-[10px] md:text-xs text-purple-700 mt-1">Repasse: <strong>${plantao.medicoAnterior}</strong> ➔ <strong>${plantao.medico}</strong></p>`;
            }

            if (!apMedico && !apAdmin) {
                if (eMeuPlantaoAtual && !eAdmin) {
                    badgeStatus = '<span class="bg-amber-200 text-amber-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">ACEITE PENDENTE</span>';
                    botoesAcao = `
                        <div class="mt-3 flex gap-1.5 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">✅ Aceitar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">🗑️</button>
                        </div>
                    `;
                } else if (eAdmin) {
                    badgeStatus = '<span class="bg-purple-200 text-purple-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE ADMIN/MÉDICO</span>';
                    botoesAcao = `
                        <div class="mt-3 flex gap-1.5 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">✅ Aprovar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-amber-200 text-amber-800 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE</span>';
                }
            } else if (!apMedico && apAdmin) {
                if (eMeuPlantaoAtual) {
                    badgeStatus = '<span class="bg-amber-200 text-amber-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">ACEITE PENDENTE</span>';
                    botoesAcao = `
                        <div class="mt-3 flex gap-1.5 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">✅ Aceitar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">✏️ Repassar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-blue-200 text-blue-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">AGUARDANDO MÉDICO</span>';
                }
            } else if (apMedico && !apAdmin) {
                if (eAdmin) {
                    badgeStatus = '<span class="bg-indigo-200 text-indigo-900 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">APROVAÇÃO ADMIN</span>';
                    botoesAcao = `
                        <div class="mt-3 flex gap-1.5 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs md:text-sm font-bold transition">✅ Aprovar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded text-xs md:text-sm font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-amber-200 text-amber-800 text-[9px] md:text-xs font-bold px-2 py-0.5 rounded">AGUARDANDO ADMIN</span>';
                }
            }
        }

        const datasInfo = formatarDatasPlantao(plantao.data, plantao.horaInicio, plantao.horaFim);

        const cardHTML = `
            <div class="${corFundo} border-l-4 ${corBorda} p-3 md:p-4 rounded-lg shadow-sm flex flex-col justify-between w-full border-y border-r border-gray-200">
                <div>
                    <div class="flex justify-between items-center gap-1 mb-1.5 flex-wrap">
                        <span class="text-[10px] md:text-xs font-bold text-gray-600">📅 ${datasInfo.inicio}</span>
                        <div class="flex items-center gap-1">
                            ${tagTipo}
                            ${badgeStatus}
                        </div>
                    </div>
                    ${datasInfo.legendaTermino ? `<p class="text-[9px] md:text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mb-1 border border-indigo-100">${datasInfo.legendaTermino}</p>` : ''}
                    <p class="text-xs md:text-sm font-extrabold text-gray-800 my-1">⏰ ${plantao.horario}</p>
                    <p class="text-xs md:text-sm text-gray-700">👨‍⚕️ <strong>${plantao.medico}</strong></p>
                    ${infoAdicional}
                </div>
                ${botoesAcao}
            </div>
        `;

        conteiner.innerHTML += cardHTML;
    });
}

function mudarMesCalendario(delta) {
    dataCalendarioView.setDate(1);
    dataCalendarioView.setMonth(dataCalendarioView.getMonth() + delta);
    renderizarCalendario();
}

function renderizarCalendario() {
    const grid = document.getElementById('grid-calendario');
    const tituloMes = document.getElementById('titulo-mes-calendario');
    if (!grid || !tituloMes) return;

    grid.innerHTML = '';

    const hojeObj = new Date();
    const ano = dataCalendarioView.getFullYear();
    const mes = dataCalendarioView.getMonth();

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    tituloMes.innerText = `${nomesMeses[mes]} / ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
        grid.innerHTML += `<div class="p-0.5 sm:p-1 bg-gray-50 rounded-md border border-dashed border-gray-200 min-h-[45px] sm:min-h-[60px] md:min-h-[75px] lg:min-h-[90px]"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mes + 1).padStart(2, '0');
        const dataChave = `${ano}-${mesStr}-${diaStr}`;

        const ehHoje = (
            dia === hojeObj.getDate() &&
            mes === hojeObj.getMonth() &&
            ano === hojeObj.getFullYear()
        );

        const plantoesNoDia = plantoesDaNuvem.filter(p => p.data === dataChave);
        let htmlPlantoes = '';

        if (plantoesNoDia.length > 0) {
            plantoesNoDia.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

            htmlPlantoes = plantoesNoDia.map(p => {
                const isConfirmado = p.status === 'CONFIRMADO' || (p.aprovadoAdmin && p.aprovadoMedico);
                const isRemocao = p.solicitouRemocao === true;
                const isEmergencia = p.tipo === 'emergencia';
                const pTurno = p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite');

                let corBadge = 'bg-amber-100 text-amber-900 border-amber-300';
                if (isRemocao) {
                    corBadge = 'bg-purple-100 text-purple-900 border-purple-300';
                } else if (isConfirmado) {
                    if (isEmergencia) {
                        corBadge = 'bg-red-100 text-red-900 border-red-400 font-bold';
                    } else if (pTurno === 'dia') {
                        corBadge = 'bg-blue-100 text-blue-900 border-blue-400 font-bold';
                    } else if (pTurno === 'noite') {
                        corBadge = 'bg-green-100 text-green-900 border-green-400 font-bold';
                    }
                }

                const nomeFormatado = formatarNomeMedicoCalendario(p.medico);
                const tagTipoAbrav = isEmergencia ? '[E]' : '[C]';

                return `
                    <div class="text-[7px] sm:text-[8px] md:text-[10px] lg:text-xs p-0.5 rounded border ${corBadge} flex items-center justify-between leading-tight overflow-hidden pointer-events-none">
                        <span class="truncate">${tagTipoAbrav} ${nomeFormatado}</span>
                    </div>
                `;
            }).join('');
        }

        const estiloBordaBotao = ehHoje 
            ? 'border-2 border-[#3f62ad] bg-blue-50/70 ring-2 ring-[#3f62ad]/20 font-black' 
            : 'border border-gray-200 bg-white';

        grid.innerHTML += `
            <button type="button" onclick="verDetalhesDia('${dataChave}')" class="w-full text-left p-0.5 sm:p-1 md:p-2 ${estiloBordaBotao} rounded-lg min-h-[45px] sm:min-h-[60px] md:min-h-[75px] lg:min-h-[90px] flex flex-col justify-start gap-0.5 sm:gap-1 hover:border-indigo-400 active:bg-indigo-100 transition shadow-sm touch-manipulation focus:outline-none select-none">
                <div class="flex justify-between items-center w-full pointer-events-none">
                    <span class="font-bold text-[9px] sm:text-xs md:text-sm lg:text-base ${ehHoje ? 'text-[#3f62ad] font-black' : (plantoesNoDia.length > 0 ? 'text-indigo-600' : 'text-gray-700')}">
                        ${dia}
                    </span>
                    ${plantoesNoDia.length > 0 ? `<span class="text-[6px] sm:text-[7px] md:text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-1 rounded-full">${plantoesNoDia.length}</span>` : ''}
                </div>
                <div class="flex flex-col gap-0.5 overflow-hidden w-full pointer-events-none">
                    ${htmlPlantoes}
                </div>
            </button>
        `;
    }
}

// RELATÓRIO MENSAL (ACESSÍVEL PARA MÉDICOS E ADMINISTRADORES)
function gerarRelatorioMensalMedico() {
    if (!usuarioAtualDados) return;

    const mes = document.getElementById('relatorio-mes').value;
    const ano = document.getElementById('relatorio-ano').value;
    const resDiv = document.getElementById('resultado-relatorio');

    if (!mes || !ano) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, selecione um mês e informe um ano válido.', customClass: { popup: 'swal2-responsive-popup' } });
        return;
    }

    const prefixoData = `${ano}-${mes}`;
    const eAdmin = usuarioAtualDados.papel === 'admin';
    
    let medicoFiltro = '';
    if (eAdmin) {
        const selectMedico = document.getElementById('relatorio-medico-select');
        medicoFiltro = selectMedico ? selectMedico.value : '';
        if (!medicoFiltro) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, selecione um médico para gerar o relatório.', customClass: { popup: 'swal2-responsive-popup' } });
            return;
        }
    } else {
        medicoFiltro = usuarioAtualDados.nome;
    }

    const plantoesDoMes = plantoesDaNuvem.filter(p => {
        if (!p.data || !p.data.startsWith(prefixoData)) return false;
        
        // Exibir apenas os plantões que já passaram
        const horaInicio = p.horaInicio || (p.turno === 'noite' ? '19:00' : '07:00');
        if (!isDataPassado(p.data, horaInicio)) return false;

        const apAdmin = p.aprovadoAdmin !== undefined ? p.aprovadoAdmin : (p.status === 'CONFIRMADO');
        const apMedico = p.aprovadoMedico !== undefined ? p.aprovadoMedico : (p.status === 'CONFIRMADO');
        const isConfirmado = p.status === 'CONFIRMADO' || (apAdmin && apMedico);

        if (!isConfirmado || p.solicitouRemocao) return false;

        if (medicoFiltro !== 'todos') {
            const eMeuPlantao = p.medico && p.medico.trim().toLowerCase() === medicoFiltro.trim().toLowerCase();
            if (!eMeuPlantao) return false;
        }

        return true;
    });

    plantoesDoMes.sort((a, b) => a.data.localeCompare(b.data));

    const totalPlantoes = plantoesDoMes.length;
    const totalDia = plantoesDoMes.filter(p => (p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite')) === 'dia').length;
    const totalNoite = plantoesDoMes.filter(p => (p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite')) === 'noite').length;
    const totalEmergencia = plantoesDoMes.filter(p => p.tipo === 'emergencia').length;

    const nomeMedicoExibicao = medicoFiltro === 'todos' ? 'Todos os Médicos' : medicoFiltro;

    if (totalPlantoes === 0) {
        resDiv.innerHTML = `<p class="text-gray-500 text-xs md:text-sm italic py-2">Nenhum plantão realizado encontrado para <strong>${nomeMedicoExibicao}</strong> em ${mes}/${ano}.</p>`;
        resDiv.classList.remove('hidden');
        return;
    }

    let tabelaHTML = `
        <div class="mb-3 text-xs md:text-sm font-bold text-gray-700 bg-gray-100 p-2 rounded-md">
            👨‍⚕️ Relatório de: <span class="text-[#3f62ad] font-extrabold">${nomeMedicoExibicao}</span> (${mes}/${ano})
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-4">
            <div class="bg-blue-50 p-2 sm:p-2.5 rounded-lg border border-blue-200 text-center">
                <span class="text-[10px] md:text-xs text-blue-700 font-bold block">Total Realizado</span>
                <span class="text-sm sm:text-base md:text-xl font-extrabold text-blue-900">${totalPlantoes}</span>
            </div>
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg border border-amber-200 text-center">
                <span class="text-[10px] md:text-xs text-amber-700 font-bold block">Turno Dia</span>
                <span class="text-sm sm:text-base md:text-xl font-extrabold text-amber-900">${totalDia}</span>
            </div>
            <div class="bg-slate-100 p-2 sm:p-2.5 rounded-lg border border-slate-300 text-center">
                <span class="text-[10px] md:text-xs text-slate-700 font-bold block">Turno Noite</span>
                <span class="text-sm sm:text-base md:text-xl font-extrabold text-slate-900">${totalNoite}</span>
            </div>
            <div class="bg-red-50 p-2 sm:p-2.5 rounded-lg border border-red-200 text-center">
                <span class="text-[10px] md:text-xs text-red-700 font-bold block">Emergências</span>
                <span class="text-sm sm:text-base md:text-xl font-extrabold text-red-900">${totalEmergencia}</span>
            </div>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                    <tr class="bg-gray-100 text-gray-700 border-b border-gray-200">
                        <th class="p-2">Data</th>
                        ${medicoFiltro === 'todos' ? '<th class="p-2">Médico(a)</th>' : ''}
                        <th class="p-2">Turno</th>
                        <th class="p-2">Horário</th>
                        <th class="p-2">Tipo</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
    `;

    plantoesDoMes.forEach(p => {
        const [a, m, d] = p.data.split('-');
        const dataFmt = `${d}/${m}/${a}`;
        const pTurno = p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite');
        const turnoFmt = pTurno === 'dia' ? '☀️ Dia' : '🌙 Noite';
        const tipoFmt = p.tipo === 'emergencia' ? '🚨 Emergência' : 'Comum';

        tabelaHTML += `
            <tr class="hover:bg-gray-50">
                <td class="p-2 font-bold text-gray-800">${dataFmt}</td>
                ${medicoFiltro === 'todos' ? `<td class="p-2 font-bold text-indigo-800">${p.medico}</td>` : ''}
                <td class="p-2">${turnoFmt}</td>
                <td class="p-2 font-semibold">${p.horario || `${p.horaInicio} às ${p.horaFim}`}</td>
                <td class="p-2">${tipoFmt}</td>
            </tr>
        `;
    });

    tabelaHTML += `
                </tbody>
            </table>
        </div>
    `;

    resDiv.innerHTML = tabelaHTML;
    resDiv.classList.remove('hidden');
}

// MODAL DO CALENDÁRIO COM OS 6 SLOTS FIXOS (OPÇÃO DE APROVAÇÃO DIRETA E ESCALA EXCLUSIVAS PARA ADMIN)
function verDetalhesDia(dataChave) {
    const plantoesNoDia = plantoesDaNuvem.filter(p => p.data === dataChave);
    const [ano, mes, dia] = dataChave.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    const eAdmin = usuarioAtualDados && usuarioAtualDados.papel === 'admin';
    const nomeUsuario = usuarioAtualDados ? usuarioAtualDados.nome.trim().toLowerCase() : '';

    const renderSlot = (titulo, plantao, turno, tipo) => {
        if (!plantao) {
            const botaoEscalar = eAdmin ? `
                <button onclick="Swal.close(); escalarSlotVago('${dataChave}', '${turno}', '${tipo}')" class="bg-indigo-50 hover:bg-indigo-100 text-[#3f62ad] border border-[#3f62ad]/30 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-[11px] sm:text-xs md:text-sm font-bold transition flex items-center gap-1 shadow-sm shrink-0">
                    ➕ Escalar
                </button>
            ` : '';

            return `
                <div class="bg-white/80 border border-dashed border-gray-300 p-2 sm:p-2.5 rounded-lg flex justify-between items-center gap-1 hover:border-indigo-300 transition">
                    <div class="min-w-0 flex-1">
                        <span class="text-[10px] sm:text-xs font-bold text-gray-500 block truncate">${titulo}</span>
                        <span class="text-xs sm:text-sm text-gray-400 italic">-- Vago --</span>
                    </div>
                    ${botaoEscalar}
                </div>
            `;
        }

        const apAdmin = plantao.aprovadoAdmin !== undefined ? plantao.aprovadoAdmin : (plantao.status === 'CONFIRMADO');
        const apMedico = plantao.aprovadoMedico !== undefined ? plantao.aprovadoMedico : (plantao.status === 'CONFIRMADO');
        const isConfirmado = plantao.status === 'CONFIRMADO' || (apAdmin && apMedico);
        const isRemocao = plantao.solicitouRemocao === true;
        const isEmergencia = plantao.tipo === 'emergencia';
        const pTurno = plantao.turno || (plantao.horaInicio === '07:00' ? 'dia' : 'noite');

        let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[8px] sm:text-[9px] md:text-xs px-1.5 py-0.5 rounded font-bold shrink-0">PENDENTE</span>';
        if (isRemocao) {
            statusBadge = '<span class="bg-purple-100 text-purple-800 text-[8px] sm:text-[9px] md:text-xs px-1.5 py-0.5 rounded font-bold shrink-0">REMOÇÃO</span>';
        } else if (isConfirmado) {
            if (isEmergencia) {
                statusBadge = '<span class="bg-red-100 text-red-800 border border-red-300 text-[8px] sm:text-[9px] md:text-xs px-1.5 py-0.5 rounded font-bold shrink-0">EMERGÊNCIA</span>';
            } else if (pTurno === 'dia') {
                statusBadge = '<span class="bg-blue-100 text-blue-800 border border-blue-300 text-[8px] sm:text-[9px] md:text-xs px-1.5 py-0.5 rounded font-bold shrink-0">CONFIRMADO (DIA)</span>';
            } else {
                statusBadge = '<span class="bg-green-100 text-green-800 border border-green-300 text-[8px] sm:text-[9px] md:text-xs px-1.5 py-0.5 rounded font-bold shrink-0">CONFIRMADO (NOITE)</span>';
            }
        }

        const eMeuPlantao = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;

        let botoesModal = '';
        if (eAdmin || eMeuPlantao) {
            let acoesAdminEspeciais = '';
            
            if (eAdmin) {
                if (isRemocao) {
                    acoesAdminEspeciais += `<button onclick="Swal.close(); aprovarRemocaoPlantao('${plantao.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition">✅ Aprovar Exclusão</button>`;
                } else if (!apAdmin) {
                    acoesAdminEspeciais += `<button onclick="Swal.close(); aprovarPlantaoPeloAdmin('${plantao.id}')" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition">✅ Aprovar</button>`;
                }
            } else if (eMeuPlantao && !apMedico && !isRemocao) {
                acoesAdminEspeciais += `<button onclick="Swal.close(); aceitarPlantaoPeloMedico('${plantao.id}')" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition">✅ Aceitar</button>`;
            }

            botoesModal = `
                <div class="mt-2 pt-1.5 border-t border-gray-100 flex flex-wrap gap-1.5 justify-end">
                    ${acoesAdminEspeciais}
                    <button onclick="Swal.close(); abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition">✏️ Editar</button>
                    ${!isRemocao ? `<button onclick="Swal.close(); solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition">🗑️ Excluir</button>` : ''}
                </div>
            `;
        }

        return `
            <div class="bg-white border border-gray-200 p-2 sm:p-2.5 rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-1 gap-1">
                    <span class="text-[10px] sm:text-xs font-bold text-gray-500 truncate">${titulo}</span>
                    ${statusBadge}
                </div>
                <p class="text-xs sm:text-sm font-extrabold text-gray-800 truncate">👨‍⚕️ ${plantao.medico}</p>
                ${botoesModal}
            </div>
        `;
    };

    const diaPlantoes = plantoesNoDia.filter(p => (p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite')) === 'dia');
    const noitePlantoes = plantoesNoDia.filter(p => (p.turno || (p.horaInicio === '07:00' ? 'dia' : 'noite')) === 'noite');

    const comunsDia = diaPlantoes.filter(p => p.tipo !== 'emergencia');
    const emergenciasDia = diaPlantoes.filter(p => p.tipo === 'emergencia');

    const comunsNoite = noitePlantoes.filter(p => p.tipo !== 'emergencia');
    const emergenciasNoite = noitePlantoes.filter(p => p.tipo === 'emergencia');

    let htmlConteudo = `
        <div class="flex flex-col gap-2.5 sm:gap-3.5 text-left max-h-[65vh] overflow-y-auto pr-0.5 mt-1">
            <!-- TURNO DIA -->
            <div class="bg-amber-50/70 border border-amber-200 p-2.5 sm:p-3 md:p-4 rounded-xl">
                <h4 class="font-bold text-xs sm:text-sm text-amber-900 mb-2 flex items-center justify-between">
                    <span>☀️ DIA (07:00 às 19:00)</span>
                    <span class="text-[10px] sm:text-xs font-normal text-amber-700">${diaPlantoes.length}/3 Escala</span>
                </h4>
                <div class="grid grid-cols-1 gap-1.5 sm:gap-2">
                    ${renderSlot('Comum 1', comunsDia[0], 'dia', 'comum')}
                    ${renderSlot('Comum 2', comunsDia[1], 'dia', 'comum')}
                    ${renderSlot('Emergência', emergenciasDia[0], 'dia', 'emergencia')}
                </div>
            </div>

            <!-- TURNO NOITE -->
            <div class="bg-slate-100/80 border border-slate-300 p-2.5 sm:p-3 md:p-4 rounded-xl">
                <h4 class="font-bold text-xs sm:text-sm text-slate-800 mb-2 flex items-center justify-between">
                    <span>🌙 NOITE (19:00 às 07:00)</span>
                    <span class="text-[10px] sm:text-xs font-normal text-slate-600">${noitePlantoes.length}/3 Escala</span>
                </h4>
                <div class="grid grid-cols-1 gap-1.5 sm:gap-2">
                    ${renderSlot('Comum 1', comunsNoite[0], 'noite', 'comum')}
                    ${renderSlot('Comum 2', comunsNoite[1], 'noite', 'comum')}
                    ${renderSlot('Emergência', emergenciasNoite[0], 'noite', 'emergencia')}
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: `📅 Escala de ${dataFormatada}`,
        html: htmlConteudo,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#3f62ad',
        customClass: { popup: 'swal2-responsive-popup' }
    });
}