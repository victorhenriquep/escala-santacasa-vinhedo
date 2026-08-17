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
}

function manipularAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const senha = document.getElementById('auth-senha').value;

    if (modoCadastro) {
        const nome = document.getElementById('auth-nome').value;
        const papel = document.getElementById('auth-papel').value;

        if (!nome) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, preencha o nome completo.' });
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
                Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Conta criada com sucesso na Santa Casa de Vinhedo!' });
            })
            .catch((error) => {
                Swal.fire({ icon: 'error', title: 'Erro ao criar conta', text: error.message });
            });
    } else {
        auth.signInWithEmailAndPassword(email, senha)
            .catch((error) => {
                Swal.fire({ icon: 'error', title: 'Erro ao fazer login', text: error.message });
            });
    }
}

function fazerLogout() {
    auth.signOut();
}

auth.onAuthStateChanged((user) => {
    const secaoAuth = document.getElementById('secao-auth');
    const secaoApp = document.getElementById('secao-app');

    if (user) {
        db.collection('usuarios').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                usuarioAtualDados = doc.data();
                
                document.getElementById('nome-usuario-logado').innerText = usuarioAtualDados.nome;
                document.getElementById('papel-usuario-logado').innerText = usuarioAtualDados.papel === 'admin' ? 'Administrador(a)' : 'Médico(a)';
                
                if (usuarioAtualDados.papel === 'admin') {
                    document.getElementById('painel-admin').classList.remove('hidden');
                } else {
                    document.getElementById('painel-admin').classList.add('hidden');
                }

                secaoAuth.classList.add('hidden');
                secaoApp.classList.remove('hidden');
                
                definirDataMinimaInputs();
                escutarMedicosCadastrados();
                escutarPlantoes();
            }
        });
    } else {
        usuarioAtualDados = null;
        secaoAuth.classList.remove('hidden');
        secaoApp.classList.add('hidden');
    }
});

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

// VALIDAÇÃO DE CONFLITO E LIMITE (Máx 2 Comuns, Máx 1 Emergência no mesmo horário)
function verificaLimiteEConflito(data, horaInicio, horaFim, tipo, ignorarId = null, medico = null) {
    const minInicio = converterParaMinutos(horaInicio);
    let minFim = converterParaMinutos(horaFim);
    if (minFim <= minInicio) minFim += 24 * 60;

    const plantoesSobrepostos = plantoesDaNuvem.filter(plantao => {
        if (ignorarId && plantao.id === ignorarId) return false;
        if (plantao.data !== data) return false;

        const pInicio = converterParaMinutos(plantao.horaInicio);
        let pFim = converterParaMinutos(plantao.horaFim);
        if (pFim <= pInicio) pFim += 24 * 60;

        return (minInicio < pFim && minFim > pInicio);
    });

    if (medico) {
        const mesmoMedico = plantoesSobrepostos.some(p => p.medico === medico);
        if (mesmoMedico) {
            return { conflito: true, motivo: 'Este médico já possui outro plantão agendado neste mesmo horário.' };
        }
    }

    const mesmoTipoCount = plantoesSobrepostos.filter(p => (p.tipo || 'comum') === tipo).length;

    if (tipo === 'emergencia' && mesmoTipoCount >= 1) {
        return { conflito: true, motivo: 'Limite atingido: já existe 1 médico de Emergência escalado para este horário.' };
    }

    if (tipo === 'comum' && mesmoTipoCount >= 2) {
        return { conflito: true, motivo: 'Limite atingido: já existem 2 médicos Comuns escalados para este horário.' };
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
    if (selectNovo) {
        selectNovo.innerHTML = '<option value="">Selecione o(a) médico(a)...</option>';
        if (medicosCadastradosList.length === 0) {
            selectNovo.innerHTML = '<option value="">Nenhum médico cadastrado</option>';
        } else {
            medicosCadastradosList.forEach(medico => {
                const option = document.createElement('option');
                option.value = medico.nome;
                option.textContent = medico.nome;
                selectNovo.appendChild(option);
            });
        }
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
    const dataInput = document.getElementById('nova-data').value;
    const horaInicio = document.getElementById('hora-inicio').value;
    const horaFim = document.getElementById('hora-fim').value;
    const tipoInput = document.getElementById('novo-tipo').value || 'comum';
    const medicoInput = document.getElementById('novo-medico').value;

    if (!dataInput || !horaInicio || !horaFim || !medicoInput) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Preencha todos os campos da escala.' });
        return;
    }

    if (isDataPassado(dataInput, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível cadastrar um plantão em uma data/horário passados.' });
        return;
    }

    const checagem = verificaLimiteEConflito(dataInput, horaInicio, horaFim, tipoInput, null, medicoInput);
    if (checagem.conflito) {
        Swal.fire({ icon: 'error', title: 'Regra de Escala', text: checagem.motivo });
        return;
    }

    const horarioFormatado = `${horaInicio} às ${horaFim}`;

    db.collection('plantoes').add({
        data: dataInput,
        horaInicio: horaInicio,
        horaFim: horaFim,
        horario: horarioFormatado,
        tipo: tipoInput,
        medico: medicoInput,
        solicitadoPor: usuarioAtualDados.nome,
        aprovadoAdmin: true,
        aprovadoMedico: false,
        status: "PENDENTE",
        solicitouRemocao: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        Swal.fire({ icon: 'success', title: 'Escalado!', text: 'Plantão cadastrado com sucesso!' });
        document.getElementById('nova-data').value = '';
        document.getElementById('hora-inicio').value = '';
        document.getElementById('hora-fim').value = '';
        document.getElementById('novo-medico').value = '';
    })
    .catch((error) => {
        Swal.fire({ icon: 'error', title: 'Erro ao cadastrar', text: error.message });
    });
}

function abrirModalEditar(id) {
    const plantao = plantoesDaNuvem.find(p => p.id === id);
    if (!plantao) return;

    plantaoEmEdicaoId = id;
    document.getElementById('edit-data').value = plantao.data || '';
    document.getElementById('edit-tipo').value = plantao.tipo || 'comum';
    
    if (plantao.horaInicio && plantao.horaFim) {
        document.getElementById('edit-hora-inicio').value = plantao.horaInicio;
        document.getElementById('edit-hora-fim').value = plantao.horaFim;
    } else if (plantao.horario && plantao.horario.includes(' às ')) {
        const partes = plantao.horario.split(' às ');
        document.getElementById('edit-hora-inicio').value = partes[0] || '';
        document.getElementById('edit-hora-fim').value = partes[1] || '';
    }

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
    const horaInicio = document.getElementById('edit-hora-inicio').value;
    const horaFim = document.getElementById('edit-hora-fim').value;
    const novoTipo = document.getElementById('edit-tipo').value || 'comum';
    const novoMedico = document.getElementById('edit-medico').value;

    if (!novaData || !horaInicio || !horaFim || !novoMedico) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Por favor, preencha todos os campos.' });
        return;
    }

    if (isDataPassado(novaData, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível alterar um plantão para uma data passada.' });
        return;
    }

    const checagem = verificaLimiteEConflito(novaData, horaInicio, horaFim, novoTipo, plantaoEmEdicaoId, novoMedico);
    if (checagem.conflito) {
        Swal.fire({ icon: 'error', title: 'Regra de Escala', text: checagem.motivo });
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
            Swal.fire({ icon: 'success', title: 'Atualizado', text: 'Alteração salva com sucesso.' });
            fecharModalEditar();
        })
        .catch(err => {
            Swal.fire({ icon: 'error', title: 'Erro ao salvar', text: err.message });
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
        cancelButtonText: 'Cancelar'
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
                Swal.fire('Confirmado!', 'O plantão foi aceito com sucesso.', 'success');
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
        cancelButtonText: 'Cancelar'
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
                Swal.fire('Aprovado!', 'Alteração aprovada com sucesso.', 'success');
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
        cancelButtonText: 'Manter'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).update({
                solicitouRemocao: true,
                remocaoSolicitadaPor: usuarioAtualDados.nome,
                statusRemocao: 'PENDENTE_REMOCAO'
            }).then(() => {
                Swal.fire('Solicitado!', 'Solicitação de remoção registrada.', 'info');
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
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).delete().then(() => {
                Swal.fire('Excluído!', 'Plantão removido com sucesso.', 'success');
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
        cancelButtonText: 'Voltar'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).update({
                solicitouRemocao: false,
                remocaoSolicitadaPor: firebase.firestore.FieldValue.delete(),
                statusRemocao: firebase.firestore.FieldValue.delete()
            }).then(() => {
                Swal.fire('Mantido!', 'Pedido de remoção cancelado.', 'success');
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

// RENDERIZAÇÃO FILTRADA DOS CARDS (APENAS PENDÊNCIAS PARA ADMIN)
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
            // Admin vê EXCLUSIVAMENTE plantões não-confirmados ou com remoção pendente
            return !estaConfirmado;
        }

        // Médicos veem seus próprios plantões
        const eMedicoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const eMedicoAnterior = plantao.medicoAnterior && plantao.medicoAnterior.trim().toLowerCase() === nomeUsuario;
        const eSolicitante = plantao.solicitadoPor && plantao.solicitadoPor.trim().toLowerCase() === nomeUsuario;

        return eMedicoAtual || eMedicoAnterior || eSolicitante;
    });

    contador.innerText = `${plantoesVisiveis.length} pendência(s)`;

    if (plantoesVisiveis.length === 0) {
        const msgVazia = eAdmin ? "Nenhum plantão pendente de aprovação ou remoção." : "Nenhum plantão agendado.";
        conteiner.innerHTML = `<p class="text-gray-500 text-xs col-span-full bg-white p-3 rounded shadow-sm text-center">${msgVazia}</p>`;
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

        let corFundo = 'bg-white';
        let corBorda = 'border-gray-300';
        let badgeStatus = '';
        let botoesAcao = '';
        let infoAdicional = '';

        const tipoPlantao = plantao.tipo === 'emergencia' ? 'EMERGÊNCIA' : 'COMUM';
        const badgeTipoColor = plantao.tipo === 'emergencia' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-blue-100 text-blue-800 border-blue-300';
        const tagTipo = `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${badgeTipoColor}">${tipoPlantao}</span>`;

        const eMeuPlantaoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const euSoliciteiRemocao = plantao.remocaoSolicitadaPor && plantao.remocaoSolicitadaPor.trim().toLowerCase() === nomeUsuario;

        if (remocaoPendente) {
            corFundo = 'bg-red-50';
            corBorda = 'border-red-500';
            badgeStatus = '<span class="bg-red-200 text-red-900 text-[9px] font-bold px-1.5 py-0.5 rounded">⚠️ REMOÇÃO</span>';

            if (euSoliciteiRemocao && !eAdmin) {
                botoesAcao = `<p class="text-[10px] text-red-800 font-semibold mt-1">Remoção solicitada por você.</p>`;
            } else {
                botoesAcao = `
                    <div class="mt-2 flex gap-1 w-full">
                        <button onclick="aprovarRemocaoPlantao('${plantao.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-1 rounded text-[10px] font-bold transition">Aprovar Exclusão</button>
                        <button onclick="rejeitarRemocaoPlantao('${plantao.id}')" class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">Manter</button>
                    </div>
                `;
            }
        } else if (estaConfirmado) {
            corFundo = 'bg-green-50/50';
            corBorda = 'border-green-500';
            badgeStatus = '<span class="bg-green-200 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded">CONFIRMADO</span>';
            
            if (eMeuPlantaoAtual || eAdmin) {
                botoesAcao = `
                    <div class="mt-2 flex gap-1 w-full">
                        <button onclick="abrirModalEditar('${plantao.id}')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1 rounded text-[10px] font-bold transition">
                            ✏️ Repassar/Editar
                        </button>
                        <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">
                            🗑️
                        </button>
                    </div>
                `;
            }
        } else {
            corFundo = 'bg-amber-50/50';
            corBorda = 'border-amber-400';

            if (plantao.medicoAnterior && plantao.medicoAnterior !== plantao.medico) {
                infoAdicional = `<p class="text-[10px] text-purple-700">Repasse: <strong>${plantao.medicoAnterior}</strong> ➔ <strong>${plantao.medico}</strong></p>`;
            }

            if (!apMedico && !apAdmin) {
                if (eMeuPlantaoAtual && !eAdmin) {
                    badgeStatus = '<span class="bg-amber-200 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded">ACEITE PENDENTE</span>';
                    botoesAcao = `
                        <div class="mt-2 flex gap-1 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 rounded text-[10px] font-bold transition">✅ Aceitar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">🗑️</button>
                        </div>
                    `;
                } else if (eAdmin) {
                    badgeStatus = '<span class="bg-purple-200 text-purple-900 text-[9px] font-bold px-1.5 py-0.5 rounded">PENDENTE ADMIN/MÉDICO</span>';
                    botoesAcao = `
                        <div class="mt-2 flex gap-1 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 rounded text-[10px] font-bold transition">✅ Aprovar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">PENDENTE</span>';
                }
            } else if (!apMedico && apAdmin) {
                if (eMeuPlantaoAtual) {
                    badgeStatus = '<span class="bg-amber-200 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded">ACEITE PENDENTE</span>';
                    botoesAcao = `
                        <div class="mt-2 flex gap-1 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 rounded text-[10px] font-bold transition">✅ Aceitar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] font-bold transition">✏️ Repassar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-blue-200 text-blue-900 text-[9px] font-bold px-1.5 py-0.5 rounded">AGUARDANDO MÉDICO</span>';
                }
            } else if (apMedico && !apAdmin) {
                if (eAdmin) {
                    badgeStatus = '<span class="bg-indigo-200 text-indigo-900 text-[9px] font-bold px-1.5 py-0.5 rounded">APROVAÇÃO ADMIN</span>';
                    botoesAcao = `
                        <div class="mt-2 flex gap-1 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 rounded text-[10px] font-bold transition">✅ Aprovar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] font-bold transition">✏️</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badgeStatus = '<span class="bg-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">AGUARDANDO ADMIN</span>';
                }
            }
        }

        const datasInfo = formatarDatasPlantao(plantao.data, plantao.horaInicio, plantao.horaFim);

        const cardHTML = `
            <div class="${corFundo} border-l-4 ${corBorda} p-2.5 rounded-md shadow-sm flex flex-col justify-between w-full border-y border-r border-gray-200">
                <div>
                    <div class="flex justify-between items-center gap-1 mb-1">
                        <span class="text-[10px] font-bold text-gray-600">📅 ${datasInfo.inicio}</span>
                        <div class="flex items-center gap-1">
                            ${tagTipo}
                            ${badgeStatus}
                        </div>
                    </div>
                    ${datasInfo.legendaTermino ? `<p class="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded mb-1 border border-indigo-100">${datasInfo.legendaTermino}</p>` : ''}
                    <p class="text-xs font-extrabold text-gray-800 my-0.5">⏰ ${plantao.horario}</p>
                    <p class="text-xs text-gray-700">👨‍⚕️ <strong>${plantao.medico}</strong></p>
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

    const ano = dataCalendarioView.getFullYear();
    const mes = dataCalendarioView.getMonth();

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    tituloMes.innerText = `${nomesMeses[mes]} / ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
        grid.innerHTML += `<div class="p-1 bg-gray-50 rounded border border-dashed border-gray-100 min-h-[45px]"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mes + 1).padStart(2, '0');
        const dataChave = `${ano}-${mesStr}-${diaStr}`;

        const plantoesNoDia = plantoesDaNuvem.filter(p => p.data === dataChave);
        let htmlPlantoes = '';

        if (plantoesNoDia.length > 0) {
            plantoesNoDia.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

            htmlPlantoes = plantoesNoDia.map(p => {
                const isConfirmado = p.status === 'CONFIRMADO' || (p.aprovadoAdmin && p.aprovadoMedico);
                const isRemocao = p.solicitouRemocao === true;
                const isEmergencia = p.tipo === 'emergencia';

                let corBadge = 'bg-amber-100 text-amber-900 border-amber-300';
                if (isRemocao) {
                    corBadge = 'bg-red-100 text-red-900 border-red-300';
                } else if (isConfirmado) {
                    corBadge = isEmergencia ? 'bg-red-100 text-red-900 border-red-300 font-bold' : 'bg-green-100 text-green-900 border-green-300';
                }

                const nomeFormatado = formatarNomeMedicoCalendario(p.medico);
                const tagTipoAbrav = isEmergencia ? '[E]' : '[C]';

                return `
                    <div class="text-[7px] md:text-[9px] p-0.5 rounded border ${corBadge} flex items-center justify-between leading-tight overflow-hidden pointer-events-none">
                        <span class="truncate">${tagTipoAbrav} ${nomeFormatado}</span>
                    </div>
                `;
            }).join('');
        }

        grid.innerHTML += `
            <button type="button" onclick="verDetalhesDia('${dataChave}')" class="w-full text-left p-1 border border-gray-200 rounded min-h-[45px] md:min-h-[60px] bg-white flex flex-col justify-start gap-0.5 hover:border-indigo-400 active:bg-indigo-100 transition shadow-sm touch-manipulation focus:outline-none select-none">
                <div class="flex justify-between items-center w-full pointer-events-none">
                    <span class="font-bold text-[9px] md:text-xs ${plantoesNoDia.length > 0 ? 'text-indigo-600' : 'text-gray-700'}">${dia}</span>
                    ${plantoesNoDia.length > 0 ? `<span class="text-[7px] bg-indigo-100 text-indigo-700 font-extrabold px-1 rounded-full md:hidden">${plantoesNoDia.length}</span>` : ''}
                </div>
                <div class="flex flex-col gap-0.5 overflow-hidden w-full pointer-events-none">
                    ${htmlPlantoes}
                </div>
            </button>
        `;
    }
}

// MODAL DO CALENDÁRIO COM AÇÕES DE EDITAR/EXCLUIR
function verDetalhesDia(dataChave) {
    const plantoesNoDia = plantoesDaNuvem.filter(p => p.data === dataChave);
    const [ano, mes, dia] = dataChave.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    if (plantoesNoDia.length === 0) {
        Swal.fire({
            title: `📅 ${dataFormatada}`,
            text: 'Nenhum plantão agendado para esta data.',
            icon: 'info',
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#3f62ad'
        });
        return;
    }

    plantoesNoDia.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

    const eAdmin = usuarioAtualDados && usuarioAtualDados.papel === 'admin';
    const nomeUsuario = usuarioAtualDados ? usuarioAtualDados.nome.trim().toLowerCase() : '';

    let htmlConteudo = `<div class="flex flex-col gap-2 text-left max-h-[60vh] overflow-y-auto pr-1 mt-2">`;

    plantoesNoDia.forEach(p => {
        const isConfirmado = p.status === 'CONFIRMADO' || (p.aprovadoAdmin && p.aprovadoMedico);
        const isRemocao = p.solicitouRemocao === true;
        const tipoStr = p.tipo === 'emergencia' ? '🚨 Emergência' : '🩺 Comum';

        let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">PENDENTE</span>';
        if (isRemocao) {
            statusBadge = '<span class="bg-red-100 text-red-800 text-[9px] px-1.5 py-0.5 rounded font-bold">REMOÇÃO</span>';
        } else if (isConfirmado) {
            statusBadge = '<span class="bg-green-100 text-green-800 text-[9px] px-1.5 py-0.5 rounded font-bold">CONFIRMADO</span>';
        }

        const eMeuPlantao = p.medico && p.medico.trim().toLowerCase() === nomeUsuario;

        let botoesModal = '';
        if (eAdmin || eMeuPlantao) {
            botoesModal = `
                <div class="mt-2 pt-2 border-t border-gray-200 flex gap-1 justify-end">
                    <button onclick="Swal.close(); abrirModalEditar('${p.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1">
                        ✏️ Editar / Repassar
                    </button>
                    <button onclick="Swal.close(); ${isRemocao ? `aprovarRemocaoPlantao('${p.id}')` : `solicitarRemocaoPlantao('${p.id}')`}" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1">
                        🗑️ Excluir
                    </button>
                </div>
            `;
        }

        htmlConteudo += `
            <div class="bg-gray-50 border border-gray-200 p-2.5 rounded shadow-sm">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-gray-800 text-xs">👨‍⚕️ ${p.medico}</span>
                    ${statusBadge}
                </div>
                <p class="text-[11px] font-semibold text-indigo-900 mb-1">Tipo: ${tipoStr}</p>
                <p class="text-xs text-gray-700 font-semibold my-0.5">⏰ Horário: <strong>${p.horario}</strong></p>
                ${p.solicitadoPor ? `<p class="text-[9px] text-gray-500">Escalado por: ${p.solicitadoPor}</p>` : ''}
                ${botoesModal}
            </div>
        `;
    });

    htmlConteudo += `</div>`;

    Swal.fire({
        title: `📅 Plantões do Dia ${dataFormatada}`,
        html: htmlConteudo,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#3f62ad',
        customClass: {
            popup: 'rounded-xl',
        }
    });
}