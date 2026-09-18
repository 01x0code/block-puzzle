class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPlace() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playClear(linesCount) {
    if (!this.ctx) return;
    const baseFreq = 440 + linesCount * 120;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playGameOver() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}

const SHAPES = [
  { shape: [[1]], color: '#00cec9' },
  { shape: [[1, 1]], color: '#74b9ff' },
  { shape: [[1], [1]], color: '#74b9ff' },
  { shape: [[1, 1, 1]], color: '#0984e3' },
  { shape: [[1], [1], [1]], color: '#0984e3' },
  { shape: [[1, 1, 1, 1]], color: '#6c5ce7' },
  { shape: [[1], [1], [1], [1]], color: '#6c5ce7' },
  { shape: [[1, 1], [1, 1]], color: '#fdcb6e' },
  { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: '#e17055' },
  { shape: [[1, 0], [1, 1]], color: '#e84393' },
  { shape: [[0, 1], [1, 1]], color: '#e84393' },
  { shape: [[1, 1], [1, 0]], color: '#e84393' },
  { shape: [[1, 1], [0, 1]], color: '#e84393' },
  { shape: [[1, 1, 1], [0, 1, 0]], color: '#00b894' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#00b894' },
  { shape: [[1, 0], [1, 1], [1, 0]], color: '#00b894' },
  { shape: [[0, 1], [1, 1], [0, 1]], color: '#00b894' },
  { shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], color: '#a29bfe' },
  { shape: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], color: '#a29bfe' },
  { shape: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], color: '#a29bfe' },
  { shape: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], color: '#a29bfe' }
];

const BOARD_SIZE = 8;
let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
let currentPieces = [null, null, null];
let score = 0;
let highScore = parseInt(localStorage.getItem('block_blast_highscore')) || 0;
let comboCount = 0;
let dragState = null;

const audio = new SoundEngine();

const boardEl = document.getElementById('board');
const pieceSlots = document.querySelectorAll('.piece-slot');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const comboPopupEl = document.getElementById('combo-popup');
const gameOverModal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');

function initGame() {
  boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  score = 0;
  comboCount = 0;
  updateScore(0);
  highScoreEl.textContent = highScore;
  createBoardDOM();
  spawnPieces();
  gameOverModal.classList.add('hidden');
}

function createBoardDOM() {
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
    }
  }
}

function renderBoard() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      cell.className = 'cell';
      cell.style.backgroundColor = '';
      if (boardState[r][c]) {
        cell.classList.add('filled');
        cell.style.backgroundColor = boardState[r][c];
      }
    }
  }
}

function spawnPieces() {
  for (let i = 0; i < 3; i++) {
    const randomPiece = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    currentPieces[i] = randomPiece;
    renderPieceInSlot(i, randomPiece);
  }
}

function renderPieceInSlot(slotIndex, piece) {
  const slot = pieceSlots[slotIndex];
  slot.innerHTML = '';
  if (!piece) return;

  const pieceGrid = document.createElement('div');
  pieceGrid.classList.add('piece-grid');
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  pieceGrid.style.gridTemplateColumns = `repeat(${cols}, 18px)`;
  pieceGrid.style.gridTemplateRows = `repeat(${rows}, 18px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = document.createElement('div');
      if (piece.shape[r][c]) {
        block.classList.add('piece-block');
        block.style.backgroundColor = piece.color;
      }
      pieceGrid.appendChild(block);
    }
  }

  slot.appendChild(pieceGrid);
}

pieceSlots.forEach((slot, index) => {
  slot.addEventListener('pointerdown', (e) => startDrag(e, index));
});

function startDrag(e, slotIndex) {
  if (!currentPieces[slotIndex]) return;
  audio.init();

  const piece = currentPieces[slotIndex];
  const boardCell = boardEl.firstElementChild.getBoundingClientRect();
  const cellSize = boardCell.width;

  const clone = document.createElement('div');
  clone.classList.add('drag-clone', 'piece-grid');
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  clone.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  clone.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = document.createElement('div');
      if (piece.shape[r][c]) {
        block.classList.add('piece-block');
        block.style.backgroundColor = piece.color;
      }
      clone.appendChild(block);
    }
  }

  document.body.appendChild(clone);

  dragState = {
    slotIndex,
    piece,
    cloneEl: clone,
    cellSize,
    rows,
    cols,
    targetRow: null,
    targetCol: null,
    isValid: false
  };

  pieceSlots[slotIndex].style.visibility = 'hidden';
  moveDrag(e);

  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function moveDrag(e) {
  if (!dragState) return;

  const pointerYOffset = e.pointerType === 'touch' ? 70 : 0;
  const x = e.clientX;
  const y = e.clientY - pointerYOffset;

  dragState.cloneEl.style.left = `${x}px`;
  dragState.cloneEl.style.top = `${y}px`;

  const boardRect = boardEl.getBoundingClientRect();
  const relX = x - boardRect.left;
  const relY = y - boardRect.top;

  const targetCol = Math.round((relX - (dragState.cols * dragState.cellSize) / 2) / dragState.cellSize);
  const targetRow = Math.round((relY - (dragState.rows * dragState.cellSize) / 2) / dragState.cellSize);

  clearHighlights();

  if (canPlacePiece(dragState.piece.shape, targetRow, targetCol)) {
    dragState.targetRow = targetRow;
    dragState.targetCol = targetCol;
    dragState.isValid = true;
    highlightPreview(dragState.piece.shape, targetRow, targetCol);
  } else {
    dragState.targetRow = null;
    dragState.targetCol = null;
    dragState.isValid = false;
  }
}

function endDrag() {
  if (!dragState) return;

  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);

  if (dragState.isValid) {
    placePiece(dragState.piece, dragState.targetRow, dragState.targetCol);
    currentPieces[dragState.slotIndex] = null;
    pieceSlots[dragState.slotIndex].innerHTML = '';
    pieceSlots[dragState.slotIndex].style.visibility = 'visible';

    audio.playPlace();
    checkAndClearLines();

    if (currentPieces.every(p => p === null)) {
      spawnPieces();
    }

    if (checkGameOver()) {
      audio.playGameOver();
      setTimeout(() => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('final-high-score').textContent = highScore;
        gameOverModal.classList.remove('hidden');
      }, 400);
    }
  } else {
    pieceSlots[dragState.slotIndex].style.visibility = 'visible';
  }

  clearHighlights();
  if (dragState.cloneEl) dragState.cloneEl.remove();
  dragState = null;
}

function canPlacePiece(shape, startRow, startCol) {
  const rows = shape.length;
  const cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c]) {
        const boardR = startRow + r;
        const boardC = startCol + c;
        if (boardR < 0 || boardR >= BOARD_SIZE || boardC < 0 || boardC >= BOARD_SIZE) {
          return false;
        }
        if (boardState[boardR][boardC] !== null) {
          return false;
        }
      }
    }
  }
  return true;
}

function highlightPreview(shape, startRow, startCol) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) {
      if (shape[r][c]) {
        const cell = boardEl.querySelector(`[data-row="${startRow + r}"][data-col="${startCol + c}"]`);
        if (cell) cell.classList.add('preview-valid');
      }
    }
  }
}

function clearHighlights() {
  const highlighted = boardEl.querySelectorAll('.preview-valid');
  highlighted.forEach(el => el.classList.remove('preview-valid'));
}

function placePiece(piece, startRow, startCol) {
  let blocksCount = 0;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[0].length; c++) {
      if (piece.shape[r][c]) {
        boardState[startRow + r][startCol + c] = piece.color;
        blocksCount++;
      }
    }
  }
  updateScore(score + blocksCount * 10);
  renderBoard();
}

function checkAndClearLines() {
  const rowsToClear = [];
  const colsToClear = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    if (boardState[r].every(cell => cell !== null)) rowsToClear.push(r);
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (boardState[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) colsToClear.push(c);
  }

  const totalLines = rowsToClear.length + colsToClear.length;

  if (totalLines > 0) {
    comboCount++;
    audio.playClear(totalLines);

    const clearedCells = new Set();
    rowsToClear.forEach(r => {
      for (let c = 0; c < BOARD_SIZE; c++) clearedCells.add(`${r}-${c}`);
    });
    colsToClear.forEach(c => {
      for (let r = 0; r < BOARD_SIZE; r++) clearedCells.add(`${r}-${c}`);
    });

    clearedCells.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      const cellEl = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (cellEl) cellEl.classList.add('clearing');
    });

    setTimeout(() => {
      clearedCells.forEach(key => {
        const [r, c] = key.split('-').map(Number);
        boardState[r][c] = null;
      });
      renderBoard();
    }, 300);

    const points = totalLines * 100 * totalLines * comboCount;
    updateScore(score + points);
    showCombo(totalLines, comboCount);
  } else {
    comboCount = 0;
  }
}

function showCombo(lines, combo) {
  let text = `${lines} LINES!`;
  if (combo > 1) text = `COMBO x${combo}!`;
  comboPopupEl.textContent = text;
  comboPopupEl.classList.add('show');
  setTimeout(() => {
    comboPopupEl.classList.remove('show');
  }, 800);
}

function checkGameOver() {
  const remaining = currentPieces.filter(p => p !== null);
  if (remaining.length === 0) return false;

  for (const piece of remaining) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlacePiece(piece.shape, r, c)) {
          return false;
        }
      }
    }
  }
  return true;
}

function updateScore(newScore) {
  score = newScore;
  scoreEl.textContent = score;
  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = highScore;
    localStorage.setItem('block_blast_highscore', highScore);
  }
}

restartBtn.addEventListener('click', initGame);

window.addEventListener('DOMContentLoaded', initGame);
    
