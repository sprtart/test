console.log('capture-frenzy.js загружен');

const CaptureFrenzy = (() => {
    // ===== БЕЗОПАСНОЕ УПРАВЛЕНИЕ ЭЛЕМЕНТАМИ =====
    function safeShow(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); el.style.setProperty('display', 'flex', 'important'); }
    }
    function safeHide(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.style.setProperty('display', 'none', 'important'); }
    }
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ===== КОНСТАНТЫ =====
    const PIECE_IMAGES = {
        'P': 'img/p/wP.svg', 'R': 'img/p/wR.svg', 'N': 'img/p/wN.svg',
        'B': 'img/p/wB.svg', 'Q': 'img/p/wQ.svg', 'K': 'img/p/wK.svg',
        'p': 'img/p/bP.svg', 'r': 'img/p/bR.svg', 'n': 'img/p/bN.svg',
        'b': 'img/p/bB.svg', 'q': 'img/p/bQ.svg', 'k': 'img/p/bK.svg'
    };
    const PIECE_VALUES = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 };
    const ENEMY_POOL_EASY = ['n','b','n','b','p']; 
    const ENEMY_POOL_MEDIUM = ['n','b','r','n','b'];  
    const ENEMY_POOL_HARD = ['b','r','r','q','n'];  

    // ===== СОСТОЯНИЕ ИГРЫ =====
    let board = []; 
    let playerPieces =[]; 
    let enemyPieces =[];  
    let selectedPiece = null; 
    let lives = 3;
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('cf-best-score')) || 0;
    let nextEnemyAt = 20; 
    let playerBishopAdded = false; 
    let isPlayerTurn = true;
    let isAnimating = false;
    let enemyIdCounter = 0;

    // Звуки
    const audioMove = new Audio('sounds/Move.ogg');
    const audioCapture = new Audio('sounds/Capture.ogg');
    const audioError = new Audio('sounds/Error.ogg');

    function safePlaySound(audio) {
        if (typeof isSoundEnabled !== 'undefined' && !isSoundEnabled) return;
        const p = audio.play();
        if (p !== undefined) p.catch(() => {});
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    function isEnemy(piece) { return piece && piece === piece.toLowerCase(); }
    function isPlayer(piece) { return piece && piece === piece.toUpperCase(); }
    
    function getRandomEmptySquare(excludes = []) {
        const empty =[];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === '') {
                    const excluded = excludes.some(e => e.r === r && e.c === c);
                    if (!excluded) empty.push({r, c});
                }
            }
        }
        return empty.length > 0 ? empty[Math.floor(Math.random() * empty.length)] : null;
    }

    function getEnemyPool() {
        if (score < 30) return ENEMY_POOL_EASY;
        if (score < 80) return ENEMY_POOL_MEDIUM;
        return ENEMY_POOL_HARD;
    }

    // ===== ИНТЕРФЕЙС =====
    function setFrenzyUI(active) {
        const gameContainer = document.querySelector('.game-container');
        const mainMenu = document.getElementById('main-menu');
        const hintBtn = document.getElementById('hint-btn');
        const topBtn = document.querySelector('.top-btn');

if (active) {
    if (gameContainer) gameContainer.classList.remove('hidden-game');
    if (mainMenu) mainMenu.classList.add('hidden');
    
    setText('label-score', 'Очки');

    // Прячем карточку Эло и кнопки
    const eloCard = document.querySelector('.top-bar .stat-card:first-child');
    if (eloCard) eloCard.style.display = 'none';
    if (hintBtn) hintBtn.style.display = 'none';
    if (topBtn) topBtn.style.display = 'none';

    // Показываем жизни в строке кнопок
    let livesEl = document.getElementById('cf-lives-bar');
    if (!livesEl) {
        livesEl = document.createElement('div');
        livesEl.id = 'cf-lives-bar';
        livesEl.style.cssText = 'font-size:7vw; letter-spacing:2px; display:flex; align-items:center;';
        document.querySelector('.bottom-bar').appendChild(livesEl);
    }
    livesEl.style.display = 'flex';

    if (topBtn) topBtn.onclick = CaptureFrenzy.openFrenzyLeaderboard;
} else {
    if (gameContainer) gameContainer.classList.add('hidden-game');
    if (mainMenu) mainMenu.classList.remove('hidden');
    
    setText('label-rating', typeof i18n !== 'undefined' && i18n[lang]?.rating ? i18n[lang].rating : 'Рейтинг');
    setText('label-best-elo', typeof i18n !== 'undefined' && i18n[lang]?.bestElo ? i18n[lang].bestElo : 'макс. Эло');
    setText('label-score', typeof i18n !== 'undefined' && i18n[lang]?.score ? i18n[lang].score : 'Очки');
    
    // Возвращаем карточку Эло
    const eloCard = document.querySelector('.top-bar .stat-card:first-child');
    if (eloCard) eloCard.style.display = '';

    if (hintBtn) hintBtn.style.display = '';
    if (topBtn) { topBtn.style.display = ''; }
    if (topBtn && typeof openLeaderboard === 'function') topBtn.onclick = openLeaderboard;

    // Прячем жизни
    const livesEl = document.getElementById('cf-lives-bar');
    if (livesEl) livesEl.style.display = 'none';
}
    }

function updateUI() {
    setText('score-display', score);
    setText('user-max-rating', bestScore);
    
    const eloDisp = document.getElementById('puzzle-elo');
    if (eloDisp) {
        eloDisp.textContent = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
    }

    // Обновляем жизни в нижней панели
    const livesEl = document.getElementById('cf-lives-bar');
    if (livesEl) {
        livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    }
}

    // ===== ИНИЦИАЛИЗАЦИЯ ИГРЫ =====
function startGame() {
    try {
        console.log("Старт игры...");

        // 1. Прячем меню
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.add('hidden');

        // 2. ИСПРАВЛЕНИЕ: Убираем только инлайновый style="display: none"
        const gameContainer = document.querySelector('.game-container');
        gameContainer.style.display = 'flex';
            const boardEl = document.getElementById('board');
    boardEl.innerHTML = ''; // Очистить доску перед отрисовкой
        if (gameContainer) {
            gameContainer.classList.remove('hidden-game');
            // Удаляем только инлайновое свойство, оставляя CSS-классы в покое
            gameContainer.style.removeProperty('display');
        }

        // 3. Прячем стартовое окно Охоты
        const startScreen = document.getElementById('cf-start-screen');
        if (startScreen) {
            startScreen.style.setProperty('display', 'none', 'important');
        }

        // 4. Очистка состояния игры
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

        // 5. Размещение ладьи
        const pos1 = getRandomEmptySquare();
        if (pos1) {
            board[pos1.r][pos1.c] = 'R';
            playerPieces.push({ r: pos1.r, c: pos1.c, type: 'R', id: 'p0' });
        }

        spawnEnemy();
        spawnEnemy();
        enemyPieces.forEach(e => e.justSpawned = false);

        // 6. Отрисовка
        updateUI();
        renderBoard();
        
        console.log("Игра успешно отрисована");
        
    } catch (err) {
        console.error("ОШИБКА В STARTGAME:", err);
    }
}

function spawnEnemy(animate = false) {
        // 1. Берем базовый пул в зависимости от сложности (очков)
        const basePool = getEnemyPool();

        // 2. Считаем, какие враги УЖЕ есть на доске
        const counts = { 'p': 0, 'n': 0, 'b': 0, 'r': 0, 'q': 0 };
        enemyPieces.forEach(e => counts[e.type] = (counts[e.type] || 0) + 1);

        // 3. Устанавливаем ЛИМИТЫ (чтобы фигуры не дублировались сверх меры)
        const limits = {
            'p': 2,
            'n': 1, // Максимум 1 конь
            'b': 1, // Максимум 1 слон
            'r': 1,
            'q': 1
        };

        // 4. Оставляем в корзине (пуле) только те фигуры, которые не превысили лимит
        let availablePool = basePool.filter(type => counts[type] < limits[type]);

        // Подстраховка: если вдруг всё заблокировалось, откатываемся к базовому пулу
        if (availablePool.length === 0) {
            // Берём тип которого меньше всего на доске
            const minCount = Math.min(...basePool.map(t => counts[t] || 0));
            availablePool = basePool.filter(t => (counts[t] || 0) === minCount);
        }

        // 5. Выбираем случайную фигуру уже из отфильтрованного списка
        const type = availablePool[Math.floor(Math.random() * availablePool.length)];
        
        // --- ДАЛЬШЕ ИДЕТ СТАНДАРТНАЯ ЛОГИКА ПОЗИЦИОНИРОВАНИЯ ---
        const playerPositions = playerPieces.map(p => ({r: p.r, c: p.c}));
        
        let attempts = 0, pos;
        do {
            pos = getRandomEmptySquare();
            attempts++;
            if (!pos) return; // Нет свободных клеток
            
            // Враги не должны спавниться вплотную к игроку
            const tooClose = playerPositions.some(p => Math.abs(p.r - pos.r) < 2 && Math.abs(p.c - pos.c) < 2);
            if (!tooClose || attempts > 20) break;
        } while (attempts < 30);

        if (!pos) return;

        let spawnPos = pos, finalType = type;
        
        // Пешки не должны спавниться на последней горизонтали (иначе сразу станут ферзями)
        if (type === 'p') {
            let attempts2 = 0;
            do {
                spawnPos = getRandomEmptySquare();
                attempts2++;
                if (!spawnPos) return;
            } while (spawnPos.r === 7 && attempts2 < 20);
            
            // Если так и не нашли нормальное место для пешки, превращаем её в коня
            if (spawnPos.r === 7) finalType = 'n';
            pos = spawnPos;
        }

        // Ставим врага на доску
        board[pos.r][pos.c] = finalType;
        enemyPieces.push({ r: pos.r, c: pos.c, type: finalType, id: 'e' + (enemyIdCounter++), justSpawned: true });

        // Анимация появления
        if (animate) {
            setTimeout(() => {
                const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
                const pieceEl = sq?.querySelector('.piece');
                if (pieceEl) pieceEl.classList.add('spawning');
            }, 50);
        }
    }

    // ===== РЕНДЕР =====
function renderBoard() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;

        // ВАЖНО: Очищаем DOM полностью
        boardEl.innerHTML = '';
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement('div');
                sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                sq.dataset.r = r;
                sq.dataset.c = c;
                
                // === НОВОЕ: Восстанавливаем желтое выделение, если фигура выбрана ===
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                    sq.classList.add('selected');
                }

                if (board[r] && board[r][c] !== '') {
                    const pEl = document.createElement('div');
                    pEl.className = 'piece' + (isPlayer(board[r][c]) ? ' player-piece' : '');
                    pEl.style.backgroundImage = `url('${PIECE_IMAGES[board[r][c]]}')`;
                    sq.appendChild(pEl);
                }

                sq.onmousedown = sq.ontouchstart = (e) => handleSquareClick(e, r, c);
                boardEl.appendChild(sq);
            }
        }
        
        // === НОВОЕ: Восстанавливаем точки возможных ходов ===
        if (selectedPiece) {
            showMoveHints(selectedPiece.r, selectedPiece.c);
        }
    }

    function updateEnemyThreats() {
        for (const enemy of enemyPieces) {
            const moves = getEnemyMoves(enemy.r, enemy.c, enemy.type);
            for (const move of moves) {
                const sq = document.querySelector(`[data-r="${move.r}"][data-c="${move.c}"]`);
                if (sq && isPlayer(board[move.r][move.c])) sq.classList.add('enemy-threat');
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
        if (!piece) return[];
        return getAllMoves(r, c, piece, true);
    }

    function getEnemyMoves(r, c, type) {
        return getAllMoves(r, c, type, false);
    }

    function getAllMoves(r, c, piece, isPlayerPiece) {
        const moves =[];
        const p = piece.toLowerCase();
        const canMoveTo = (tr, tc) => {
            if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
            const target = board[tr][tc];
            if (isPlayerPiece) return target === '' || isEnemy(target);
            return target === '' || isPlayer(target);
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
            case 'r': addSliding([[0,1],[0,-1],[1,0],[-1,0]]); break;
            case 'b': addSliding([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
            case 'q': addSliding([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
            case 'n':
                for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                    const tr = r + dr, tc = c + dc;
                    if (canMoveTo(tr, tc)) moves.push({r: tr, c: tc});
                }
                break;
            case 'p':
                if (!isPlayerPiece) {
                    if (r + 1 < 8 && board[r+1][c] === '') moves.push({r: r+1, c});
                    for (const dc of[-1, 1]) {
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
    let lastTouchTime = 0, lastTouchDeselect = 0;

function handleSquareClick(e, r, c) {
        if (e.type === 'mousedown' && Date.now() - lastTouchTime < 500) return;
        if (e.type === 'touchstart') lastTouchTime = Date.now();
        if (e.cancelable) e.preventDefault();
        if (!isPlayerTurn || isAnimating) return;

        const piece = board[r][c];

        // 1. КЛИК НА ЦЕЛЬ: Если фигура уже выбрана, и мы кликаем куда сходить
        if (selectedPiece && !isPlayer(piece)) {
            const moves = getPlayerMoves(selectedPiece.r, selectedPiece.c);
            if (moves.some(m => m.r === r && m.c === c)) {
                executePlayerMove(selectedPiece.r, selectedPiece.c, r, c);
                selectedPiece = null;
                return;
            }
        }

        // 2. Клик на пустую/вражескую клетку (мимо хода) - снимаем выделение
        if (!isPlayer(piece)) {
            if (selectedPiece) { selectedPiece = null; renderBoard(); }
            return;
        }

        // 3. Снятие выделения (клик на ту же самую фигуру повторно)
        if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
            if (e.type === 'touchstart') lastTouchDeselect = Date.now();
            selectedPiece = null;
            renderBoard();
            return;
        }

        if (e.type === 'mousedown' && Date.now() - lastTouchDeselect < 500) return;

        // 4. ВЫБОР ФИГУРЫ
        selectedPiece = { r, c };

        const currentSqEl = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        const follower = document.getElementById('drag-follower');
        if (!currentSqEl || !follower) return;

        // Визуально очищаем прошлые подсказки и рисуем новые (без перерисовки всей доски!)
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.hint-dot, .hint-ring').forEach(el => el.remove());
        currentSqEl.classList.add('selected'); // Желтый фон выделения
        showMoveHints(r, c); // Точки куда можно ходить

        // Настройка копии фигуры для перетаскивания
        const rect = currentSqEl.getBoundingClientRect();
        follower.style.width = (rect.width * (window.innerHeight > window.innerWidth ? 1.6 : 1.0)) + 'px';
        follower.style.height = follower.style.width;
        follower.style.backgroundImage = `url('${PIECE_IMAGES[piece]}')`;
        follower.style.display = 'block';

        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        updateFollower(follower, clientX, clientY);

        const pInBoard = currentSqEl.querySelector('.piece');
        if (pInBoard) pInBoard.style.opacity = '0.4';

        let isDragging = false, startR = r, startC = c;

        const onMove = (me) => {
            if (me.cancelable) me.preventDefault();
            isDragging = true;
            clientX = me.touches ? me.touches[0].clientX : me.clientX;
            clientY = me.touches ? me.touches[0].clientY : me.clientY;
            updateFollower(follower, clientX, clientY);
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
                const tr = parseInt(target.dataset.r), tc = parseInt(target.dataset.c);
                if (tr === startR && tc === startC) { 
                    // === ИСПРАВЛЕНИЕ ===
                    // Это был просто КЛИК (тап) без перетаскивания. 
                    // Ничего не перерисовываем, точки уже есть! Просто выходим.
                    return; 
                }
                // Если успешно перетащили:
                if (getPlayerMoves(startR, startC).some(m => m.r === tr && m.c === tc)) {
                    executePlayerMove(startR, startC, tr, tc, true);
                    selectedPiece = null;
                    return;
                }
            }

            // Если перетащили "в молоко" (за пределы доски или на неверную клетку):
            if (isDragging) {
                selectedPiece = null;
                renderBoard();
            }
        };

        document.addEventListener('mousemove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
    }

    function updateFollower(foll, x, y) {
        if (foll) { foll.style.left = x + 'px'; foll.style.top = y + 'px'; }
    }

    // ===== ХОД ИГРОКА =====
function executePlayerMove(fr, fc, tr, tc, isDrag = false) {
        isAnimating = true;
        isPlayerTurn = false;

        const piece = board[fr][fc];
        const capturedPiece = board[tr][tc];

        if (capturedPiece && isEnemy(capturedPiece)) safePlaySound(audioCapture);
        else safePlaySound(audioMove);

        const fromSq = document.querySelector(`[data-r="${fr}"][data-c="${fc}"]`);
        const toSq = document.querySelector(`[data-r="${tr}"][data-c="${tc}"]`);
        const pieceEl = fromSq?.querySelector('.piece');
        const tR = toSq ? toSq.getBoundingClientRect() : null;

        if (!isDrag && pieceEl && toSq) {
            const fR = fromSq.getBoundingClientRect();
            pieceEl.style.transition = 'transform 0.2s ease-in-out';
            pieceEl.style.transform = `translate(${tR.left - fR.left}px, ${tR.top - fR.top}px)`;
        }

        setTimeout(() => {
            board[tr][tc] = piece;
            board[fr][fc] = '';

            const pp = playerPieces.find(p => p.r === fr && p.c === fc);
            if (pp) { pp.r = tr; pp.c = tc; }

            // Если съели врага
            if (capturedPiece && isEnemy(capturedPiece)) {
                addScore(PIECE_VALUES[capturedPiece] || 1, tR);
                enemyPieces = enemyPieces.filter(e => !(e.r === tr && e.c === tc));
                
                // Рендерим доску без съеденной фигуры
                renderBoard();
                checkMilestones();

                // Ждем немного перед тем, как спавнить нового и отдавать ход
                setTimeout(() => {
                    spawnEnemy(true); 
                    renderBoard();
                    
                    // Теперь, когда все анимации спавна завершены, отдаем ход врагу
                    setTimeout(() => { executeEnemyMove(); }, 400);
                }, 300);
            } else {
                // Если просто походили (без взятия)
                renderBoard();
                checkMilestones();
                setTimeout(() => { executeEnemyMove(); }, 400);
            }
        }, isDrag ? 0 : 220);
    }
    // ===== ОЧКИ =====
    function addScore(points, rect) {
        score += points;
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
        // Выдача Слона на 50 очках
        if (score >= 50 && !playerBishopAdded) {
            playerBishopAdded = true;
            const pos = getRandomEmptySquare();
            if (pos) {
                board[pos.r][pos.c] = 'B';
                playerPieces.push({ r: pos.r, c: pos.c, type: 'B', id: 'p1' });
                setTimeout(() => {
                    const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
                    if (sq?.querySelector('.piece')) sq.querySelector('.piece').classList.add('spawning');
                }, 50);
                showFloatingText('+ Слон!', '#769656');
            }
        }

        // Спавн новых врагов по мере роста очков
        if (score >= nextEnemyAt) {
            nextEnemyAt += 20; // Следующий спавн еще через 20 очков
            
            // ЛИМИТ: Максимум 7 врагов на доске одновременно!
            // Иначе доска переполнится и игра зависнет
            if (enemyPieces.length < 7) {
                spawnEnemy(true);
            }
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
// ===== ХОД ВРАГОВ =====
    function executeEnemyMove() {
        enemyPieces.forEach(e => e.justSpawned = false);
        const safetyTimeout = setTimeout(() => {
            isAnimating = false;
            isPlayerTurn = true;
            renderBoard();
        }, 1000);

        if (enemyPieces.length === 0) {
            clearTimeout(safetyTimeout);
            isAnimating = false;
            isPlayerTurn = true;
            return;
        }

        let enemy = null;
        let targetMove = null;

        // ШАГ 1: ПРОВЕРКА НА УБИЙСТВО (Инстинкт хищника)
        // Проверяем всех врагов - может ли кто-то прямо сейчас съесть игрока?
        for (const candidate of enemyPieces) {
           if (candidate.justSpawned) continue;// Только что появившиеся не бьют
            const cMoves = getEnemyMoves(candidate.r, candidate.c, candidate.type);
            for (const move of cMoves) {
                if (isPlayer(board[move.r][move.c])) { // Ого, тут игрок!
                    enemy = candidate;
                    targetMove = move;
                    break;
                }
            }
            if (enemy) break;
        }

        // ШАГ 2: ОБЫЧНОЕ ПЕРЕМЕЩЕНИЕ (Если убить нельзя)
        if (!enemy) {
            const shuffled =[...enemyPieces].sort(() => Math.random() - 0.5);
            let moves =[];

            // Ищем любого врага, у которого вообще есть ходы
            for (const candidate of shuffled) {
                //if (candidate.justSpawned) continue;
                const cMoves = getEnemyMoves(candidate.r, candidate.c, candidate.type);
                if (cMoves.length > 0) { 
                    enemy = candidate; 
                    moves = cMoves; 
                    break; 
                }
            }

            if (!enemy) {
                clearTimeout(safetyTimeout);
                isAnimating = false;
                isPlayerTurn = true;
                return;
            }

            // ИИ: 65% шанс пойти в сторону игрока, 35% шанс случайного хода
            if (Math.random() < 0.65 && playerPieces.length > 0) {
                let bestDist = Infinity, targetPlayer = playerPieces[0];
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
        }

        // --- ВЫПОЛНЕНИЕ ХОДА ВРАГОМ ---
        const fromSq = document.querySelector(`[data-r="${enemy.r}"][data-c="${enemy.c}"]`);
        const toSq = document.querySelector(`[data-r="${targetMove.r}"][data-c="${targetMove.c}"]`);
        const pieceEl = fromSq?.querySelector('.piece');
        
        if (pieceEl) {
            pieceEl.classList.remove('spawning');
            pieceEl.style.animation = 'none';
        }

        if (!pieceEl || !toSq) {
            board[targetMove.r][targetMove.c] = enemy.type;
            board[enemy.r][enemy.c] = '';
            enemy.r = targetMove.r; enemy.c = targetMove.c;
            renderBoard();
            isAnimating = false;
            isPlayerTurn = true;
            return;
        }

        const fR = fromSq.getBoundingClientRect();
        const tR = toSq.getBoundingClientRect();

        if (board[targetMove.r][targetMove.c] && isPlayer(board[targetMove.r][targetMove.c])) safePlaySound(audioCapture);
        else safePlaySound(audioMove);

        pieceEl.style.transition = 'transform 0.2s ease-in-out';
        pieceEl.style.transform = `translate(${tR.left - fR.left}px, ${tR.top - fR.top}px)`;

        setTimeout(() => {
            clearTimeout(safetyTimeout);
            const capturedPiece = board[targetMove.r][targetMove.c];

            board[targetMove.r][targetMove.c] = enemy.type;
            board[enemy.r][enemy.c] = '';
            enemy.r = targetMove.r;
            enemy.c = targetMove.c;
            enemy.justSpawned = false; // Первый ход сделан — теперь может есть

            // Превращение вражеской пешки
            if (enemy.type === 'p' && targetMove.r === 7) {
                enemy.type = 'q';
                board[targetMove.r][targetMove.c] = 'q';
                showFloatingText('Пешка → Ферзь!', '#ef4444');
            }

            // Убийство игрока
            if (capturedPiece && isPlayer(capturedPiece)) {
                loseLife(capturedPiece, targetMove.r, targetMove.c);
            } else {
                renderBoard();
                isAnimating = false;
                isPlayerTurn = true;
                
                // === ПРОВЕРКА НА ТУПИК ИГРОКА ===
                checkPlayerStuck();
            }
        }, 220);
    }

    // Вспомогательная функция: если игрока зажали и нет ходов, пропускаем его ход
    function checkPlayerStuck() {
        let hasAnyMove = false;
        for (const pp of playerPieces) {
            if (getPlayerMoves(pp.r, pp.c).length > 0) {
                hasAnyMove = true;
                break;
            }
        }
        
        if (!hasAnyMove && playerPieces.length > 0) {
            showFloatingText('Нет ходов! Пропуск...', '#d97706');
            isPlayerTurn = false;
            setTimeout(() => executeEnemyMove(), 800);
        }
    }

    // ===== ПОТЕРЯ ЖИЗНИ =====
    function loseLife(capturedPiece, r, c) {
        lives--;
        safePlaySound(audioError);
        updateUI();

        const boardEl = document.getElementById('board');
        if(boardEl) {
            boardEl.classList.add('shake');
            setTimeout(() => boardEl.classList.remove('shake'), 400);
        }

        if (lives <= 0) {
            setTimeout(() => gameOver(), 500);
            return;
        }

        const idx = playerPieces.findIndex(p => p.r === r && p.c === c);
        if (idx !== -1) playerPieces.splice(idx, 1);

        setTimeout(() => {
            const pos = getRandomEmptySquare();
            if (pos) {
                board[pos.r][pos.c] = capturedPiece;
                playerPieces.push({ r: pos.r, c: pos.c, type: capturedPiece, id: 'p_resp_' + Date.now() });
                renderBoard();
                setTimeout(() => {
                    const sq = document.querySelector(`[data-r="${pos.r}"][data-c="${pos.c}"]`);
                    if (sq?.querySelector('.piece')) sq.querySelector('.piece').classList.add('spawning');
                }, 50);
            }
            isAnimating = false;
            isPlayerTurn = true;
        }, 300);
        renderBoard();
    }

    // ===== GAME OVER =====
function gameOver() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('cf-best-score', bestScore);
    }

    // Меняем кнопку Подсказка → Заново
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
        hintBtn.style.display = 'flex';
        const icon = hintBtn.querySelector('.video-icon');
        if (icon) icon.style.display = 'none';
        const text = hintBtn.querySelector('#hint-btn-text');
        if (text) text.textContent = 'Заново';
        hintBtn.onclick = () => CaptureFrenzy.startGame();
    }

    // Показываем Топ обратно как кнопку "В меню"
    const topBtn = document.querySelector('.top-btn');
    if (topBtn) {
        topBtn.style.display = 'flex';
        topBtn.textContent = 'В меню';
        topBtn.onclick = () => CaptureFrenzy.goBack();
    }

    // Показываем итог в карточке очков через всплывающий текст
    showFloatingText(`Игра окончена! Счёт: ${score}`, '#ef4444');

    isPlayerTurn = false;
    isAnimating = false;
}

// ===== ПУБЛИЧНЫЕ МЕТОДЫ (API) =====
    return {
        showStart: () => {
            // 1. Проверяем память браузера
            const hasSeenTutorial = localStorage.getItem('tutorial_shown_frenzy');

            if (hasSeenTutorial === 'true') {
                // ЕСЛИ УЖЕ ВИДЕЛИ: запускаем твою правильную функцию startGame мгновенно
                startGame();
            } else {
                // ЕСЛИ НЕ ВИДЕЛИ: показываем плашку "Охоты" первый и последний раз
                const gameContainer = document.querySelector('.game-container');
                if (gameContainer) {
                    gameContainer.style.display = 'flex'; 
                    gameContainer.classList.remove('hidden-game');
                }
                
                // Рисуем фальшивый фон для плашки
                board = Array(8).fill(null).map(() => Array(8).fill(''));
                board[3][3] = 'R'; 
                renderBoard();

                // Прячем меню
                const mainMenu = document.getElementById('main-menu');
                if (mainMenu) mainMenu.classList.add('hidden');

                // Выводим само модальное окно на экран
                const startScreen = document.getElementById('cf-start-screen');
                if (startScreen) {
                    startScreen.classList.remove('hidden');
                    startScreen.style.setProperty('display', 'flex', 'important');
                }

                // ВАЖНО: ставим галочку в память, чтобы больше никогда не показывать
                localStorage.setItem('tutorial_shown_frenzy', 'true');
            }
        },
        startGame: startGame,
goBack: () => {
    safeHide('cf-start-screen');
    safeHide('cf-gameover-screen');

    // Сбрасываем кнопку Заново обратно в Подсказка
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
        hintBtn.onclick = requestHint;
        const icon = hintBtn.querySelector('.video-icon');
        if (icon) icon.style.display = '';
        const text = hintBtn.querySelector('#hint-btn-text');
        if (text) text.textContent = typeof i18n !== 'undefined' ? i18n[lang]?.hintBtn : 'Помощь';
    }

    const topBtn = document.querySelector('.top-btn');
    if (topBtn) {
        const topText = document.getElementById('top-btn-text');
        if (topText) topBtn.innerHTML = `<span id="top-btn-text">Топ</span>`;
        if (typeof openLeaderboard === 'function') topBtn.onclick = openLeaderboard;
    }

    setFrenzyUI(false);
},
        openFrenzyLeaderboard: () => {
            alert("Таблица рекордов для этого режима в разработке!");
        }
    };
})();