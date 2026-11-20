const ROAM_SHEET_ID = '15epmkeXdkwjIb7GTVmbLhcW2gHkmyBIxH_Yl1zUzPWM';
const ROAM_ORGANIZER = 'ROAM_ORGANIZER_KEY';
const ROAM_SCHEMA = {
  trips: ['Roam_旅程', ['旅程 ID', '旅程名稱', '開始日期', '結束日期', '邀請版本（請勿修改）']],
  members: ['Roam_旅伴', ['旅程 ID', '旅伴 ID', '姓名']],
  itinerary: ['Roam_行程', ['旅程 ID', '行程 ID', '日期', '時間', '名稱', '地點', '備註']],
  expenses: ['Roam_支出', ['旅程 ID', '支出 ID', '日期', '名稱', '付款旅伴 ID', '金額（元）', '備註']]
};
const ROAM_KEY = /^[a-f0-9]{64}$/;
const ROAM_ID = /^[a-f0-9]{32}$/;

// Run once from the script editor after restricting the sheet. Private functions
// (names ending in "_") cannot be called through google.script.run.
function setupRoam_() {
  withRoamLock_(() => {
    const book = openRoamBook_();
    for (const kind of Object.keys(ROAM_SCHEMA)) {
      const [name, labels] = ROAM_SCHEMA[kind];
      let sheet = book.getSheetByName(name);
      if (!sheet) sheet = book.insertSheet(name);
      if (!sheet.getLastRow()) {
        sheet.getRange(1, 1, 1, labels.length).setValues([labels]).setFontWeight('bold');
        sheet.setFrozenRows(1);
        sheet.getRange(2, 1, sheet.getMaxRows() - 1, labels.length).setNumberFormat('@');
        if (kind === 'expenses') {
          sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1).setNumberFormat('0.00');
        }
      }
      roamTab_(book, kind);
    }
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty(ROAM_ORGANIZER)) props.setProperty(ROAM_ORGANIZER, roamKey_());
  });
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('旅伴 roam')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function roamInclude_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// The only browser RPC. Access is checked before reading any trip data or
// performing a mutation. Tokens travel in the RPC body, not a query string.
function roamRpc(request) {
  try {
    const r = request || {};
    const organizer = PropertiesService.getScriptProperties().getProperty(ROAM_ORGANIZER);
    const isOrganizer = Boolean(organizer && ROAM_KEY.test(r.organizer) && sameRoam_(r.organizer, organizer));
    if (!isOrganizer && !(ROAM_ID.test(r.tripId) && ROAM_KEY.test(r.invite))) {
      roamError_('access', '請使用有效的私人邀請連結。');
    }
    return withRoamLock_(() => {
      const book = openRoamBook_();
      const trips = roamRows_(book, 'trips');
      if (isOrganizer && r.action === 'list') {
        return { ok: true, trips: trips.rows.filter(row => ROAM_ID.test(row.values[0])).map(tripData_) };
      }
      if (isOrganizer && r.action === 'create') return createRoamTrip_(trips, r.data);
      const trip = ROAM_ID.test(r.tripId) && trips.rows.find(row => row.values[0] === r.tripId);
      if (!trip || (!isOrganizer && !sameRoam_(r.invite, roamInviteKey_(trip, organizer)))) {
        roamError_('access', '邀請連結無效或已撤銷。');
      }
      if (isOrganizer && r.action === 'invitation') return roamInvitation_(trips, trip, organizer, r.data);
      if (r.action === 'get') return roamSnapshot_(book, trip, isOrganizer);
      if (isOrganizer && r.action === 'updateTrip') {
        updateRoamTrip_(book, trips, trip, r.data);
        return { ok: true };
      }
      if (r.action === 'save' || r.action === 'delete') {
        changeRoamRow_(book, trip, r);
        return { ok: true };
      }
      roamError_('access', '無法執行此操作。');
    });
  } catch (error) {
    if (error.roamCode) return { ok: false, code: error.roamCode, message: error.message };
    return { ok: false, code: 'server', message: '無法存取試算表，請稍後重試或聯絡主辦人。' };
  }
}

function openRoamBook_() {
  if (DriveApp.getFileById(ROAM_SHEET_ID).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    roamError_('sharing', '主辦人須先在 Google 試算表將一般存取設為「限制」。');
  }
  return SpreadsheetApp.openById(ROAM_SHEET_ID);
}

function withRoamLock_(run) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) roamError_('busy', '目前有其他更新，請稍後重試。');
  try {
    const result = run();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function roamTab_(book, kind) {
  const [name, labels] = ROAM_SCHEMA[kind];
  const sheet = book.getSheetByName(name);
  if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, labels.length).getValues()[0]) !== JSON.stringify(labels)) {
    roamError_('setup', '找不到符合格式的 Roam 分頁，請主辦人確認初始化設定。');
  }
  return sheet;
}

function roamRows_(book, kind) {
  const sheet = roamTab_(book, kind);
  const count = sheet.getLastRow() - 1;
  const width = ROAM_SCHEMA[kind][1].length;
  const values = count ? sheet.getRange(2, 1, count, width).getValues() : [];
  const timezone = book.getSpreadsheetTimeZone();
  const rows = values.map((cells, i) => ({
    index: i + 2,
    values: cells.map((cell, col) => {
      if (!(cell instanceof Date)) return cell;
      return Utilities.formatDate(cell, timezone, kind === 'itinerary' && col === 3 ? 'HH:mm' : 'yyyy-MM-dd');
    })
  }));
  return { sheet, rows };
}

function writeRoamRow_(table, index, values) {
  if (index > table.sheet.getMaxRows()) table.sheet.insertRowsAfter(table.sheet.getMaxRows(), 100);
  // Sheets interprets leading "=" as a formula, even for text supplied by Apps Script.
  const cells = values.map(value => typeof value === 'string' && /^[=+\-@']/.test(value) ? "'" + value : value);
  table.sheet.getRange(index, 1, 1, cells.length).setValues([cells]);
}

function tripData_(row) {
  const [id, name, start, end, inviteHash] = row.values;
  // Invitation rotation should not invalidate an open editor for the dates/name.
  return { id, name: String(name), start, end, hasInvite: ROAM_ID.test(inviteHash),
    version: roamHash_(JSON.stringify([id, name, start, end])) };
}

function roamSnapshot_(book, row, organizer) {
  const trip = tripData_(row);
  const belonging = kind => roamRows_(book, kind).rows
    .filter(item => item.values[0] === trip.id && ROAM_ID.test(item.values[1]))
    .map(item => roamRowData_(kind, item.values));
  return { ok: true, organizer, trip, members: belonging('members'),
    itinerary: belonging('itinerary'), expenses: belonging('expenses') };
}

function roamRowData_(kind, values) {
  const [, id, first, second, third, fourth, fifth] = values;
  const version = roamHash_(JSON.stringify(values));
  if (kind === 'members') return { id, version, name: String(first) };
  if (kind === 'itinerary') return { id, version, date: first, time: second, title: String(third),
    place: String(fourth), note: String(fifth) };
  return { id, version, date: first, title: String(second), payer: third, amount: fourth, note: String(fifth) };
}

function createRoamTrip_(trips, data) {
  const [name, start, end] = roamTripFields_(data);
  const id = data.id;
  if (!ROAM_ID.test(id)) roamError_('validation', '旅程 ID 無效。');
  const existing = trips.rows.find(row => row.values[0] === id);
  if (existing) return { ok: true, id };
  writeRoamRow_(trips, trips.sheet.getLastRow() + 1, [id, name, start, end, '']);
  return { ok: true, id };
}

function updateRoamTrip_(book, trips, row, data) {
  const trip = tripData_(row);
  if (!data || data.version !== trip.version) roamConflict_();
  const [name, start, end] = roamTripFields_(data);
  if (roamRows_(book, 'itinerary').rows.some(({ values }) => values[0] === trip.id &&
      (values[2] < start || values[2] > end))) {
    roamError_('validation', '請先調整超出新日期範圍的行程。');
  }
  writeRoamRow_(trips, row.index, [trip.id, name, start, end, row.values[4]]);
}

function roamInvitation_(trips, trip, organizer, data) {
  const action = data && data.mode;
  const url = ScriptApp.getService().getUrl();
  if (!url || !url.endsWith('/exec')) roamError_('setup', '請使用正式部署的 /exec 網址。');
  if (action === 'rotate' && ROAM_ID.test(data.nonce)) {
    trip.values[4] = data.nonce;
    trips.sheet.getRange(trip.index, 5).setValue(data.nonce);
  } else if (action === 'revoke') {
    trip.values[4] = '';
    trips.sheet.getRange(trip.index, 5).clearContent();
  } else if (action !== 'retrieve') {
    roamError_('validation', '邀請操作無效。');
  }
  const key = roamInviteKey_(trip, organizer);
  return { ok: true, url: key ? url + '#trip=' + trip.values[0] + '&invite=' + key : '' };
}

function roamInviteKey_(trip, organizer) {
  const [id, , , , nonce] = trip.values;
  if (!organizer || !ROAM_ID.test(nonce)) return '';
  return Utilities.computeHmacSha256Signature('roam-invite:' + id + ':' + nonce, organizer)
    .map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
}

function changeRoamRow_(book, trip, request) {
  const kind = request.kind;
  const data = request.data;
  if (!['members', 'itinerary', 'expenses'].includes(kind) || !data || !ROAM_ID.test(data.id)) {
    roamError_('validation', '資料類型或 ID 無效。');
  }
  const tripId = trip.values[0];
  const table = roamRows_(book, kind);
  const existing = table.rows.find(row => row.values[0] === tripId && row.values[1] === data.id);
  if (request.action === 'delete') {
    if (!existing) return;
    if (data.version !== roamRowData_(kind, existing.values).version) roamConflict_();
    if (kind === 'members' && roamRows_(book, 'expenses').rows.some(({ values }) =>
        values[0] === tripId && values[4] === data.id)) {
      roamError_('validation', '這位旅伴有付款紀錄，請先調整相關支出。');
    }
    table.sheet.deleteRow(existing.index);
    return;
  }
  const values = [tripId, data.id, ...roamFields_(book, kind, data, trip)];
  if (existing && JSON.stringify(values) === JSON.stringify(existing.values)) return;
  if (existing ? data.version !== roamRowData_(kind, existing.values).version : data.version) roamConflict_();
  writeRoamRow_(table, existing ? existing.index : table.sheet.getLastRow() + 1, values);
}

function roamFields_(book, kind, data, trip) {
  if (kind === 'members') return [roamText_(data.name, '旅伴姓名', 80, true)];
  const date = roamDate_(data.date);
  const title = roamText_(data.title, '名稱', 160, true);
  const note = roamText_(data.note, '備註', 2000);
  if (kind === 'itinerary') {
    if (date < trip.values[2] || date > trip.values[3]) roamError_('validation', '行程日期必須在旅程日期內。');
    const time = data.time || '';
    if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) roamError_('validation', '請輸入有效時間。');
    return [date, time, title, roamText_(data.place, '地點', 200), note];
  }
  if (!ROAM_ID.test(data.payer) || !roamRows_(book, 'members').rows.some(({ values }) =>
    values[0] === trip.values[0] && values[1] === data.payer)) {
    roamError_('validation', '請選擇這趟旅程的付款旅伴。');
  }
  const amount = String(data.amount);
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    roamError_('validation', '金額須大於零，整數最多九位，小數最多兩位。');
  }
  return [date, title, data.payer, Number(amount), note];
}

function roamTripFields_(data) {
  const fields = data || {};
  const name = roamText_(fields.name, '旅程名稱', 160, true);
  const start = roamDate_(fields.start);
  const end = roamDate_(fields.end);
  if (start > end || Date.parse(end) - Date.parse(start) > 365 * 86400000) {
    roamError_('validation', '結束日期須在開始日期後一年內（可為同一天）。');
  }
  return [name, start, end];
}

function roamDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    roamError_('validation', '請輸入有效日期。');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    roamError_('validation', '請輸入有效日期。');
  }
  return value;
}

function roamText_(value, label, max, required) {
  if (value == null) value = '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    roamError_('validation', label + '格式不符（最多 ' + max + ' 字）。');
  }
  return value.trim();
}

function roamKey_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

function roamHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
}

function sameRoam_(a, b) {
  if (typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function roamConflict_() {
  roamError_('conflict', '這筆資料已被更新。請關閉表單並重新整理，再重新編輯。');
}

function roamError_(code, message) {
  const error = new Error(message);
  error.roamCode = code;
  throw error;
}
