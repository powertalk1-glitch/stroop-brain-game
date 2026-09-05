const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
for (const required of [
  '<html lang="zh-Hant">',
  'id="home-screen"',
  'id="enter-setup"',
  'id="setup-screen"',
  'id="game-screen"',
  'id="result-screen"',
  'engine.js',
  'app.js',
  '娛樂與腦力挑戰用途',
  'prefers-reduced-motion'
]) assert.ok(html.includes(required), `index.html 缺少：${required}`);
for (const file of ['engine.js', 'app.js']) assert.ok(fs.existsSync(file), `缺少 ${file}`);
assert.equal(html.includes('data-profile='), false, '不應保留玩家模式選項');
assert.equal(html.includes('data-mode='), false, '不應保留玩法選項');
assert.ok(html.includes('成人混合挑戰'), '應明確標示成人混合挑戰');
assert.ok(html.includes('transform:translateY(-4px)}'), '主要按鈕 CSS 宣告不完整');
console.log('HTML 結構與必要資源檢查通過');
