/**
 * Backend for Gelang Pesona Serdik.
 * Deploy as a Web app (Execute as: Me, Who has access: Anyone).
 * Writes one row per Google account into the "Jawaban" sheet and keeps a
 * "Kodebook" sheet describing every column.
 */
const CLIENT_ID = 'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com'; // same value as config.js
const ALLOWED_DOMAIN = 'p3md.sbm-itb.ac.id';
const SHEET_ANSWERS = 'Jawaban';
const SHEET_CODEBOOK = 'Kodebook';

function doGet() {
  return ContentService.createTextOutput('Gelang Pesona backend is running.');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const user = verifyToken_(body.idToken);
    if (body.action === 'status') return json_({ ok: true, submitted: hasSubmitted_(user.email) });
    if (body.action === 'submit') return submit_(user, body.rows);
    return json_({ ok: false, code: 'BAD_ACTION' });
  } catch (err) {
    return json_({ ok: false, code: err.code || 'ERROR', message: String(err.message || err) });
  }
}

function fail_(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}

/** Verifies a Google ID token and returns { email }. */
function verifyToken_(token) {
  if (!token) fail_('AUTH', 'Missing token.');
  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) fail_('AUTH', 'Token rejected.');
  const info = JSON.parse(res.getContentText());
  const email = String(info.email || '').toLowerCase();
  if (info.aud !== CLIENT_ID) fail_('AUTH', 'Token issued for another app.');
  if (String(info.email_verified) !== 'true') fail_('AUTH', 'Email not verified.');
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) fail_('DOMAIN', 'Account is not on the allowed domain.');
  if (Number(info.exp) * 1000 < Date.now()) fail_('AUTH', 'Token expired.');
  return { email: email };
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function hasSubmitted_(email) {
  const sh = sheet_(SHEET_ANSWERS);
  const last = sh.getLastRow();
  if (last < 2) return false;
  return sh.getRange(2, 2, last - 1, 1).getValues()
    .some(function (r) { return String(r[0]).toLowerCase() === email; });
}

function submit_(user, rows) {
  if (!Array.isArray(rows) || !rows.length) fail_('BAD_DATA', 'Empty submission.');
  const consent = rows.find(function (r) { return r.k === 'persetujuan'; });
  if (!consent || consent.value !== 'Ya') fail_('BAD_DATA', 'Consent missing.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (hasSubmitted_(user.email)) fail_('ALREADY', 'This account has already submitted.');
    const sh = sheet_(SHEET_ANSWERS);

    // Header: Waktu, Email, then one column per answer key. New keys are
    // appended at the end so older rows keep their positions.
    let header = sh.getLastRow() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (!header.length) header = ['Waktu', 'Email'];
    const added = [];
    rows.forEach(function (r) {
      if (header.indexOf(r.k) === -1) { header.push(r.k); added.push(r); }
    });
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (added.length) appendCodebook_(added);

    const byKey = {};
    rows.forEach(function (r) { byKey[r.k] = r.value; });
    const row = header.map(function (h) {
      if (h === 'Waktu') return new Date();
      if (h === 'Email') return user.email;
      const v = byKey[h];
      return v === undefined || v === null ? '' : v;
    });
    sh.appendRow(row);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function appendCodebook_(rows) {
  const sh = sheet_(SHEET_CODEBOOK);
  if (!sh.getLastRow()) {
    sh.appendRow(['Kolom', 'Pertanyaan', 'Kode jawaban']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  rows.forEach(function (r) { sh.appendRow([r.k, r.label || '', r.codes || '']); });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
