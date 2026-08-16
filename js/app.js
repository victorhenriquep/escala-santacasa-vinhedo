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

// Alternar entre Login e Cadastro
function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    
    document.getElementById('titulo-auth').innerText = modoCadastro ? 'Criar Conta' : 'Acessar o Sistema';
    document.getElementById('btn-submit-auth').innerText = modoCadastro ? 'Cadastrar' : 'Entrar';
    document.getElementById('texto-alternar').innerText = modoCadastro ? 'Já possui uma conta?' : 'Não tem uma conta?';
    document.getElementById('btn-alternar').innerText = modoCadastro ? 'Faça Login' : 'Cadastre-se';
    
    document.getElementById('campo-nome').classList.toggle('hidden', !modoCadastro);
    document.getElementById('campo-papel').classList.toggle('hidden', !modoCadastro);
}

// Autenticação (Login / Cadastro)
function manipularAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const senha = document.getElementById('auth-senha').value;

    if (modoCadastro) {
        const nome = document.getElementById('auth-nome').value;
        const papel = document.getElementById('auth-papel').value;

        if (!nome) {
            alert("Por favor, preencha o nome completo.");
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
                alert("Conta criada com sucesso na Santa Casa de Vinhedo!");
            })
            .catch((error) => {
                alert("Erro ao criar conta: " + error.message);
            });
    } else {
        auth.signInWithEmailAndPassword(email, senha)
            .catch((error) => {
                alert("Erro ao fazer login: " + error.message);
            });
    }
}

function fazerLogout() {
    auth.signOut();
}

// Escuta o estado da autenticação
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
                    escutarMedicosCadastrados();
                } else {
                    document.getElementById('painel-admin').classList.add('hidden');
                }

                secaoAuth.classList.add('hidden');
                secaoApp.classList.remove('hidden');
                
                escutarPlantoes();
            }
        });
    } else {
        usuarioAtualDados = null;
        secaoAuth.classList.remove('hidden');
        secaoApp.classList.add('hidden');
    }
});

// Lista os médicos em ordem alfabética para o administrador
function escutarMedicosCadastrados() {
    db.collection('usuarios').where('papel', '==', 'medico').onSnapshot((snapshot) => {
        const selectMedico = document.getElementById('novo-medico');
        selectMedico.innerHTML = '<option value="">Selecione o(a) médico(a)...</option>';
        
        const medicos = [];
        snapshot.forEach(doc => {
            medicos.push(doc.data());
        });

        medicos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

        if (medicos.length === 0) {
            selectMedico.innerHTML = '<option value="">Nenhum médico cadastrado</option>';
            return;
        }

        medicos.forEach(medico => {
            const option = document.createElement('option');
            option.value = medico.nome;
            option.textContent = medico.nome;
            selectMedico.appendChild(option);
        });
    });
}

// Criação do plantão com horários customizáveis de início e fim
function criarPlantao() {
    const dataInput = document.getElementById('nova-data').value;
    const horaInicio = document.getElementById('hora-inicio').value;
    const horaFim = document.getElementById('hora-fim').value;
    const medicoInput = document.getElementById('novo-medico').value;

    if (!dataInput || !horaInicio || !horaFim || !medicoInput) {
        alert("Por favor, preencha a data, horário de início, fim e selecione o médico!");
        return;
    }

    const horarioFormatado = `${horaInicio} às ${horaFim}`;

    db.collection('plantoes').add({
        data: dataInput,
        horario: horarioFormatado,
        medico: medicoInput,
        status: "PENDENTE_APROVACAO",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Plantão cadastrado com sucesso!");
        document.getElementById('nova-data').value = '';
        document.getElementById('hora-inicio').value = '';
        document.getElementById('hora-fim').value = '';
        document.getElementById('novo-medico').value = '';
    })
    .catch((error) => {
        alert("Erro ao criar plantão: " + error.message);
    });
}

function aceitarPlantao(idDoPlantao) {
    db.collection('plantoes').doc(idDoPlantao).update({
        status: 'CONFIRMADO',
        confirmadoPor: usuarioAtualDados.nome
    });
}

// Carrega os plantões do Firestore
function escutarPlantoes() {
    db.collection('plantoes').onSnapshot((snapshot) => {
        plantoesDaNuvem = [];
        snapshot.forEach((doc) => {
            plantoesDaNuvem.push({
                id: doc.id,
                ...doc.data()
            });
        });
        renderizarPlantoes();
    });
}

// Renderiza plantões (Filtrando por privacidade do médico)
function renderizarPlantoes() {
    const conteiner = document.getElementById('lista-plantoes');
    const contador = document.getElementById('contador-plantoes');
    conteiner.innerHTML = ''; 

    // Filtra para mostrar todos para o Admin e apenas os do próprio médico para ele mesmo
    let plantoesVisiveis = plantoesDaNuvem;
    if (usuarioAtualDados.papel === 'medico') {
        plantoesVisiveis = plantoesDaNuvem.filter(plantao => 
            plantao.medico && plantao.medico.trim().toLowerCase() === usuarioAtualDados.nome.trim().toLowerCase()
        );
    }

    contador.innerText = `${plantoesVisiveis.length} plantão(ões)`;

    if (plantoesVisiveis.length === 0) {
        conteiner.innerHTML = `<p class="text-gray-500 text-sm col-span-2 bg-white p-4 rounded-lg shadow-sm">Nenhum plantão agendado para exibição.</p>`;
        return;
    }

    plantoesVisiveis.forEach(plantao => {
        let corFundo = '';
        let corBorda = '';
        let badge = '';
        let botoes = '';

        const eOMedicoDoPlantao = usuarioAtualDados.papel === 'medico';
        const mostrarBotoes = eOMedicoDoPlantao && plantao.status === 'PENDENTE_APROVACAO';

        if (plantao.status === 'PENDENTE_APROVACAO') {
            corFundo = 'bg-yellow-50';
            corBorda = 'border-yellow-400';
            badge = '<span class="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded">PENDENTE</span>';
            
            if (mostrarBotoes) {
                botoes = `
                    <div class="mt-4">
                        <button onclick="aceitarPlantao('${plantao.id}')" class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold transition">✅ ACEITAR PLANTÃO</button>
                    </div>
                `;
            } else if (usuarioAtualDados.papel === 'admin') {
                botoes = `<p class="text-xs text-yellow-700 mt-4">Aguardando confirmação do médico.</p>`;
            }

        } else if (plantao.status === 'CONFIRMADO') {
            corFundo = 'bg-green-50';
            corBorda = 'border-green-500';
            badge = '<span class="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded">CONFIRMADO</span>';
        }

        const partesData = plantao.data ? plantao.data.split('-') : [];
        const dataBonita = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}/${partesData[0]}` : plantao.data;

        const cardHTML = `
            <div class="${corFundo} border-l-4 ${corBorda} p-4 rounded-lg shadow-sm">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider">Data: ${dataBonita}</p>
                        <p class="text-lg font-bold text-gray-800 my-1">⏰ ${plantao.horario}</p>
                        <p class="text-sm font-medium text-gray-700">👨‍⚕️ ${plantao.medico}</p>
                    </div>
                    ${badge}
                </div>
                ${botoes}
            </div>
        `;

        conteiner.innerHTML += cardHTML;
    });
}