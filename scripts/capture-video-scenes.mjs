import fs from 'node:fs/promises';

const OUT = '/tmp/qs-video-scenes';
const APP = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:3001/api';

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No Chrome page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(expression, label, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      // Navigation can briefly destroy the execution context.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function screenshot(name) {
  await sleep(700);
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const path = `${OUT}/${name}.png`;
  await fs.writeFile(path, Buffer.from(result.data, 'base64'));
  console.log(path);
}

async function navigate(tab, readyText, extraWait = 0) {
  await command('Page.navigate', { url: `${APP}/?tab=${tab}&doc=seed-08&v=${Date.now()}` });
  await waitFor(`document.body.innerText.includes(${JSON.stringify(readyText)})`, readyText);
  if (extraWait) await sleep(extraWait);
}

async function post(path, body = {}) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} failed: HTTP ${response.status}`);
  return response.json();
}

async function chat(message) {
  return post('/rfqs/seed-08/chat', { message, actor: '演示录制' });
}

await post('/reset-demo');
await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await navigate('review', '演示主场景 · 三行询价');
await screenshot('00-overview');

await navigate('chat', '对话补规格，按钮做承诺');
await screenshot('01-chat-intro');

await chat('审单，并告诉我哪些行不能报价');
await navigate('chat', '首轮审单完成');
await screenshot('02-chat-round1');

await chat('第二行表面处理是镀锌');
await navigate('chat', '补充信息已写入');
await screenshot('03-chat-round2');

await chat('为什么第三行不能报价');
await navigate('chat', 'ROW 03 当前是目录外');
await screenshot('04-chat-round3');

await chat('审批并导出 CSV');
await navigate('chat', '审批需要主管在报价审批页确认');
await screenshot('05-chat-approval-guardrail');

await navigate('approval', '报价审批与导出');
await screenshot('06-approval-before');

await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('审批这份报价'));
  if (!button) return false;
  button.click();
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('.modal-backdrop'))`, 'approval modal');
await screenshot('07-approve-modal');

await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '取消');
  if (button) button.click();
})()`);

await post('/rfqs/seed-08/approve', { actor: '王主管 / Supervisor' });
await navigate('approval', '已由 王主管 / Supervisor 审批');
await screenshot('08-approved');

const csv = await fetch(`${API}/rfqs/seed-08/export.csv`);
if (!csv.ok) throw new Error(`CSV export failed: HTTP ${csv.status}`);
await csv.arrayBuffer();
await navigate('audit', '审计时间线');
await screenshot('09-audit');

await post('/reset-demo');
console.log(JSON.stringify({ ok: true, count: 10, out: OUT }, null, 2));
socket.close();
