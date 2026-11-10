// Site configuration. Only public values belong here — never a client secret.
window.APP_CONFIG = {
  // OAuth 2.0 Client ID (Web application) from Google Cloud Console.
  // Leave empty to run the site in preview mode (no sign-in, nothing is sent).
  clientId: "686372700251-qsbsutbjuubli03r5qdntso2ep68gls0.apps.googleusercontent.com",

  // Google Apps Script web app URL (ends with /exec). See README.md.
  scriptUrl: "https://script.google.com/macros/s/AKfycbzZ-CS4-RNK0BMnZ0qlpaSFa7SeMIYUBmpnbPPsQioe08-7b7o3zLtMCijJUFdttm2t/exec",

  // Only Google accounts on this domain may sign in and submit.
  allowedDomain: "p3md.sbm-itb.ac.id",

  // Minutes without activity (including time minimized) before the person is
  // signed out and sent back to the sign-in screen. Answers are saved first.
  idleMinutes: 30,

  // Shown on the welcome and closing screens.
  organizer: "Bidang SDM Senat P3MD",
  sdmContact: {
    name: "Bidang SDM",
    // WhatsApp number in 62xxxxxxxx format; leave empty to hide the button.
    wa: ""
  },

  // Who can see raw answers. Edit to match what Bidang SDM actually does.
  dataNotice:
    "Jawaban mentah hanya dibuka oleh tim pengolah Bidang SDM. Hasil dilaporkan secara agregat, bukan penilaian individu."
};
