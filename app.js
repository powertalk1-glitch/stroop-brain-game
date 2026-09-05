(() => {
  'use strict';
  const E = window.StroopEngine;
  const $ = (id) => document.getElementById(id);
  const screens = ['home', 'setup', 'game', 'result'];
  const labels = {
    profile: { adult: '成人挑戰', child: '兒童模式', senior: '長輩模式' },
    mode: { ink: '看字色', word: '看字義', mixed: '混合指令' },
    difficulty: { easy: '簡單', normal: '普通', hard: '困難' }
  };
  const ruleDescriptions = { ink: '只看字體呈現的顏色', word: '只看文字寫的是什麼', mixed: '每題先看「字色」或「字義」指令' };
  const state = {
    profile: 'adult', mode: 'ink', difficulty: 'easy', sound: true,
    playing: false, paused: false, locked: false, started: false,
    score: 0, streak: 0, correct: 0, wrong: 0, totalReactionMs: 0, maxStreak: 0,
    roundEnd: 0, questionEnd: 0, questionStart: 0, pauseStart: 0,
    current: null, nextAt: 0, frame: 0, audio: null
  };

  function showScreen(name) {
    screens.forEach((screen) => $(`${screen}-screen`).classList.toggle('active', screen === name));
    window.scrollTo(0, 0);
  }

  function setProfile(profile) {
    state.profile = profile;
    document.body.className = `profile-${profile}`;
    $('profile-label').textContent = labels.profile[profile];
    updateSetup();
    showScreen('setup');
  }

  function selectChoice(groupId, attribute, value) {
    document.querySelectorAll(`#${groupId} [data-${attribute}]`).forEach((button) => {
      button.classList.toggle('selected', button.dataset[attribute] === value);
    });
  }

  function updateSetup() {
    $('rule-summary').textContent = ruleDescriptions[state.mode];
    ['easy', 'normal', 'hard'].forEach((difficulty) => {
      const config = E.getRoundConfig(state.profile, difficulty);
      const description = document.querySelector(`[data-difficulty="${difficulty}"] small`);
      if (description) description.textContent = `${config.optionCount} 選項・${config.questionMs / 1000} 秒`;
    });
  }

  function ensureAudio() {
    if (!state.sound) return null;
    if (!state.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) state.audio = new AudioContext();
    }
    if (state.audio?.state === 'suspended') state.audio.resume().catch(() => {});
    return state.audio;
  }

  function beep(kind) {
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = kind === 'good' ? 'sine' : 'square';
    oscillator.frequency.setValueAtTime(kind === 'good' ? 620 : 180, now);
    if (kind === 'good') oscillator.frequency.exponentialRampToValueAtTime(880, now + .08);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.12, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .12);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + .13);
    if (navigator.vibrate) navigator.vibrate(kind === 'good' ? 22 : [35, 25, 35]);
  }

  function resetStats() {
    Object.assign(state, { score: 0, streak: 0, correct: 0, wrong: 0, totalReactionMs: 0, maxStreak: 0, locked: false, current: null, nextAt: 0 });
    $('score').textContent = '0'; $('streak').textContent = '0';
  }

  function runCountdown(message, done) {
    const overlay = $('countdown-overlay');
    const number = $('count-number');
    $('count-message').textContent = message;
    overlay.classList.add('active');
    let value = 3;
    number.textContent = value;
    beep('good');
    const timer = setInterval(() => {
      value -= 1;
      if (value > 0) { number.textContent = value; beep('good'); return; }
      clearInterval(timer);
      number.textContent = 'GO';
      beep('good');
      setTimeout(() => { overlay.classList.remove('active'); done(); }, 380);
    }, 720);
  }

  function startGame() {
    ensureAudio();
    cancelAnimationFrame(state.frame);
    resetStats();
    state.playing = true; state.started = false; state.paused = false;
    showScreen('game');
    runCountdown('準備好，專心看清楚指令', () => {
      const now = performance.now();
      state.roundEnd = now + 60000;
      state.started = true;
      nextQuestion(now);
      state.frame = requestAnimationFrame(tick);
    });
  }

  function nextQuestion(now = performance.now()) {
    if (!state.playing || state.paused) return;
    const config = E.getRoundConfig(state.profile, state.difficulty);
    state.current = E.createQuestion(state.mode, state.difficulty);
    state.questionStart = now;
    state.questionEnd = now + config.questionMs;
    state.locked = false; state.nextAt = 0;
    const question = state.current;
    $('rule-badge').textContent = question.rule === 'ink' ? '看字色' : '看字義';
    const word = $('prompt-word');
    word.textContent = question.word.label;
    word.style.color = question.ink.hex;
    word.style.transform = 'scale(.96)';
    requestAnimationFrame(() => { word.style.transform = 'scale(1)'; });
    const answers = $('answers');
    answers.className = `answers${question.options.length === 2 ? ' two' : ''}`;
    answers.replaceChildren(...question.options.map((color) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'answer'; button.dataset.answer = color.id;
      button.setAttribute('aria-label', color.label);
      const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = color.hex;
      const label = document.createElement('span'); label.textContent = color.label;
      button.append(swatch, label);
      button.addEventListener('click', () => answer(color.id, button));
      return button;
    }));
  }

  function answer(id, button) {
    if (!state.playing || state.paused || state.locked) return;
    const now = performance.now();
    const config = E.getRoundConfig(state.profile, state.difficulty);
    const correct = id === state.current.answer;
    state.locked = true;
    const updated = E.scoreAnswer(state, correct, now - state.questionStart, config.questionMs);
    Object.assign(state, updated);
    document.querySelectorAll('.answer').forEach((item) => {
      item.disabled = true;
      if (item.dataset.answer === state.current.answer) item.classList.add('correct');
    });
    if (!correct) button.classList.add('wrong');
    $('score').textContent = state.score;
    $('streak').textContent = state.streak;
    const flash = $('flash');
    flash.className = `flash show ${correct ? 'good' : 'bad'}`;
    flash.textContent = correct ? (state.streak >= 3 ? `${state.streak} 連擊` : '答對') : '再專心一點';
    beep(correct ? 'good' : 'bad');
    state.nextAt = now + 360;
  }

  function tick(now) {
    if (!state.playing) return;
    if (!state.paused && state.started) {
      const roundRemaining = Math.max(0, state.roundEnd - now);
      $('round-bar').style.transform = `scaleX(${roundRemaining / 60000})`;
      if (roundRemaining <= 0) { finishGame(); return; }
      if (state.locked && state.nextAt && now >= state.nextAt) nextQuestion(now);
      if (!state.locked && state.current) {
        const config = E.getRoundConfig(state.profile, state.difficulty);
        const questionRemaining = Math.max(0, state.questionEnd - now);
        $('question-bar').style.transform = `scaleX(${questionRemaining / config.questionMs})`;
        if (questionRemaining <= 0) {
          state.locked = true;
          Object.assign(state, E.scoreAnswer(state, false, config.questionMs, config.questionMs));
          $('streak').textContent = '0';
          document.querySelectorAll('.answer').forEach((item) => { item.disabled = true; if (item.dataset.answer === state.current.answer) item.classList.add('correct'); });
          const flash = $('flash'); flash.className = 'flash show bad'; flash.textContent = '時間到'; beep('bad');
          state.nextAt = now + 480;
        }
      }
    }
    state.frame = requestAnimationFrame(tick);
  }

  function pauseGame() {
    if (!state.playing || !state.started || state.paused) return;
    state.paused = true; state.pauseStart = performance.now();
  }

  function offerResume() {
    if (state.playing && state.paused) $('pause-overlay').classList.add('active');
  }

  function resumeGame() {
    $('pause-overlay').classList.remove('active');
    runCountdown('回到節奏，繼續挑戰', () => {
      const now = performance.now();
      const pausedDuration = now - state.pauseStart;
      state.roundEnd += pausedDuration;
      state.questionEnd += pausedDuration;
      state.questionStart += pausedDuration;
      state.pauseStart = 0; state.paused = false;
    });
  }

  function finishGame() {
    state.playing = false; state.started = false;
    cancelAnimationFrame(state.frame);
    const summary = E.summarize(state);
    $('result-score').textContent = summary.score;
    $('result-correct').textContent = summary.correct;
    $('result-accuracy').textContent = `${summary.accuracy}%`;
    $('result-average').textContent = `${(summary.averageMs / 1000).toFixed(2)}s`;
    $('result-streak').textContent = summary.maxStreak;
    $('result-context').innerHTML = `${labels.profile[state.profile]}<br>${labels.mode[state.mode]}・${labels.difficulty[state.difficulty]}`;
    showScreen('result');
  }

  document.querySelectorAll('[data-profile]').forEach((button) => button.addEventListener('click', () => setProfile(button.dataset.profile)));
  $('mode-choices').addEventListener('click', (event) => { const button = event.target.closest('[data-mode]'); if (!button) return; state.mode = button.dataset.mode; selectChoice('mode-choices', 'mode', state.mode); updateSetup(); });
  $('difficulty-choices').addEventListener('click', (event) => { const button = event.target.closest('[data-difficulty]'); if (!button) return; state.difficulty = button.dataset.difficulty; selectChoice('difficulty-choices', 'difficulty', state.difficulty); updateSetup(); });
  $('back-home').addEventListener('click', () => showScreen('home'));
  $('start-game').addEventListener('click', startGame);
  $('play-again').addEventListener('click', startGame);
  $('change-settings').addEventListener('click', () => showScreen('setup'));
  $('resume-game').addEventListener('click', resumeGame);
  $('sound-toggle').addEventListener('click', () => { state.sound = !state.sound; $('sound-toggle').textContent = state.sound ? '🔊' : '🔇'; $('sound-toggle').setAttribute('aria-label', state.sound ? '關閉音效' : '開啟音效'); if (state.sound) beep('good'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); else offerResume(); });
  window.addEventListener('pagehide', pauseGame);
  updateSetup();
})();
