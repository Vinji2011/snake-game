const canvas = document.querySelector('#board');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const bestElement = document.querySelector('#best');
const statusElement = document.querySelector('#game-status');
const overlay = document.querySelector('#game-overlay');
const overlayKicker = document.querySelector('#overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlayButton = document.querySelector('#overlay-button');
const pauseButton = document.querySelector('#pause-button');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
const directions = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

let snake;
let direction;
let nextDirection;
let food;
let score;
let best = 0;
let state = 'running';
let tickTimer;

function readBestScore() {
  if (globalThis.chrome?.storage?.local) {
    chrome.storage.local.get({ snakeBest: 0 }, (values) => {
      best = values.snakeBest;
      updateScores();
    });
    return;
  }

  best = Number(localStorage.getItem('snakeBest')) || 0;
  updateScores();
}

function saveBestScore() {
  if (globalThis.chrome?.storage?.local) {
    chrome.storage.local.set({ snakeBest: best });
  } else {
    localStorage.setItem('snakeBest', String(best));
  }
}

function updateScores() {
  scoreElement.textContent = String(score).padStart(2, '0');
  bestElement.textContent = String(best).padStart(2, '0');
}

function placeFood() {
  const openCells = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        openCells.push({ x, y });
      }
    }
  }
  food = openCells.length ? openCells[Math.floor(Math.random() * openCells.length)] : null;
}

function resetGame() {
  clearInterval(tickTimer);
  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];
  direction = directions.right;
  nextDirection = direction;
  score = 0;
  state = 'ready';
  placeFood();
  overlayKicker.textContent = 'READY';
  overlayTitle.textContent = 'Ready when you are.';
  overlayButton.textContent = 'Start game';
  overlay.hidden = false;
  pauseButton.textContent = 'Ⅱ';
  pauseButton.setAttribute('aria-label', 'Game not started');
  pauseButton.disabled = true;
  statusElement.textContent = 'Ready when you are.';
  updateScores();
  draw();
}

function startGame() {
  if (state !== 'ready') return;
  state = 'running';
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.setAttribute('aria-label', 'Pause game');
  statusElement.textContent = 'Make it count.';
  tickTimer = setInterval(step, 125);
}

function setDirection(name) {
  if (state !== 'running') return;
  const requested = directions[name];
  if (requested.x === -direction.x && requested.y === -direction.y) return;
  nextDirection = requested;
}

function step() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };
  const eating = head.x === food?.x && head.y === food?.y;
  const body = eating ? snake : snake.slice(0, -1);
  const hitWall = head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
  const hitBody = body.some((segment) => segment.x === head.x && segment.y === head.y);

  if (hitWall || hitBody) {
    finishGame();
    return;
  }

  snake.unshift(head);
  if (eating) {
    score += 1;
    if (score > best) {
      best = score;
      saveBestScore();
    }
    placeFood();
    updateScores();
    statusElement.textContent = score % 5 === 0 ? 'On a roll.' : 'Nice one.';
    if (!food) {
      finishGame(true);
      return;
    }
  } else {
    snake.pop();
  }
  draw();
}

function finishGame(won = false) {
  clearInterval(tickTimer);
  state = 'over';
  overlayKicker.textContent = won ? 'BOARD CLEARED' : 'GAME OVER';
  overlayTitle.textContent = won ? 'Perfect run.' : 'One more go?';
  overlayButton.textContent = 'Play again';
  overlay.hidden = false;
  pauseButton.textContent = 'Ⅱ';
  pauseButton.setAttribute('aria-label', 'Game over');
  pauseButton.disabled = true;
  statusElement.textContent = won ? 'A perfect run.' : 'Score ' + score + '. Keep going.';
  draw();
}

function togglePause() {
  if (state === 'running') {
    clearInterval(tickTimer);
    state = 'paused';
    overlayKicker.textContent = 'PAUSED';
    overlayTitle.textContent = 'Take a breath.';
    overlayButton.textContent = 'Resume';
    overlay.hidden = false;
    pauseButton.disabled = false;
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', 'Resume game');
    statusElement.textContent = 'Paused.';
  } else if (state === 'paused') {
    state = 'running';
    overlay.hidden = true;
      pauseButton.disabled = false;
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', 'Pause game');
    statusElement.textContent = 'Back in.';
    tickTimer = setInterval(step, 125);
  }
}

function draw() {
  context.fillStyle = '#173e32';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(216, 239, 182, 0.065)';
  context.lineWidth = 1;
  for (let line = 1; line < gridSize; line += 1) {
    const position = line * cellSize + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, position);
    context.lineTo(canvas.width, position);
    context.stroke();
  }

  if (food) {
    const centerX = food.x * cellSize + cellSize / 2;
    const centerY = food.y * cellSize + cellSize / 2;
    context.fillStyle = '#f27b5d';
    context.beginPath();
    context.arc(centerX, centerY, cellSize * 0.34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd291';
    context.fillRect(centerX - 1, centerY - 1, 3, 3);
  }

  snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 2.5;
    context.fillStyle = index === 0 ? '#d9fa7b' : index % 2 ? '#9bd85b' : '#b3e76a';
    context.beginPath();
    context.roundRect(
      segment.x * cellSize + inset,
      segment.y * cellSize + inset,
      cellSize - inset * 2,
      cellSize - inset * 2,
      4
    );
    context.fill();
  });

  const head = snake[0];
  const eyeOffset = direction.x === 0 ? 5 : direction.x * 4;
  const eyeSide = direction.y === 0 ? 5 : direction.y * 4;
  context.fillStyle = '#234335';
  for (const side of [-1, 1]) {
    const eyeX = head.x * cellSize + cellSize / 2 + (direction.x === 0 ? side * 4 : eyeOffset);
    const eyeY = head.y * cellSize + cellSize / 2 + (direction.y === 0 ? side * 4 : eyeSide);
    context.fillRect(eyeX - 1, eyeY - 1, 2, 2);
  }
}

document.addEventListener('keydown', (event) => {
  const keyDirections = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left'
  };
  const requested = keyDirections[event.key];
  if (requested) {
    event.preventDefault();
    setDirection(requested);
  } else if (event.code === 'Space') {
    event.preventDefault();
    togglePause();
  }
});

document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => setDirection(button.dataset.direction));
});

pauseButton.addEventListener('click', togglePause);
document.querySelector('#restart-button').addEventListener('click', resetGame);
overlayButton.addEventListener('click', () => {
  if (state === 'ready') startGame();
  else if (state === 'paused') togglePause();
  else resetGame();
});

readBestScore();
resetGame();