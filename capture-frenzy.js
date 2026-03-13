const CaptureFrenzy = (() => {

    // Применяем тему как в основной игре
function applySavedTheme() {
    const saved = localStorage.getItem('user-theme');
    if (saved === 'light') {
        document.documentElement.classList.remove('dark-mode');
    } else {
        // По умолчанию тёмная
        document.documentElement.classList.add('dark-mode');
    }
}

applySavedTheme();



// ===== КОНСТАНТЫ =====
const PIECE_IMAGES = {
    'P': 'img/p/wP.svg', 'R': 'img/p/wR.svg', 'N': 'img/p/wN.svg',
    'B': 'img/p/wB.svg', 'Q': 'img/p/wQ.svg', 'K': 'img/p/wK.svg',
    'p': 'img/p/bP.svg', 'r': 'img/p/bR.svg', 'n': 'img/p/bN.svg',
    'b': 'img/p/bB.svg', 'q': 'img/p/bQ.svg', 'k': 'img/p/bK.svg'
};

const PIECE_VALUES = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 };

// Пул вражеских фигур по уровням сложности
const ENEMY_POOL_EASY =   ['n','b','n','b','p']; // пешка 1 из 5
const ENEMY_POOL_MEDIUM = ['n','b','r','n','b'];  // пешек нет
const ENEMY_POOL_HARD =   ['b','r','r','q','n'];  // пешек нет

// ===== СОСТОЯНИЕ ИГРЫ =====
let board = []; // 8x8 массив, '' = пусто, 'R'/'B' = игрок, 'p'/'n'/etc = враг
let playerPieces = []; // [{r, c, type}] — фигуры игрока
let enemyPieces = [];  // [{r, c, type, id}]
let selectedPiece = null; // {r, c} выбранная фигура игрока
let lives = 3;
let score = 0;
let bestScore = parseInt(localStorage.getItem('cf-best-score')) || 0;
let nextEnemyAt = 20; // очки до следующего врага
let playerBishopAdded = false; // слон добавлен после 50 очков
let isPlayerTurn = true;
let isAnimating = false;
let enemyIdCounter = 0;

const audioMove = new Audio('sounds/Move.ogg');
const audioCapture = new Audio('sounds/Capture.ogg');
const audioError = new Audio('sounds/Error.ogg');

function safePlaySound(audio) {
    const p = audio.play();
    if (p !== undefined) p.catch(() => {});
}

const boardEl = document.getElementById('cf-board');
const follower = document.getElementById('cf-drag-follower');

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function posToIdx(pos) {
    return { r: 8 - parseInt(pos[1]), c: pos.charCodeAt(0) - 97 };
}

function idxToPos(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
}

function isEnemy(piece) {
    return piece && piece === piece.toLowerCase() && piece !== '';
}

function isPlayer(piece) {
    return piece && piece === piece.toUpperCase() && piece !== '';
}

function getRandomEmptySquare(excludes = []) {
    const empty = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === '') {
                const excluded = excludes.some(e => e.r === r && e.c === c);
                if (!excluded) empty.push({r, c});
            }
        }
    }
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
}

function getEnemyPool() {
    if (score < 30) return ENEMY_POOL_EASY;
    if (score < 80) return ENEMY_POOL_MEDIUM;
    return ENEMY_POOL_HARD;
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function startGame() {

    // Заполняем профиль
if (typeof Platform !== 'undefined' && Platform.user) {
    document.getElementById('cf-user-name').textContent = Platform.user.first_name;
    if (Platform.user.photo_100) {
        document.getElementById('cf-user-avatar').src = Platform.user.photo_100;
    }
}
document.getElementById('cf-btn-again-cf').classList.add('hidden');
    board = Array(8).fill(null).map(() => Array(8).fill(''));
    playerPieces = [];
    enemyPieces = [];
    selectedPiece = null;
    lives = 3;
    score = 0;
    nextEnemyAt = 20;
    playerBishopAdded = false;
    isPlayerTurn = true;
    isAnimating = false;
    enemyIdCounter = 0;

    // Размещаем ладью игрока
    const pos1 = getRandomEmptySquare();
    board[pos1.r][pos1.c] = 'R';
    playerPieces.push({ r: pos1.r, c: pos1.c, type: 'R', id: 'p0' });

    // Размещаем 2 врагов
    spawnEnemy();
    spawnEnemy();
    // Стартовые враги могут ходить сразу
enemyPieces.forEach(e => e.justSpawned = false);

    updateUI();
    renderBoard();

    document.getElementById('cf-start-screen').style.display = 'none';
    document.getElementById('cf-game-screen').style.display = 'flex';
    document.getElementById('cf-gameover-screen').style.display = 'none';
}

function spawnEnemy(animate = false) {
    const pool = getEnemyPool();
    const type = pool[Math.floor(Math.random() * pool.length)];
    
    // Спавним подальше от игрока
    const playerPositions = playerPieces.map(p => ({r: p.r, c: p.c}));
    
    let attempts = 0;
    let pos;
    do {
        pos = getRandomEmptySquare();
        attempts++;
        if (!pos) return;
        // Стараемся не спавнить слишком близко к игроку
        const tooClose = playerPositions.some(p => 
            Math.abs(p.r - pos.r) < 2 && Math.abs(p.c - pos.c) < 2
        );
        if (!tooClose || attempts > 20) break;
    } while (attempts < 30);

    if (!pos) return;

    const id = 'e' + (enemyIdCounter++);

// Если пешка — не спавним на последней горизонтали (r=7)
let spawnPos = pos;
if (type === 'p') {
    let attempts2 = 0;
    do {
        spawnPos = getRandomEmptySquare();
        attempts2++;
        if (!spawnPos) return;
    } while (spawnPos.r === 7 && attempts2 < 20);
    
    // Если всё равно r=7 — меняем тип на коня
    if (spawnPos.r === 7) type = 'n';
    pos = spawnPos;
}


    board[pos.r][pos.c] = type;
    enemyPieces.push({ r: pos.r, c: pos.c, type, id, justSpawned: true });

    if (animate) {
        // Помечаем для анимации появления
        setTimeout(() => {
            const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
            const pieceEl = sq?.querySelector('.piece');
            if (pieceEl) pieceEl.classList.add('spawning');
        }, 50);
    }
}

// ===== РЕНДЕР =====
function renderBoard() {
    boardEl.innerHTML = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            sq.dataset.r = r;
            sq.dataset.c = c;

            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                sq.classList.add('selected');
            }

            const piece = board[r][c];
            if (piece) {
                const pEl = document.createElement('div');
                pEl.className = 'piece' + (isPlayer(piece) ? ' player-piece' : '');
                pEl.style.backgroundImage = `url('${PIECE_IMAGES[piece]}')`;
                sq.appendChild(pEl);
            }

            sq.onmousedown = sq.ontouchstart = (e) => handleSquareClick(e, r, c);
            boardEl.appendChild(sq);
        }
    }

    // Показываем подсказки ходов
    if (selectedPiece) {
        showMoveHints(selectedPiece.r, selectedPiece.c);
    }

    updateEnemyThreats();
}

function updateEnemyThreats() {
    // Подсвечиваем клетки под угрозой врагов
    for (const enemy of enemyPieces) {
        const moves = getEnemyMoves(enemy.r, enemy.c, enemy.type);
        for (const move of moves) {
            const sq = document.querySelector(`[data-r="${move.r}"][data-c="${move.c}"]`);
            if (sq && isPlayer(board[move.r][move.c])) {
                sq.classList.add('enemy-threat');
            }
        }
    }
}

function showMoveHints(r, c) {
    const moves = getPlayerMoves(r, c);
    for (const move of moves) {
        const sq = document.querySelector(`[data-r="${move.r}"][data-c="${move.c}"]`);
        if (sq) {
            const h = document.createElement('div');
            h.className = board[move.r][move.c] ? 'hint-ring' : 'hint-dot';
            sq.appendChild(h);
        }
    }
}

// ===== ЛОГИКА ХОДОВ =====
function getPlayerMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    return getAllMoves(r, c, piece, true);
}

function getEnemyMoves(r, c, type) {
    return getAllMoves(r, c, type, false);
}

function getAllMoves(r, c, piece, isPlayerPiece) {
    const moves = [];
    const p = piece.toLowerCase();

    const canMoveTo = (tr, tc) => {
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
        const target = board[tr][tc];
        if (isPlayerPiece) {
            return target === '' || isEnemy(target);
        } else {
            return target === '' || isPlayer(target);
        }
    };

    const addSliding = (dirs) => {
        for (const [dr, dc] of dirs) {
            let tr = r + dr, tc = c + dc;
            while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                const target = board[tr][tc];
                if (isPlayerPiece) {
                    if (isPlayer(target)) break;
                    moves.push({r: tr, c: tc});
                    if (isEnemy(target)) break;
                } else {
                    if (isEnemy(target)) break;
                    moves.push({r: tr, c: tc});
                    if (isPlayer(target)) break;
                }
                tr += dr; tc += dc;
            }
        }
    };

    switch(p) {
        case 'r':
            addSliding([[0,1],[0,-1],[1,0],[-1,0]]);
            break;
        case 'b':
            addSliding([[1,1],[1,-1],[-1,1],[-1,-1]]);
            break;
        case 'q':
            addSliding([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
            break;
        case 'n':
            for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                const tr = r + dr, tc = c + dc;
                if (canMoveTo(tr, tc)) moves.push({r: tr, c: tc});
            }
            break;
        case 'p':
            // Враг-пешка ходит вниз (увеличение r)
            if (!isPlayerPiece) {
                if (r + 1 < 8 && board[r+1][c] === '') moves.push({r: r+1, c});
                for (const dc of [-1, 1]) {
                    if (r+1 < 8 && c+dc >= 0 && c+dc < 8 && isPlayer(board[r+1][c+dc])) {
                        moves.push({r: r+1, c: c+dc});
                    }
                }
            }
            break;
    }

    return moves;
}

// ===== ОБРАБОТКА КЛИКОВ =====
let lastTouchTime = 0;
let lastTouchDeselect = 0;

function handleSquareClick(e, r, c) {
    if (e.type === 'mousedown' && Date.now() - lastTouchTime < 500) return;
    if (e.type === 'touchstart') lastTouchTime = Date.now();
    if (e.cancelable) e.preventDefault();
    if (!isPlayerTurn || isAnimating) return;

    const piece = board[r][c];

    // Если уже выбрана фигура и кликнули на допустимую клетку
    if (selectedPiece && !isPlayer(piece)) {
        const moves = getPlayerMoves(selectedPiece.r, selectedPiece.c);
        const isValid = moves.some(m => m.r === r && m.c === c);
        if (isValid) {
            executePlayerMove(selectedPiece.r, selectedPiece.c, r, c);
            selectedPiece = null;
            return;
        }
    }

    if (!isPlayer(piece)) {
        if (selectedPiece) { selectedPiece = null; renderBoard(); }
        return;
    }

    // Повторный клик — снимаем выделение
    if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
        if (e.type === 'touchstart') lastTouchDeselect = Date.now();
        selectedPiece = null;
        renderBoard();
        return;
    }

    if (e.type === 'mousedown' && Date.now() - lastTouchDeselect < 500) return;

    selectedPiece = { r, c };
    renderBoard();

    // --- ПЕРЕТАСКИВАНИЕ ---
    const currentSqEl = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    const rect = currentSqEl.getBoundingClientRect();
    const squareSize = rect.width;
    const isPortrait = window.innerHeight > window.innerWidth;
    const scale = isPortrait ? 1.6 : 1.0;

    follower.style.width = (squareSize * scale) + 'px';
    follower.style.height = (squareSize * scale) + 'px';
    follower.style.backgroundImage = `url('${PIECE_IMAGES[piece]}')`;
    follower.style.display = 'block';

    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateFollower(clientX, clientY);

    const pInBoard = currentSqEl.querySelector('.piece');
    if (pInBoard) pInBoard.style.opacity = '0.4';

    let isDragging = false;
    const startR = r, startC = c;

    const onMove = (me) => {
        if (me.cancelable) me.preventDefault();
        isDragging = true;
        clientX = me.touches ? me.touches[0].clientX : me.clientX;
        clientY = me.touches ? me.touches[0].clientY : me.clientY;
        updateFollower(clientX, clientY);
    };

    const onEnd = (ue) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove, { passive: false });
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);

        follower.style.display = 'none';
        if (pInBoard) pInBoard.style.opacity = '1';

        let ux = clientX, uy = clientY;
        if (ue && ue.changedTouches && ue.changedTouches.length > 0) {
            ux = ue.changedTouches[0].clientX;
            uy = ue.changedTouches[0].clientY;
        }

        const target = document.elementFromPoint(ux, uy)?.closest('.square');

        if (target) {
            const tr = parseInt(target.dataset.r);
            const tc = parseInt(target.dataset.c);

            if (tr === startR && tc === startC) {
                renderBoard();
                return;
            }

            const moves = getPlayerMoves(startR, startC);
            const isValid = moves.some(m => m.r === tr && m.c === tc);
            if (isValid) {
                executePlayerMove(startR, startC, tr, tc, true); // true = drag
                selectedPiece = null;
                return;
            }
        }

        if (isDragging) selectedPiece = null;
        renderBoard();
    };

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
}

function updateFollower(x, y) {
    follower.style.left = x + 'px';
    follower.style.top = y + 'px';
}
// ===== ХОД ИГРОКА =====
function executePlayerMove(fr, fc, tr, tc, isDrag = false) {
    isAnimating = true;
    isPlayerTurn = false;
    updateTurnIndicator(false);

    const piece = board[fr][fc];
    const capturedPiece = board[tr][tc];

        if (capturedPiece && isEnemy(capturedPiece)) {
        safePlaySound(audioCapture);
    } else {
        safePlaySound(audioMove);
    }

    const fromSq = document.querySelector(`[data-r="${fr}"][data-c="${fc}"]`);
    const toSq = document.querySelector(`[data-r="${tr}"][data-c="${tc}"]`);
    const pieceEl = fromSq?.querySelector('.piece');
    const tR = toSq ? toSq.getBoundingClientRect() : null;

    // Анимация только если НЕ перетаскивание
    if (!isDrag && pieceEl && toSq) {
        const fR = fromSq.getBoundingClientRect();
        pieceEl.style.transition = 'transform 0.2s ease-in-out';
        pieceEl.style.transform = `translate(${tR.left - fR.left}px, ${tR.top - fR.top}px)`;
    }

    const delay = isDrag ? 0 : 220;

    setTimeout(() => {
        board[tr][tc] = piece;
        board[fr][fc] = '';

        const pp = playerPieces.find(p => p.r === fr && p.c === fc);
        if (pp) { pp.r = tr; pp.c = tc; }

if (capturedPiece && isEnemy(capturedPiece)) {
    const points = PIECE_VALUES[capturedPiece] || 1;
    addScore(points, tR);
    enemyPieces = enemyPieces.filter(e => !(e.r === tr && e.c === tc));
    
    setTimeout(() => { 
        spawnEnemy(true); 
        renderBoard();
        // Даём больше времени новой фигуре появиться перед ходом
        setTimeout(() => { executeEnemyMove(); }, 600);
    }, 300);
    
    renderBoard();
    checkMilestones();
    return; // Выходим — executeEnemyMove вызовется внутри
}

renderBoard();
checkMilestones();
setTimeout(() => { executeEnemyMove(); }, 400);

    }, delay);
}

// ===== ОЧКИ =====
function addScore(points, rect) {
    score += points;
    
    // Анимация очков
    if (rect) {
        const el = document.createElement('div');
        el.className = 'score-float';
        el.textContent = '+' + points;
        el.style.left = rect.left + rect.width/2 + 'px';
        el.style.top = rect.top + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    updateUI();
}

function checkMilestones() {
    // Добавляем слона после 50 очков
    if (score >= 50 && !playerBishopAdded) {
        playerBishopAdded = true;
        const pos = getRandomEmptySquare();
        if (pos) {
            board[pos.r][pos.c] = 'B';
            playerPieces.push({ r: pos.r, c: pos.c, type: 'B', id: 'p1' });
            
            setTimeout(() => {
                const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
                const pieceEl = sq?.querySelector('.piece');
                if (pieceEl) pieceEl.classList.add('spawning');
            }, 50);

            showFloatingText('+ Слон!', '#769656');
        }
    }

    // Новый враг каждые 20 очков
    if (score >= nextEnemyAt) {
        nextEnemyAt += 20;
        spawnEnemy(true);
        renderBoard();
    }
}

function showFloatingText(text, color) {
    const el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = '18px';
    el.style.left = '50%';
    el.style.top = '40%';
    el.style.transform = 'translateX(-50%)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ===== ХОД ВРАГОВ =====
function executeEnemyMove() {
    // Защитный таймаут — если что-то пошло не так, возвращаем ход игроку
    const safetyTimeout = setTimeout(() => {
        console.warn('Safety timeout triggered');
        isAnimating = false;
        isPlayerTurn = true;
        updateTurnIndicator(true);
        renderBoard();
    }, 1000);

    if (enemyPieces.length === 0) {
        clearTimeout(safetyTimeout);
        isAnimating = false;
        isPlayerTurn = true;
        updateTurnIndicator(true);
        return;
    }

const shuffled = [...enemyPieces].sort(() => Math.random() - 0.5);
let enemy = null;
let moves = [];

// Первый проход — ищем не justSpawned
for (const candidate of shuffled) {
    if (candidate.justSpawned) {
        candidate.justSpawned = false;
        continue;
    }
    const candidateMoves = getEnemyMoves(candidate.r, candidate.c, candidate.type);
    if (candidateMoves.length > 0) {
        enemy = candidate;
        moves = candidateMoves;
        break;
    }
}

// Второй проход — если все были justSpawned, берём любого у кого есть ходы
if (!enemy) {
    for (const candidate of shuffled) {
        const candidateMoves = getEnemyMoves(candidate.r, candidate.c, candidate.type);
        if (candidateMoves.length > 0) {
            enemy = candidate;
            moves = candidateMoves;
            break;
        }
    }
}

console.log('выбран враг:', enemy?.type, 'ходов:', moves.length);

// Если все justSpawned или никто не может ходить — просто возвращаем ход
if (!enemy) {
    clearTimeout(safetyTimeout);
    isAnimating = false;
    isPlayerTurn = true;
    updateTurnIndicator(true);
    return;
}

if (!enemy) {
    clearTimeout(safetyTimeout);
    isAnimating = false;
    isPlayerTurn = true;
    updateTurnIndicator(true);
    return;
}

    let targetMove;
    if (Math.random() < 0.65 && playerPieces.length > 0) {
        let bestDist = Infinity;
        let targetPlayer = playerPieces[0];
        for (const pp of playerPieces) {
            const dist = Math.abs(pp.r - enemy.r) + Math.abs(pp.c - enemy.c);
            if (dist < bestDist) { bestDist = dist; targetPlayer = pp; }
        }
        let minDist = Infinity;
        for (const move of moves) {
            const dist = Math.abs(move.r - targetPlayer.r) + Math.abs(move.c - targetPlayer.c);
            if (dist < minDist) { minDist = dist; targetMove = move; }
        }
    } else {
        targetMove = moves[Math.floor(Math.random() * moves.length)];
    }

    // Берём rect ДО любых изменений
    const fromSq = document.querySelector(`[data-r="${enemy.r}"][data-c="${enemy.c}"]`);
    const toSq = document.querySelector(`[data-r="${targetMove.r}"][data-c="${targetMove.c}"]`);
    const pieceEl = fromSq?.querySelector('.piece');
    if (pieceEl) {
    pieceEl.classList.remove('spawning');
    pieceEl.style.animation = 'none';
}

    if (!pieceEl || !toSq) {
        // Если DOM не готов — просто обновляем состояние без анимации
        board[targetMove.r][targetMove.c] = enemy.type;
        board[enemy.r][enemy.c] = '';
        enemy.r = targetMove.r;
        enemy.c = targetMove.c;
        renderBoard();
        isAnimating = false;
        isPlayerTurn = true;
        updateTurnIndicator(true);
        return;
    }

    const fR = fromSq.getBoundingClientRect();
    const tR = toSq.getBoundingClientRect();
if (board[targetMove.r][targetMove.c] && isPlayer(board[targetMove.r][targetMove.c])) {
    safePlaySound(audioCapture);
} else {
    safePlaySound(audioMove);
}
    // Запускаем анимацию
    pieceEl.style.transition = 'transform 0.2s ease-in-out';
    pieceEl.style.transform = `translate(${tR.left - fR.left}px, ${tR.top - fR.top}px)`;

    setTimeout(() => {
        clearTimeout(safetyTimeout);
        const capturedPiece = board[targetMove.r][targetMove.c];

        board[targetMove.r][targetMove.c] = enemy.type;
        board[enemy.r][enemy.c] = '';
        enemy.r = targetMove.r;
        enemy.c = targetMove.c;

        if (enemy.type === 'p' && targetMove.r === 7) {
            enemy.type = 'q';
            board[targetMove.r][targetMove.c] = 'q';
            showFloatingText('Пешка → Ферзь!', '#ef4444');
        }

        if (capturedPiece && isPlayer(capturedPiece)) {
            loseLife(capturedPiece, targetMove.r, targetMove.c);
        } else {
            renderBoard();
            isAnimating = false;
            isPlayerTurn = true;
            updateTurnIndicator(true);
        }
    }, 220);
}
// ===== ПОТЕРЯ ЖИЗНИ =====
function loseLife(capturedPiece, r, c) {
    lives--;
    safePlaySound(audioError);
    updateUI();

    // Тряска
    document.getElementById('cf-board').classList.add('shake');
    setTimeout(() => document.getElementById('cf-board').classList.remove('shake'), 400);

    if (lives <= 0) {
        setTimeout(() => gameOver(), 500);
        return;
    }

    // Убираем съеденную фигуру из playerPieces
    playerPieces = playerPieces.filter(p => !(p.r === r && p.c === r));
    // Точнее:
    const idx = playerPieces.findIndex(p => p.r === r && p.c === c);
    if (idx !== -1) playerPieces.splice(idx, 1);

    // Респаун фигуры игрока
    setTimeout(() => {
        const pos = getRandomEmptySquare();
        if (pos) {
            board[pos.r][pos.c] = capturedPiece;
            playerPieces.push({ r: pos.r, c: pos.c, type: capturedPiece, id: 'p_resp_' + Date.now() });
            
            renderBoard();
            
            setTimeout(() => {
                const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
                const pieceEl = sq?.querySelector('.piece');
                if (pieceEl) pieceEl.classList.add('spawning');
            }, 50);
        }

        isAnimating = false;
        isPlayerTurn = true;
        updateTurnIndicator(true);
    }, 300);

    renderBoard();
}

// ===== UI =====
function updateUI() {
    document.getElementById('cf-score-val').textContent = score;
    document.getElementById('cf-best-score').textContent = bestScore;

    // Жизни
    const livesEls = document.querySelectorAll('#cf-lives-display .life');
    livesEls.forEach((el, i) => {
        el.classList.toggle('lost', i >= lives);
    });
}

function updateTurnIndicator(isPlayer) {
    const el = document.getElementById('turn-indicator');
    el.textContent = isPlayer ? 'Твой ход' : 'Ход врага...';
    el.className = 'turn-indicator' + (isPlayer ? ' your-turn' : '');
}

// ===== GAME OVER =====
function gameOver() {
    if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('cf-best-score', bestScore);
}
    document.getElementById('cf-best-score').textContent = bestScore;
    document.getElementById('cf-btn-again-cf').classList.remove('hidden');
    document.getElementById('cf-gameover-screen').style.display = 'flex';
}

    function showStart() { 
        document.getElementById('cf-start-screen').style.display = 'none';
        document.getElementById('cf-game-screen').style.display = 'none';
        goHome();
    }

function goHome() {
    // Возврат в основное меню — адаптируй под свою логику
    window.location.href = 'index.html';
}


    return {
    showStart: () => {
        document.getElementById('cf-start-screen').style.display = 'flex';
    },
    startGame,
    goBack,
    showStart,
    openFrenzyLeaderboard
};
})();