/**
 * Critter Swap backend (saving only). The web page reads the sheet directly; this script writes to it.
 *
 * Setup (once):
 *   1. Open your trade sheet > Extensions > Apps Script, and paste this file in.
 *   2. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone.
 *   3. Open the web app URL (ends with /exec) once in your browser.
 *      That writes the URL into a Settings tab, so players only ever need the sheet link.
 *   4. Share the sheet as "Anyone with the link: Viewer" so the page can read it.
 *
 * The album tab ("Latest-Album") is a grid, one column per player:
 *   A1 USERNAME | B1 name | C1 name | ...
 *   A2 PUID     | B2 id   | C2 id   | ...
 *   A3..A137    = cards 1..135        A138..A272 = foil cards 1F..135F
 *   A player's cell is "FT" (for trade), "LF" (looking for) or blank.
 * Keep the PUID row (row 2) formatted as Plain text. Don't reorder or delete the card rows.
 * Other tabs (created automatically):
 *   Settings: key | value                     (goldTrading = on / off, scriptUrl = filled in for you)
 *   Cards:    number | name | stars | rarity  (optional; blank cell = keep the site's default)
 */
const ALBUM_TAB = 'Latest-Album';
const TOTAL = 135;                 // cards per version; the foil block follows the normal block
const FIRST_CARD_ROW = 3;          // row of card 1; card nF is at FIRST_CARD_ROW + TOTAL + n - 1
const LAST_ROW = FIRST_CARD_ROW + TOTAL * 2 - 1;   // 272

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet_(name, head, seed) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    (seed || []).forEach(r => sh.appendRow(r));
  }
  return sh;
}

// Creates the album tab (if it doesn't exist) with the card rows in the right order.
function ensureAlbum_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ALBUM_TAB);
  if (sh) return sh;
  sh = ss.insertSheet(ALBUM_TAB);
  const col = [['USERNAME'], ['PUID']];
  for (let n = 1; n <= TOTAL; n++) col.push([String(n)]);
  for (let n = 1; n <= TOTAL; n++) col.push([n + 'F']);
  sh.getRange(1, 1, col.length, 1).setNumberFormat('@').setValues(col);
  sh.setFrozenRows(2); sh.setFrozenColumns(1);
  return sh;
}

function setSetting_(key, value) {
  const sh = ensureSheet_('Settings', ['key', 'value'], [['goldTrading', 'off']]);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

// Safe to run many times.
function setup_() {
  ensureAlbum_();
  ensureSheet_('Cards', ['number', 'name', 'stars', 'rarity']);
  const url = ScriptApp.getService().getUrl();
  if (url) setSetting_('scriptUrl', url);
}

// Open the /exec URL once in a browser to finish setup.
function doGet() {
  setup_();
  return json_({ ok: true, message: 'Critter Swap is set up. You can close this tab.' });
}

// "12" -> normal card 12, "12F" -> foil card 12, as a row number (or 0 if invalid).
function rowFor_(code) {
  const m = /^(\d{1,3})(F?)$/.exec(code);
  const n = m && Number(m[1]);
  if (!m || n < 1 || n > TOTAL) return 0;
  return FIRST_CARD_ROW + (m[2] ? TOTAL : 0) + n - 1;
}

// Write: save one player's lists into their column (found by player ID, created if new).
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return json_({ ok: false, error: 'spam' }); // honeypot
    const playerId = String(d.playerId || '').trim();
    const username = String(d.username || '').trim().slice(0, 30);
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(playerId) || !username) return json_({ ok: false, error: 'Missing or invalid name / player ID' });

    const sh = ensureAlbum_();
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const head = sh.getRange(1, 1, 2, lastCol).getValues();   // [usernames, PUIDs]

    // existing player? (column B onwards)
    let col = 0, isNew = false;
    for (let c = 1; c < lastCol; c++) {
      if (String(head[1][c]).trim().toLowerCase() === playerId.toLowerCase()) { col = c + 1; break; }
    }
    if (!col) {   // new player: first column with an empty username and PUID
      isNew = true;
      col = lastCol + 1;
      for (let c = 1; c < lastCol; c++) {
        if (!String(head[0][c]).trim() && !String(head[1][c]).trim()) { col = c + 1; break; }
      }
      if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns());
    }

    const values = [];
    for (let r = 1; r <= LAST_ROW; r++) values.push(['']);
    values[0][0] = username;
    values[1][0] = playerId;
    const mark = (list, tag) => String(list || '').split(',').forEach(c => {
      const row = rowFor_(c.trim().toUpperCase());
      if (row) values[row - 1][0] = tag;
    });
    mark(d.lookingFor, 'LF');
    mark(d.forTrade, 'FT');    // a card can only be in one list; FT wins if both were sent

    const range = sh.getRange(1, col, LAST_ROW, 1);
    range.setNumberFormat('@');      // plain text, so player IDs stay text and don't get read as numbers
    range.setValues(values);
    return json_({ ok: true, updated: !isNew });
  } finally {
    lock.releaseLock();
  }
}
