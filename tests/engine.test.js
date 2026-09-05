const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../engine.js');

const rngFrom = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

test('所有難度常駐四色選項且沒有單題截止時間', () => {
  for (const profile of ['adult', 'child', 'senior']) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const config = Engine.getRoundConfig(profile, difficulty);
      assert.equal(config.optionCount, 4);
      assert.equal('questionMs' in config, false);
      assert.ok(config.speedReferenceMs > 0);
    }
  }
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
  assert.equal(q.options.length, 4);
});

test('混合模式可以在字色與字義規則間切換', () => {
  const inkQuestion = Engine.createQuestion('mixed', 'hard', rngFrom(0.1, 0.2, 0.8, 0.4, 0.6));
  const wordQuestion = Engine.createQuestion('mixed', 'hard', rngFrom(0.9, 0.2, 0.8, 0.4, 0.6));
  assert.equal(inkQuestion.rule, 'ink');
  assert.equal(wordQuestion.rule, 'word');
});

test('所有題目的文字字義與字體顏色強制不同', () => {
  for (const mode of ['ink', 'word', 'mixed']) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      for (let i = 0; i < 20; i += 1) {
        const q = Engine.createQuestion(mode, difficulty);
        assert.notEqual(q.word.id, q.ink.id);
        assert.equal(q.conflict, true);
      }
    }
  }
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
