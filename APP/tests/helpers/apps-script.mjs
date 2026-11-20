import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const files = new URL('../../apps-script/', import.meta.url);
const read = name => readFileSync(new URL(name, files), 'utf8');

class Sheet {
  cells = [];
  formulas = [];

  getLastRow() {
    return this.cells.findLastIndex(row => row?.some(value => value !== '')) + 1;
  }

  getMaxRows() { return Math.max(this.cells.length, 1000); }
  insertRowsAfter(index, count) { this.cells.length = index + count; }
  deleteRow(row) { this.cells.splice(row - 1, 1); }
  setFrozenRows() {}

  getRange(row, col, height = 1, width = 1) {
    const readCell = (y, x) => this.cells[y]?.[x] ?? '';
    const range = {
      setFontWeight: () => range,
      setNumberFormat: () => range,
      getValues: () => Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => readCell(row - 1 + y, col - 1 + x))),
      setValues: matrix => {
        for (const [y, values] of matrix.entries()) {
          const cells = this.cells[row - 1 + y] ??= [];
          for (const [x, value] of values.entries()) {
            if (typeof value === 'string' && value.startsWith('=')) this.formulas.push(value);
            cells[col - 1 + x] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
          }
        }
        return range;
      },
      setValue: value => range.setValues([[value]]),
      clearContent: () => range.setValue('')
    };
    return range;
  }
}

export function appsScript({ url = 'https://script.google.com/macros/s/local/exec' } = {}) {
  const tabs = new Map();
  const properties = new Map();
  const book = {
    getSheetByName: name => tabs.get(name),
    insertSheet: name => {
      const sheet = new Sheet();
      tabs.set(name, sheet);
      return sheet;
    },
    getSpreadsheetTimeZone: () => 'Asia/Taipei'
  };
  const harness = {
    sharing: 'PRIVATE',
    book, tabs,
    organizer: () => properties.get('ROAM_ORGANIZER_KEY')
  };
  let locked = false;
  const context = vm.createContext({
    Date,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value)
    }) },
    DriveApp: { getFileById: () => ({ getSharingAccess: () => harness.sharing }), Access: { PRIVATE: 'PRIVATE' } },
    SpreadsheetApp: { openById: () => book, flush: () => {} },
    LockService: { getScriptLock: () => ({
      tryLock: () => {
        if (locked) return false;
        locked = true;
        return true;
      },
      releaseLock: () => { locked = false; }
    }) },
    ScriptApp: { getService: () => ({ getUrl: () => url }) },
    HtmlService: {
      createTemplateFromFile: name => ({
        evaluate: () => {
          harness.html = read(name + '.html').replace(/<\?!= roamInclude_\('(\w+)'\); \?>/g,
            (_, file) => read(file + '.html'));
          return { setTitle() { return this; }, addMetaTag() { return this; } };
        }
      })
    },
    Utilities: {
      getUuid: randomUUID,
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => [...createHash(algorithm).update(value).digest()],
      computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()],
      formatDate: (date, timeZone, format) => format === 'HH:mm'
        ? new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(date)
        : new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date)
    }
  });
  vm.runInContext(read('Code.gs'), context, { filename: 'Code.gs' });
  harness.run = request => JSON.parse(JSON.stringify(context.roamRpc(request)));
  harness.setup = context.setupRoam_;
  harness.render = () => { context.doGet(); return harness.html; };
  return harness;
}
