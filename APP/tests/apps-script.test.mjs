import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/Roam.gs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../apps-script/Roam.html', import.meta.url), 'utf8');
const url = 'https://script.google.com/macros/s/test/exec';
const id = () => randomUUID().replaceAll('-', '');

class Sheet {
  rows = [];
  getLastRow() { return this.rows.findLastIndex(row => row.some(value => value !== '')) + 1; }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  getRange(first, column, count, width) {
    if (typeof first === 'string') return {setNumberFormat() {}};
    const getValues = () => Array.from({length:count}, (_, i) =>
      Array.from({length:width}, (_, j) => this.rows[first + i - 1]?.[column + j - 1] ?? ''));
    const update = values => values.forEach((row, i) => {
      const target = this.rows[first + i - 1] ||= [];
      row.forEach((value, j) => { target[column + j - 1] = typeof value === 'string' ? value.replace(/^'/, '') : value; });
    });
    return {getValues, setValues:update, clearContent:() => update(getValues().map(row => row.map(() => '')))};
  }
}

function environment() {
  const properties = new Map([['ROAM_SHEET_ID', 'requested-workbook']]);
  const config = {getProperty:key => properties.get(key), setProperty:(key, value) => properties.set(key, value),
    deleteProperty:key => properties.delete(key)};
  const original = new Sheet();
  original.getRange(1, 1, 1, 1).setValues([['使用者既有資料']]);
  const tabs = new Map([['既有分頁', original]]);
  const book = {getSheetByName:name => tabs.get(name),
    insertSheet(name) { const sheet = new Sheet(); tabs.set(name, sheet); return sheet; }};
  const logs = [];
  const context = vm.createContext({
    PropertiesService:{getScriptProperties:() => config},
    ScriptApp:{getService:() => ({getUrl:() => url})},
    SpreadsheetApp:{openById:sheetId => { assert.equal(sheetId, 'requested-workbook'); return book; }, flush() {}},
    LockService:{getScriptLock:() => ({waitLock() {}, releaseLock() {}})},
    Utilities:{getUuid:randomUUID, computeHmacSha256Signature:(message, secret) => createHmac('sha256', secret).update(message).digest(),
      base64EncodeWebSafe:bytes => bytes.toString('base64url')},
    console:{log:message => logs.push(message)}
  });
  vm.runInContext(source, context);
  context.roamSetup_();
  const key = new URLSearchParams(new URL(logs.at(-1)).hash.slice(1)).get('organizer');
  const api = (action, fields = {}) => JSON.parse(JSON.stringify(context.roamRequest({action, ...fields})));
  const success = (action, fields) => {
    const result = api(action, fields);
    assert.equal(result.error, undefined);
    return result.data;
  };
  const createTrip = (name = '跨裝置測試', tripId = id()) => success('createTrip', {
    key, id:tripId, record:{name, start:'2026-11-21', end:'2026-11-23'}
  }).id;
  const invite = tripId => new URLSearchParams(new URL(success('invite', {key, id:tripId}).url).hash.slice(1)).get('invite');
  return {api, success, createTrip, invite, tabs, key, setup:() => context.roamSetup_()};
}

test('Apps Script HTML client parses', () => {
  new vm.Script(html.match(/<script>([\s\S]+)<\/script>/)[1]);
});

test('two simulated clients share a blank trip and see live workbook edits', () => {
  const {success, createTrip, invite, tabs, setup} = environment();
  const tripId = createTrip();
  const key = invite(tripId);
  const clientA = (action, fields) => success(action, {key, ...fields});
  const clientB = () => success('read', {key});
  setup();
  const empty = clientB();
  for (const kind of ['members', 'plans', 'expenses']) assert.deepEqual(empty[kind], []);
  const memberId = id();
  const planId = id();
  const expenseId = id();
  clientA('save', {kind:'members', newId:memberId, record:{name:'測試旅伴'}});
  clientA('save', {kind:'plans', newId:planId, record:{date:'2026-11-21', time:'08:30', title:'集合', place:'車站', note:'東門'}});
  const expense = {date:'2026-11-21', payer:memberId, title:'午餐', amount:'125.25', note:'一份'};
  clientA('save', {kind:'expenses', newId:expenseId, record:expense});
  clientA('save', {kind:'expenses', newId:expenseId, record:expense});
  const read = clientB();
  assert.equal(read.members[0].name, '測試旅伴');
  assert.equal(read.plans[0].time, '08:30');
  assert.equal(read.expenses.length, 1);
  assert.equal(read.expenses[0].amount, 125.25);
  const sheet = tabs.get('Roam_支出');
  assert.deepEqual(sheet.getRange(2, 1, 1, 7).getValues()[0], [tripId, expenseId, '2026-11-21', memberId, '午餐', 125.25, '一份']);
  sheet.getRange(2, 6, 1, 1).setValues([[173.5]]);
  assert.equal(clientB().expenses[0].amount, 173.5);
  assert.equal(tabs.get('既有分頁').getRange(1, 1, 1, 1).getValues()[0][0], '使用者既有資料');
});

test('missing, tampered, cross-trip and revoked access cannot read or write', () => {
  const {api, success, createTrip, invite, key} = environment();
  const tripId = createTrip();
  const other = createTrip('另一趟旅程');
  const access = invite(tripId);
  const second = invite(other);
  const member = success('save', {key:access, kind:'members', newId:id(), record:{name:'只在第一趟旅程'}}).members[0];
  for (const invalid of ['', 'invalid', other + '.' + access.split('.')[1]]) {
    assert.match(api('read', {key:invalid}).error, /無效/);
    assert.match(api('save', {key:invalid, kind:'members', newId:id(), record:{name:'禁止寫入'}}).error, /無效/);
  }
  assert.deepEqual(success('read', {key:second}).members, []);
  assert.match(api('delete', {key:second, kind:'members', id:member.id, stamp:member.stamp}).error, /已更新或刪除/);
  assert.match(api('revoke', {key:access, id:tripId}).error, /主辦人/);
  success('revoke', {key, id:tripId});
  assert.match(api('read', {key:access}).error, /撤銷/);
  assert.match(api('save', {key:access, kind:'members', newId:id(), record:{name:'禁止寫入'}}).error, /撤銷/);
  const replacement = invite(tripId);
  assert.notEqual(replacement, access);
  assert.equal(success('read', {key:replacement}).members.length, 1);
});

test('updates and deletes handle stale versions and preserve extra sheet columns', () => {
  const {api, success, createTrip, invite, tabs} = environment();
  const key = invite(createTrip());
  const item = success('save', {key, kind:'plans', newId:id(), record:{date:'2026-11-21', title:'=文字', place:'車站'}}).plans[0];
  assert.equal(item.title, '=文字');
  const updated = success('save', {key, id:item.id, stamp:item.stamp, kind:'plans',
    record:{...item, title:'新行程'}}).plans[0];
  assert.match(api('delete', {key, id:item.id, stamp:item.stamp, kind:'plans'}).error, /已更新/);
  const sheet = tabs.get('Roam_行程');
  sheet.getRange(2, 8, 1, 1).setValues([['使用者擴充欄位']]);
  assert.deepEqual(success('delete', {key, id:item.id, stamp:updated.stamp, kind:'plans'}).plans, []);
  assert.equal(sheet.getRange(2, 8, 1, 1).getValues()[0][0], '使用者擴充欄位');
});
