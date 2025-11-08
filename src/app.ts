import Peer from 'peerjs';

// Game State
let gameState = {
    role: null, // 'host' or 'player'
    peer: null,
    hostConnection: null,
    playerConnections: new Map(),
    currentQuiz: null,
    players: [],
    currentQuestion: 0,
    gamePin: null,
    playerName: null,
    answers: new Map(),
    scores: new Map(),
    timerInterval: null,
    timeLeft: 0
};

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Generate 6-digit PIN
function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Initialize Peer Connection
function initializePeer(peerId = null) {
    return new Promise((resolve, reject) => {
        const peer = new Peer(peerId, {
            host: 'peerjs-server.herokuapp.com',
            secure: true,
            port: 443,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('Peer ID:', id);
            resolve(peer);
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            reject(err);
        });
    });
}

// Load Available Quizzes
async function loadQuizzes() {
    try {
        const select = document.getElementById('quiz-select');
        // For now, just add the example quiz
        // In production, you'd scan the quizzes directory
        select.innerHTML = '<option value="quizzes/example-quiz.json">General Knowledge Quiz</option>';
    } catch (error) {
        console.error('Error loading quizzes:', error);
    }
}

// Load Quiz Data
async function loadQuiz(path) {
    try {
        const response = await fetch(path);
        return await response.json();
    } catch (error) {
        console.error('Error loading quiz:', error);
        return null;
    }
}

// HOST FUNCTIONS
async function startHosting() {
    const quizPath = document.getElementById('quiz-select').value;
    if (!quizPath) return;

    gameState.currentQuiz = await loadQuiz(quizPath);
    if (!gameState.currentQuiz) {
        alert('Failed to load quiz');
        return;
    }

    gameState.role = 'host';
    gameState.gamePin = generatePin();
    gameState.players = [];
    gameState.currentQuestion = 0;
    gameState.scores = new Map();

    try {
        gameState.peer = await initializePeer(`yupp-${gameState.gamePin}`);
        setupHostListeners();
        showHostLobby();
    } catch (error) {
        alert('Failed to create game. Please try again.');
        console.error(error);
    }
}

function setupHostListeners() {
    gameState.peer.on('connection', (conn) => {
        conn.on('open', () => {
            console.log('Player connected:', conn.peer);
        });

        conn.on('data', (data) => {
            handleHostMessage(conn, data);
        });

        conn.on('close', () => {
            removePlayer(conn.metadata?.playerName);
        });
    });
}

function handleHostMessage(conn, data) {
    switch (data.type) {
        case 'join':
            addPlayer(conn, data.playerName);
            break;
        case 'answer':
            recordAnswer(data.playerName, data.answer, data.timestamp);
            break;
    }
}

function addPlayer(conn, playerName) {
    if (gameState.players.some(p => p.name === playerName)) {
        conn.send({ type: 'error', message: 'Name already taken' });
        return;
    }

    const player = { name: playerName, connection: conn };
    gameState.players.push(player);
    gameState.playerConnections.set(playerName, conn);
    gameState.scores.set(playerName, 0);

    // Send confirmation to player
    conn.send({ 
        type: 'joined', 
        quiz: {
            title: gameState.currentQuiz.title,
            questionCount: gameState.currentQuiz.questions.length
        }
    });

    // Update lobby
    updatePlayersList();
    broadcastToPlayers({ 
        type: 'playerJoined', 
        players: gameState.players.map(p => p.name) 
    });
}

function removePlayer(playerName) {
    gameState.players = gameState.players.filter(p => p.name !== playerName);
    gameState.playerConnections.delete(playerName);
    updatePlayersList();
    broadcastToPlayers({ 
        type: 'playerLeft', 
        players: gameState.players.map(p => p.name) 
    });
}

function updatePlayersList() {
    const count = gameState.players.length;
    document.getElementById('player-count').textContent = count;
    
    const listElement = document.getElementById('players-list');
    listElement.innerHTML = gameState.players
        .map(p => `<div class="player-item">${p.name}</div>`)
        .join('');
}

function showHostLobby() {
    document.getElementById('game-pin').textContent = gameState.gamePin;
    updatePlayersList();
    showScreen('host-lobby-screen');
}

function startGame() {
    if (gameState.players.length === 0) {
        alert('Need at least 1 player to start!');
        return;
    }

    broadcastToPlayers({ 
        type: 'gameStarting',
        quiz: gameState.currentQuiz
    });

    setTimeout(() => {
        showNextQuestion();
    }, 2000);
}

function showNextQuestion() {
    if (gameState.currentQuestion >= gameState.currentQuiz.questions.length) {
        showFinalResults();
        return;
    }

    gameState.answers = new Map();
    const question = gameState.currentQuiz.questions[gameState.currentQuestion];
    
    // Show to host
    showHostQuestion(question);
    
    // Send to players
    broadcastToPlayers({
        type: 'question',
        questionNumber: gameState.currentQuestion + 1,
        totalQuestions: gameState.currentQuiz.questions.length,
        question: question.question,
        answers: question.answers,
        timeLimit: gameState.currentQuiz.timePerQuestion
    });

    startQuestionTimer(gameState.currentQuiz.timePerQuestion);
}

function showHostQuestion(question) {
    document.getElementById('host-q-number').textContent = gameState.currentQuestion + 1;
    document.getElementById('host-q-total').textContent = gameState.currentQuiz.questions.length;
    document.getElementById('host-question-text').textContent = question.question;
    
    const answerBoxes = document.querySelectorAll('#host-answers-grid .answer-box');
    question.answers.forEach((answer, index) => {
        answerBoxes[index].querySelector('.answer-text').textContent = answer;
    });

    document.getElementById('responses-count').textContent = '0';
    document.getElementById('total-players').textContent = gameState.players.length;

    showScreen('host-question-screen');
}

function startQuestionTimer(seconds) {
    gameState.timeLeft = seconds;
    updateTimerDisplay();

    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateTimerDisplay();

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            endQuestion();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElements = document.querySelectorAll('.timer');
    timerElements.forEach(el => {
        el.textContent = gameState.timeLeft;
        if (gameState.timeLeft <= 5) {
            el.classList.add('urgent');
        } else {
            el.classList.remove('urgent');
        }
    });
}

function recordAnswer(playerName, answer, timestamp) {
    if (!gameState.answers.has(playerName)) {
        gameState.answers.set(playerName, { answer, timestamp });
        
        // Update response count
        document.getElementById('responses-count').textContent = gameState.answers.size;

        // Check if all answered
        if (gameState.answers.size === gameState.players.length) {
            clearInterval(gameState.timerInterval);
            setTimeout(() => endQuestion(), 1000);
        }
    }
}

function endQuestion() {
    clearInterval(gameState.timerInterval);
    
    const question = gameState.currentQuiz.questions[gameState.currentQuestion];
    const correctAnswer = question.correctAnswer;
    const maxPoints = question.points;

    // Calculate scores
    gameState.answers.forEach((answerData, playerName) => {
        if (answerData.answer === correctAnswer) {
            // Award points based on speed (faster = more points)
            const timeBonus = Math.floor((gameState.timeLeft / gameState.currentQuiz.timePerQuestion) * 500);
            const points = maxPoints + timeBonus;
            const currentScore = gameState.scores.get(playerName) || 0;
            gameState.scores.set(playerName, currentScore + points);
        }
    });

    // Show results
    showQuestionResults(question, correctAnswer);
}

function showQuestionResults(question, correctAnswer) {
    document.getElementById('correct-answer-text').textContent = question.answers[correctAnswer];
    updateLeaderboard();

    // Broadcast results to players
    const results = Array.from(gameState.scores.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);

    broadcastToPlayers({
        type: 'questionResults',
        correctAnswer,
        leaderboard: results
    });

    showScreen('results-screen');
}

function updateLeaderboard() {
    const leaderboard = Array.from(gameState.scores.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);

    const listElement = document.getElementById('leaderboard-list');
    listElement.innerHTML = leaderboard
        .map((player, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            return `
                <div class="leaderboard-item ${rankClass}">
                    <span class="rank">${index + 1}</span>
                    <span class="name">${player.name}</span>
                    <span class="score">${player.score}</span>
                </div>
            `;
        })
        .join('');
}

function nextQuestion() {
    gameState.currentQuestion++;
    showNextQuestion();
}

function showFinalResults() {
    const leaderboard = Array.from(gameState.scores.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);

    // Update podium
    if (leaderboard[0]) {
        document.getElementById('first-place').textContent = leaderboard[0].name;
        document.getElementById('first-score').textContent = leaderboard[0].score;
    }
    if (leaderboard[1]) {
        document.getElementById('second-place').textContent = leaderboard[1].name;
        document.getElementById('second-score').textContent = leaderboard[1].score;
    }
    if (leaderboard[2]) {
        document.getElementById('third-place').textContent = leaderboard[2].name;
        document.getElementById('third-score').textContent = leaderboard[2].score;
    }

    // Update full leaderboard
    const listElement = document.getElementById('final-leaderboard-list');
    listElement.innerHTML = leaderboard
        .map((player, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            return `
                <div class="leaderboard-item ${rankClass}">
                    <span class="rank">${index + 1}</span>
                    <span class="name">${player.name}</span>
                    <span class="score">${player.score}</span>
                </div>
            `;
        })
        .join('');

    broadcastToPlayers({
        type: 'gameOver',
        leaderboard
    });

    showScreen('final-results-screen');
}

function broadcastToPlayers(message) {
    gameState.players.forEach(player => {
        player.connection.send(message);
    });
}

// PLAYER FUNCTIONS
async function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const pin = document.getElementById('game-pin-input').value.trim();
    const errorEl = document.getElementById('join-error');

    if (!playerName || !pin) {
        errorEl.textContent = 'Please enter your name and game PIN';
        errorEl.classList.add('show');
        return;
    }

    if (pin.length !== 6) {
        errorEl.textContent = 'Game PIN must be 6 digits';
        errorEl.classList.add('show');
        return;
    }

    gameState.role = 'player';
    gameState.playerName = playerName;
    gameState.gamePin = pin;

    try {
        gameState.peer = await initializePeer();
        const hostPeerId = `yupp-${pin}`;
        gameState.hostConnection = gameState.peer.connect(hostPeerId, {
            metadata: { playerName }
        });

        setupPlayerListeners();

        gameState.hostConnection.on('open', () => {
            gameState.hostConnection.send({
                type: 'join',
                playerName
            });
        });

        gameState.hostConnection.on('error', (err) => {
            errorEl.textContent = 'Could not connect to game. Check PIN and try again.';
            errorEl.classList.add('show');
            console.error(err);
        });

    } catch (error) {
        errorEl.textContent = 'Failed to join game. Please try again.';
        errorEl.classList.add('show');
        console.error(error);
    }
}

function setupPlayerListeners() {
    gameState.hostConnection.on('data', (data) => {
        handlePlayerMessage(data);
    });

    gameState.hostConnection.on('close', () => {
        alert('Connection to host lost');
        resetToHome();
    });
}

function handlePlayerMessage(data) {
    switch (data.type) {
        case 'joined':
            showPlayerLobby(data.quiz);
            break;
        case 'error':
            alert(data.message);
            resetToHome();
            break;
        case 'playerJoined':
        case 'playerLeft':
            updateLobbyPlayersList(data.players);
            break;
        case 'gameStarting':
            gameState.currentQuiz = data.quiz;
            break;
        case 'question':
            showPlayerQuestion(data);
            break;
        case 'questionResults':
            showPlayerResults(data);
            break;
        case 'gameOver':
            showPlayerFinalResults(data.leaderboard);
            break;
    }
}

function showPlayerLobby(quiz) {
    document.getElementById('your-name').textContent = gameState.playerName;
    showScreen('player-lobby-screen');
}

function updateLobbyPlayersList(players) {
    document.getElementById('lobby-player-count').textContent = players.length;
    const listElement = document.getElementById('lobby-players-list');
    listElement.innerHTML = players
        .map(name => `<div class="player-item">${name}</div>`)
        .join('');
}

function showPlayerQuestion(data) {
    document.getElementById('player-q-number').textContent = data.questionNumber;
    document.getElementById('player-q-total').textContent = data.totalQuestions;
    document.getElementById('player-question-text').textContent = data.question;

    const answerButtons = document.querySelectorAll('#player-answers-grid .answer-btn');
    data.answers.forEach((answer, index) => {
        const btn = answerButtons[index];
        btn.querySelector('.answer-text').textContent = answer;
        btn.classList.remove('selected', 'correct', 'incorrect');
        btn.disabled = false;
    });

    document.getElementById('answer-feedback').textContent = '';
    document.getElementById('answer-feedback').className = 'answer-feedback';

    showScreen('player-question-screen');
}

function submitAnswer(answerIndex) {
    const buttons = document.querySelectorAll('#player-answers-grid .answer-btn');
    buttons.forEach(btn => btn.disabled = true);
    buttons[answerIndex].classList.add('selected');

    gameState.hostConnection.send({
        type: 'answer',
        playerName: gameState.playerName,
        answer: answerIndex,
        timestamp: Date.now()
    });

    document.getElementById('answer-feedback').textContent = 'Answer submitted!';
    document.getElementById('answer-feedback').className = 'answer-feedback';
}

function showPlayerResults(data) {
    const buttons = document.querySelectorAll('#player-answers-grid .answer-btn');
    buttons.forEach((btn, index) => {
        if (index === data.correctAnswer) {
            btn.classList.add('correct');
        } else {
            btn.classList.add('incorrect');
        }
    });

    const playerAnswered = Array.from(buttons).findIndex(btn => btn.classList.contains('selected'));
    const isCorrect = playerAnswered === data.correctAnswer;

    const feedback = document.getElementById('answer-feedback');
    feedback.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
    feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
}

function showPlayerFinalResults(leaderboard) {
    // Find player's rank
    const playerRank = leaderboard.findIndex(p => p.name === gameState.playerName) + 1;
    const playerScore = leaderboard.find(p => p.name === gameState.playerName)?.score || 0;

    alert(`Game Over! You placed #${playerRank} with ${playerScore} points!`);
    showScreen('final-results-screen');
}

// UTILITY FUNCTIONS
function resetToHome() {
    if (gameState.peer) {
        gameState.peer.destroy();
    }
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    gameState = {
        role: null,
        peer: null,
        hostConnection: null,
        playerConnections: new Map(),
        currentQuiz: null,
        players: [],
        currentQuestion: 0,
        gamePin: null,
        playerName: null,
        answers: new Map(),
        scores: new Map(),
        timerInterval: null,
        timeLeft: 0
    };
    showScreen('home-screen');
}

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    loadQuizzes();

    // Home screen
    document.getElementById('host-btn').addEventListener('click', () => {
        showScreen('host-setup-screen');
    });

    document.getElementById('join-btn').addEventListener('click', () => {
        showScreen('join-screen');
    });

    // Host setup
    document.getElementById('start-hosting-btn').addEventListener('click', startHosting);
    document.getElementById('back-from-host-btn').addEventListener('click', () => showScreen('home-screen'));

    // Host lobby
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('cancel-host-btn').addEventListener('click', resetToHome);

    // Join screen
    document.getElementById('join-game-btn').addEventListener('click', joinGame);
    document.getElementById('back-from-join-btn').addEventListener('click', () => {
        showScreen('home-screen');
        document.getElementById('join-error').classList.remove('show');
    });

    // Player lobby
    document.getElementById('leave-lobby-btn').addEventListener('click', resetToHome);

    // Answer buttons
    document.querySelectorAll('#player-answers-grid .answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const answerIndex = parseInt(e.currentTarget.dataset.answer);
            submitAnswer(answerIndex);
        });
    });

    // Results screen
    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);

    // Final results
    document.getElementById('new-game-btn').addEventListener('click', resetToHome);
});
