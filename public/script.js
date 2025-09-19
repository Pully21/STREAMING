// Variável global para armazenar os dados do catálogo
let seriesData = new Map();
let userRole = localStorage.getItem('userRole') || 'guest';
let userName = localStorage.getItem('userName') || '';
let userProfilePic = localStorage.getItem('userProfilePic') || '';
let userToken = localStorage.getItem('userToken') || null;

// Funções de UI
function showCatalog() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('series-upload-section').style.display = 'none';
    document.getElementById('video-section').style.display = 'none';
    document.getElementById('series-episodes-section').style.display = 'none';
    document.getElementById('account-settings-section').style.display = 'none';
    document.getElementById('catalog-section').style.display = 'block';
    
    updateUIForUserRole();
    fetchAndRenderCatalog();
}

function updateUIForUserRole() {
    if (userRole === 'admin') {
        document.getElementById('admin-buttons-catalog').style.display = 'flex';
    } else {
        document.getElementById('admin-buttons-catalog').style.display = 'none';
    }

    if (userToken) {
        document.getElementById('user-profile-menu-container').style.display = 'flex';
        document.getElementById('welcome-message').textContent = `Bem-vindo, ${userName}!`;
        const profilePicElement = document.getElementById('profile-pic');
        profilePicElement.src = `/profile-pics/${userProfilePic}`;
        profilePicElement.style.display = 'inline-block';
    } else {
        document.getElementById('user-profile-menu-container').style.display = 'none';
    }
}

// Funções de API
async function fetchAndRenderCatalog(searchTerm = '') {
    const moviesListElement = document.getElementById('movie-list');
    const seriesListElement = document.getElementById('series-list');
    const noResultsMessage = document.getElementById('no-results-message');

    moviesListElement.innerHTML = 'Carregando...';
    seriesListElement.innerHTML = '';
    noResultsMessage.style.display = 'none';

    try {
        const url = searchTerm ? `/movies?search=${encodeURIComponent(searchTerm)}` : '/movies';
        const response = await fetch(url);
        const allVideos = await response.json();

        moviesListElement.innerHTML = '';
        
        const movies = allVideos.filter(video => !video.isSeries);
        const series = allVideos.filter(video => video.isSeries);

        if (movies.length > 0) {
            document.getElementById('movies-heading').style.display = 'block';
            movies.forEach(movie => {
                const movieItem = document.createElement('div');
                movieItem.className = 'movie-item';
                let buttonsHtml = '';
                if (userRole === 'admin') {
                    buttonsHtml = `<button class="delete-button" onclick="deleteItem('${movie._id}')">Excluir</button>`;
                }
                
                const movieImageSrc = movie.episodeLogoFileName ? `/logos/${movie.episodeLogoFileName}` : `/logos/placeholder-movie.png`;

                movieItem.innerHTML = `
                    <img src="${movieImageSrc}" alt="${movie.title} Logo" class="video-logo">
                    <h3>${movie.title}</h3>
                    <p>Gênero: ${movie.genre} - Classificação: ${movie.ageRating || 'N/A'}</p>
                    <button onclick="playVideo('${movie.videoFileName}')">Assistir</button>
                    ${buttonsHtml}
                `;
                moviesListElement.appendChild(movieItem);
            });
        } else {
            document.getElementById('movies-heading').style.display = 'none';
        }

        if (series.length > 0) {
            document.getElementById('series-heading').style.display = 'block';
            
            seriesData.clear(); 
            series.forEach(episode => {
                if (!seriesData.has(episode.seriesTitle)) {
                    seriesData.set(episode.seriesTitle, {
                        episodes: [],
                        logo: episode.seriesLogoFileName,
                        genre: episode.genre,
                        ageRating: episode.ageRating
                    });
                }
                seriesData.get(episode.seriesTitle).episodes.push(episode);
            });

            seriesData.forEach((data, seriesTitle) => {
                const seriesItem = document.createElement('div');
                seriesItem.className = 'series-item';
                let buttonsHtml = '';
                if (userRole === 'admin') {
                    buttonsHtml = `<button class="delete-button" onclick="deleteSeries('${seriesTitle}')">Excluir Série</button>`;
                }

                const seriesImageSrc = data.logo ? `/logos/${data.logo}` : `/logos/placeholder-series.png`;

                seriesItem.innerHTML = `
                    <img src="${seriesImageSrc}" alt="${seriesTitle} Logo" class="series-logo">
                    <h3>${seriesTitle}</h3>
                    <p>Gênero: ${data.genre || 'N/A'} - Classificação: ${data.ageRating || 'N/A'}</p>
                    <button onclick="showEpisodes('${seriesTitle}')">Ver Episódios</button>
                    ${buttonsHtml}
                `;
                seriesListElement.appendChild(seriesItem);
            });

        } else {
            document.getElementById('series-heading').style.display = 'none';
        }

        if (movies.length === 0 && series.length === 0) {
            noResultsMessage.style.display = 'block';
        }

    } catch (error) {
        moviesListElement.innerHTML = 'Erro ao carregar o catálogo.';
        console.error('Erro ao buscar vídeos:', error);
    }
}

async function populateSeriesList() {
    const selectElement = document.getElementById('series-list-select');
    selectElement.innerHTML = '<option value="">Carregando...</option>';
    try {
        const response = await fetch('/series-list');
        const series = await response.json();
        selectElement.innerHTML = '';
        if (series.length > 0) {
            series.forEach(seriesTitle => {
                const option = document.createElement('option');
                option.value = seriesTitle;
                option.textContent = seriesTitle;
                selectElement.appendChild(option);
            });
            selectElement.setAttribute('required', 'true');
        } else {
            selectElement.innerHTML = '<option value="">Nenhuma série cadastrada</option>';
            selectElement.removeAttribute('required');
        }
    } catch (error) {
        console.error('Erro ao buscar lista de séries:', error);
        selectElement.innerHTML = '<option value="">Erro ao carregar séries</option>';
    }
}

function showEpisodes(seriesTitle) {
    document.getElementById('catalog-section').style.display = 'none';
    document.getElementById('series-episodes-section').style.display = 'block';
    
    document.getElementById('series-title-heading').textContent = seriesTitle;
    const episodesList = document.getElementById('episodes-list');
    episodesList.innerHTML = ''; 

    const seriesInfo = seriesData.get(seriesTitle);
    
    const sortedEpisodes = seriesInfo.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    sortedEpisodes.forEach(episode => {
        if(episode.videoFileName) {
            const episodeItem = document.createElement('div');
            episodeItem.className = 'episode-item';
            let buttonsHtml = '';
            if (userRole === 'admin') {
                buttonsHtml = `<button class="delete-button" onclick="deleteItem('${episode._id}', '${seriesTitle}')">Excluir Episódio</button>`;
            }

            const episodeImageSrc = episode.episodeLogoFileName ? `/logos/${episode.episodeLogoFileName}` : `/logos/placeholder-episode.png`;

            episodeItem.innerHTML = `
                <img src="${episodeImageSrc}" alt="${episode.title} Logo" class="video-logo">
                <h3>Episódio ${episode.episodeNumber}: ${episode.title}</h3>
                <p>Gênero: ${episode.genre} - Classificação: ${seriesInfo.ageRating || 'N/A'}</p>
                <button onclick="playVideo('${episode.videoFileName}')">Assistir</button>
                ${buttonsHtml}
            `;
            episodesList.appendChild(episodeItem);
        }
    });
}

function playVideo(fileName) {
    const videoPlayer = document.getElementById('video-player');
    videoPlayer.src = '/videos/' + fileName;

    document.getElementById('catalog-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('series-episodes-section').style.display = 'none';
    document.getElementById('account-settings-section').style.display = 'none';
    document.getElementById('video-section').style.display = 'block';
}

async function deleteItem(itemId, seriesTitle = null) {
    if (confirm('Tem certeza que deseja apagar este item?')) {
        try {
            const response = await fetch(`/delete/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            const data = await response.json();
            if (data.success) {
                alert('Item deletado com sucesso!');
                fetchAndRenderCatalog();
                showCatalog();
            } else {
                alert('Erro ao deletar: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao comunicar com o servidor:', error);
            alert('Erro ao deletar o item.');
        }
    }
}

async function deleteSeries(seriesTitle) {
    if (confirm('Tem certeza que deseja apagar a série completa?')) {
        try {
            const response = await fetch(`/delete-series/${seriesTitle}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            const data = await response.json();
            if (data.success) {
                alert('Série deletada com sucesso!');
                fetchAndRenderCatalog();
                showCatalog();
            } else {
                alert('Erro ao deletar a série: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao comunicar com o servidor:', error);
            alert('Erro ao deletar a série.');
        }
    }
}

// Event Listeners
document.getElementById('toggle-auth-mode').addEventListener('click', () => {
    const isLogin = document.getElementById('auth-submit-btn').textContent === 'Entrar';
    if (isLogin) {
        document.getElementById('auth-title').textContent = 'Cadastre-se';
        document.getElementById('auth-submit-btn').textContent = 'Cadastrar';
        document.getElementById('toggle-auth-mode').textContent = 'Já tem uma conta? Entrar';
        document.getElementById('register-fields').style.display = 'block';
        document.getElementById('name-input').setAttribute('required', 'true');
    } else {
        document.getElementById('auth-title').textContent = 'Entrar';
        document.getElementById('auth-submit-btn').textContent = 'Entrar';
        document.getElementById('toggle-auth-mode').textContent = 'Não tem uma conta? Cadastre-se';
        document.getElementById('register-fields').style.display = 'none';
        document.getElementById('name-input').removeAttribute('required');
    }
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isLogin = document.getElementById('auth-submit-btn').textContent === 'Entrar';
    const messageElement = document.getElementById('auth-message');
    const form = e.target;
    const formData = new FormData(form);
    
    let url = isLogin ? '/login' : '/register';
    let method = 'POST';
    
    messageElement.textContent = 'Processando...';
    
    try {
        const response = await fetch(url, {
            method,
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            if (isLogin) {
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userRole', data.userRole);
                localStorage.setItem('userName', data.userName);
                localStorage.setItem('userProfilePic', data.userProfilePic);
                userToken = data.token;
                userRole = data.userRole;
                userName = data.userName;
                userProfilePic = data.userProfilePic;
                alert('Login bem-sucedido!');
                showCatalog();
            } else {
                messageElement.textContent = 'Usuário cadastrado com sucesso! Faça login para continuar.';
                form.reset();
                document.getElementById('toggle-auth-mode').click();
            }
        } else {
            messageElement.textContent = data.message;
        }
    } catch (error) {
        messageElement.textContent = 'Erro ao se comunicar com o servidor. Verifique a console.';
        console.error('Erro:', error);
    }
});

document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});

document.getElementById('upload-movie-link').addEventListener('click', () => {
    document.getElementById('catalog-section').style.display = 'none';
    document.getElementById('video-section').style.display = 'none';
    document.getElementById('series-episodes-section').style.display = 'none';
    document.getElementById('account-settings-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'block';
});

document.getElementById('upload-series-link').addEventListener('click', () => {
    document.getElementById('catalog-section').style.display = 'none';
    document.getElementById('video-section').style.display = 'none';
    document.getElementById('series-episodes-section').style.display = 'none';
    document.getElementById('account-settings-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('series-upload-section').style.display = 'block';
});

document.getElementById('new-series-link').addEventListener('click', () => {
    document.getElementById('add-series-form-container').style.display = 'block';
    document.getElementById('add-episode-form-container').style.display = 'none';
});

document.getElementById('new-episode-link').addEventListener('click', () => {
    document.getElementById('add-series-form-container').style.display = 'none';
    document.getElementById('add-episode-form-container').style.display = 'block';
    populateSeriesList();
});

const backToCatalogButtons = ['back-from-upload', 'back-from-series-upload', 'back-to-catalog', 'back-from-settings', 'back-to-series-catalog'];
backToCatalogButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if(button) {
        button.addEventListener('click', () => {
            showCatalog();
        });
    }
});

document.getElementById('new-series-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageElement = document.getElementById('series-message');
    const form = e.target;
    const formData = new FormData(form);
    messageElement.textContent = 'Cadastrando série...';
    try {
        const response = await fetch('/upload-series', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const data = await response.json();
        if (data.success) {
            messageElement.textContent = 'Série cadastrada com sucesso!';
            form.reset();
        } else {
            messageElement.textContent = 'Erro ao cadastrar: ' + data.message;
        }
    } catch (error) {
        messageElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', error);
    }
});

document.getElementById('new-episode-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageElement = document.getElementById('episode-message');
    const form = e.target;
    const formData = new FormData(form);
    messageElement.textContent = 'Adicionando episódio...';
    try {
        const response = await fetch('/upload-episode', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const data = await response.json();
        if (data.success) {
            messageElement.textContent = 'Episódio adicionado com sucesso!';
            form.reset();
        } else {
            messageElement.textContent = 'Erro ao adicionar: ' + data.message;
        }
    } catch (error) {
        messageElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', error);
    }
});

document.getElementById('video-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageElement = document.getElementById('message');
    const form = e.target;
    const formData = new FormData(form);
    messageElement.textContent = 'Enviando...';
    try {
        const response = await fetch('/upload-movie', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const data = await response.json();
        if (data.success) {
            messageElement.textContent = 'Upload concluído!';
            form.reset();
        } else {
            messageElement.textContent = 'Erro no upload: ' + data.message;
        }
    } catch (error) {
        messageElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', error);
    }
});

document.getElementById('search-button').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-input').value;
    fetchAndRenderCatalog(searchTerm);
});

// Event listeners para o novo menu de perfil
document.getElementById('profile-pic').addEventListener('click', () => {
    document.getElementById('profile-menu').classList.toggle('show');
});

document.getElementById('account-settings-link').addEventListener('click', () => {
    document.getElementById('profile-menu').classList.remove('show');
    document.getElementById('catalog-section').style.display = 'none';
    document.getElementById('account-settings-section').style.display = 'block';
    
    // Preencher o formulário com dados atuais
    document.getElementById('new-name-input').value = userName;
});

// Event listener para o formulário de atualização de conta
document.getElementById('account-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageElement = document.getElementById('settings-message');
    const form = e.target;
    const formData = new FormData(form);
    messageElement.textContent = 'Salvando alterações...';
    try {
        const response = await fetch('/update-profile', {
            method: 'PUT',
            body: formData,
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const data = await response.json();
        if (data.success) {
            // Atualizar localStorage com os novos dados
            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userName', data.userName);
            localStorage.setItem('userProfilePic', data.userProfilePic);
            userToken = data.token;
            userName = data.userName;
            userProfilePic = data.userProfilePic;

            messageElement.textContent = 'Alterações salvas com sucesso!';
            updateUIForUserRole();
        } else {
            messageElement.textContent = 'Erro ao salvar alterações: ' + data.message;
        }
    } catch (error) {
        messageElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', error);
    }
});

// Inicialização: Se o usuário já tiver um token, mostra o catálogo. Caso contrário, mostra a tela de autenticação.
if (userToken) {
    showCatalog();
} else {
    document.getElementById('auth-section').style.display = 'block';
}