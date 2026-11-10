# Kuesioner Beban Kegiatan dan Kesejahteraan Serdik

Charm-themed web front end for the Bidang SDM questionnaire
"Kuesioner Beban Kegiatan dan Kesejahteraan Serdik". Same architecture as
Ekspedisi 9 Nilai: static site on Vercel, Google sign-in gated to
`p3md.sbm-itb.ac.id`, one-click submission through a Google Apps Script web
app into a Google Sheet, one submission per account.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole site (questions, flow, styling). |
| `config.js` | Public settings: Client ID, Apps Script URL, domain, SDM contact, data notice. |
| `privasi.html` | Privacy policy page (Risdikti as operator) for the Google OAuth consent screen. |
| `apps-script/Code.gs` | Backend: verifies the Google ID token, saves drafts, blocks repeat submissions, writes the row. |

With `clientId` empty the site runs in **preview mode**: no sign-in, nothing is
sent, and the submit button only simulates sending. Good for showing Bidang SDM.

## How it plays

- 7 sections, one per screen; each finished section earns a charm
  (Bintang, Awan, Hati, Petir, Bunga, Bulan, Surat). The bracelet in the header
  is the progress bar.
- Charms count completed sections only, never answer values, so the game does
  not nudge answers.
- No scores are shown back to the respondent (wellbeing answers are sensitive).
- Nothing is stored in the browser (same as Ekspedisi 9 Nilai). Progress is
  saved server-side to the `Draf` tab per question (debounced; at most one
  request every 6 s per person, immediately on finishing a section, and a
  last `sendBeacon` when the tab is hidden or closed), loaded back after sign-in on any device, and deleted on submission
  or with "Mulai dari awal". Sign-in is never persisted; every visit asks for
  Google sign-in again. An expired ID token (1 hour) is renewed in a popup
  without losing in-memory answers.

## Changes from the Google Form (worth confirming with Bidang SDM)

- Validation: No Serdik `^\d{3}$`, phone numbers `^62\d{8,13}$`, name in capitals.
- Address fields after Tanggal lahir: alamat KTP, "sama dengan domisili?", and
  alamat domisili only when "Tidak" (sent as "-" when "Ya", as the form asks).
- Branching instead of "write -": leadership/business details only after "Ya";
  weekly hours and the "Peran tambahan" NASA-TLX rows only when a role is chosen.
  Hidden answers are sent empty; `peran_jam` is sent as "Tidak ada".
- "Tidak ada" is exclusive in multi-select questions.
- Bagian 5 (NASA-TLX) follows the form: one question per dimension (pikir,
  fisik, waktu, usaha) with a 0–10 row per activity; attention check `att1`
  (expected answer: 2 = Jarang) sits between "waktu" and "usaha". The
  "diburu waktu dalam ini" typo is fixed to "dalam kegiatan ini".
- Sleep hours bins no longer overlap: <3, 3–<4, 4–<5, 5–<6, ≥6.
- "Hari dan jam paling kurang istirahat" is a day × time-of-day grid
  (stored as `Senin Malam; Rabu Pagi; …`) plus an optional note.
- Last open question and the note are optional; everything else is required.
- Consent "Tidak" ends the flow without sending anything.

## Setup

The Google Cloud project is owned by the same personal Gmail account as 9 Nilai,
so the OAuth audience is **External** (published). Who may fill the
questionnaire is enforced separately: the site rejects non-`p3md.sbm-itb.ac.id`
accounts after sign-in, and `Code.gs` re-verifies the token and the email domain
before reading or writing anything.

1. Google Cloud Console: new project → Google Auth Platform (Branding, Audience,
   Clients). App name "Kuesioner Beban Kegiatan dan Kesejahteraan Serdik",
   privacy policy `https://sdm-kesejahteraanserdik.vercel.app/privasi.html`,
   authorized domain `vercel.app`, audience External → Publish app.
   Web application client with JavaScript origin
   `https://sdm-kesejahteraanserdik.vercel.app`. Only the Client ID is needed —
   never the client secret.
2. New Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs`,
   set `CLIENT_ID`, run `setup()` once (grant permissions), then Deploy → New
   deployment → Web app (Execute as: Me, Who has access: Anyone). Copy `/exec`.
3. `config.js`: fill `clientId`, `scriptUrl`, optional `sdmContact.wa`. Commit;
   Vercel redeploys.

After editing `Code.gs`, use *Manage deployments → Edit → New version* so the
same `/exec` URL serves the new code.

## Data

- `Jawaban`: one row per account — `Waktu kirim`, `Email`, `persetujuan`, then one
  column per answer key in survey order.
- `Draf`: one row per account still filling in (state as JSON); removed on submission.
- `Kodebook`: column key, full question text, and code meaning.
- Likert items are stored as numbers 1–5 (labels in `Kodebook`); NASA-TLX as 0–10
  in columns `tlx_<activity>_<pikir|fisik|waktu|usaha>`.
- Scoring tip (COPSOQ III): convert 1–5 to 0/25/50/75/100 and average per scale.
  Reverse `inf*`, `sup*`, `com1–3`, `mean*`, `var1` when building a risk index;
  `com4` and `var2` are already in the "worse" direction.
- To let someone resubmit, delete their row in `Jawaban`.

## Local development

```bash
python3 -m http.server 8765   # open http://localhost:8765
```

Add `http://localhost:8765` to the Client ID's authorized origins to test sign-in.
Question text lives in the `SECTIONS` array in `index.html`; keep keys stable
once responses come in.
