// Site configuration. Only public values belong here — never a client secret.
window.APP_CONFIG = {
  // OAuth 2.0 Client ID (Web application) from Google Cloud Console.
  // Leave empty to run the site in preview mode (no sign-in, nothing is sent).
  clientId: "",

  // Google Apps Script web app URL (ends with /exec). See README.md.
  scriptUrl: "",

  // Only Google accounts on this domain may sign in and submit.
  allowedDomain: "p3md.sbm-itb.ac.id",

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
