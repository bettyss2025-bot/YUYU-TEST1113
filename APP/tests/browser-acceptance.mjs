import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appsScript } from './helpers/apps-script.mjs';

const { chromium } = await import(process.env.ROAM_PLAYWRIGHT_MODULE || 'playwright-core');
const shim = `<meta name="viewport" content="width=device-width, initial-scale=1">
<script>
window.google = { script: {
  url: { getLocation: fn => fn({ hash: location.hash }) },
  run: { withSuccessHandler: onSuccess => ({ withFailureHandler: onFailure => ({
    roamRpc: request => fetch('/rpc', { method: 'POST', body: JSON.stringify(request) })
      .then(response => response.json()).then(onSuccess).catch(onFailure)
  }) }) }
} };
</script>`;
const server = createServer(async (request, response) => {
  if (request.url === '/rpc') {
    let body = '';
    for await (const part of request) body += part;
    response.setHeader('content-type', 'application/json');
    return response.end(JSON.stringify(env.run(JSON.parse(body))));
  }
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(env.render().replace('</head>', shim + '</head>'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port + '/exec';
const env = appsScript({ url: origin });

env.setup();
const launch = { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] };
const browserA = await chromium.launch(launch);
const browserB = await chromium.launch(launch);
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const errors = [];
const open = async (browser, url, options = {}) => {
  const page = await browser.newPage(options);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  return page;
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
const shown = async (page, message) => page.getByText(message, { exact: true }).waitFor();
const save = async page => {
  await button(page, '儲存').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};
try {
  const owner = await open(browserA, origin + '#organizer=' + env.organizer());
  await button(owner, '建立旅程').click();
  await owner.getByLabel('旅程名稱').fill('兩個瀏覽器驗收');
  await owner.getByLabel('開始日期').fill('2026-11-20');
  await owner.getByLabel('結束日期').fill('2026-11-22');
  await save(owner);
  await button(owner, '邀請').click();
  await button(owner, '產生邀請連結').click();
  const inviteField = owner.getByLabel('邀請連結', { exact: true });
  await inviteField.waitFor();
  const invite = await inviteField.inputValue();
  assert.match(invite, /#trip=[a-f0-9]{32}&invite=[a-f0-9]{64}$/);

  const first = await open(browserA, invite, phone);
  const second = await open(browserB, invite, phone);
  await shown(second, '目前還沒有行程。');

  await button(first, '旅伴').click();
  await button(first, '新增旅伴').click();
  await first.getByLabel('旅伴姓名').fill('驗收旅伴');
  await save(first);
  await button(first, '行程').click();
  await button(first, '新增行程').click();
  await first.getByLabel('名稱').fill('車站集合');
  await first.getByLabel('時間').fill('09:45');
  await first.getByLabel('地點').fill('台北車站');
  await first.getByLabel('備註').fill('東一門等候');
  await save(first);
  await button(first, '記帳').click();
  await button(first, '新增支出').click();
  await first.getByLabel('名稱').fill('早餐');
  await first.getByLabel('誰付款').selectOption({ label: '驗收旅伴' });
  await first.getByLabel('金額（元）').fill('175.50');
  await save(first);
  await second.reload();
  await shown(second, '車站集合');
  await shown(second, '09:45 · 台北車站');
  await shown(second, '東一門等候');
  await button(second, '旅伴').click();
  await shown(second, '驗收旅伴');
  await button(second, '記帳').click();
  await shown(second, '早餐');
  const intl = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD' });
  await second.getByText(intl.format(175.50), { exact: true }).last().waitFor();
  assert.equal(env.tabs.get('Roam_旅伴').getRange(2, 3).getValues()[0][0], '驗收旅伴');
  assert.equal(env.tabs.get('Roam_行程').getRange(2, 5).getValues()[0][0], '車站集合');
  assert.equal(env.tabs.get('Roam_支出').getRange(2, 6).getValues()[0][0], 175.50);
  env.tabs.get('Roam_支出').getRange(2, 6).setValue(193.25);
  await button(second, '重新整理').click();
  await second.getByText(intl.format(193.25), { exact: true }).last().waitFor();

  const noInvite = await open(browserB, origin, phone);
  await shown(noInvite, '請使用主辦人提供的私人邀請連結。');
  assert.equal(await noInvite.getByRole('button', { name: '新增旅伴' }).count(), 0);
  const fragment = new URLSearchParams(new URL(invite).hash.slice(1));
  const invalid = await open(browserB, origin + '#trip=' + fragment.get('trip') + '&invite=' + '0'.repeat(64));
  await shown(invalid, '邀請連結無效或已撤銷。');
  const denied = await noInvite.request.post(origin.replace('/exec', '/rpc'), { data: {
    tripId: fragment.get('trip'), action: 'save', kind: 'members', data: { id: '1'.repeat(32), name: '不允許' }
  } });
  assert.equal((await denied.json()).code, 'access');
  await button(owner, '撤銷邀請連結').click();
  await button(owner, '確認').click();
  await shown(owner, '目前沒有有效的邀請連結。');
  await button(second, '重新整理').click();
  await shown(second, '邀請連結無效或已撤銷。');
  assert.equal(await second.getByText('早餐', { exact: true }).isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: two isolated Chromium instances, three shared rows, sheet edit 175.50 → 193.25, access denied without valid invite and after revocation (local simulator)');
} finally {
  await Promise.all([browserA.close(), browserB.close()]);
  server.close();
}
