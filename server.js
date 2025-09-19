const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ADICIONADO: EM UM PROJETO REAL, USE UMA VARIÁVEL DE AMBIENTE.
const JWT_SECRET = 'sua_chave_secreta_muito_segura_aqui';

const mongoURI = 'mongodb+srv://ulyssesro2:Streamingulysses123@clusterstreaming.tpf8vbq.mongodb.net/?retryWrites=true&w=majority&appName=ClusterStreaming';

mongoose.connect(mongoURI)
    .then(() => console.log('Conectado ao MongoDB Atlas!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const movieSchema = new mongoose.Schema({
    title: String,
    genre: String,
    ageRating: String,
    isSeries: { type: Boolean, default: false },
    seriesTitle: String,
    episodeNumber: Number,
    videoFileName: String,
    seriesLogoFileName: String,
    episodeLogoFileName: String
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: String,
    profilePictureFileName: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

const Movie = mongoose.model('Movie', movieSchema);
const User = mongoose.model('User', userSchema);

const app = express();
const PORT = 3000;

// Configuração do Multer para uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;
        if (file.fieldname === 'profilePicture' || file.fieldname === 'newProfilePicture') {
            uploadPath = path.join(__dirname, 'public/profile-pics');
        } else {
            uploadPath = (file.fieldname === 'video') ? path.join(__dirname, 'public/videos') : path.join(__dirname, 'public/logos');
        }
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'public')));
// Middleware para processar JSON e dados de formulário
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para verificar o token JWT e a permissão de administrador
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('Erro ao verificar token:', err);
                return res.status(403).json({ success: false, message: 'Token inválido ou expirado.' });
            }
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ success: false, message: 'Autenticação necessária.' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores podem executar esta ação.' });
    }
};

// Rota de Registro
app.post('/register', upload.single('profilePicture'), async (req, res) => {
    try {
        console.log('Dados recebidos no registro:', req.body);
        console.log('Arquivo de foto de perfil recebido:', req.file);

        const { name, password, dob } = req.body;
        const profilePictureFileName = req.file ? req.file.filename : 'default-user-pic.png';

        if (!name || !password) {
            return res.status(400).json({ success: false, message: 'Nome e senha são obrigatórios.' });
        }

        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Nome de usuário já existe.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            password: hashedPassword,
            dob,
            profilePictureFileName,
            role: 'user'
        });

        await newUser.save();
        res.status(201).json({ success: true, message: 'Usuário cadastrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota de Login
app.post('/login', upload.none(), async (req, res) => {
    try {
        console.log('Tentativa de login para o usuário:', req.body.name);
        const { name, password } = req.body;
        const user = await User.findOne({ name });

        if (!user) {
            console.log('Usuário não encontrado.');
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Senha incorreta.');
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: user._id, name: user.name, role: user.role, profilePictureFileName: user.profilePictureFileName },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('Login bem-sucedido. Token gerado.');
        res.status(200).json({
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userRole: user.role,
            userName: user.name,
            userProfilePic: user.profilePictureFileName
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// NOVA ROTA: Atualização de perfil do usuário
app.put('/update-profile', authenticateJWT, upload.single('newProfilePicture'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, password, dob } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const updateData = {};
        let newProfilePictureFileName = user.profilePictureFileName;

        if (name && name !== user.name) {
            const existingUser = await User.findOne({ name });
            if (existingUser) {
                return res.status(409).json({ success: false, message: 'Nome de usuário já existe.' });
            }
            updateData.name = name;
        }
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        if (dob) {
            updateData.dob = dob;
        }
        if (req.file) {
            if (user.profilePictureFileName && user.profilePictureFileName !== 'default-user-pic.png' && user.profilePictureFileName !== 'default-admin-pic.png') {
                const oldPicPath = path.join(__dirname, 'public/profile-pics', user.profilePictureFileName);
                if (fs.existsSync(oldPicPath)) {
                    fs.unlinkSync(oldPicPath);
                }
            }
            updateData.profilePictureFileName = req.file.filename;
            newProfilePictureFileName = req.file.filename;
        }

        await User.findByIdAndUpdate(userId, updateData);

        const newToken = jwt.sign(
            { id: user._id, name: updateData.name || user.name, role: user.role, profilePictureFileName: newProfilePictureFileName },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.status(200).json({
            success: true,
            message: 'Perfil atualizado com sucesso!',
            token: newToken,
            userName: updateData.name || user.name,
            userProfilePic: newProfilePictureFileName
        });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rotas protegidas (exigem JWT)
app.post('/upload-series', authenticateJWT, requireAdmin, upload.single('seriesLogo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'A logo da série é obrigatória.' });
        }
        const newSeries = new Movie({
            title: req.body.seriesTitle,
            genre: req.body.genre,
            ageRating: req.body.ageRating,
            isSeries: true,
            seriesTitle: req.body.seriesTitle,
            seriesLogoFileName: req.file.filename,
            episodeNumber: null,
            videoFileName: null,
            episodeLogoFileName: null
        });
        await newSeries.save();
        res.status(200).json({ success: true, message: 'Série cadastrada com sucesso!' });
    } catch (error) {
        console.error('Erro ao cadastrar série:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/upload-episode', authenticateJWT, requireAdmin, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'episodeLogo', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.video || !req.files.episodeLogo) {
            return res.status(400).json({ success: false, message: 'Vídeo e logo do episódio são obrigatórios.' });
        }
        const series = await Movie.findOne({ seriesTitle: req.body.seriesTitle });
        if (!series) {
            return res.status(404).json({ success: false, message: 'Série não encontrada.' });
        }
        const newEpisode = new Movie({
            title: req.body.title,
            genre: series.genre,
            ageRating: series.ageRating,
            isSeries: true,
            seriesTitle: req.body.seriesTitle,
            episodeNumber: req.body.episodeNumber,
            videoFileName: req.files.video[0].filename,
            episodeLogoFileName: req.files.episodeLogo[0].filename,
            seriesLogoFileName: series.seriesLogoFileName
        });
        await newEpisode.save();
        res.status(200).json({ success: true, message: 'Episódio adicionado com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar episódio:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/upload-movie', authenticateJWT, requireAdmin, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'episodeLogo', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.video || !req.files.episodeLogo) {
            return res.status(400).json({ success: false, message: 'Vídeo e logo do filme são obrigatórios.' });
        }
        const newMovie = new Movie({
            title: req.body.title,
            genre: req.body.genre,
            isSeries: false,
            videoFileName: req.files.video[0].filename,
            episodeLogoFileName: req.files.episodeLogo[0].filename,
            ageRating: req.body.ageRating
        });
        await newMovie.save();
        res.status(200).json({ success: true, message: 'Filme adicionado com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar filme:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.delete('/delete/:id', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const movieId = req.params.id;
        const deletedMovie = await Movie.findByIdAndDelete(movieId);
        if (!deletedMovie) {
            return res.status(404).json({ success: false, message: 'Item não encontrado.' });
        }
        const videoPath = path.join(__dirname, 'public/videos', deletedMovie.videoFileName);
        const logoPath = path.join(__dirname, 'public/logos', deletedMovie.episodeLogoFileName);
        if (fs.existsSync(videoPath) && deletedMovie.videoFileName) { fs.unlinkSync(videoPath); }
        if (fs.existsSync(logoPath) && deletedMovie.episodeLogoFileName) { fs.unlinkSync(logoPath); }
        res.status(200).json({ success: true, message: 'Item deletado com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar item:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.delete('/delete-series/:seriesTitle', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const seriesTitle = req.params.seriesTitle;
        const deletedMovies = await Movie.find({ seriesTitle: seriesTitle });
        if (deletedMovies.length === 0) {
            return res.status(404).json({ success: false, message: 'Série não encontrada.' });
        }
        const result = await Movie.deleteMany({ seriesTitle: seriesTitle });
        deletedMovies.forEach(movie => {
            if (movie.videoFileName) { const videoPath = path.join(__dirname, 'public/videos', movie.videoFileName); if (fs.existsSync(videoPath)) { fs.unlinkSync(videoPath); } }
            if (movie.episodeLogoFileName) { const episodeLogoPath = path.join(__dirname, 'public/logos', movie.episodeLogoFileName); if (fs.existsSync(episodeLogoPath)) { fs.unlinkSync(episodeLogoPath); } }
        });
        const seriesLogo = deletedMovies[0].seriesLogoFileName;
        if (seriesLogo) { const seriesLogoPath = path.join(__dirname, 'public/logos', seriesLogo); if (fs.existsSync(seriesLogoPath)) { fs.unlinkSync(seriesLogoPath); } }
        res.status(200).json({ success: true, message: `${result.deletedCount} itens deletados com sucesso!` });
    } catch (error) {
        console.error('Erro ao deletar a série:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/series-list', async (req, res) => {
    try {
        const seriesList = await Movie.find({ isSeries: true }).distinct('seriesTitle');
        res.status(200).json(seriesList);
    } catch (error) {
        console.error('Erro ao buscar lista de séries:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar lista de séries.' });
    }
});

app.get('/movies', async (req, res) => {
    try {
        const searchTerm = req.query.search || '';
        let query = {};
        if (searchTerm) {
            query = {
                $or: [
                    { title: { $regex: searchTerm, $options: 'i' } },
                    { genre: { $regex: searchTerm, $options: 'i' } },
                    { seriesTitle: { $regex: searchTerm, $options: 'i' } }
                ]
            };
        }
        const movies = await Movie.find(query);
        res.status(200).json(movies);
    } catch (error) {
        console.error('Erro ao buscar filmes:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar filmes.' });
    }
});

app.get('/videos/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public/videos', filename);
    if (!fs.existsSync(filePath)) { return res.status(404).send('Vídeo não encontrado'); }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': 'video/mp4' };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

app.get('/profile-pics/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'public/profile-pics', req.params.filename);
    res.sendFile(filePath);
});

async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ name: 'admin' });
        if (!adminExists) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            const adminUser = new User({
                name: 'admin',
                password: hashedPassword,
                dob: '2000-01-01',
                profilePictureFileName: 'default-admin-pic.png',
                role: 'admin'
            });
            await adminUser.save();
            console.log('✅ Usuário admin criado com sucesso.');
        } else {
            console.log('Admin já existe no banco de dados. Ignorando a criação.');
        }
    } catch (error) {
        console.error('❌ Erro ao criar usuário admin:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    createAdminUser();
});