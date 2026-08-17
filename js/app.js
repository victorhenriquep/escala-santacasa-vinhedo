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
const plantoesPorPagina = 4;

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

function verificaChoqueHorario(data, horaInicio, horaFim, ignorarId = null, medico = null) {
    const minInicio = converterParaMinutos(horaInicio);
    let minFim = converterParaMinutos(horaFim);
    if (minFim <= minInicio) minFim += 24 * 60;

    return plantoesDaNuvem.some(plantao => {
        if (ignorarId && plantao.id === ignorarId) return false;
        if (plantao.data !== data) return false;
        if (medico && plantao.medico !== medico) return false;

        const pInicio = converterParaMinutos(plantao.horaInicio);
        let pFim = converterParaMinutos(plantao.horaFim);
        if (pFim <= pInicio) pFim += 24 * 60;

        return (minInicio < pFim && minFim > pInicio);
    });
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
            legendaTermino: `➔ Término no dia seguinte: ${diaFim}/${mesFim}/${ano.substring(2)} às ${horaFim}`
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
    const medicoInput = document.getElementById('novo-medico').value;

    if (!dataInput || !horaInicio || !horaFim || !medicoInput) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Preencha a data, horário de início, fim e selecione o médico.' });
        return;
    }

    if (isDataPassado(dataInput, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível cadastrar um plantão em uma data ou horário que já passou.' });
        return;
    }

    if (verificaChoqueHorario(dataInput, horaInicio, horaFim, null, medicoInput)) {
        Swal.fire({ icon: 'error', title: 'Choque de Horários', text: 'Este médico já possui outro plantão agendado para este horário.' });
        return;
    }

    const horarioFormatado = `${horaInicio} às ${horaFim}`;

    db.collection('plantoes').add({
        data: dataInput,
        horaInicio: horaInicio,
        horaFim: horaFim,
        horario: horarioFormatado,
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
    const novoMedico = document.getElementById('edit-medico').value;

    if (!novaData || !horaInicio || !horaFim || !novoMedico) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Por favor, preencha todos os campos.' });
        return;
    }

    if (isDataPassado(novaData, horaInicio)) {
        Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível alterar um plantão para uma data ou horário que já passou.' });
        return;
    }

    if (verificaChoqueHorario(novaData, horaInicio, horaFim, plantaoEmEdicaoId, novoMedico)) {
        Swal.fire({ icon: 'error', title: 'Choque de Horários', text: 'Este médico já possui outro plantão agendado neste horário.' });
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
            Swal.fire({ icon: 'success', title: 'Solicitação Enviada', text: 'A alteração foi gravada com sucesso.' });
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
        text: 'Você confirmará esta escala ou alteração no sistema.',
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
        text: 'A exclusão do plantão exigirá a aprovação da outra parte.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, solicitar remoção',
        cancelButtonText: 'Manter Plantão'
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
        title: 'Confirmar Exclusão Definitiva?',
        text: 'O plantão será permanentemente excluído.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir definitivamente',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).delete().then(() => {
                Swal.fire('Excluído!', 'O plantão foi removido com sucesso.', 'success');
            });
        }
    });
}

function rejeitarRemocaoPlantao(id) {
    Swal.fire({
        title: 'Manter Plantão?',
        text: 'A solicitação de remoção será rejeitada e o plantão continuará ativo.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, manter plantão',
        cancelButtonText: 'Voltar'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('plantoes').doc(id).update({
                solicitouRemocao: false,
                remocaoSolicitadaPor: firebase.firestore.FieldValue.delete(),
                statusRemocao: firebase.firestore.FieldValue.delete()
            }).then(() => {
                Swal.fire('Mantido!', 'A solicitação de remoção foi cancelada.', 'success');
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
    if (!conteiner || !contador) return;

    conteiner.innerHTML = ''; 

    const nomeUsuario = usuarioAtualDados.nome.trim().toLowerCase();
    const eAdmin = usuarioAtualDados.papel === 'admin';

    let plantoesVisiveis = plantoesDaNuvem.filter(plantao => {
        if (eAdmin) return true;
        const eMedicoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const eMedicoAnterior = plantao.medicoAnterior && plantao.medicoAnterior.trim().toLowerCase() === nomeUsuario;
        const eSolicitante = plantao.solicitadoPor && plantao.solicitadoPor.trim().toLowerCase() === nomeUsuario;

        return eMedicoAtual || eMedicoAnterior || eSolicitante;
    });

    contador.innerText = `${plantoesVisiveis.length} plantão(ões)`;

    if (plantoesVisiveis.length === 0) {
        conteiner.innerHTML = `<p class="text-gray-500 text-sm col-span-1 md:col-span-2 bg-white p-4 rounded-lg shadow-sm text-center">Nenhum plantão agendado para exibição.</p>`;
        document.getElementById('paginacao-container').classList.add('hidden');
        return;
    }

    const totalPaginas = Math.ceil(plantoesVisiveis.length / plantoesPorPagina);
    if (paginaAtual < 1) paginaAtual = 1;
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

    const inicio = (paginaAtual - 1) * plantoesPorPagina;
    const plantoesPagina = plantoesVisiveis.slice(inicio, inicio + plantoesPorPagina);

    document.getElementById('paginacao-container').classList.remove('hidden');
    document.getElementById('info-paginacao').innerText = `Página ${paginaAtual} de ${totalPaginas}`;
    document.getElementById('btn-pag-anterior').disabled = (paginaAtual === 1);
    document.getElementById('btn-pag-proxima').disabled = (paginaAtual === totalPaginas);

    plantoesPagina.forEach(plantao => {
        const apAdmin = plantao.aprovadoAdmin !== undefined ? plantao.aprovadoAdmin : (plantao.status === 'CONFIRMADO');
        const apMedico = plantao.aprovadoMedico !== undefined ? plantao.aprovadoMedico : (plantao.status === 'CONFIRMADO');
        const estaConfirmado = plantao.status === 'CONFIRMADO' || (apAdmin && apMedico);
        const remocaoPendente = plantao.solicitouRemocao === true;

        let corFundo = 'bg-white';
        let corBorda = 'border-gray-300';
        let badge = '';
        let botoesAcao = '';
        let infoAdicional = '';

        const eMeuPlantaoAtual = plantao.medico && plantao.medico.trim().toLowerCase() === nomeUsuario;
        const euSoliciteiRemocao = plantao.remocaoSolicitadaPor && plantao.remocaoSolicitadaPor.trim().toLowerCase() === nomeUsuario;

        if (remocaoPendente) {
            corFundo = 'bg-red-50';
            corBorda = 'border-red-500';
            badge = '<span class="bg-red-200 text-red-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">⚠️ REMOÇÃO SOLICITADA</span>';

            if (euSoliciteiRemocao) {
                botoesAcao = `
                    <div class="mt-3 p-2 bg-red-100 rounded text-xs text-red-800 font-semibold text-center w-full">
                        Você solicitou a exclusão. Aguardando a outra parte.
                    </div>
                `;
            } else {
                botoesAcao = `
                    <div class="mt-3 w-full">
                        <p class="text-xs font-semibold text-red-700 mb-2"><strong>${plantao.remocaoSolicitadaPor}</strong> solicitou a remoção.</p>
                        <div class="flex flex-col sm:flex-row gap-2 w-full">
                            <button onclick="aprovarRemocaoPlantao('${plantao.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">🗑️ Aprovar Exclusão</button>
                            <button onclick="rejeitarRemocaoPlantao('${plantao.id}')" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">Manter Plantão</button>
                        </div>
                    </div>
                `;
            }
        } else if (estaConfirmado) {
            corFundo = 'bg-green-50';
            corBorda = 'border-green-500';
            badge = '<span class="bg-green-200 text-green-800 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">CONFIRMADO</span>';
            
            if (eMeuPlantaoAtual || eAdmin) {
                botoesAcao = `
                    <div class="mt-3 flex flex-col sm:flex-row gap-2 w-full">
                        <button onclick="abrirModalEditar('${plantao.id}')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1">
                            ✏️ Alterar / Repassar
                        </button>
                        <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1">
                            🗑️ Solicitar Remoção
                        </button>
                    </div>
                `;
            }
        } else {
            corFundo = 'bg-yellow-50';
            corBorda = 'border-yellow-400';

            if (plantao.medicoAnterior && plantao.medicoAnterior !== plantao.medico) {
                infoAdicional = `<p class="text-xs text-purple-700 mt-1">🔄 Repasse: <strong>${plantao.medicoAnterior}</strong> ➔ <strong>${plantao.medico}</strong></p>`;
            }

            if (!apMedico && !apAdmin) {
                if (eMeuPlantaoAtual) {
                    badge = '<span class="bg-amber-200 text-amber-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE SEU ACEITE</span>';
                    botoesAcao = `
                        <div class="mt-3 flex flex-col sm:flex-row gap-2 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✅ Aceitar</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✏️ Repassar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">🗑️</button>
                        </div>
                    `;
                } else if (eAdmin) {
                    badge = '<span class="bg-purple-200 text-purple-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE ADMIN E MÉDICO</span>';
                    botoesAcao = `
                        <div class="mt-3 flex flex-col sm:flex-row gap-2 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✅ Aprovar (Admin)</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✏️ Editar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">🗑️</button>
                        </div>
                    `;
                } else {
                    badge = '<span class="bg-yellow-200 text-yellow-800 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">AGUARDANDO APROVAÇÕES</span>';
                    botoesAcao = `<p class="text-xs text-yellow-700 mt-3">Aguardando aceite do médico e aprovação do Administrador.</p>`;
                }
            } else if (!apMedico && apAdmin) {
                if (eMeuPlantaoAtual) {
                    badge = '<span class="bg-amber-200 text-amber-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE SEU ACEITE</span>';
                    botoesAcao = `
                        <div class="mt-3 flex flex-col sm:flex-row gap-2 w-full">
                            <button onclick="aceitarPlantaoPeloMedico('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✅ Aceitar Plantão</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✏️ Repassar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">🗑️</button>
                        </div>
                    `;
                } else if (eAdmin) {
                    badge = '<span class="bg-blue-200 text-blue-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">AGUARDANDO ACEITE DO MÉDICO</span>';
                    botoesAcao = `
                        <div class="mt-3 flex justify-between items-center w-full gap-2">
                            <span class="text-xs text-blue-800">Aprovado por você. Aguardando ${plantao.medico}.</span>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap">Solicitar Remoção</button>
                        </div>
                    `;
                } else {
                    badge = '<span class="bg-yellow-200 text-yellow-800 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">EM ANDAMENTO</span>';
                }
            } else if (apMedico && !apAdmin) {
                if (eAdmin) {
                    badge = '<span class="bg-indigo-200 text-indigo-900 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">PENDENTE SUA APROVAÇÃO</span>';
                    botoesAcao = `
                        <div class="mt-3 flex flex-col sm:flex-row gap-2 w-full">
                            <button onclick="aprovarPlantaoPeloAdmin('${plantao.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✅ Aprovar Alteração</button>
                            <button onclick="abrirModalEditar('${plantao.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">✏️ Editar</button>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">🗑️</button>
                        </div>
                    `;
                } else if (eMeuPlantaoAtual || (plantao.solicitadoPor && plantao.solicitadoPor.trim().toLowerCase() === nomeUsuario)) {
                    badge = '<span class="bg-yellow-200 text-yellow-800 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">AGUARDANDO ADMIN</span>';
                    botoesAcao = `
                        <div class="mt-3 flex justify-between items-center w-full gap-2">
                            <p class="text-xs text-yellow-700">Aguardando aprovação do Administrador.</p>
                            <button onclick="solicitarRemocaoPlantao('${plantao.id}')" class="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap">Solicitar Remoção</button>
                        </div>
                    `;
                } else {
                    badge = '<span class="bg-yellow-200 text-yellow-800 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded">EM ANDAMENTO</span>';
                }
            }
        }

        const datasInfo = formatarDatasPlantao(plantao.data, plantao.horaInicio, plantao.horaFim);

        const cardHTML = `
            <div class="${corFundo} border-l-4 ${corBorda} p-3 md:p-4 rounded-lg shadow-sm flex flex-col justify-between w-full">
                <div>
                    <div class="flex justify-between items-start gap-2 mb-1">
                        <p class="text-xs text-gray-600 font-bold uppercase tracking-wider">📅 Início: ${datasInfo.inicio}</p>
                        ${badge}
                    </div>
                    ${datasInfo.legendaTermino ? `<p class="text-xs font-bold text-indigo-700 bg-indigo-50 p-1.5 rounded mb-2 border border-indigo-200">${datasInfo.legendaTermino}</p>` : ''}
                    <p class="text-base md:text-lg font-bold text-gray-800 my-1">⏰ ${plantao.horario}</p>
                    <p class="text-xs md:text-sm font-medium text-gray-700">👨‍⚕️ Responsável: <strong>${plantao.medico}</strong></p>
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

    // Espaços vazios do início do mês
    for (let i = 0; i < primeiroDiaSemana; i++) {
        grid.innerHTML += `<div class="p-1 bg-gray-50 rounded border border-dashed border-gray-100 min-h-[50px] md:min-h-[75px]"></div>`;
    }

    // Renderização dos dias da grade
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

                let corBadge = 'bg-amber-100 text-amber-900 border-amber-300';
                if (isRemocao) {
                    corBadge = 'bg-red-100 text-red-900 border-red-300';
                } else if (isConfirmado) {
                    corBadge = 'bg-green-100 text-green-900 border-green-300';
                }

                const nomeFormatado = formatarNomeMedicoCalendario(p.medico);
                const horaInicioCurta = p.horaInicio ? p.horaInicio.substring(0, 5) : '';

                return `
                    <div class="text-[8px] md:text-[10px] p-0.5 rounded border ${corBadge} font-semibold flex items-center justify-between leading-tight overflow-hidden pointer-events-none">
                        <span class="truncate">${nomeFormatado}</span>
                        <span class="text-[7px] md:text-[8px] opacity-80 font-mono hidden md:inline ml-1">${horaInicioCurta}</span>
                    </div>
                `;
            }).join('');
        }

        grid.innerHTML += `
            <button type="button" onclick="verDetalhesDia('${dataChave}')" class="w-full text-left p-1 border border-gray-200 rounded min-h-[50px] md:min-h-[75px] bg-white flex flex-col justify-start gap-0.5 cursor-pointer hover:border-indigo-400 active:bg-indigo-100 transition shadow-sm touch-manipulation focus:outline-none select-none">
                <div class="flex justify-between items-center w-full pointer-events-none">
                    <span class="font-bold text-[10px] md:text-xs ${plantoesNoDia.length > 0 ? 'text-indigo-600' : 'text-gray-700'}">${dia}</span>
                    ${plantoesNoDia.length > 0 ? `<span class="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1 rounded-full md:hidden">${plantoesNoDia.length}</span>` : ''}
                </div>
                <div class="flex flex-col gap-0.5 overflow-hidden w-full pointer-events-none">
                    ${htmlPlantoes}
                </div>
            </button>
        `;
    }
}

// JANELA FLUTUANTE DE DETALHES DO DIA (OTIMIZADO PARA CELULAR)
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
            confirmButtonColor: '#4f46e5'
        });
        return;
    }

    plantoesNoDia.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

    let htmlConteudo = `<div class="flex flex-col gap-2 text-left max-h-[60vh] overflow-y-auto pr-1 mt-2">`;

    plantoesNoDia.forEach(p => {
        const isConfirmado = p.status === 'CONFIRMADO' || (p.aprovadoAdmin && p.aprovadoMedico);
        const isRemocao = p.solicitouRemocao === true;

        let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">PENDENTE</span>';
        if (isRemocao) {
            statusBadge = '<span class="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-bold">REMOÇÃO</span>';
        } else if (isConfirmado) {
            statusBadge = '<span class="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold">CONFIRMADO</span>';
        }

        htmlConteudo += `
            <div class="bg-gray-50 border border-gray-200 p-3 rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-gray-800 text-sm">👨‍⚕️ ${p.medico}</span>
                    ${statusBadge}
                </div>
                <p class="text-xs text-gray-700 font-semibold my-1">⏰ Horário: <strong>${p.horario}</strong></p>
                ${p.solicitadoPor ? `<p class="text-[10px] text-gray-500">Escalado por: ${p.solicitadoPor}</p>` : ''}
            </div>
        `;
    });

    htmlConteudo += `</div>`;

    Swal.fire({
        title: `📅 Plantões do Dia ${dataFormatada}`,
        html: htmlConteudo,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#4f46e5',
        customClass: {
            popup: 'rounded-xl',
        }
    });
}