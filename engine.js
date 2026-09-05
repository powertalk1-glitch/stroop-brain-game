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
    Object.freeze({ id: 'green', label: '綠', hex: '#159b68' }),
    Object.freeze({ id: 'orange', label: '橘', hex: '#ef7f2d' }),
    Object.freeze({ id: 'purple', label: '紫', hex: '#8b5cf6' })
  ]);

  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ optionCount: 6, speedReferenceMs: 5000, feedbackMs: 520 }),
    normal: Object.freeze({ optionCount: 6, speedReferenceMs: 3500, feedbackMs: 360 }),
    hard: Object.freeze({ optionCount: 6, speedReferenceMs: 2200, feedbackMs: 220 })
  });

  const SPEED_ADJUSTMENTS = Object.freeze({ adult: 0, child: 1000, senior: 2000 });

  function getRoundConfig(profile, difficulty) {
    const base = DIFFICULTIES[difficulty];
    if (!base) throw new Error('未知難度');
    if (!(profile in SPEED_ADJUSTMENTS)) throw new Error('未知玩家模式');
    return {
      optionCount: base.optionCount,
      speedReferenceMs: base.speedReferenceMs + SPEED_ADJUSTMENTS[profile],
      feedbackMs: base.feedbackMs
    };
  }

  function pickIndex(rng, length) {
    return Math.min(length - 1, Math.floor(rng() * length));
  }

  function questionKey(question) {
    return `${question.rule}:${question.word.id}:${question.ink.id}`;
  }

  function createQuestion(mode, difficulty, rng = Math.random, previousQuestion = null) {
    if (!['ink', 'word', 'mixed'].includes(mode)) throw new Error('未知玩法');
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error('未知難度');

    const rule = mode === 'mixed' ? (rng() < 0.5 ? 'ink' : 'word') : mode;
    const word = COLORS[pickIndex(rng, COLORS.length)];
    const alternatives = COLORS.filter((color) => color.id !== word.id);
    let ink = alternatives[pickIndex(rng, alternatives.length)];

    if (previousQuestion && previousQuestion.rule === rule && previousQuestion.word.id === word.id && previousQuestion.ink.id === ink.id) {
      ink = alternatives.find((color) => color.id !== previousQuestion.ink.id);
    }

    const answer = rule === 'ink' ? ink.id : word.id;
    const options = COLORS.slice();

    return { rule, word, ink, answer, options, conflict: true };
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

  return Object.freeze({ COLORS, getRoundConfig, createQuestion, questionKey, scoreAnswer, summarize });
});
