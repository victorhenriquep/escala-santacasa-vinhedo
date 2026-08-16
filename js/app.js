// 1. Configuração do Firebase
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

// Estado global do usuário logado
let modoCadastro = false;
let usuarioAtualDados = null;
let plantoesDaNuvem = [];

// 2. Alternar entre formulário de Login e Cadastro
function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    
    document.getElementById('titulo-auth').innerText = modoCadastro ? 'Criar Conta' : 'Acessar o Sistema';
    document.getElementById('btn-submit-auth').innerText = modoCadastro ? 'Cadastrar' : 'Entrar';
    document.getElementById('texto-alternar').innerText = modoCadastro ? 'Já possui uma conta?' : 'Não tem uma conta?';
    document.getElementById('btn-alternar').innerText = modoCadastro ? 'Faça Login' : 'Cadastre-se';
    
    document.getElementById('campo-nome').classList.toggle('hidden', !modoCadastro);
    document.getElementById('campo-papel').classList.toggle('hidden', !modoCadastro);
}

// 3. Fazer Login ou Cadastro
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
                // Salva os dados do perfil do usuário no Firestore
                return db.collection('usuarios').doc(credenciais.user.uid).set({
                    nome: nome,
                    papel: papel,
                    email: email
                });
            })
            .then(() => {
                alert("Conta criada com sucesso!");
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

// 4. Logout
function fazerLogout() {
    auth.signOut();
}

// 5. Monitorar o Estado de Login em Tempo Real
auth.onAuthStateChanged((user) => {
    const secaoAuth = document.getElementById('secao-auth');
    const secaoApp = document.getElementById('secao-app');

    if (user) {
        // Usuário está logado: busca os dados do perfil no Firestore
        db.collection('usuarios').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                usuarioAtualDados = doc.data();
                
                // Atualiza a tela
                document.getElementById('nome-usuario-logado').innerText = usuarioAtualDados.nome;
                document.getElementById('papel-usuario-logado').innerText = usuarioAtualDados.papel === 'admin' ? 'Administrador' : 'Médico';
                
                // Exibe painel admin se for administrador
                if (usuarioAtualDados.papel === 'admin') {
                    document.getElementById('painel-admin').classList.remove('hidden');
                    escutarMedicosCadastrados(); // Carrega médicos em ordem alfabética no menu
                } else {
                    document.getElementById('painel-admin').classList.add('hidden');
                }

                secaoAuth.classList.add('hidden');
                secaoApp.classList.remove('hidden');
                
                // Inicia escuta dos plantões
                escutarPlantoes();
            }
        });
    } else {
        // Usuário deslogado
        usuarioAtualDados = null;
        secaoAuth.classList.remove('hidden');
        secaoApp.classList.add('hidden');
    }
});

// 6. Buscar médicos cadastrados em ordem alfabética para o Select da Administradora
function escutarMedicosCadastrados() {
    db.collection('usuarios').where('papel', '==', 'medico').onSnapshot((snapshot) => {
        const selectMedico = document.getElementById('novo-medico');
        selectMedico.innerHTML = '<option value="">Selecione um(a) médico(a)...</option>';
        
        const medicos = [];
        snapshot.forEach(doc => {
            medicos.push(doc.data());
        });

        // Ordenar os médicos em ordem alfabética pelo nome (A-Z)
        medicos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

        if (medicos.length === 0) {
            selectMedico.innerHTML = '<option value="">Nenhum médico cadastrado ainda</option>';
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

// 7. Salvar novo plantão no Firebase (Apenas Admin)
function criarPlantao() {
    const dataInput = document.getElementById('nova-data').value;
    const horarioInput = document.getElementById('novo-horario').value;
    const medicoInput = document.getElementById('novo-medico').value;

    if (!dataInput || !medicoInput) {
        alert("Por favor, selecione a data e o médico responsável!");
        return;
    }

    db.collection('plantoes').add({
        data: dataInput,
        horario: horarioInput,
        medico: medicoInput,
        status: "PENDENTE_APROVACAO",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Plantão criado com sucesso!");
        document.getElementById('nova-data').value = '';
        document.getElementById('novo-medico').value = '';
    })
    .catch((error) => {
        alert("Erro ao criar plantão: " + error.message);
    });
}

// 8. Aceitar Plantão
function aceitarPlantao(idDoPlantao) {
    db.collection('plantoes').doc(idDoPlantao).update({
        status: 'CONFIRMADO',
        confirmadoPor: usuarioAtualDados.nome
    });
}

// 9. Escutar atualizações de plantões
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

// 10. Desenhar os cards na tela
function renderizarPlantoes() {
    const conteiner = document.getElementById('lista-plantoes');
    conteiner.innerHTML = ''; 

    if (plantoesDaNuvem.length === 0) {
        conteiner.innerHTML = `<p class="text-gray-500 text-sm col-span-2">Nenhum plantão cadastrado no momento.</p>`;
        return;
    }

    plantoesDaNuvem.forEach(plantao => {
        let corFundo = '';
        let corBorda = '';
        let badge = '';
        let botoes = '';

        const eOMedicoDoPlantao = usuarioAtualDados.papel === 'medico' && plantao.medico.toLowerCase().includes(usuarioAtualDados.nome.toLowerCase());
        const mostrarBotoes = eOMedicoDoPlantao && plantao.status === 'PENDENTE_APROVACAO';

        if (plantao.status === 'PENDENTE_APROVACAO') {
            corFundo = 'bg-yellow-50';
            corBorda = 'border-yellow-400';
            badge = '<span class="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded">PENDENTE</span>';
            
            if (mostrarBotoes) {
                botoes = `
                    <div class="mt-4 flex gap-2">
                        <button onclick="aceitarPlantao('${plantao.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold transition">✅ ACEITAR</button>
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
            <div class="${corFundo} border-l-4 ${corBorda} p-4 rounded shadow-sm">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm text-gray-500 font-semibold">Data: ${dataBonita}</p>
                        <p class="text-lg font-bold text-gray-800">${plantao.horario}</p>
                        <p class="text-md text-gray-700 mt-1">Médico: ${plantao.medico}</p>
                    </div>
                    ${badge}
                </div>
                ${botoes}
            </div>
        `;

        conteiner.innerHTML += cardHTML;
    });
}