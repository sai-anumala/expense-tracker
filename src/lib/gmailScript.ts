// Builds the Google Apps Script the user pastes into script.google.com. Pure. It runs in the user's own Google account.

/** The script text, with this user's Ledgerly URL and token filled in. */
export function buildGmailScript(origin: string, token: string): string {
  const url = `${origin.replace(/\/$/, "")}/api/capture/email`;
  return `// Ledgerly: sends your bank's alert emails to your "To review" list.
// This token is private. Don't share this script.
const LEDGERLY_URL = ${JSON.stringify(url)};
const LEDGERLY_TOKEN = ${JSON.stringify(token)};

// Add the address your bank's alerts come from, for example "alerts@yourbank.com".
const BANK_SENDERS = [
  "",
];

const LAST_SENT = "ledgerlyLastSent";
const MAX_PER_RUN = 50;
const MAX_CHARS = 2000;

function senders_() {
  const list = BANK_SENDERS.map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new Error("Add your bank's email address to BANK_SENDERS first.");
  return list;
}

/** Run this once. Only alerts arriving from now on are sent, then it checks every 5 minutes. */
function setup() {
  senders_();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  PropertiesService.getUserProperties().setProperty(LAST_SENT, String(Date.now()));
  ScriptApp.newTrigger("sendBankAlerts").timeBased().everyMinutes(5).create();
}

function sendBankAlerts() {
  const props = PropertiesService.getUserProperties();
  let lastSent = Number(props.getProperty(LAST_SENT) || Date.now());
  const query = "from:(" + senders_().join(" OR ") + ") newer_than:7d";

  const messages = [];
  GmailApp.search(query, 0, MAX_PER_RUN).forEach((thread) => {
    // Banks reuse subjects, so Gmail threads alerts together: check every message by date, not the thread.
    thread.getMessages().forEach((m) => {
      if (m.getDate().getTime() > lastSent) messages.push(m);
    });
  });
  messages.sort((a, b) => a.getDate() - b.getDate());

  for (const m of messages.slice(0, MAX_PER_RUN)) {
    const res = UrlFetchApp.fetch(LEDGERLY_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + LEDGERLY_TOKEN },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        messageId: m.getId(),
        subject: m.getSubject(),
        text: m.getPlainBody().slice(0, MAX_CHARS),
        sender: m.getFrom(),
        receivedAt: m.getDate().toISOString(),
      }),
    });
    // On any failure, stop and keep the place: this alert is tried again on the next run.
    if (res.getResponseCode() !== 200) {
      console.error("Ledgerly returned " + res.getResponseCode() + ": " + res.getContentText());
      return;
    }
    lastSent = m.getDate().getTime();
    props.setProperty(LAST_SENT, String(lastSent));
  }
}
`;
}
