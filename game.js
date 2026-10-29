(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best');
  const overlay = document.querySelector('#overlay');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const playButton = document.querySelector('#play-button');
  const playLabel = document.querySelector('#play-label');
  const status = document.querySelector('#game-status');
  const statusLight = document.querySelector('#status-light');
  const subtitle = document.querySelector('#overlay-subtitle');
  const boardMessage = document.querySelector('#board-message');
  const soundButton = document.querySelector('#sound-button');

  const cells = 20;
  const size = canvas.width / cells;
  const initialSnake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  let snake = [];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 14, y: 10 };
  let score = 0;
  let best = Number(localStorage.getItem('snake-best') || 0);
  let state = 'ready';
  let timer = null;
  let soundOn = false;
  let audio;

  bestEl.textContent = format(best);

  function format(n) { return String(n).padStart(3, '0'); }
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  function drawGrid() {
    ctx.fillStyle = '#13201b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#213128'; ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      const p = i * size + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
    }
  }

  function draw() {
    drawGrid();
    const fx = food.x * size + size / 2;
    const fy = food.y * size + size / 2;
    ctx.save(); ctx.shadowColor = '#ff9b67'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff9b67'; ctx.beginPath(); ctx.arc(fx, fy, size * .31, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#c8f39a'; ctx.beginPath(); ctx.ellipse(fx + 4, fy - 6, 3, 1.5, -.6, 0, Math.PI * 2); ctx.fill();

    snake.forEach((part, index) => {
      const inset = index === 0 ? 2 : 3;
      const x = part.x * size + inset, y = part.y * size + inset;
      ctx.fillStyle = index === 0 ? '#c8f39a' : `rgba(164, 219, 125, ${Math.max(.48, .9 - index * .018)})`;
      roundedRect(x, y, size - inset * 2, size - inset * 2, index === 0 ? 7 : 5);
      if (index === 0) {
        ctx.fillStyle = '#263c2a';
        const eyes = direction.x !== 0 ? [[direction.x > 0 ? x + 11 : x + 4, y + 5], [direction.x > 0 ? x + 11 : x + 4, y + 11]] : [[x + 5, direction.y > 0 ? y + 11 : y + 4], [x + 11, direction.y > 0 ? y + 11 : y + 4]];
        eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey, 1.45, 0, Math.PI * 2); ctx.fill(); });
      }
    });
  }

  function placeFood() {
    do { food = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) }; }
    while (snake.some(part => part.x === food.x && part.y === food.y));
  }

  function beep(frequency = 440, duration = .07) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.frequency.value = frequency; oscillator.type = 'sine'; gain.gain.value = .035;
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); oscillator.stop(audio.currentTime + duration);
    } catch (_) { /* Audio is optional. */ }
  }

  function setStatus(label, active) {
    status.textContent = label;
    statusLight.style.background = active ? '#b2e580' : '#74857d';
    statusLight.style.boxShadow = active ? '0 0 9px #b2e58070' : 'none';
  }

  function start() {
    if (state === 'running') return;
    if (state === 'paused') { state = 'running'; pauseOverlay.classList.add('hidden'); setStatus('IN MOTION', true); boardMessage.textContent = 'NICE AND STEADY'; timer = setInterval(tick, speed()); return; }
    snake = initialSnake.map(part => ({ ...part })); direction = { x: 1, y: 0 }; nextDirection = { ...direction };
    score = 0; scoreEl.textContent = format(score); placeFood(); state = 'running'; overlay.classList.add('hidden');
    setStatus('IN MOTION', true); boardMessage.textContent = 'NICE AND STEADY'; draw(); timer = setInterval(tick, speed());
  }

  function speed() { return Math.max(72, 145 - score * 2.5); }

  function pause() {
    if (state === 'running') { clearInterval(timer); state = 'paused'; pauseOverlay.classList.remove('hidden'); setStatus('PAUSED', false); boardMessage.textContent = 'TAKE YOUR TIME'; }
    else if (state === 'paused') start();
  }

  function finish() {
    clearInterval(timer); state = 'over';
    const record = score > best;
    if (record) { best = score; localStorage.setItem('snake-best', String(best)); bestEl.textContent = format(best); }
    setStatus('RUN COMPLETE', false); boardMessage.textContent = 'GOOD RUN. GO AGAIN?';
    subtitle.innerHTML = record && score > 0 ? 'NEW PERSONAL BEST!<br>THAT WAS A GOOD RUN.' : `YOU SCORED ${format(score)} POINTS.<br>READY FOR ANOTHER?`;
    playLabel.textContent = 'PLAY AGAIN'; overlay.classList.remove('hidden'); beep(160, .18); draw();
  }

  function tick() {
    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = head.x === food.x && head.y === food.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.x >= cells || head.y < 0 || head.y >= cells || body.some(part => part.x === head.x && part.y === head.y)) { finish(); return; }
    snake.unshift(head);
    if (eating) { score += 10; scoreEl.textContent = format(score); placeFood(); beep(610, .06); clearInterval(timer); timer = setInterval(tick, speed()); }
    else snake.pop();
    draw();
  }

  function turn(x, y) {
    if (state !== 'running') return;
    if (x === -direction.x && y === -direction.y) return;
    nextDirection = { x, y };
  }

  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    const directions = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    if (directions[key]) { event.preventDefault(); turn(...directions[key]); }
    if (key === ' ' || key === 'enter') { event.preventDefault(); if (state === 'ready' || state === 'over') start(); else pause(); }
  });
  playButton.addEventListener('click', start);
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('pointerdown', event => {
    event.preventDefault(); const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }; turn(...dirs[button.dataset.direction]);
  }));
  soundButton.addEventListener('click', () => { soundOn = !soundOn; soundButton.classList.toggle('muted', !soundOn); soundButton.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound'); beep(520); });

  draw();
})();