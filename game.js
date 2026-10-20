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
const menuButton = document.querySelector('#menu-button');
const menuScreen = document.querySelector('#main-menu');
const gameScreen = document.querySelector('#game-screen');
const heading = document.querySelector('#game-heading');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
const directions = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};
const gameNames = {
  snake: 'Snake',
  pacman: 'Pac-Man',
  pong: 'Ping Pong',
  runner: 'Run & Jump'
};
const mazeSize = 16;
const pongTickMs = 24;
const runnerTickMs = 24;

let mode = 'snake';
let gameState = 'menu';
let tickTimer;
let score = 0;
let bestScores = { snake: 0, pacman: 0, pong: 0, runner: 0 };
let snake;
let direction;
let nextDirection;
let food;
let maze;
let pellets;
let pacman;
let ghosts;
let paddle;
let ball;
let runner;
let obstacles;
let runnerDistance;

function storageGet(defaults, callback) {
  if (globalThis.chrome?.storage?.local) {
    chrome.storage.local.get(defaults, callback);
  } else {
    const values = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      const stored = localStorage.getItem(key);
      if (stored !== null) values[key] = Number(stored) || 0;
    });
    callback(values);
  }
}

function storageSet(values) {
  if (globalThis.chrome?.storage?.local) {
    chrome.storage.local.set(values);
  } else {
    Object.entries(values).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });
  }
}

function readBestScores() {
  storageGet({
    snakeBest: 0,
    pacmanBest: 0,
    pongBest: 0,
    runnerBest: 0
  }, (values) => {
    bestScores = {
      snake: values.snakeBest,
      pacman: values.pacmanBest,
      pong: values.pongBest,
      runner: values.runnerBest
    };
    updateScores();
  });
}

function updateScores() {
  scoreElement.textContent = String(score).padStart(2, '0');
  bestElement.textContent = String(bestScores[mode] || 0).padStart(2, '0');
}

function setScore(value) {
  score = value;
  if (score > bestScores[mode]) {
    bestScores[mode] = score;
    storageSet({ [mode + 'Best']: score });
  }
  updateScores();
}

function showMenu() {
  clearInterval(tickTimer);
  gameState = 'menu';
  heading.firstChild.textContent = 'Little Arcade';
  menuScreen.hidden = false;
  gameScreen.hidden = true;
}

function selectGame(name) {
  mode = name;
  menuScreen.hidden = true;
  gameScreen.hidden = false;
  heading.firstChild.textContent = gameNames[mode];
  canvas.setAttribute('aria-label', gameNames[mode] + ' game board');
  resetGame();
}

function resetGame() {
  clearInterval(tickTimer);
  score = 0;
  gameState = 'ready';
  pauseButton.textContent = 'Ⅱ';
  pauseButton.disabled = true;
  pauseButton.setAttribute('aria-label', 'Game not started');
  overlayKicker.textContent = 'READY';
  overlayTitle.textContent = 'Ready when you are.';
  overlayButton.textContent = 'Start game';
  overlay.hidden = false;
  statusElement.textContent = 'Ready when you are.';
  updateScores();

  if (mode === 'snake') resetSnake();
  if (mode === 'pacman') resetPacman();
  if (mode === 'pong') resetPong();
  if (mode === 'runner') resetRunner();
  draw();
}

function startGame() {
  if (gameState !== 'ready') return;
  gameState = 'running';
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.setAttribute('aria-label', 'Pause game');
  statusElement.textContent = mode === 'runner' ? 'Jump over the cacti.' : 'Make it count.';
  tickTimer = setInterval(step, mode === 'pong' ? pongTickMs : mode === 'runner' ? runnerTickMs : 125);
}

function finishGame(won = false) {
  clearInterval(tickTimer);
  gameState = 'over';
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
  if (gameState === 'running') {
    clearInterval(tickTimer);
    gameState = 'paused';
    overlayKicker.textContent = 'PAUSED';
    overlayTitle.textContent = 'Take a breath.';
    overlayButton.textContent = 'Resume';
    overlay.hidden = false;
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', 'Resume game');
    statusElement.textContent = 'Paused.';
  } else if (gameState === 'paused') {
    gameState = 'running';
    overlay.hidden = true;
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', 'Pause game');
    statusElement.textContent = 'Back in.';
    tickTimer = setInterval(step, mode === 'pong' ? pongTickMs : mode === 'runner' ? runnerTickMs : 125);
  }
}

function step() {
  if (mode === 'snake') stepSnake();
  if (mode === 'pacman') stepPacman();
  if (mode === 'pong') stepPong();
  if (mode === 'runner') stepRunner();
}

function setDirection(name) {
  if (gameState !== 'running') return;
  const requested = directions[name];
  if (mode === 'snake') {
    if (requested.x === -direction.x && requested.y === -direction.y) return;
    nextDirection = requested;
  } else if (mode === 'pacman') {
    pacman.nextDirection = requested;
  } else if (mode === 'pong') {
    paddle.direction = requested.y;
  }
}

function resetSnake() {
  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];
  direction = directions.right;
  nextDirection = direction;
  placeFood();
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

function stepSnake() {
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
    setScore(score + 1);
    placeFood();
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

function buildMaze() {
  return Array.from({ length: mazeSize }, (_, y) =>
    Array.from({ length: mazeSize }, (_, x) => {
      if (x === 0 || y === 0 || x === mazeSize - 1 || y === mazeSize - 1) return 1;
      const verticalBlock = (x === 3 || x === 4 || x === 11 || x === 12) && y >= 2 && y <= 5;
      const lowerBlock = (x === 3 || x === 4 || x === 11 || x === 12) && y >= 9 && y <= 13;
      const horizontalBlock = y === 7 && x >= 6 && x <= 9;
      return verticalBlock || lowerBlock || horizontalBlock ? 1 : 0;
    })
  );
}

function resetPacman() {
  maze = buildMaze();
  pacman = { x: 1, y: 1, direction: directions.right, nextDirection: directions.right };
  ghosts = [
    { x: 14, y: 1, color: '#f27b5d' },
    { x: 14, y: 14, color: '#71c6e8' },
    { x: 1, y: 14, color: '#d68ce5' }
  ];
  pellets = [];
  for (let y = 1; y < mazeSize - 1; y += 1) {
    for (let x = 1; x < mazeSize - 1; x += 1) {
      if (!maze[y][x] && !(x === pacman.x && y === pacman.y)) pellets.push({ x, y });
    }
  }
}

function canMoveInMaze(x, y) {
  return x >= 0 && x < mazeSize && y >= 0 && y < mazeSize && maze[y][x] === 0;
}

function stepPacman() {
  const turnX = pacman.x + pacman.nextDirection.x;
  const turnY = pacman.y + pacman.nextDirection.y;
  if (canMoveInMaze(turnX, turnY)) pacman.direction = pacman.nextDirection;
  const nextX = pacman.x + pacman.direction.x;
  const nextY = pacman.y + pacman.direction.y;
  if (canMoveInMaze(nextX, nextY)) {
    pacman.x = nextX;
    pacman.y = nextY;
  }

  const pelletIndex = pellets.findIndex((pellet) => pellet.x === pacman.x && pellet.y === pacman.y);
  if (pelletIndex >= 0) {
    pellets.splice(pelletIndex, 1);
    setScore(score + 10);
  }
  for (const ghost of ghosts) {
    const choices = Object.values(directions)
      .map((move) => ({ x: ghost.x + move.x, y: ghost.y + move.y }))
      .filter((spot) => canMoveInMaze(spot.x, spot.y));
    choices.sort((a, b) =>
      (Math.abs(a.x - pacman.x) + Math.abs(a.y - pacman.y)) -
      (Math.abs(b.x - pacman.x) + Math.abs(b.y - pacman.y))
    );
    if (choices.length) {
      const choice = Math.random() < 0.75 ? choices[0] : choices[Math.floor(Math.random() * choices.length)];
      ghost.x = choice.x;
      ghost.y = choice.y;
    }
    if (ghost.x === pacman.x && ghost.y === pacman.y) {
      finishGame();
      return;
    }
  }
  if (!pellets.length) {
    finishGame(true);
    return;
  }
  draw();
}

function resetPong() {
  paddle = { y: 125, height: 70, direction: 0 };
  ball = { x: 160, y: 160, vx: -4.2, vy: 3, radius: 6 };
}

function stepPong() {
  paddle.y += paddle.direction * 7;
  paddle.y = Math.max(0, Math.min(canvas.height - paddle.height, paddle.y));
  const aiY = ball.y - paddle.height / 2;
  const rightPaddleY = Math.max(0, Math.min(canvas.height - paddle.height, aiY));
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.y < ball.radius || ball.y > canvas.height - ball.radius) ball.vy *= -1;

  if (ball.vx < 0 && ball.x - ball.radius <= 24 && ball.y >= paddle.y && ball.y <= paddle.y + paddle.height) {
    ball.x = 31;
    ball.vx = Math.abs(ball.vx) * 1.06;
    ball.vy += (ball.y - (paddle.y + paddle.height / 2)) * 0.055;
    setScore(score + 1);
  } else if (ball.vx > 0 && ball.x + ball.radius >= canvas.width - 24 &&
    ball.y >= rightPaddleY && ball.y <= rightPaddleY + paddle.height) {
    ball.x = canvas.width - 31;
    ball.vx = -Math.abs(ball.vx) * 1.04;
    ball.vy += (ball.y - (rightPaddleY + paddle.height / 2)) * 0.035;
  }
  if (ball.x < -ball.radius) {
    finishGame();
    return;
  }
  if (ball.x > canvas.width + ball.radius) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = -4.2;
    ball.vy = Math.random() < 0.5 ? -3 : 3;
  }
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > 10) {
    ball.vx = (ball.vx / ballSpeed) * 10;
    ball.vy = (ball.vy / ballSpeed) * 10;
  }
  draw(rightPaddleY);
}

function resetRunner() {
  runner = { x: 48, y: 254, width: 25, height: 32, velocityY: 0, grounded: true };
  obstacles = createCactusGroup(350);
  runner.nextSpawnX = 350 + cactusGroupWidth(obstacles) + randomBetween(45, 165);
  runnerDistance = 0;
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function createCactusGroup(startX) {
  const count = 1 + Math.floor(Math.random() * 3);
  const group = [];
  let x = startX;
  for (let index = 0; index < count; index += 1) {
    const width = 16 + Math.floor(Math.random() * 7);
    group.push({
      x,
      width,
      height: 28 + Math.floor(Math.random() * 19)
    });
    x += width + randomBetween(8, 16);
  }
  return group;
}

function cactusGroupWidth(group) {
  const lastCactus = group[group.length - 1];
  return lastCactus.x + lastCactus.width - group[0].x;
}

function jump() {
  if (gameState === 'running' && mode === 'runner' && runner.grounded) {
    runner.velocityY = -11;
    runner.grounded = false;
  }
}

function stepRunner() {
  runnerDistance += 1;
  if (runnerDistance % 5 === 0) setScore(Math.floor(runnerDistance / 5));
  runner.velocityY += 0.55;
  runner.y += runner.velocityY;
  if (runner.y >= 254) {
    runner.y = 254;
    runner.velocityY = 0;
    runner.grounded = true;
  }
  const speed = 5.5 + Math.min(4, score / 80);
  obstacles.forEach((obstacle) => {
    obstacle.x -= speed;
  });
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
  runner.nextSpawnX -= speed;
  if (runner.nextSpawnX <= canvas.width) {
    const group = createCactusGroup(runner.nextSpawnX);
    obstacles.push(...group);
    runner.nextSpawnX += cactusGroupWidth(group) + randomBetween(45, 165);
  }
  for (const obstacle of obstacles) {
    const overlaps = runner.x + runner.width - 5 > obstacle.x &&
      runner.x + 5 < obstacle.x + obstacle.width &&
      runner.y + runner.height > 286 - obstacle.height;
    if (overlaps) {
      finishGame();
      return;
    }
  }
  if (gameState === 'running') draw();
}

function draw() {
  if (mode === 'snake') drawSnake();
  if (mode === 'pacman') drawPacman();
  if (mode === 'pong') drawPong();
  if (mode === 'runner') drawRunner();
}

function drawSnake() {
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
    context.fillStyle = '#f27b5d';
    context.beginPath();
    context.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, cellSize * 0.34, 0, Math.PI * 2);
    context.fill();
  }
  snake.forEach((segment, index) => {
    const inset = 2.5;
    context.fillStyle = index === 0 ? '#d9fa7b' : index % 2 ? '#9bd85b' : '#b3e76a';
    context.beginPath();
    context.roundRect(segment.x * cellSize + inset, segment.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2, 4);
    context.fill();
  });
  const head = snake[0];
  context.fillStyle = '#234335';
  context.fillRect(head.x * cellSize + 6, head.y * cellSize + 6, 2, 2);
  context.fillRect(head.x * cellSize + 12, head.y * cellSize + 6, 2, 2);
}

function drawPacman() {
  context.fillStyle = '#10142d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < mazeSize; y += 1) {
    for (let x = 0; x < mazeSize; x += 1) {
      if (maze[y][x]) {
        context.fillStyle = '#304e9a';
        context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      }
    }
  }
  context.fillStyle = '#ffe7a0';
  pellets.forEach((pellet) => {
    context.beginPath();
    context.arc(pellet.x * cellSize + 10, pellet.y * cellSize + 10, 2, 0, Math.PI * 2);
    context.fill();
  });
  context.fillStyle = '#ffd83d';
  context.beginPath();
  context.arc(pacman.x * cellSize + 10, pacman.y * cellSize + 10, 8, 0.22, Math.PI * 2 - 0.22);
  context.lineTo(pacman.x * cellSize + 10, pacman.y * cellSize + 10);
  context.fill();
  ghosts.forEach((ghost) => {
    context.fillStyle = ghost.color;
    context.beginPath();
    context.arc(ghost.x * cellSize + 10, ghost.y * cellSize + 10, 8, Math.PI, 0);
    context.lineTo(ghost.x * cellSize + 18, ghost.y * cellSize + 19);
    context.lineTo(ghost.x * cellSize + 14, ghost.y * cellSize + 16);
    context.lineTo(ghost.x * cellSize + 10, ghost.y * cellSize + 19);
    context.lineTo(ghost.x * cellSize + 6, ghost.y * cellSize + 16);
    context.lineTo(ghost.x * cellSize + 2, ghost.y * cellSize + 19);
    context.fill();
    context.fillStyle = '#fff';
    context.fillRect(ghost.x * cellSize + 6, ghost.y * cellSize + 8, 3, 4);
    context.fillRect(ghost.x * cellSize + 12, ghost.y * cellSize + 8, 3, 4);
  });
}

function drawPong(rightPaddleY) {
  context.fillStyle = '#173e32';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setLineDash([6, 8]);
  context.strokeStyle = 'rgba(216, 239, 182, 0.35)';
  context.beginPath();
  context.moveTo(canvas.width / 2, 0);
  context.lineTo(canvas.width / 2, canvas.height);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#d9fa7b';
  context.fillRect(16, paddle.y, 8, paddle.height);
  context.fillStyle = '#f27b5d';
  context.fillRect(canvas.width - 24, rightPaddleY === undefined ? 125 : rightPaddleY, 8, paddle.height);
  context.fillStyle = '#f5f4ec';
  context.beginPath();
  context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  context.fill();
  context.font = 'bold 28px Consolas, monospace';
  context.fillStyle = 'rgba(245, 244, 236, 0.55)';
  context.fillText(String(score), 112, 42);
}

function drawRunner() {
  context.fillStyle = '#e7f5fa';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(70, 52, 18, 0, Math.PI * 2);
  context.arc(89, 52, 13, 0, Math.PI * 2);
  context.arc(242, 86, 15, 0, Math.PI * 2);
  context.arc(258, 86, 11, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#afc7b5';
  context.fillRect(0, 286, canvas.width, 34);
  context.fillStyle = '#738b78';
  context.fillRect(0, 286, canvas.width, 2);
  context.fillStyle = '#7b9c87';
  for (let x = -((runnerDistance * 4) % 40); x < canvas.width; x += 40) {
    context.fillRect(x, 299, 15, 2);
    context.fillRect(x + 23, 310, 9, 2);
  }
  obstacles.forEach((obstacle) => {
    context.fillStyle = '#527f4e';
    context.fillRect(obstacle.x, 286 - obstacle.height, obstacle.width, obstacle.height);
    context.fillRect(obstacle.x - 5, 274 - obstacle.height, 7, 15);
    context.fillRect(obstacle.x + obstacle.width - 2, 267 - obstacle.height, 7, 16);
  });
  context.fillStyle = '#465d54';
  context.fillRect(runner.x + 4, runner.y + 8, 17, 24);
  context.fillRect(runner.x + 14, runner.y + 1, 14, 14);
  context.fillRect(runner.x + 22, runner.y + 5, 9, 5);
  context.fillStyle = '#fff';
  context.fillRect(runner.x + 23, runner.y + 4, 3, 3);
  context.fillStyle = '#465d54';
  const legOffset = gameState === 'running' && runner.grounded ? Math.floor(runnerDistance / 2) % 2 * 4 : 0;
  context.fillRect(runner.x + 5, runner.y + 27, 5, 8 + legOffset);
  context.fillRect(runner.x + 15, runner.y + 27, 5, 12 - legOffset);
  context.fillStyle = '#728b78';
  context.font = '12px Consolas, monospace';
  context.fillText('DISTANCE ' + String(score).padStart(4, '0'), 204, 24);
}

document.addEventListener('keydown', (event) => {
  const keyDirections = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left'
  };
  const requested = keyDirections[event.key];
  if (requested && gameState === 'running') {
    event.preventDefault();
    if (mode === 'runner' && requested === 'up') jump();
    else setDirection(requested);
  } else if (event.code === 'Space') {
    event.preventDefault();
    if (mode === 'runner' && gameState === 'running') jump();
    else if (gameState === 'ready') startGame();
    else togglePause();
  } else if (event.key === 'Enter' && gameState === 'ready') {
    startGame();
  }
});

document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    const requested = button.dataset.direction;
    if (mode === 'runner' && requested === 'up') jump();
    else setDirection(requested);
  });
});

document.querySelectorAll('[data-game]').forEach((button) => {
  button.addEventListener('click', () => selectGame(button.dataset.game));
});

pauseButton.addEventListener('click', togglePause);
menuButton.addEventListener('click', showMenu);
document.querySelector('#restart-button').addEventListener('click', resetGame);
overlayButton.addEventListener('click', () => {
  if (gameState === 'ready') startGame();
  else if (gameState === 'paused') togglePause();
  else resetGame();
});

readBestScores();
showMenu();
