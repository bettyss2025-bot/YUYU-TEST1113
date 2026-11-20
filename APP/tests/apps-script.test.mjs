import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { appsScript } from './helpers/apps-script.mjs';

const uid = () => randomUUID().replaceAll('-', '');

function fixture() {
  const app = appsScript();
  app.setup();
  const organizer = app.organizer();
  const owner = (action, data, extra) => app.run({ action, data, organizer, ...extra });
  const tripId = uid();
  const fields = { id: tripId, name: '三日旅行', start: '2026-11-20', end: '2026-11-22' };
  assert.equal(owner('create', fields).id, tripId);
  const invite = () => {
    const result = owner('invitation', { mode: 'rotate', nonce: uid() }, { tripId });
    assert.equal(result.ok, true);
    return new URLSearchParams(new URL(result.url).hash.slice(1)).get('invite');
  };
  return { app, owner, tripId, invite, fields };
}

test('setup refuses a generally shared spreadsheet and preserves existing tabs and the organizer key', () => {
  const app = appsScript();
  const legacy = app.book.insertSheet('工作表1');
  legacy.getRange(1, 1).setValue('保留原資料');
  app.sharing = 'ANYONE_WITH_LINK';
  assert.throws(app.setup, /一般存取/);
  assert.equal(app.tabs.size, 1);
  app.sharing = 'PRIVATE';
  app.setup();
  const key = app.organizer();
  app.setup();
  assert.equal(app.organizer(), key);
  assert.equal(app.tabs.size, 5);
  assert.equal(legacy.getRange(1, 1).getValues()[0][0], '保留原資料');
  assert.match(app.render(), /<title|旅伴/);
});

test('two invite clients share an empty trip, can create records, and read sheet changes', () => {
  const { app, tripId, invite } = fixture();
  const key = invite();
  const client = () => (action, kind, data) => app.run({ tripId, invite: key, action, kind, data });
  const first = client();
  const second = client();
  const { members, itinerary, expenses } = first('get');
  assert.deepEqual({ members, itinerary, expenses }, { members: [], itinerary: [], expenses: [] });
  const payer = uid();
  const event = uid();
  const payment = uid();
  const data = { id: payment, title: '午餐', date: '2026-11-21', payer, amount: '205.75', note: '=1+1' };
  assert.equal(first('save', 'members', { id: payer, name: '王小明' }).ok, true);
  assert.equal(first('save', 'itinerary', { id: event, title: '午餐', date: '2026-11-21', time: '12:30', place: '市區' }).ok, true);
  assert.equal(first('save', 'expenses', data).ok, true);
  assert.equal(first('save', 'expenses', data).ok, true);
  const updated = second('get');
  assert.equal(updated.members[0].name, '王小明');
  assert.equal(updated.itinerary[0].place, '市區');
  assert.equal(updated.expenses.length, 1);
  assert.equal(updated.expenses[0].amount, 205.75);
  const expenseTab = app.tabs.get('Roam_支出');
  assert.equal(expenseTab.getRange(2, 6).getValues()[0][0], 205.75);
  assert.deepEqual(expenseTab.formulas, []);
  assert.equal(updated.expenses[0].note, '=1+1');
  expenseTab.getRange(2, 6).setValue(235.50);
  app.tabs.get('Roam_行程').getRange(2, 3).setValue(new Date('2026-11-20T16:00:00Z'));
  assert.equal(second('get').expenses[0].amount, 235.50);
  assert.equal(second('get').itinerary[0].date, '2026-11-21');
  assert.equal(first('save', 'expenses', { ...updated.expenses[0], amount: '250' }).code, 'conflict');
  assert.equal(second('delete', 'members', updated.members[0]).code, 'validation');
  assert.equal(second('delete', 'expenses', second('get').expenses[0]).ok, true);
  assert.equal(second('delete', 'itinerary', second('get').itinerary[0]).ok, true);
  assert.equal(second('delete', 'members', updated.members[0]).ok, true);
  assert.deepEqual(second('get').expenses, []);
});

test('an invite is scoped to one trip and rejected after rotation, revocation, or enabling sheet sharing', () => {
  const { app, owner, tripId, invite, fields } = fixture();
  const otherId = uid();
  owner('create', { ...fields, id: otherId });
  const key = invite();
  const get = (token, id = tripId) => app.run({ action: 'get', tripId: id, invite: token });
  assert.equal(get('').code, 'access');
  assert.equal(get(key, otherId).code, 'access');
  assert.equal(get(key).ok, true);
  assert.equal(app.run({ action: 'list', tripId, invite: key }).code, 'access');
  assert.equal(app.run({ action: 'invitation', tripId, invite: key, data: { mode: 'retrieve' } }).code, 'access');
  const newKey = invite();
  assert.equal(get(key).code, 'access');
  assert.equal(get(newKey).ok, true);
  app.sharing = 'ANYONE_WITH_LINK';
  assert.equal(get(newKey).code, 'sharing');
  app.sharing = 'PRIVATE';
  assert.equal(owner('invitation', { mode: 'revoke' }, { tripId }).url, '');
  assert.equal(get(newKey).code, 'access');
  assert.equal(app.run({ action: 'save', tripId, invite: newKey, kind: 'members',
    data: { id: uid(), name: '未授權' } }).code, 'access');
  assert.equal(owner('get', null, { tripId }).members.length, 0);
});

test('trip date validation protects itinerary and expenses only accept a payer from the same trip', () => {
  const { owner, tripId, invite, fields, app } = fixture();
  const key = invite();
  const call = (action, kind, data) => app.run({ action, kind, data, tripId, invite: key });
  const otherId = uid();
  const payer = uid();
  owner('create', { ...fields, id: otherId });
  owner('save', { id: payer, name: '另一趟旅伴' }, { tripId: otherId, kind: 'members' });
  assert.equal(call('save', 'expenses', { id: uid(), date: fields.start, payer, title: '午餐', amount: '120' }).code,
    'validation');
  const event = { id: uid(), title: '集合', time: '10:00', date: fields.end };
  assert.equal(call('save', 'itinerary', event).ok, true);
  assert.equal(call('save', 'itinerary', { ...event, date: '2026-11-31' }).code, 'validation');
  assert.equal(call('save', 'itinerary', { ...event, date: '2026-11-23' }).code, 'validation');
  const trip = call('get').trip;
  assert.equal(owner('updateTrip', { ...trip, end: '2026-11-21' }, { tripId }).code, 'validation');
  const edit = { ...call('get').itinerary[0], title: '新集合地點' };
  assert.equal(call('save', 'itinerary', edit).ok, true);
  assert.equal(call('get').itinerary[0].title, edit.title);
});
