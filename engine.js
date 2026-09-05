(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.StroopEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLORS = Object.freeze([
    Object.freeze({ id: 'red', label: '紅', hex: '#e5484d' }),
    Object.freeze({ id: 'yellow', label: '黃', hex: '#f2bd2e' }),
    Object.freeze({ id: 'blue', label: '藍', hex: '#2878ff' }),
    Object.freeze({ id: 'green', label: '綠', hex: '#159b68' })
  ]);

  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ optionCount: 2, questionMs: 5000, conflictRate: 0.5 }),
    normal: Object.freeze({ optionCount: 4, questionMs: 3000, conflictRate: 0.78 }),
    hard: Object.freeze({ optionCount: 4, questionMs: 2000, conflictRate: 0.96 })
  });

  const TIME_ADJUSTMENTS = Object.freeze({ adult: 0, child: 1000, senior: 2000 });

  function getRoundConfig(profile, difficulty) {
    const base = DIFFICULTIES[difficulty];
    if (!base) throw new Error('未知難度');
    if (!(profile in TIME_ADJUSTMENTS)) throw new Error('未知玩家模式');
    return {
      optionCount: base.optionCount,
      questionMs: base.questionMs + TIME_ADJUSTMENTS[profile],
      conflictRate: base.conflictRate
    };
  }

  function pickIndex(rng, length) {
    return Math.min(length - 1, Math.floor(rng() * length));
  }

  function createQuestion(mode, difficulty, rng = Math.random) {
    if (!['ink', 'word', 'mixed'].includes(mode)) throw new Error('未知玩法');
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error('未知難度');

    const rule = mode === 'mixed' ? (rng() < 0.5 ? 'ink' : 'word') : mode;
    const word = COLORS[pickIndex(rng, COLORS.length)];
    const conflict = rng() < config.conflictRate;
    let ink = word;
    if (conflict) {
      const alternatives = COLORS.filter((color) => color.id !== word.id);
      ink = alternatives[pickIndex(rng, alternatives.length)];
    }

    const answer = rule === 'ink' ? ink.id : word.id;
    let options;
    if (config.optionCount === COLORS.length) {
      options = COLORS.slice();
    } else {
      const answerColor = COLORS.find((color) => color.id === answer);
      const distractors = COLORS.filter((color) => color.id !== answer);
      const distractor = distractors[pickIndex(rng, distractors.length)];
      options = COLORS.filter((color) => color.id === answerColor.id || color.id === distractor.id);
    }

    return { rule, word, ink, answer, options, conflict };
  }

  function scoreAnswer(state, isCorrect, reactionMs, questionMs) {
    const next = { ...state };
    if (isCorrect) {
      next.streak = state.streak + 1;
      next.maxStreak = Math.max(state.maxStreak || 0, next.streak);
      next.correct = state.correct + 1;
      next.totalReactionMs = state.totalReactionMs + Math.max(0, reactionMs);
      const speedRatio = Math.max(0, Math.min(1, 1 - reactionMs / questionMs));
      const speedBonus = Math.round(speedRatio * 100);
      const comboBonus = Math.min(next.streak - 1, 10) * 10;
      next.score = state.score + 100 + speedBonus + comboBonus;
    } else {
      next.streak = 0;
      next.wrong = state.wrong + 1;
      next.maxStreak = Math.max(state.maxStreak || 0, state.streak || 0);
    }
    return next;
  }

  function summarize(state) {
    const attempts = state.correct + state.wrong;
    return {
      score: state.score,
      correct: state.correct,
      wrong: state.wrong,
      accuracy: attempts ? Math.round((state.correct / attempts) * 100) : 0,
      averageMs: state.correct ? Math.round(state.totalReactionMs / state.correct) : 0,
      maxStreak: state.maxStreak || 0
    };
  }

  return Object.freeze({ COLORS, getRoundConfig, createQuestion, scoreAnswer, summarize });
});
