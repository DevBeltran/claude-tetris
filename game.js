'use strict';

// ══════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════
const CFG = {
  COLS: 10, ROWS: 20, BLOCK: 30,
  QUEUE_SIZE: 5,
  DEFAULT_PREVIEW: 3,
  ABILITY_PREVIEW: 5,
  PREVIEW_BLOCK: 20,
  NEXT_SLOT_H: 90,
  SPECIAL_PIECE_CHANCE: 0.12,
  POWERUP_LINE_INTERVAL: 8,
  POWERUP_CHANCE: 0.55,
  FREEZE_MS: 5000,
  SLOW_MS: 10000,
  SLOW_FACTOR: 3,
  ENERGY_MAX: 100,
  ENERGY_PER_LINE: [0, 10, 25, 40, 60],
  B2B_BONUS: 0.5,
  PERFECT_CLEAR_BONUS: 800,
  GARBAGE_INTERVAL_MS: 10000,
  CHALLENGE_TIME_MS: 120000,
  CHALLENGE_LINES: 40,
  INVERT_ROTATION_LEVEL: 10,
};

const STD_MIN = 1, STD_MAX = 8;
const SPC_MIN = 9, SPC_MAX = 13;
const PWR_MIN = 14, PWR_MAX = 18;
const WILDCARD = 19;

const COLORS = [
  null,
  '#4dd0e1', // 1  I
  '#ffd54f', // 2  O
  '#ba68c8', // 3  T
  '#81c784', // 4  S
  '#e57373', // 5  Z
  '#90caf9', // 6  J
  '#ffb74d', // 7  L
  '#b0bec5', // 8  Nut
  '#ff6b9d', // 9  Plus
  '#c3f735', // 10 U
  '#f7a535', // 11 Y
  '#ffffff', // 12 1×1
  '#a78bfa', // 13 3×3 hollow
  '#ff4444', // 14 Bomb
  '#44ffff', // 15 Lightning
  '#ff44ff', // 16 Tint
  '#44ff44', // 17 Gravity
  '#4488ff', // 18 Freeze
  '#ffff44', // 19 Wildcard
];

const PWR_LABELS = { 14: 'B', 15: 'L', 16: 'T', 17: 'G', 18: 'F' };
const PWR_NAMES  = { 14: 'BOMBA', 15: 'RAYO', 16: 'TINTE', 17: 'GRAVEDAD', 18: 'CONGELAR' };

// shape[r][c] = color index (0 = empty)
const PIECE_TEMPLATES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // 1 I
  [[2,2],[2,2]],                               // 2 O
  [[0,3,0],[3,3,3],[0,0,0]],                  // 3 T
  [[0,4,4],[4,4,0],[0,0,0]],                  // 4 S
  [[5,5,0],[0,5,5],[0,0,0]],                  // 5 Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // 6 J
  [[0,0,7],[7,7,7],[0,0,0]],                  // 7 L
  [[8,8,8],[8,0,8],[8,8,8]],                  // 8 Nut
  [[0,9,0],[9,9,9],[0,9,0]],                  // 9 Plus
  [[10,0,10],[10,10,10],[0,0,0]],             // 10 U
  [[0,11],[11,11],[0,11],[0,11]],             // 11 Y
  [[12]],                                      // 12 1×1
  [[13,13,13],[13,0,13],[13,13,13]],          // 13 3×3 hollow
  [[14]], [[15]], [[16]], [[17]], [[18]],      // 14-18 power-ups
];

const LINE_SCORES  = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [0, 200, 400, 600, 800];

// ══════════════════════════════════════════════════════
// DOM
// ══════════════════════════════════════════════════════
const canvas      = document.getElementById('board');
const ctx         = canvas.getContext('2d');
const holdCanvas  = document.getElementById('hold-canvas');
const holdCtx     = holdCanvas.getContext('2d');
const nextCanvas  = document.getElementById('next-canvas');
const nextCtx     = nextCanvas.getContext('2d');
const scoreEl     = document.getElementById('score');
const linesEl     = document.getElementById('lines');
const levelEl     = document.getElementById('level');
const comboEl     = document.getElementById('combo');
const overlay     = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn  = document.getElementById('restart-btn');
const energyFill  = document.getElementById('energy-fill');
const energyLabel = document.getElementById('energy-label');
const statusMsg   = document.getElementById('status-msg');
const modeBtn     = document.getElementById('mode-btn');
const challengeInfo = document.getElementById('challenge-info');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel  = document.getElementById('theme-label');
const nextWrap    = document.getElementById('next-wrap');

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
let board, current, queue, hold, holdUsed;
let score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, lastWasTetrisOrTspin;
let lastActionRotation;
let frozenUntil, slowUntil;
let energy, previewCount;
let abilityExpanded, abilityExpandUntil;
let gameMode;
let challengeStart, garbageAccum, linesSinceLastPowerup;
let undoState;
let pendingSmallPiece, statusTimeout;

// ══════════════════════════════════════════════════════
// PIECE FACTORY
// ══════════════════════════════════════════════════════
const PieceFactory = {
  fromType(type) {
    const tpl = PIECE_TEMPLATES[type];
    if (!tpl) return null;
    const shape = tpl.map(r => [...r]);
    return { type, shape, x: Math.floor(CFG.COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  },

  random() {
    if (Math.random() < CFG.SPECIAL_PIECE_CHANCE) {
      return this.fromType(SPC_MIN + Math.floor(Math.random() * (SPC_MAX - SPC_MIN + 1)));
    }
    return this.fromType(STD_MIN + Math.floor(Math.random() * (STD_MAX - STD_MIN + 1)));
  },

  randomPowerup() {
    return this.fromType(PWR_MIN + Math.floor(Math.random() * (PWR_MAX - PWR_MIN + 1)));
  },

  refillQueue() {
    while (queue.length < CFG.QUEUE_SIZE) queue.push(this.random());
  },

  dequeue() {
    const piece = queue.shift();
    this.refillQueue();
    return piece;
  },
};

// ══════════════════════════════════════════════════════
// BOARD UTILS
// ══════════════════════════════════════════════════════
function createBoard() {
  return Array.from({ length: CFG.ROWS }, () => new Array(CFG.COLS).fill(0));
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= CFG.COLS || ny >= CFG.ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out[c][rows - 1 - r] = shape[r][c];
  return out;
}

function rotateCCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out[cols - 1 - c][r] = shape[r][c];
  return out;
}

function tryRotate(cw = true) {
  const rotated = cw ? rotateCW(current.shape) : rotateCCW(current.shape);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastActionRotation = true;
      return;
    }
  }
}

function isTSpin() {
  if (current.type !== 3 || !lastActionRotation) return false;
  const cx = current.x, cy = current.y;
  let filled = 0;
  for (const [r, c] of [[cy,cx],[cy,cx+2],[cy+2,cx],[cy+2,cx+2]]) {
    if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS || board[r]?.[c]) filled++;
  }
  return filled >= 3;
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function applyGravityBoard() {
  for (let c = 0; c < CFG.COLS; c++) {
    const blocks = [];
    for (let r = 0; r < CFG.ROWS; r++) if (board[r][c]) blocks.push(board[r][c]);
    for (let r = 0; r < CFG.ROWS; r++)
      board[r][c] = r < CFG.ROWS - blocks.length ? 0 : blocks[r - (CFG.ROWS - blocks.length)];
  }
}

// noComboReset: true when called from power-ups so combo isn't broken
function clearLines(noComboReset = false) {
  let cleared = 0;
  for (let r = CFG.ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(CFG.COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    if (!noComboReset) combo = 0;
    return;
  }

  const tspin        = isTSpin();
  const isTetris     = cleared === 4;
  const perfectClear = isBoardEmpty();
  const b2b          = lastWasTetrisOrTspin && (isTetris || tspin);

  let base = (tspin ? TSPIN_SCORES : LINE_SCORES)[Math.min(cleared, 4)];
  let pts  = base * level;
  if (b2b) pts = Math.floor(pts * (1 + CFG.B2B_BONUS));
  if (perfectClear) pts += CFG.PERFECT_CLEAR_BONUS * level;
  combo++;
  pts = Math.floor(pts * (1 + (combo - 1) * 0.5));
  score += pts;

  energy = Math.min(CFG.ENERGY_MAX, energy + (CFG.ENERGY_PER_LINE[Math.min(cleared, 4)] || 0));
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = computeDropInterval();
  lastWasTetrisOrTspin = isTetris || tspin;

  // Notifications — later ones overwrite earlier ones (showStatus is non-blocking)
  if (combo > 1)             showStatus(`COMBO ×${combo}`, '#ffb74d', 1200);
  if (tspin)                 showStatus('T-SPIN!', '#ba68c8', 1500);
  if (isTetris)              showStatus('TETRIS!', '#4dd0e1', 1500);
  if (b2b && isTetris)       showStatus('BACK-TO-BACK!', '#4dd0e1', 2000);
  if (perfectClear)          showStatus('PERFECT CLEAR!', '#ffff44', 2500);

  if (isTetris && !pendingSmallPiece) pendingSmallPiece = true;

  linesSinceLastPowerup += cleared;
  if (linesSinceLastPowerup >= CFG.POWERUP_LINE_INTERVAL && Math.random() < CFG.POWERUP_CHANCE) {
    // Inject power-up after the piece currently in front of the queue
    queue.splice(1, 0, PieceFactory.randomPowerup());
    linesSinceLastPowerup = 0;
  }

  updateHUD();
}

function computeDropInterval() {
  let base = Math.max(100, 1000 - (level - 1) * 90);
  if (slowUntil > performance.now()) base *= CFG.SLOW_FACTOR;
  return base;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

// ══════════════════════════════════════════════════════
// POWER-UP MANAGER
// ══════════════════════════════════════════════════════
const PowerUpManager = {
  apply(type, cx, cy) {
    switch (type) {
      case 14: this._bomb(cx, cy);  break;
      case 15: this._lightning(cy); break;
      case 16: this._tint();        break;
      case 17: this._gravity();     break;
      case 18: this._freeze();      break;
    }
    showStatus(PWR_NAMES[type] + '!', COLORS[type], 2000);
  },

  _bomb(cx, cy) {
    for (let r = cy - 1; r <= cy + 1; r++)
      for (let c = cx - 1; c <= cx + 1; c++)
        if (r >= 0 && r < CFG.ROWS && c >= 0 && c < CFG.COLS)
          board[r][c] = 0;
    // No clearLines — bomb creates gaps, can't complete rows
  },

  _lightning(row) {
    if (row < 0 || row >= CFG.ROWS) return;
    board.splice(row, 1);
    board.unshift(new Array(CFG.COLS).fill(0));
    // Award 1 line without resetting combo
    lines += 1;
    score += LINE_SCORES[1] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = computeDropInterval();
    energy = Math.min(CFG.ENERGY_MAX, energy + CFG.ENERGY_PER_LINE[1]);
    updateHUD();
  },

  _tint() {
    const colors = new Set();
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        if (board[r][c] >= STD_MIN && board[r][c] <= SPC_MAX) colors.add(board[r][c]);
    if (!colors.size) return;
    const target = [...colors][Math.floor(Math.random() * colors.size)];
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        if (board[r][c] === target) board[r][c] = WILDCARD;
    clearLines(true);
  },

  _gravity() {
    applyGravityBoard();
    clearLines(true);
  },

  _freeze() {
    frozenUntil = performance.now() + CFG.FREEZE_MS;
  },
};

// ══════════════════════════════════════════════════════
// HOLD
// ══════════════════════════════════════════════════════
function activateHold() {
  if (holdUsed) return;
  holdUsed = true;

  const tpl = PIECE_TEMPLATES[current.type];
  const resetShape = tpl.map(r => [...r]);
  const resetX = Math.floor(CFG.COLS / 2) - Math.floor(resetShape[0].length / 2);
  const stored = hold;
  hold = { type: current.type, shape: resetShape, x: resetX, y: 0 };

  if (stored) {
    current = stored;
  } else {
    current = PieceFactory.dequeue();
  }
  lastActionRotation = false;
  drawHold();
  drawNext();
}

// ══════════════════════════════════════════════════════
// ABILITY MANAGER
// ══════════════════════════════════════════════════════
const AbilityManager = {
  ready() { return energy >= CFG.ENERGY_MAX; },

  activate(slot) {
    if (!this.ready()) return;
    energy = 0;
    updateHUD();
    switch (slot) {
      case 0: this._extendPreview();  break;
      case 1: this._swapPiece();      break;
      case 2: this._slowTime();       break;
      case 3: this._undo();           break;
    }
  },

  tick(now) {
    if (abilityExpanded && now >= abilityExpandUntil) {
      abilityExpanded = false;
      previewCount = CFG.DEFAULT_PREVIEW;
      nextWrap.classList.remove('expanded');
      drawNext();
    }
  },

  _extendPreview() {
    previewCount = CFG.ABILITY_PREVIEW;
    abilityExpanded = true;
    abilityExpandUntil = performance.now() + 15000;
    nextWrap.classList.add('expanded');
    showStatus('PREVIEW ×5', '#c3f735', 1500);
    drawNext();
  },

  _swapPiece() {
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i];
      const sx = Math.floor(CFG.COLS / 2) - Math.floor(candidate.shape[0].length / 2);
      if (!collide(candidate.shape, sx, 0)) {
        queue.splice(i, 1);
        PieceFactory.refillQueue();
        current = { ...candidate, x: sx, y: 0 };
        showStatus('SWAP!', '#ff6b9d', 1500);
        drawNext();
        return;
      }
    }
    showStatus('NO SWAP', '#888', 1000);
  },

  _slowTime() {
    slowUntil = performance.now() + CFG.SLOW_MS;
    dropInterval = computeDropInterval();
    showStatus('TIME SLOW!', '#4488ff', 1500);
  },

  _undo() {
    if (!undoState) { showStatus('NO UNDO', '#888', 1000); return; }
    // Put current (newly spawned) piece back in queue front
    queue.unshift(current);
    board   = undoState.board;
    current = undoState.piece;
    undoState = null;
    drawNext();
    showStatus('UNDO!', '#ff44ff', 1500);
  },
};

// ══════════════════════════════════════════════════════
// HUD / STATUS
// ══════════════════════════════════════════════════════
function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 0 ? `×${combo}` : '×1';
  comboEl.style.opacity = combo > 1 ? '1' : '0.3';

  const pct = (energy / CFG.ENERGY_MAX) * 100;
  energyFill.style.width = pct + '%';
  energyFill.classList.toggle('ready', energy >= CFG.ENERGY_MAX);
  energyLabel.textContent = AbilityManager.ready() ? 'LISTO' : `${Math.floor(pct)}%`;

  updateChallengeInfo();
}

function showStatus(text, color, ms) {
  clearTimeout(statusTimeout);
  statusMsg.textContent = text;
  statusMsg.style.color = color || '#fff';
  statusMsg.style.opacity = '1';
  statusTimeout = setTimeout(() => { statusMsg.style.opacity = '0'; }, ms || 1500);
}

function updateChallengeInfo() {
  if (!challengeInfo) return;
  if (gameMode === '40lines') {
    const rem = Math.max(0, CFG.CHALLENGE_TIME_MS - (performance.now() - challengeStart));
    const need = Math.max(0, CFG.CHALLENGE_LINES - lines);
    challengeInfo.textContent = `${Math.ceil(rem / 1000)}s | ${need}L restantes`;
    challengeInfo.style.display = '';
  } else if (gameMode === 'garbage') {
    const next = Math.max(0, Math.ceil((CFG.GARBAGE_INTERVAL_MS - garbageAccum) / 1000));
    challengeInfo.textContent = `Basura en ${next}s`;
    challengeInfo.style.display = '';
  } else {
    challengeInfo.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════
// RENDERING
// ══════════════════════════════════════════════════════
function drawBlock(context, x, y, colorIdx, size, alpha) {
  if (!colorIdx) return;
  const color = COLORS[colorIdx] || '#888';
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);

  if (colorIdx >= PWR_MIN && size >= 18) {
    const label = PWR_LABELS[colorIdx];
    if (label) {
      context.fillStyle = 'rgba(0,0,0,0.75)';
      context.font = `bold ${Math.floor(size * 0.55)}px monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, x * size + size / 2, y * size + size / 2);
    }
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = document.body.classList.contains('light') ? '#d0d0dc' : '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < CFG.COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CFG.BLOCK, 0); ctx.lineTo(c * CFG.BLOCK, CFG.ROWS * CFG.BLOCK); ctx.stroke();
  }
  for (let r = 1; r < CFG.ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CFG.BLOCK); ctx.lineTo(CFG.COLS * CFG.BLOCK, r * CFG.BLOCK); ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < CFG.ROWS; r++)
    for (let c = 0; c < CFG.COLS; c++)
      drawBlock(ctx, c, r, board[r][c], CFG.BLOCK);

  if (gameOver) return;

  // Ghost (skip for power-ups — 1×1 blocks)
  if (current.type < PWR_MIN) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], CFG.BLOCK, 0.2);
  }

  // Current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], CFG.BLOCK);

  // Freeze tint overlay
  if (frozenUntil > performance.now()) {
    ctx.save();
    ctx.fillStyle = 'rgba(68,136,255,0.07)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawHold() {
  const NB = CFG.PREVIEW_BLOCK;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!hold) return;
  const shape = hold.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  holdCtx.globalAlpha = holdUsed ? 0.35 : 1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], NB);
  holdCtx.globalAlpha = 1;
}

function drawNext() {
  const NB = CFG.PREVIEW_BLOCK;
  const slotH = CFG.NEXT_SLOT_H;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const count = Math.min(previewCount, queue.length);
  for (let i = 0; i < count; i++) {
    const shape = queue[i].shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const blockOffY = Math.floor((slotH / NB - shape.length) / 2);
    nextCtx.save();
    nextCtx.translate(0, i * slotH);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, blockOffY + r, shape[r][c], NB);
    nextCtx.restore();
    if (i < count - 1) {
      nextCtx.strokeStyle = 'rgba(128,128,128,0.15)';
      nextCtx.lineWidth = 1;
      nextCtx.beginPath();
      nextCtx.moveTo(0, (i + 1) * slotH);
      nextCtx.lineTo(nextCanvas.width, (i + 1) * slotH);
      nextCtx.stroke();
    }
  }
}

// ══════════════════════════════════════════════════════
// GAME ACTIONS
// ══════════════════════════════════════════════════════
function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  // Save undo snapshot before anything changes
  undoState = {
    board: board.map(r => [...r]),
    piece: { ...current, shape: current.shape.map(r => [...r]) },
  };

  const type = current.type;
  if (type >= PWR_MIN && type <= PWR_MAX) {
    PowerUpManager.apply(type, current.x, current.y);
  } else {
    merge();
    clearLines();
  }

  holdUsed = false;
  lastActionRotation = false;
  spawn();
}

function spawn() {
  if (pendingSmallPiece) {
    current = PieceFactory.fromType(12); // 1×1 reward
    pendingSmallPiece = false;
  } else {
    current = PieceFactory.dequeue();
  }

  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
  drawHold();
}

// ══════════════════════════════════════════════════════
// CHALLENGE
// ══════════════════════════════════════════════════════
const ChallengeManager = {
  addGarbageRow() {
    const gap = Math.floor(Math.random() * CFG.COLS);
    board.shift();
    board.push(Array.from({ length: CFG.COLS }, (_, c) => c === gap ? 0 : 8));
    if (collide(current.shape, current.x, current.y)) endGame();
  },

  tick(dt) {
    if (gameMode === 'garbage') {
      garbageAccum += dt;
      if (garbageAccum >= CFG.GARBAGE_INTERVAL_MS) {
        garbageAccum -= CFG.GARBAGE_INTERVAL_MS;
        this.addGarbageRow();
      }
    }
    if (gameMode === '40lines') {
      if (performance.now() - challengeStart >= CFG.CHALLENGE_TIME_MS) {
        endGame(false, 'TIEMPO AGOTADO');
        return;
      }
      if (lines >= CFG.CHALLENGE_LINES) {
        endGame(true, '¡VICTORIA!');
      }
    }
  },
};

// ══════════════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════════════
function endGame(win = false, msg = 'GAME OVER') {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = win ? '¡VICTORIA!' : msg;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    overlay.classList.add('hidden');
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  AbilityManager.tick(ts);

  if (slowUntil > 0 && ts > slowUntil) {
    slowUntil = 0;
    dropInterval = computeDropInterval();
  }

  const frozen = frozenUntil > ts;
  if (!frozen) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  ChallengeManager.tick(dt);
  if (gameOver) return;

  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board               = createBoard();
  queue               = [];
  score               = 0;
  lines               = 0;
  level               = 1;
  paused              = false;
  gameOver            = false;
  dropInterval        = 1000;
  dropAccum           = 0;
  lastTime            = performance.now();
  combo               = 0;
  lastWasTetrisOrTspin = false;
  lastActionRotation  = false;
  frozenUntil         = 0;
  slowUntil           = 0;
  energy              = 0;
  previewCount        = CFG.DEFAULT_PREVIEW;
  abilityExpanded     = false;
  hold                = null;
  holdUsed            = false;
  pendingSmallPiece   = false;
  linesSinceLastPowerup = 0;
  undoState           = null;
  garbageAccum        = 0;
  challengeStart      = performance.now();

  nextWrap.classList.remove('expanded');

  PieceFactory.refillQueue();
  current = PieceFactory.dequeue();

  updateHUD();
  drawNext();
  drawHold();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════
// INPUT
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;

  // Invert rotation at high levels in normal/garbage modes
  const invertRot = gameMode !== '40lines' && level >= CFG.INVERT_ROTATION_LEVEL;

  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) {
        current.x--;
        lastActionRotation = false;
      }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) {
        current.x++;
        lastActionRotation = false;
      }
      break;
    case 'ArrowDown':
      softDrop(); return;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate(!invertRot); break;
    case 'KeyZ':
      tryRotate(invertRot); break;
    case 'Space':
      e.preventDefault();
      hardDrop(); return;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      activateHold(); return;
    case 'Digit1': AbilityManager.activate(0); return;
    case 'Digit2': AbilityManager.activate(1); return;
    case 'Digit3': AbilityManager.activate(2); return;
    case 'Digit4': AbilityManager.activate(3); return;
  }

  updateHUD();
  draw();
});

// ══════════════════════════════════════════════════════
// MODE SELECTOR
// ══════════════════════════════════════════════════════
const MODES = ['normal', '40lines', 'garbage'];
const MODE_LABELS = { normal: 'NORMAL', '40lines': '40 LÍNEAS', garbage: 'BASURA' };

function cycleMode() {
  const idx = MODES.indexOf(gameMode);
  gameMode = MODES[(idx + 1) % MODES.length];
  modeBtn.textContent = MODE_LABELS[gameMode];
  localStorage.setItem('tetris-mode', gameMode);
}

// ══════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════
function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  themeLabel.textContent = isLight ? 'LIGHT' : 'DARK';
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
});

// ══════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════
gameMode = localStorage.getItem('tetris-mode') || 'normal';
modeBtn.textContent = MODE_LABELS[gameMode] || 'NORMAL';

modeBtn.addEventListener('click', cycleMode);
restartBtn.addEventListener('click', init);

init();
