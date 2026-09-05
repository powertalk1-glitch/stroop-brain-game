const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../engine.js');

const rngFrom = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

test('難度與玩家模式會共同決定選項數和答題時間', () => {
  assert.deepEqual(Engine.getRoundConfig('adult', 'easy'), { optionCount: 2, questionMs: 5000, conflictRate: 0.5 });
  assert.equal(Engine.getRoundConfig('child', 'hard').questionMs, 3000);
  assert.equal(Engine.getRoundConfig('senior', 'hard').questionMs, 4000);
  assert.equal(Engine.getRoundConfig('adult', 'normal').optionCount, 4);
});

test('字體顏色模式以墨色作答，且選項必定包含答案', () => {
  const q = Engine.createQuestion('ink', 'normal', rngFrom(0, 0.3, 0.7, 0.2, 0.8));
  assert.equal(q.rule, 'ink');
  assert.equal(q.answer, q.ink.id);
  assert.ok(q.options.some((option) => option.id === q.answer));
  assert.equal(q.options.length, 4);
});

test('文字字義模式以文字內容作答', () => {
  const q = Engine.createQuestion('word', 'easy', rngFrom(0, 0.8, 0.4, 0.6));
  assert.equal(q.rule, 'word');
  assert.equal(q.answer, q.word.id);
  assert.equal(q.options.length, 2);
});

test('混合模式可以在字色與字義規則間切換', () => {
  const inkQuestion = Engine.createQuestion('mixed', 'hard', rngFrom(0.1, 0.2, 0.8, 0.4, 0.6));
  const wordQuestion = Engine.createQuestion('mixed', 'hard', rngFrom(0.9, 0.2, 0.8, 0.4, 0.6));
  assert.equal(inkQuestion.rule, 'ink');
  assert.equal(wordQuestion.rule, 'word');
});

test('普通與困難題會依設定提高色字衝突機率', () => {
  const normal = Engine.getRoundConfig('adult', 'normal');
  const hard = Engine.getRoundConfig('adult', 'hard');
  assert.ok(normal.conflictRate > Engine.getRoundConfig('adult', 'easy').conflictRate);
  assert.ok(hard.conflictRate > normal.conflictRate);
});

test('答對可得基礎、速度與連擊分；答錯不扣分但連擊歸零', () => {
  const correct = Engine.scoreAnswer({ score: 0, streak: 2, correct: 2, wrong: 0, totalReactionMs: 1000 }, true, 1000, 5000);
  assert.equal(correct.streak, 3);
  assert.equal(correct.correct, 3);
  assert.ok(correct.score > 100);
  const wrong = Engine.scoreAnswer(correct, false, 2000, 5000);
  assert.equal(wrong.score, correct.score);
  assert.equal(wrong.streak, 0);
  assert.equal(wrong.wrong, 1);
});

test('逾時視為答錯且不產生負分', () => {
  const result = Engine.scoreAnswer({ score: 0, streak: 4, correct: 0, wrong: 0, totalReactionMs: 0 }, false, 5000, 5000);
  assert.equal(result.score, 0);
  assert.equal(result.streak, 0);
});

test('結算正確率與平均反應時間可處理零題狀態', () => {
  assert.deepEqual(Engine.summarize({ score: 0, correct: 0, wrong: 0, totalReactionMs: 0, maxStreak: 0 }), {
    score: 0, correct: 0, wrong: 0, accuracy: 0, averageMs: 0, maxStreak: 0
  });
  const summary = Engine.summarize({ score: 520, correct: 3, wrong: 1, totalReactionMs: 3600, maxStreak: 3 });
  assert.equal(summary.accuracy, 75);
  assert.equal(summary.averageMs, 1200);
});
