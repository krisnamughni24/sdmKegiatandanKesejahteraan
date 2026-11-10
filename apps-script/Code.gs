/**
 * Kuesioner Beban Kegiatan dan Kesejahteraan Serdik: response receiver.
 *
 * Bind this script to the Google Sheet that should hold the answers
 * (Extensions -> Apps Script), run setup() once, then deploy as a Web app:
 *   Execute as: Me    Who has access: Anyone
 *
 * Every request carries the Google ID token the site received at sign-in.
 * The token is verified here, on Google's servers, before anything is read or
 * written: correct audience (our OAuth Client ID), verified email, allowed
 * domain, not expired. One submission per email.
 *
 * Progress is saved server-side (same as Ekspedisi 9 Nilai): the site sends its
 * whole state after consent and after each finished section ("save"). Drafts
 * live in the "Draf" tab (one row per email) and are removed on submission, so
 * "Jawaban" only ever holds final answers. "Kodebook" describes every column.
 *
 * No secrets live in this file. The Client ID is public by design.
 */

const CLIENT_ID = "PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com"; // same value as config.js
const ALLOWED_DOMAIN = "p3md.sbm-itb.ac.id";
const SHEET_ANSWERS = "Jawaban";
const SHEET_DRAFT = "Draf";
const SHEET_CODEBOOK = "Kodebook";
const DRAFT_HEADERS = ["Email", "Terakhir disimpan", "Nama", "Pesona terkumpul", "Data draf (JSON)"];
const MAX_DRAFT_CHARS = 45000; // a Sheets cell holds 50,000 characters

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const who = verifyToken_(body.idToken);
    if (body.action === "status") return json_(status_(who.email));
    if (body.action === "save") return json_(save_(who, body));
    if (body.action === "clear") return json_(clear_(who));
    if (body.action === "submit") return json_(submit_(who, body.rows));
    return json_({ ok: false, code: "BAD_ACTION", message: "Permintaan tidak dikenal." });
  } catch (err) {
    if (!err || !err.code) console.error(err);
    return json_({ ok: false, code: (err && err.code) || "ERROR",
      message: err && err.code ? err.message : "Terjadi kesalahan di server. Coba lagi sebentar lagi." });
  }
}

/* Health check: opening the web app URL in a browser shows this. */
function doGet() {
  return json_({ ok: true, service: "Kuesioner Beban Kegiatan dan Kesejahteraan Serdik", time: new Date().toISOString() });
}

function fail_(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}

function verifyToken_(token) {
  if (!token || typeof token !== "string") fail_("AUTH", "Sesi login tidak ditemukan. Masuk ulang dengan Google.");
  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) fail_("AUTH", "Sesi login sudah kedaluwarsa. Masuk ulang dengan Google.");
  const t = JSON.parse(res.getContentText());
  const email = String(t.email || "").toLowerCase();
  if (t.aud !== CLIENT_ID) fail_("AUTH", "Token login bukan untuk situs ini.");
  if (String(t.email_verified) !== "true") fail_("AUTH", "Email akun Google belum terverifikasi.");
  if (!email.endsWith("@" + ALLOWED_DOMAIN)) fail_("DOMAIN", "Gunakan akun @" + ALLOWED_DOMAIN + ".");
  if (Number(t.exp) * 1000 < Date.now()) fail_("AUTH", "Sesi login sudah kedaluwarsa. Masuk ulang dengan Google.");
  return { email: email };
}

/* ---------- Status ---------- */
function status_(email) {
  if (emails_(answersSheet_(), 2).indexOf(email) >= 0) return { ok: true, submitted: true };
  const d = draftSheet_();
  const i = emails_(d, 1).indexOf(email);
  if (i < 0) return { ok: true, submitted: false };
  const r = d.getRange(i + 2, 1, 1, DRAFT_HEADERS.length).getValues()[0];
  let state = null;
  try { state = JSON.parse(r[4]); } catch (e) {}
  return { ok: true, submitted: false, draft: state ? { at: new Date(r[1]).toISOString(), state: state } : null };
}

/* ---------- Drafts ---------- */
function save_(who, body) {
  const json = JSON.stringify(body.state || {});
  if (json.length > MAX_DRAFT_CHARS) fail_("TOO_LONG", "Jawaban terlalu panjang untuk disimpan sebagai draf. Persingkat isian teks.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (emails_(answersSheet_(), 2).indexOf(who.email) >= 0) fail_("ALREADY", "Akun ini sudah mengirim jawaban.");
    const now = new Date();
    const row = [who.email, now, String(body.nama || "").slice(0, 120), Number(body.progress) || 0, json];
    const d = draftSheet_();
    const i = emails_(d, 1).indexOf(who.email);
    if (i >= 0) d.getRange(i + 2, 1, 1, row.length).setValues([row]);
    else d.appendRow(row);
    return { ok: true, at: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function clear_(who) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { removeDraft_(who.email); return { ok: true }; } finally { lock.releaseLock(); }
}

function removeDraft_(email) {
  const d = draftSheet_();
  const i = emails_(d, 1).indexOf(email);
  if (i >= 0) d.deleteRow(i + 2);
}

/* ---------- Submission ---------- */
function submit_(who, rows) {
  if (!Array.isArray(rows) || !rows.length) fail_("BAD_DATA", "Jawaban kosong.");
  const consent = rows.find(function (r) { return r.k === "persetujuan"; });
  if (!consent || consent.value !== "Ya") fail_("BAD_DATA", "Persetujuan belum diberikan.");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = answersSheet_();
    if (emails_(sh, 2).indexOf(who.email) >= 0) fail_("ALREADY", "Akun ini sudah mengirim jawaban. Setiap Serdik hanya bisa mengirim satu kali.");

    // Header: Waktu kirim, Email, then one column per answer key. New keys are
    // appended at the end so older rows keep their positions.
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const added = [];
    rows.forEach(function (r) {
      if (header.indexOf(r.k) === -1) { header.push(r.k); added.push(r); }
    });
    if (added.length) {
      sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
      appendCodebook_(added);
    }

    const byKey = {};
    rows.forEach(function (r) { byKey[r.k] = r.value; });
    const now = new Date();
    sh.appendRow(header.map(function (h) {
      if (h === "Waktu kirim") return now;
      if (h === "Email") return who.email;
      const v = byKey[h];
      return v === undefined || v === null ? "" : v;
    }));
    removeDraft_(who.email);
    return { ok: true, at: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function appendCodebook_(rows) {
  const sh = sheet_(SHEET_CODEBOOK, ["Kolom", "Pertanyaan", "Kode jawaban"]);
  rows.forEach(function (r) { sh.appendRow([r.k, r.label || "", r.codes || ""]); });
}

/* ---------- Sheets ---------- */
function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
function answersSheet_() { return sheet_(SHEET_ANSWERS, ["Waktu kirim", "Email"]); }
function draftSheet_() { return sheet_(SHEET_DRAFT, DRAFT_HEADERS); }

function emails_(sh, col) {
  const last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, col, last - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); }) : [];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Run once from the editor to create the tabs and grant permissions. */
function setup() {
  answersSheet_();
  draftSheet_();
  sheet_(SHEET_CODEBOOK, ["Kolom", "Pertanyaan", "Kode jawaban"]);
  UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=x", { muteHttpExceptions: true });
}
