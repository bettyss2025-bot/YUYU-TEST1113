const ROAM_TABLES = {
  trips: ['Roam_旅程', ['旅程 ID', '名稱', '開始日期', '結束日期']],
  members: ['Roam_旅伴', ['旅程 ID', '旅伴 ID', '姓名']],
  plans: ['Roam_行程', ['旅程 ID', '行程 ID', '日期', '時間', '名稱', '地點', '備註']],
  expenses: ['Roam_支出', ['旅程 ID', '支出 ID', '日期', '付款人 ID', '名稱', '金額（TWD）', '備註']]
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Roam')
    .setTitle('旅伴 roam')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

// In the Apps Script editor, run this after configuring ROAM_SHEET_ID.
// Run again to recover the private organizer URL after deployment.
function roamSetup_() {
  const config = PropertiesService.getScriptProperties();
  const book = roamBook_();
  roamLocked_(function () {
    Object.keys(ROAM_TABLES).forEach(function (kind) {
      if (book.getSheetByName(ROAM_TABLES[kind][0])) roamTable_(book, kind);
    });
    Object.keys(ROAM_TABLES).forEach(function (kind) {
      const [name, headers] = ROAM_TABLES[kind];
      if (book.getSheetByName(name)) return;
      const sheet = book.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange('A:B').setNumberFormat('@');
      if (kind !== 'members') sheet.getRange('C:D').setNumberFormat('@');
      if (kind === 'expenses') sheet.getRange('F:F').setNumberFormat('0.00');
    });
    if (!config.getProperty('ROAM_SECRET')) config.setProperty('ROAM_SECRET', roamRandom_() + roamRandom_());
  });
  const url = roamUrl_();
  console.log(url ? url + '#organizer=' + roamSign_('organizer') : '請先部署 Web 應用程式，再執行一次 roamSetup_。');
}

function roamRequest(request) {
  try {
    return roamLocked_(function () { return {data: roamDispatch_(request || {})}; });
  } catch (error) {
    return {error: error.roamMessage || '無法連線或儲存，請稍後重新整理。'};
  }
}

function roamDispatch_(request) {
  const {action, key, id, kind, record, stamp} = request;
  if (['organizer', 'createTrip', 'invite', 'revoke'].includes(action)) {
    if (!roamEqual_(key, roamSign_('organizer'))) roamFail_('主辦人連結無效。');
    const book = roamBook_();
    const trips = roamTable_(book, 'trips');
    if (action === 'organizer') return {trips: roamRows_(trips).map(row => roamTrip_(row.values, book))};
    if (action === 'createTrip') {
      const fields = roamTripFields_(record);
      const tripId = roamNewId_(id);
      const existing = roamRows_(trips).find(row => row.values[0] === tripId);
      if (existing) return {id: tripId};
      roamWrite_(trips, null, [tripId, ...fields]);
      return {id: tripId};
    }
    const row = roamRows_(trips).find(row => row.values[0] === id);
    if (!row) roamFail_('找不到旅程。');
    const config = PropertiesService.getScriptProperties();
    if (action === 'revoke') {
      config.deleteProperty('ROAM_INVITE_' + id);
      return {active: false};
    }
    if (!config.getProperty('ROAM_INVITE_' + id)) config.setProperty('ROAM_INVITE_' + id, roamRandom_());
    return {url: roamUrl_() + '#invite=' + id + '.' + roamInvite_(id)};
  }

  const match = typeof key === 'string' && /^([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(key);
  if (!match || !roamEqual_(match[2], roamInvite_(match[1]))) roamFail_('旅程邀請連結無效或已撤銷。');
  const tripId = match[1];
  const book = roamBook_();
  const trips = roamTable_(book, 'trips');
  const tripRow = roamRows_(trips).find(row => row.values[0] === tripId);
  if (!tripRow) roamFail_('旅程邀請連結無效或已撤銷。');
  if (action === 'read') return roamRead_(book, tripRow);
  if (action === 'updateTrip') {
    roamCheckStamp_(tripRow, stamp);
    roamWrite_(trips, tripRow, [tripId, ...roamTripFields_(record)]);
    return roamRead_(book, tripRow);
  }
  if (!['save', 'delete'].includes(action) || !['members', 'plans', 'expenses'].includes(kind)) {
    roamFail_('無法執行這項操作。');
  }
  const table = roamTable_(book, kind);
  const current = id ? roamRows_(table, tripId).find(row => row.values[1] === id) : null;
  if (id) roamCheckStamp_(current, stamp);
  if (action === 'delete') {
    if (!current) roamFail_('找不到資料。');
    if (kind === 'members' && roamRows_(roamTable_(book, 'expenses'), tripId).some(row => row.values[3] === id)) {
      roamFail_('這位旅伴仍有付款紀錄。請先調整相關帳目。');
    }
    table.sheet.getRange(current.number, 1, 1, table.width).clearContent();
  } else {
    const newId = current ? current.values[1] : roamNewId_(request.newId);
    if (!current && roamRows_(table, tripId).some(row => row.values[1] === newId)) return roamRead_(book, tripRow);
    const fields = roamRecordFields_(book, tripId, kind, record || {});
    roamWrite_(table, current, [tripId, newId, ...fields]);
  }
  return roamRead_(book, tripRow);
}

function roamRead_(book, tripRow) {
  const fresh = roamRows_(roamTable_(book, 'trips')).find(row => row.values[0] === tripRow.values[0]);
  const trip = roamTrip_(fresh.values, book);
  delete trip.active;
  trip.stamp = roamStamp_(fresh);
  const maps = {
    members: (_, id, name) => ({id: String(id), name: String(name)}),
    plans: (_, id, date, time, title, place, note) => ({id: String(id), date: roamCellDate_(date, book),
      time: roamCellTime_(time, book), title: String(title), place: String(place), note: String(note)}),
    expenses: (_, id, date, payer, title, amount, note) => ({id: String(id), date: roamCellDate_(date, book),
      payer: String(payer), title: String(title), amount: Math.round(Number(amount) * 100) / 100, note: String(note)})
  };
  return Object.keys(maps).reduce(function (data, kind) {
    data[kind] = roamRows_(roamTable_(book, kind), trip.id).map(row => ({
      ...maps[kind](...row.values), stamp: roamStamp_(row)
    }));
    return data;
  }, {trip});
}

function roamTrip_(values, book) {
  const [id, name, start, end] = values;
  return {id: String(id), name: String(name), start: roamCellDate_(start, book), end: roamCellDate_(end, book),
    active: Boolean(PropertiesService.getScriptProperties().getProperty('ROAM_INVITE_' + id))};
}

function roamRecordFields_(book, tripId, kind, item) {
  if (kind === 'members') return [roamText_(item.name, 60, true)];
  const date = roamDate_(item.date);
  const title = roamText_(item.title, 120, true);
  const note = roamText_(item.note, 2000);
  if (kind === 'plans') {
    const time = roamText_(item.time, 5);
    if (time && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) roamFail_('請輸入有效時間。');
    return [date, time, title, roamText_(item.place, 200), note];
  }
  if (!roamRows_(roamTable_(book, 'members'), tripId).some(row => row.values[1] === item.payer)) {
    roamFail_('請選擇這趟旅程的付款人。');
  }
  if (typeof item.amount !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(item.amount) || Number(item.amount) <= 0) {
    roamFail_('請輸入大於零、最多兩位小數的金額。');
  }
  return [date, item.payer, title, Number(item.amount), note];
}

function roamTripFields_(item) {
  item = item || {};
  const start = roamDate_(item.start);
  const end = roamDate_(item.end);
  if (end < start) roamFail_('結束日期須等於或晚於開始日期。');
  return [roamText_(item.name, 80, true), start, end];
}

function roamText_(value, limit, required) {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > limit) roamFail_('請檢查必填欄位與字數限制。');
  return text;
}

function roamDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) roamFail_('請輸入有效日期。');
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) roamFail_('請輸入有效日期。');
  return value;
}

function roamCellDate_(value, book) {
  return value instanceof Date ? Utilities.formatDate(value, book.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(value || '');
}

function roamCellTime_(value, book) {
  return value instanceof Date ? Utilities.formatDate(value, book.getSpreadsheetTimeZone(), 'HH:mm') : String(value || '');
}

function roamBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('ROAM_SHEET_ID');
  if (!id) roamFail_('請主辦人完成試算表設定。');
  return SpreadsheetApp.openById(id);
}

function roamUrl_() {
  const configured = PropertiesService.getScriptProperties().getProperty('ROAM_WEB_URL');
  if (configured && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(configured)) {
    roamFail_('ROAM_WEB_URL 必須是正式的 Apps Script /exec 網址。');
  }
  return configured || ScriptApp.getService().getUrl();
}

function roamTable_(book, kind) {
  const [name, headers] = ROAM_TABLES[kind];
  const sheet = book.getSheetByName(name);
  const actual = sheet && sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (!actual || headers.some((header, i) => actual[i] !== header)) {
    roamFail_('試算表分頁或欄名不符，請主辦人檢查 ' + name + '。');
  }
  return {sheet, width: headers.length};
}

function roamRows_(table, tripId) {
  const count = table.sheet.getLastRow() - 1;
  if (count <= 0) return [];
  return table.sheet.getRange(2, 1, count, table.width).getValues()
    .map((values, index) => ({values, number: index + 2}))
    .filter(row => row.values[0] && (!tripId || row.values[0] === tripId));
}

function roamWrite_(table, existing, values) {
  const row = existing ? existing.number : table.sheet.getLastRow() + 1;
  if (row > table.sheet.getMaxRows()) table.sheet.insertRowsAfter(table.sheet.getMaxRows(), 100);
  // Sheets interprets a leading equals sign as a formula. Store literal user text.
  const literal = values.map(value => typeof value === 'string' && /^[=+\-@']/.test(value) ? "'" + value : value);
  table.sheet.getRange(row, 1, 1, table.width).setValues([literal]);
}

function roamStamp_(row) {
  return roamSign_('row:' + JSON.stringify(row.values));
}

function roamCheckStamp_(row, stamp) {
  if (!row || !roamEqual_(stamp, roamStamp_(row))) roamFail_('這筆資料已更新或刪除。請關閉表單並重新整理。');
}

function roamInvite_(id) {
  const nonce = PropertiesService.getScriptProperties().getProperty('ROAM_INVITE_' + id);
  return nonce ? roamSign_('invite:' + id + ':' + nonce) : '';
}

function roamSign_(message) {
  const secret = PropertiesService.getScriptProperties().getProperty('ROAM_SECRET');
  if (!secret) roamFail_('請主辦人完成網站設定。');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(message, secret)).replace(/=+$/, '');
}

function roamEqual_(left, right) {
  if (typeof left !== 'string' || !right || left.length !== right.length) return false;
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return different === 0;
}

function roamRandom_() {
  return Utilities.getUuid().replace(/-/g, '').toLowerCase();
}

function roamNewId_(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) roamFail_('資料識別碼無效。');
  return id;
}

function roamLocked_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const result = callback();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function roamFail_(message) {
  const error = new Error(message);
  error.roamMessage = message;
  throw error;
}
