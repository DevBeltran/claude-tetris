const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#00FFFF', // I - cyan
    '#ADD8E6', // J - pale blue (light blue)
    '#FF7F00', // L - orange
    '#FFFF00', // O - yellow
    '#00FF00', // S - green
    '#800080', // T - purple
    '#FF0000', // Z - red
];

const PIECES = [
    [],
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[2,0,0],[2,2,2],[0,0,0]],                   // J
    [[0,0,3],[3,3,3],[0,0,0]],                   // L
    [[4,4],[4,4]],                               // O
    [[0,5,5],[5,5,0],[0,0,0]],                   // S
    [[0,6,0],[6,6,6],[0,0,0]],                   // T
    [[7,7,0],[0,7,7],[0,0,0]],                   // Z
];

const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');

let board = [];
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let paused = false;
let currentPiece = null;
let nextPiece = null;
let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;
let animationId = null;

function initBoard() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
}

function createPiece(type) {
    return {
        pos: {x: Math.floor(COLS / 2) - 1, y: 0},
        matrix: PIECES[type],
        type: type
    };
}

function randomPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    return createPiece(type);
}

function drawBlock(context, x, y, colorIndex) {
    const color = COLORS[colorIndex];
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 1;
    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // Highlight
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, 4);
}

function drawMatrix(context, matrix, offset, blockSize) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlockCustom(context, x + offset.x, y + offset.y, COLORS[value], blockSize);
            }
        });
    });
}

function drawBlockCustom(context, x, y, color, blockSize) {
    context.fillStyle = color;
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 1;
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);

    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(x * blockSize + 2, y * blockSize + 2, blockSize - 4, 4);
}

function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x, y, value);
            }
        });
    });
}

function drawPiece() {
    if (currentPiece) {
        // Draw ghost piece
        drawGhost();
        drawMatrix(ctx, currentPiece.matrix, currentPiece.pos, BLOCK_SIZE);
    }
}

function drawGhost() {
    if (!currentPiece) return;
    let ghostY = currentPiece.pos.y;
    while (!collision(currentPiece.matrix, {x: currentPiece.pos.x, y: ghostY + 1})) {
        ghostY++;
    }
    if (ghostY === currentPiece.pos.y) return;

    currentPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(
                    (x + currentPiece.pos.x) * BLOCK_SIZE,
                    (y + ghostY) * BLOCK_SIZE,
                    BLOCK_SIZE, BLOCK_SIZE
                );
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    (x + currentPiece.pos.x) * BLOCK_SIZE,
                    (y + ghostY) * BLOCK_SIZE,
                    BLOCK_SIZE, BLOCK_SIZE
                );
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.fillStyle = '#111';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPiece) {
        const blockSize = 25;
        const offsetX = Math.floor((nextCanvas.width / blockSize - nextPiece.matrix[0].length) / 2);
        const offsetY = Math.floor((nextCanvas.height / blockSize - nextPiece.matrix.length) / 2);
        drawMatrix(nextCtx, nextPiece.matrix, {x: offsetX, y: offsetY}, blockSize);
    }
}

function drawMatrixCustomSize(context, matrix, offset, blockSize) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlockCustom(context, x + offset.x, y + offset.y, COLORS[value], blockSize);
            }
        });
    });
}

function collision(matrix, pos) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                const newX = x + pos.x;
                const newY = y + pos.y;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && board[newY][newX] !== 0) return true;
            }
        }
    }
    return false;
}

function merge() {
    currentPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const boardY = y + currentPiece.pos.y;
                const boardX = x + currentPiece.pos.x;
                if (boardY >= 0) {
                    board[boardY][boardX] = value;
                }
            }
        });
    });
}

function clearLines() {
    let linesCleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(value => value !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++;
        }
    }
    if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        score += (points[linesCleared] || 800) * level;
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        updateScore();
    }
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
}

function spawnPiece() {
    if (!nextPiece) {
        nextPiece = randomPiece();
    }
    currentPiece = nextPiece;
    nextPiece = randomPiece();

    currentPiece.pos = {
        x: Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2),
        y: 0
    };

    if (collision(currentPiece.matrix, currentPiece.pos)) {
        endGame();
    }

    drawNextPiece();
}

function rotatePiece(dir) {
    const matrix = currentPiece.matrix;
    const N = matrix.length;
    const rotated = Array.from({length: N}, () => Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (dir > 0) {
                rotated[x][N - 1 - y] = matrix[y][x];
            } else {
                rotated[N - 1 - x][y] = matrix[y][x];
            }
        }
    }

    // Wall kick
    const prevPos = {...currentPiece.pos};
    let offset = 1;
    currentPiece.matrix = rotated;
    while (collision(currentPiece.matrix, currentPiece.pos)) {
        currentPiece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (Math.abs(offset) > matrix[0].length) {
            currentPiece.matrix = matrix;
            currentPiece.pos = prevPos;
            return;
        }
    }
}

function moveLeft() {
    currentPiece.pos.x--;
    if (collision(currentPiece.matrix, currentPiece.pos)) {
        currentPiece.pos.x++;
    }
}

function moveRight() {
    currentPiece.pos.x++;
    if (collision(currentPiece.matrix, currentPiece.pos)) {
        currentPiece.pos.x--;
    }
}

function moveDown() {
    currentPiece.pos.y++;
    if (collision(currentPiece.matrix, currentPiece.pos)) {
        currentPiece.pos.y--;
        merge();
        clearLines();
        spawnPiece();
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collision(currentPiece.matrix, {x: currentPiece.pos.x, y: currentPiece.pos.y + 1})) {
        currentPiece.pos.y++;
    }
    merge();
    clearLines();
    spawnPiece();
    dropCounter = 0;
}

function update(time = 0) {
    if (!gameOver && !paused) {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        if (dropCounter >= dropInterval) {
            moveDown();
        }
        draw();
    }
    animationId = requestAnimationFrame(update);
}

function draw() {
    drawBoard();
    drawPiece();
}

function endGame() {
    gameOver = true;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '16px Arial';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 35);
}

function startGame() {
    initBoard();
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    paused = false;
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = 0;
    currentPiece = null;
    nextPiece = null;
    updateScore();
    spawnPiece();
    if (animationId) cancelAnimationFrame(animationId);
    update();
}

document.addEventListener('keydown', (e) => {
    if (gameOver) {
        if (e.key === 'r' || e.key === 'R') startGame();
        return;
    }
    if (e.key === 'p' || e.key === 'P') {
        paused = !paused;
        if (!paused) {
            lastTime = performance.now();
            update();
        }
        return;
    }
    if (paused) return;
    switch(e.key) {
        case 'ArrowLeft': moveLeft(); break;
        case 'ArrowRight': moveRight(); break;
        case 'ArrowDown': moveDown(); break;
        case 'ArrowUp': rotatePiece(1); break;
        case ' ': hardDrop(); e.preventDefault(); break;
        case 'z': case 'Z': rotatePiece(-1); break;
    }
    draw();
});

startGame();
