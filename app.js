/**
 * Landing metrics + waitlist (local-first).
 * - visitor stamp in sessionStorage (unique-ish per browser session)
 * - waitlist persisted to localStorage and downloaded as JSONL-friendly blob
 * Kill metrics: WTP radio, handoff_need checkbox, signup count.
 */

const STORAGE_KEY = "devflow_waitlist_v1";
const VISITOR_KEY = "devflow_visitor_v1";

function loadWaitlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWaitlist(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function stampVisitor() {
  const el = document.getElementById("visitor-stamp");
  let id = sessionStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(VISITOR_KEY, id);
    // count unique sessions in localStorage aggregate
    const key = "devflow_visitor_count";
    const n = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(n));
    if (el) el.textContent = `metrics on · session ${n}`;
  } else if (el) {
    const n = localStorage.getItem("devflow_visitor_count") || "?";
    el.textContent = `metrics on · sessions ${n}`;
  }
}

function exportHint(rows) {
  // Developers can pull from localStorage; also expose window helper
  window.__devflowWaitlist = rows;
  window.__devflowExportWaitlist = () => {
    const lines = rows.map((r) => JSON.stringify(r)).join("\n");
    const blob = new Blob([lines + "\n"], { type: "application/x-ndjson" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "waitlist.jsonl";
    a.click();
    return lines;
  };
}

function initForm() {
  const form = document.getElementById("waitlist-form");
  const status = document.getElementById("form-status");
  if (!form) return;

  const existing = loadWaitlist();
  exportHint(existing);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.classList.remove("error");
    status.textContent = "";

    const fd = new FormData(form);
    const email = String(fd.get("email") || "")
      .trim()
      .toLowerCase();
    const wtp = String(fd.get("wtp") || "0");
    const why = String(fd.get("why") || "").trim();
    const handoffNeed = fd.get("handoff_need") === "1";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.classList.add("error");
      status.textContent = "Enter a valid email.";
      return;
    }

    const rows = loadWaitlist();
    if (rows.some((r) => r.email === email)) {
      status.classList.add("error");
      status.textContent = "Already on the list with this email.";
      return;
    }

    const row = {
      ts: new Date().toISOString(),
      event: "landing_waitlist",
      email,
      wtp,
      handoff_need: handoffNeed,
      why: why.slice(0, 500),
      source: "landing",
      userAgent: navigator.userAgent.slice(0, 120),
    };

    rows.push(row);
    saveWaitlist(rows);
    exportHint(rows);

    // Also stash a JSONL line for operators who open DevTools
    console.info("[devflow-metric]", JSON.stringify(row));

    status.textContent =
      wtp === "0"
        ? "You're on the Free / BYOK list. We'll send install notes."
        : `You're in for Founding Pro interest at $${wtp}/mo. We'll email seat details.`;
    form.reset();
    const nine = form.querySelector('input[name="wtp"][value="9"]');
    if (nine) nine.checked = true;
  });
}

stampVisitor();
initForm();
