# Gelang Pesona Serdik

Charm-bracelet themed web front end for the Bidang SDM questionnaire
"Kuesioner Beban Kegiatan dan Kesejahteraan Serdik". Same architecture as
Ekspedisi 9 Nilai: static site on Vercel, Google sign-in gated to
`p3md.sbm-itb.ac.id`, one-click submission through a Google Apps Script web
app into a Google Sheet, one submission per account.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole site (questions, flow, styling). |
| `config.js` | Public settings: Client ID, Apps Script URL, domain, SDM contact, data notice. |
| `privacy.html` | Privacy policy page for the Google OAuth consent screen. |
| `apps-script/Code.gs` | Backend: verifies the Google ID token, blocks repeat submissions, writes the row. |

With `clientId` empty the site runs in **preview mode**: no sign-in, nothing is
sent, and the submit button only simulates sending. Good for showing Bidang SDM.

## How it plays

- 7 sections, one per screen; each finished section earns a charm
  (Bintang, Awan, Hati, Petir, Bunga, Bulan, Surat). The bracelet in the header
  is the progress bar.
- Charms count completed sections only, never answer values, so the game does
  not nudge answers.
- No scores are shown back to the respondent (wellbeing answers are sensitive).
- Drafts are saved in `localStorage`, keyed by the signed-in email. Sign-in is
  never persisted; every visit asks for Google sign-in again.

## Changes from the Google Form (worth confirming with Bidang SDM)

- Validation: No Serdik `^\d{3}$`, phone numbers `^62\d{8,13}$`, name in capitals.
- Branching instead of "write -": leadership/business details only after "Ya";
  weekly hours and the "Peran tambahan" NASA-TLX rows only when a role is chosen.
  Hidden answers are sent empty; `peran_jam` is sent as "Tidak ada".
- "Tidak ada" is exclusive in multi-select questions.
- Bagian 5 (NASA-TLX) is grouped per activity (4 ratings each) instead of per
  dimension; attention check `att1` (expected answer: 2 = Jarang) sits between activities.
- Sleep hours bins no longer overlap: <3, 3–<4, 4–<5, 5–<6, ≥6.
- Health item: "Sempurna" relabelled "Sangat baik sekali".
- "Hari dan jam paling kurang istirahat" is a day × time-of-day grid
  (stored as `Senin Malam; Rabu Pagi; …`) plus an optional note.
- Last open question and the note are optional; everything else is required.
- Consent "Tidak" ends the flow without sending anything.

## Setup

1. **GitHub + Vercel.** Push this folder to a new repo, import it in Vercel
   (preset *Other*, no build command), deploy, note the URL.
2. **Client ID.** Create a new Google Cloud project (e.g. `gelang-pesona`) so the
   sign-in popup shows this app's own name instead of the 9 Nilai one:
   OAuth consent screen / Branding → app name "Gelang Pesona Serdik", privacy
   policy URL `https://<vercel-url>/privacy.html`, audience Internal (or External
   + Publish). Then Credentials → OAuth client ID → Web application, with the
   Vercel URL as an authorized JavaScript origin. Only the Client ID is needed —
   never the client secret.
3. **Sheet + Apps Script.** Create a new Google Sheet (it can be downloaded as
   .xlsx any time), open *Extensions → Apps
   Script*, paste `apps-script/Code.gs`, set `CLIENT_ID` and `ALLOWED_DOMAIN`.
   *Deploy → New deployment → Web app*, Execute as **Me**, Who has access
   **Anyone**. Copy the `/exec` URL.
4. **config.js.** Fill `clientId`, `scriptUrl`, `sdmContact.wa`, and adjust
   `dataNotice` to what Bidang SDM actually promises. Commit; Vercel redeploys.

After editing `Code.gs`, use *Manage deployments → Edit → New version* so the
same `/exec` URL serves the new code.

## Data

- `Jawaban`: one row per account — `Waktu`, `Email`, `persetujuan`, then one
  column per answer key in survey order.
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
