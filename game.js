"use strict";

/* =========================================================
   CONSTANTS
========================================================= */

const BOARD_SIZE = 8;
const PIECE_COUNT = 3;
const STORAGE_KEY = "blockBlastHighScore";
const SOUND_STORAGE_KEY = "blockBlastSoundEnabled";
const CLEAR_ANIMATION_MS = 290;

const COLORS = [
  "#7C6CFF",
  "#FF6688",
  "#38CFFF",
  "#FFB84D",
  "#5DE3A5",
  "#D875FF",
  "#FF7E5F"
];

const SHAPES = [
  [[1]],

  [[1, 1]],
  [[1], [1]],

  [[1, 1, 1]],
  [[1], [1], [1]],

  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],

  [
    [1, 1],
    [1, 1]
  ],

  [
    [1, 0],
    [1, 1]
  ],

  [
    [0, 1],
    [1, 1]
  ],

  [
    [1, 1],
    [1, 0]
  ],

  [
    [1, 1],
    [0, 1]
  ],

  [
    [1, 1, 1],
    [0, 1, 0]
  ],

  [
    [0, 1, 0],
    [1, 1, 1]
  ],

  [
    [1, 0],
    [1, 1],
    [1, 0]
  ],

  [
    [0, 1],
    [1, 1],
    [0, 1]
  ],

  [
    [1, 1, 0],
    [0, 1, 1]
  ],

  [
    [0, 1, 1],
    [1, 1, 0]
  ],

  [
    [1, 0, 0],
    [1, 1, 1]
  ],

  [
    [0, 0, 1],
    [1, 1, 1]
  ],

  [
    [1, 1],
    [1, 0],
    [1, 0]
  ],

  [
    [1, 1],
    [0, 1],
    [0, 1]
  ]
];

/* =========================================================
   DOM REFERENCES
========================================================= */

const boardElement = document.getElementById("board");
const pieceTrayElement = document.getElementById("pieceTray");

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");

const comboBadge = document.getElementById("comboBadge");
const comboValueElement = document.getElementById("comboValue");

const scorePopupsElement = document.getElementById("scorePopups");

const dragGhost = document.getElementById("dragGhost");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreElement = document.getElementById("finalScore");
const finalHighScoreElement = document.getElementById("finalHighScore");
const restartButton = document.getElementById("restartButton");

const soundButton = document.getElementById("soundButton");
const soundIcon = document.getElementById("soundIcon");

/* =========================================================
   GAME STATE
========================================================= */

const state = {
  board: [],
  pieces: [],
  score: 0,
  highScore: 0,
  combo: 0,
  gameOver: false,
  inputLocked: false,
  drag: null,
  soundEnabled: true,
  audioContext: null,
  audioMaster: null
};

/* =========================================================
   UTILITY
========================================================= */

function createEmptyBoard() {
  return Array.from(
    { length: BOARD_SIZE },
    () => Array(BOARD_SIZE).fill(null)
  );
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function getShapeCells(matrix) {
  const cells = [];

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col]) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function formatNumber(value) {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US");
}

function delay(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

/* =========================================================
   PERSISTENCE
========================================================= */

function loadHighScore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number.parseInt(raw, 10);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  } catch {
    // localStorage can be disabled or unavailable.
  }

  return 0;
}

function saveHighScore() {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.highScore));
  } catch {
    // Gameplay continues without persistence.
  }
}

function loadSoundPreference() {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);

    if (raw === "false") {
      return false;
    }

    if (raw === "true") {
      return true;
    }
  } catch {
    // Ignore unavailable storage.
  }

  return true;
}

function saveSoundPreference() {
  try {
    localStorage.setItem(
      SOUND_STORAGE_KEY,
      String(state.soundEnabled)
    );
  } catch {
    // Ignore unavailable storage.
  }
}

function updateHighScore() {
  if (state.score > state.highScore) {
    state.highScore = state.score;
    saveHighScore();
  }
}

/* =========================================================
   PIECE GENERATION
========================================================= */

function createPiece() {
  const shape = cloneMatrix(randomItem(SHAPES));

  return {
    id:
      Date.now().toString(36) +
      Math.random().toString(36).slice(2),
    shape,
    color: randomItem(COLORS)
  };
}

function generatePieces() {
  state.pieces = Array.from(
    { length: PIECE_COUNT },
    () => createPiece()
  );
}

/* =========================================================
   BOARD LOGIC
========================================================= */

function isInsideBoard(row, col) {
  return (
    row >= 0 &&
    row < BOARD_SIZE &&
    col >= 0 &&
    col < BOARD_SIZE
  );
}

function canPlacePiece(piece, startRow, startCol) {
  if (!piece || !Array.isArray(piece.shape)) {
    return false;
  }

  const cells = getShapeCells(piece.shape);

  if (cells.length === 0) {
    return false;
  }

  for (const cell of cells) {
    const row = startRow + cell.row;
    const col = startCol + cell.col;

    if (!isInsideBoard(row, col)) {
      return false;
    }

    if (state.board[row][col] !== null) {
      return false;
    }
  }

  return true;
}

function findFirstValidPosition(piece) {
  if (!piece) {
    return null;
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (canPlacePiece(piece, row, col)) {
        return { row, col };
      }
    }
  }

  return null;
}

function hasAnyMove() {
  return state.pieces.some(piece => {
    return findFirstValidPosition(piece) !== null;
  });
}

function placePiece(piece, startRow, startCol) {
  const cells = getShapeCells(piece.shape);

  if (!canPlacePiece(piece, startRow, startCol)) {
    return false;
  }

  for (const cell of cells) {
    const row = startRow + cell.row;
    const col = startCol + cell.col;

    state.board[row][col] = piece.color;
  }

  return true;
}

/* =========================================================
   LINE CLEARING
========================================================= */

function findCompletedLines() {
  const rows = [];
  const columns = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    let complete = true;

    for (let col = 0; col < BOARD_SIZE; col++) {
      if (state.board[row][col] === null) {
        complete = false;
        break;
      }
    }

    if (complete) {
      rows.push(row);
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    let complete = true;

    for (let row = 0; row < BOARD_SIZE; row++) {
      if (state.board[row][col] === null) {
        complete = false;
        break;
      }
    }

    if (complete) {
      columns.push(col);
    }
  }

  return { rows, columns };
}

function getClearedCellSet(lines) {
  const cells = new Set();

  for (const row of lines.rows) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      cells.add(`${row},${col}`);
    }
  }

  for (const col of lines.columns) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      cells.add(`${row},${col}`);
    }
  }

  return cells;
}

function clearCells(cells) {
  for (const key of cells) {
    const [row, col] = key.split(",").map(Number);

    if (isInsideBoard(row, col)) {
      state.board[row][col] = null;
    }
  }
}

/* =========================================================
   SCORING
========================================================= */

function calculateLineScore(rows, columns, clearedCellCount) {
  const lineCount = rows + columns;

  if (lineCount <= 0) {
    return 0;
  }

  const base =
    clearedCellCount * 10 +
    lineCount * 50 +
    Math.max(0, lineCount - 1) * 35;

  const multiplier = Math.max(1, state.combo);

  return base * multiplier;
}

function addScore(points) {
  if (!Number.isFinite(points) || points <= 0) {
    return;
  }

  state.score += Math.floor(points);
  updateHighScore();
  renderScore();
}

function showScorePopup(points, clientX, clientY, combo = false) {
  const popup = document.createElement("div");

  popup.className = combo
    ? "score-popup combo"
    : "score-popup";

  popup.textContent = combo
    ? `COMBO ×${state.combo}`
    : `+${formatNumber(points)}`;

  const fallbackX = window.innerWidth / 2;
  const fallbackY = window.innerHeight / 2;

  popup.style.left = `${Number.isFinite(clientX) ? clientX : fallbackX}px`;
  popup.style.top = `${Number.isFinite(clientY) ? clientY : fallbackY}px`;

  scorePopupsElement.appendChild(popup);

  window.setTimeout(() => {
    popup.remove();
  }, 850);
}

function renderScore() {
  scoreElement.textContent = formatNumber(state.score);
  highScoreElement.textContent = formatNumber(state.highScore);
}

/* =========================================================
   RENDERING
========================================================= */

function renderBoard() {
  boardElement.textContent = "";

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.createElement("div");

      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("role", "gridcell");

      const color = state.board[row][col];

      if (color !== null) {
        cell.classList.add("occupied");
        cell.style.background = color;
      }

      boardElement.appendChild(cell);
    }
  }
}

function createPieceVisual(piece, ghost = false) {
  const container = document.createElement("div");

  container.className = ghost
    ? "drag-piece-grid"
    : "piece-grid";

  container.style.gridTemplateColumns =
    `repeat(${piece.shape[0].length}, max-content)`;

  container.style.gridTemplateRows =
    `repeat(${piece.shape.length}, max-content)`;

  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      const block = document.createElement("div");

      if (piece.shape[row][col]) {
        block.className = "piece-block";
        block.style.background = piece.color;
      } else {
        block.style.visibility = "hidden";
        block.className = "piece-block";
      }

      container.appendChild(block);
    }
  }

  return container;
}

function renderPieces() {
  pieceTrayElement.textContent = "";

  state.pieces.forEach((piece, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "piece-button";
    button.dataset.pieceId = piece.id;
    button.dataset.index = String(index);

    button.setAttribute(
      "aria-label",
      `Piece ${index + 1}, ${getShapeCells(piece.shape).length} blocks`
    );

    button.appendChild(createPieceVisual(piece));
    button.addEventListener("pointerdown", handlePiecePointerDown);
    button.addEventListener("keydown", handlePieceKeyDown);

    pieceTrayElement.appendChild(button);
  });
}

function renderAll() {
  renderBoard();
  renderPieces();
  renderScore();
  updateComboUI();
}

/* =========================================================
   PREVIEW
========================================================= */

function clearPreview() {
  const cells = boardElement.querySelectorAll(
    ".preview-valid, .preview-invalid"
  );

  cells.forEach(cell => {
    cell.classList.remove(
      "preview-valid",
      "preview-invalid"
    );
  });
}

function getBoardCellSize() {
  const rect = boardElement.getBoundingClientRect();

  const styles = window.getComputedStyle(boardElement);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const gap = Number.parseFloat(styles.columnGap) || 0;

  const usableWidth =
    rect.width -
    paddingLeft -
    paddingRight -
    gap * (BOARD_SIZE - 1);

  const usableHeight =
    rect.height -
    paddingTop -
    paddingBottom -
    gap * (BOARD_SIZE - 1);

  return {
    width: usableWidth / BOARD_SIZE,
    height: usableHeight / BOARD_SIZE,
    rect,
    paddingLeft,
    paddingTop,
    gap
  };
}

function getBoardPositionFromPointer(clientX, clientY) {
  const metrics = getBoardCellSize();

  const localX =
    clientX -
    metrics.rect.left -
    metrics.paddingLeft;

  const localY =
    clientY -
    metrics.rect.top -
    metrics.paddingTop;

  const stepX = metrics.width + metrics.gap;
  const stepY = metrics.height + metrics.gap;

  const col = Math.floor(localX / stepX);
  const row = Math.floor(localY / stepY);

  return { row, col };
}

function updatePreview(clientX, clientY) {
  clearPreview();

  const drag = state.drag;

  if (!drag || !drag.piece) {
    return;
  }

  const position = getBoardPositionFromPointer(
    clientX,
    clientY
  );

  const startRow =
    position.row - drag.anchorRow;

  const startCol =
    position.col - drag.anchorCol;

  const valid = canPlacePiece(
    drag.piece,
    startRow,
    startCol
  );

  for (const cell of getShapeCells(drag.piece.shape)) {
    const row = startRow + cell.row;
    const col = startCol + cell.col;

    if (!isInsideBoard(row, col)) {
      continue;
    }

    const boardCell = boardElement.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"]`
    );

    if (boardCell) {
      boardCell.classList.add(
        valid
          ? "preview-valid"
          : "preview-invalid"
      );
    }
  }

  drag.previewRow = startRow;
  drag.previewCol = startCol;
  drag.previewValid = valid;
}

/* =========================================================
   DRAG GHOST
========================================================= */

function setupDragGhost(piece) {
  dragGhost.textContent = "";

  const visual = createPieceVisual(piece, true);

  dragGhost.appendChild(visual);
  dragGhost.style.gridTemplateColumns =
    `repeat(${piece.shape[0].length}, max-content)`;
  dragGhost.style.gridTemplateRows =
    `repeat(${piece.shape.length}, max-content)`;

  dragGhost.hidden = false;
}

function moveDragGhost(clientX, clientY) {
  if (!state.drag) {
    return;
  }

  const x =
    clientX -
    state.drag.ghostOffsetX;

  const y =
    clientY -
    state.drag.ghostOffsetY;

  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function hideDragGhost() {
  dragGhost.hidden = true;
  dragGhost.textContent = "";
}

/* =========================================================
   DRAGGING
========================================================= */

function getPieceFromElement(element) {
  const button = element.closest(".piece-button");

  if (!button) {
    return null;
  }

  const pieceId = button.dataset.pieceId;

  return state.pieces.find(
    piece => piece.id === pieceId
  ) || null;
}

function getPointerAnchor(event, button) {
  const rect = button.getBoundingClientRect();

  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  const piece = getPieceFromElement(button);

  if (!piece) {
    return { row: 0, col: 0 };
  }

  const cols = piece.shape[0].length;
  const rows = piece.shape.length;

  const visualWidth =
    Math.max(1, rect.width - 16);

  const visualHeight =
    Math.max(1, rect.height - 16);

  const cellWidth =
    visualWidth / Math.max(1, cols);

  const cellHeight =
    visualHeight / Math.max(1, rows);

  const col = Math.min(
    cols - 1,
    Math.max(0, Math.floor(
      (localX - 8) / cellWidth
    ))
  );

  const row = Math.min(
    rows - 1,
    Math.max(0, Math.floor(
      (localY - 8) / cellHeight
    ))
  );

  return { row, col };
}

function handlePiecePointerDown(event) {
  if (
    state.gameOver ||
    state.inputLocked ||
    state.drag
  ) {
    return;
  }

  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  const button = event.currentTarget;
  const piece = getPieceFromElement(button);

  if (!piece) {
    return;
  }

  event.preventDefault();

  initializeAudio();

  const anchor = getPointerAnchor(event, button);
  const rect = button.getBoundingClientRect();

  state.drag = {
    pointerId: event.pointerId,
    piece,
    pieceIndex: state.pieces.indexOf(piece),
    anchorRow: anchor.row,
    anchorCol: anchor.col,
    ghostOffsetX: Math.min(
      rect.width * 0.5,
      Math.max(12, rect.width * 0.25)
    ),
    ghostOffsetY: Math.min(
      rect.height * 0.35,
      Math.max(10, rect.height * 0.2)
    ),
    previewRow: null,
    previewCol: null,
    previewValid: false,
    sourceButton: button
  };

  button.classList.add("dragging");

  try {
    button.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture may fail on unusual browsers.
  }

  setupDragGhost(piece);
  moveDragGhost(event.clientX, event.clientY);
  updatePreview(event.clientX, event.clientY);

  window.addEventListener(
    "pointermove",
    handleGlobalPointerMove,
    { passive: false }
  );

  window.addEventListener(
    "pointerup",
    handleGlobalPointerUp,
    { passive: false, once: true }
  );

  window.addEventListener(
    "pointercancel",
    handleGlobalPointerCancel,
    { passive: false, once: true }
  );
}

function handleGlobalPointerMove(event) {
  if (!state.drag) {
    return;
  }

  if (
    state.drag.pointerId !== event.pointerId
  ) {
    return;
  }

  event.preventDefault();

  moveDragGhost(event.clientX, event.clientY);
  updatePreview(event.clientX, event.clientY);
}

function removeGlobalDragListeners() {
  window.removeEventListener(
    "pointermove",
    handleGlobalPointerMove
  );

  window.removeEventListener(
    "pointerup",
    handleGlobalPointerUp
  );

  window.removeEventListener(
    "pointercancel",
    handleGlobalPointerCancel
  );
}

function endDrag() {
  const drag = state.drag;

  if (!drag) {
    return;
  }

  if (drag.sourceButton) {
    drag.sourceButton.classList.remove("dragging");

    try {
      if (
        drag.sourceButton.hasPointerCapture(
          drag.pointerId
        )
      ) {
        drag.sourceButton.releasePointerCapture(
          drag.pointerId
        );
      }
    } catch {
      // Ignore pointer capture cleanup failures.
    }
  }

  clearPreview();
  hideDragGhost();
  removeGlobalDragListeners();

  state.drag = null;
}

function handleGlobalPointerUp(event) {
  if (!state.drag) {
    return;
  }

  if (
    state.drag.pointerId !== event.pointerId
  ) {
    return;
  }

  event.preventDefault();

  const drag = state.drag;

  const valid =
    drag.previewValid &&
    Number.isInteger(drag.previewRow) &&
    Number.isInteger(drag.previewCol) &&
    canPlacePiece(
      drag.piece,
      drag.previewRow,
      drag.previewCol
    );

  if (valid) {
    const row = drag.previewRow;
    const col = drag.previewCol;

    endDrag();

    performPlacement(
      drag.piece,
      drag.pieceIndex,
      row,
      col,
      event.clientX,
      event.clientY
    );
  } else {
    endDrag();
  }
}

function handleGlobalPointerCancel(event) {
  if (!state.drag) {
    return;
  }

  if (
    state.drag.pointerId !== event.pointerId
  ) {
    return;
  }

  endDrag();
}

/* =========================================================
   KEYBOARD
========================================================= */

function handlePieceKeyDown(event) {
  if (
    state.gameOver ||
    state.inputLocked
  ) {
        return;
  }

  if (
    event.key !== "Enter" &&
    event.key !== " "
  ) {
    return;
  }

  event.preventDefault();

  initializeAudio();

  const button = event.currentTarget;
  const piece = getPieceFromElement(button);

  if (!piece) {
    return;
  }

  const index = state.pieces.indexOf(piece);
  const position = findFirstValidPosition(piece);

  if (!position) {
    button.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 180 }
    );

    return;
  }

  performPlacement(
    piece,
    index,
    position.row,
    position.col,
    window.innerWidth / 2,
    window.innerHeight / 2
  );
}

/* =========================================================
   PLACEMENT FLOW
========================================================= */

async function performPlacement(
  piece,
  pieceIndex,
  row,
  col,
  popupX,
  popupY
) {
  if (
    state.gameOver ||
    state.inputLocked ||
    !piece
  ) {
    return;
  }

  if (
    !Number.isInteger(pieceIndex) ||
    state.pieces[pieceIndex]?.id !== piece.id
  ) {
    return;
  }

  if (!canPlacePiece(piece, row, col)) {
    return;
  }

  state.inputLocked = true;

  const placedCells = getShapeCells(piece.shape).length;

  const placed = placePiece(
    piece,
    row,
    col
  );

  if (!placed) {
    state.inputLocked = false;
    return;
  }

  addScore(placedCells * 5);
  showScorePopup(
    placedCells * 5,
    popupX,
    popupY
  );

  playPlaceSound();

  state.pieces.splice(pieceIndex, 1);

  renderBoard();
  renderPieces();

  await resolveLines();

  if (!state.gameOver) {
    while (state.pieces.length < PIECE_COUNT) {
      state.pieces.push(createPiece());
    }

    renderPieces();

    checkGameOver();
  }

  state.inputLocked = false;
}

/* =========================================================
   LINE RESOLUTION
========================================================= */

async function resolveLines() {
  const lines = findCompletedLines();

  if (
    lines.rows.length === 0 &&
    lines.columns.length === 0
  ) {
    state.combo = 0;
    updateComboUI();
    return;
  }

  state.combo += 1;
  updateComboUI();

  const clearedCells = getClearedCellSet(lines);

  const points = calculateLineScore(
    lines.rows.length,
    lines.columns.length,
    clearedCells.size
  );

  addScore(points);

  showScorePopup(
    points,
    window.innerWidth / 2,
    window.innerHeight * 0.45
  );

  if (state.combo > 1) {
    showScorePopup(
      0,
      window.innerWidth / 2,
      window.innerHeight * 0.45,
      true
    );

    playComboSound(state.combo);
  } else {
    playClearSound(
      lines.rows.length + lines.columns.length
    );
  }

  markCellsAsClearing(clearedCells);

  await delay(CLEAR_ANIMATION_MS);

  clearCells(clearedCells);
  renderBoard();
}

function markCellsAsClearing(cells) {
  for (const key of cells) {
    const [row, col] = key.split(",").map(Number);

    const boardCell = boardElement.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"]`
    );

    if (boardCell) {
      boardCell.classList.add("clearing");
    }
  }
}

function updateComboUI() {
  if (state.combo > 0) {
    comboBadge.hidden = false;
    comboValueElement.textContent =
      String(state.combo);
  } else {
    comboBadge.hidden = true;
  }
}

/* =========================================================
   GAME OVER
========================================================= */

function checkGameOver() {
  if (state.gameOver) {
    return true;
  }

  if (state.pieces.length === 0) {
    return false;
  }

  if (hasAnyMove()) {
    return false;
  }

  triggerGameOver();
  return true;
}

function triggerGameOver() {
  if (state.gameOver) {
    return;
  }

  state.gameOver = true;
  state.inputLocked = true;

  if (state.drag) {
    endDrag();
  }

  updateHighScore();
  renderScore();

  finalScoreElement.textContent =
    formatNumber(state.score);

  finalHighScoreElement.textContent =
    formatNumber(state.highScore);

  gameOverOverlay.hidden = false;

  playGameOverSound();

  window.setTimeout(() => {
    restartButton.focus();
  }, 50);
}

/* =========================================================
   RESTART
========================================================= */

function restartGame() {
  if (state.drag) {
    endDrag();
  }

  state.gameOver = false;
  state.inputLocked = true;
  state.score = 0;
  state.combo = 0;
  state.board = createEmptyBoard();

  generatePieces();

  gameOverOverlay.hidden = true;

  renderAll();

  window.setTimeout(() => {
    state.inputLocked = false;
    checkGameOver();
  }, 80);
}

/* =========================================================
   AUDIO
========================================================= */

function initializeAudio() {
  if (!state.soundEnabled) {
    return;
  }

  try {
    if (!state.audioContext) {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      state.audioContext =
        new AudioContextClass();

      state.audioMaster =
        state.audioContext.createGain();

      state.audioMaster.gain.value = 0.12;
      state.audioMaster.connect(
        state.audioContext.destination
      );
    }

    if (
      state.audioContext.state === "suspended"
    ) {
      state.audioContext.resume().catch(() => {});
    }
  } catch {
    state.audioContext = null;
    state.audioMaster = null;
  }
}

function createTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.25,
  endFrequency = frequency
) {
  if (
    !state.soundEnabled ||
    !state.audioContext ||
    !state.audioMaster
  ) {
    return;
  }

  try {
    const context = state.audioContext;
    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    const now = context.currentTime;
    const end = now + duration;

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
      frequency,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      end
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      now + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end
    );

    oscillator.connect(gain);
    gain.connect(state.audioMaster);

    oscillator.start(now);
    oscillator.stop(end + 0.01);
  } catch {
    // Audio must never break gameplay.
  }
}

function playPlaceSound() {
  initializeAudio();

  createTone(
    430,
    0.07,
    "sine",
    0.25,
    650
  );
}

function playClearSound(lineCount) {
  initializeAudio();

  const count = Math.max(
    1,
    Math.min(5, lineCount)
  );

  createTone(
    500 + count * 35,
    0.12,
    "triangle",
    0.3,
    820 + count * 45
  );

  window.setTimeout(() => {
    createTone(
      720 + count * 40,
      0.11,
      "sine",
      0.22,
      1050 + count * 50
    );
  }, 65);
}

function playComboSound(combo) {
  initializeAudio();

  const intensity =
    Math.min(6, Math.max(2, combo));

  createTone(
    650 + intensity * 35,
    0.09,
    "triangle",
    0.3,
    1050 + intensity * 50
  );

  window.setTimeout(() => {
    createTone(
      900 + intensity * 40,
      0.1,
      "triangle",
      0.25,
      1300 + intensity * 55
    );
  }, 70);
}

function playGameOverSound() {
  initializeAudio();

  createTone(
    390,
    0.16,
    "sine",
    0.25,
    250
  );

  window.setTimeout(() => {
    createTone(
      240,
      0.2,
      "sine",
      0.2,
      120
    );
  }, 125);
}

function toggleSound() {
  state.soundEnabled =
    !state.soundEnabled;

  soundIcon.textContent =
    state.soundEnabled ? "🔊" : "🔇";

  soundButton.setAttribute(
    "aria-pressed",
    String(state.soundEnabled)
  );

  saveSoundPreference();

  if (state.soundEnabled) {
    initializeAudio();
    createTone(
      600,
      0.08,
      "sine",
      0.18,
      760
    );
  }
}

/* =========================================================
   SERVICE WORKER
========================================================= */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => {
        // The game remains fully playable without SW.
      });
  });
}

/* =========================================================
   GLOBAL SAFETY
========================================================= */

function handleVisibilityChange() {
  if (
    document.hidden &&
    state.drag
  ) {
    endDrag();
  }
}

function handleWindowBlur() {
  if (state.drag) {
    endDrag();
  }
}

function handleUnexpectedPointerUp() {
  if (state.drag) {
    endDrag();
  }
}

/* =========================================================
   INITIALIZATION
========================================================= */

function initializeGame() {
  state.highScore = loadHighScore();
  state.soundEnabled = loadSoundPreference();

  state.board = createEmptyBoard();
  generatePieces();

  soundIcon.textContent =
    state.soundEnabled ? "🔊" : "🔇";

  soundButton.setAttribute(
    "aria-pressed",
    String(state.soundEnabled)
  );

  renderAll();

  soundButton.addEventListener(
    "click",
    toggleSound
  );

  restartButton.addEventListener(
    "click",
    () => {
      initializeAudio();
      playPlaceSound();
      restartGame();
    }
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.addEventListener(
    "blur",
    handleWindowBlur
  );

  window.addEventListener(
    "pointerup",
    handleUnexpectedPointerUp
  );

  window.addEventListener(
    "pointercancel",
    handleUnexpectedPointerUp
  );

  window.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "r" ||
        event.key === "R"
      ) {
        if (state.gameOver) {
          event.preventDefault();
          initializeAudio();
          restartGame();
        }
      }
    }
  );

  registerServiceWorker();

  checkGameOver();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeGame
);
