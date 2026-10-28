import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, deleteField }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);

// ==== Firebase(設定が未入力なら使わない) ====
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
const db = configured ? getFirestore(initializeApp(firebaseConfig)) : null;
const pairRef = (code) => doc(db, "pairs", code);

// ==== 端末内の保存 ====
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeText = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
const getCheckins = () => store.get("checkins", {});
const saveCheckins = (c) => store.set("checkins", c);

// ==== 接続コード(本人用の端末で作る。家族用で入力すると同じデータを見られる) ====
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0とO、1とIなど紛らわしい文字は除く
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
let pairCode = store.get("pairCode", null);
if (!pairCode) { pairCode = makeCode(); store.set("pairCode", pairCode); }
let familyCode = store.get("familyCode", "");

// ==== クラウドへの書き込み(本人用) ====
async function pushCheckin(day, time) {
  if (!db) return;
  try {
    await setDoc(pairRef(pairCode), { checkins: { [day]: time ?? deleteField() } }, { merge: true });
    $("sync-status").textContent = "クラウドに保存しました";
  } catch (e) {
    console.error(e);
    $("sync-status").textContent = "クラウドに保存できませんでした";
  }
}

// ==== クラウドの読み取り(家族用) ====
let remote = {};
let unsubscribe = null;
function connect(code) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  remote = {};
  if (!db) { $("conn-status").textContent = "未接続(設定なし)。この端末の記録を表示中"; render(); return; }
  if (!code) { $("conn-status").textContent = "接続コードを入力してください"; render(); return; }
  $("conn-status").textContent = "接続中…";
  unsubscribe = onSnapshot(
    pairRef(code),
    (snap) => {
      remote = snap.exists() ? (snap.data().checkins || {}) : {};
      $("conn-status").textContent = snap.exists() ? "接続済み" : "このコードのデータはまだありません";
      render();
    },
    (e) => { console.error(e); $("conn-status").textContent = "接続できません。ネットとコードを確認してください"; }
  );
}

// ==== 画面の切り替え ====
let role = store.get("role", "elder");
function showRole(next) {
  role = next;
  store.set("role", role);
  document.body.dataset.role = role;
  $("view-elder").hidden = role !== "elder";
  $("view-family").hidden = role !== "family";
  $("mode-label").textContent = role === "elder" ? "本人用の画面" : "家族用の画面";
  document.querySelectorAll("[data-role-btn]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.roleBtn === role))
  );
  render();
}

// ==== 本人用 ====
function renderElder() {
  const time = getCheckins()[dayKey()];
  $("greeting").textContent = "本人用の画面";
  $("checkin").classList.toggle("done", Boolean(time));
  $("checkin-main").textContent = time ? "記録済み" : "記録ボタン";
  $("checkin-sub").textContent = time ? "記録されました" : "押すと記録されます";
  $("elder-status").textContent = time ? `記録した時刻: ${time}` : "";
  $("undo").hidden = !time;
  $("pair-code").textContent = pairCode;
  $("pair-info").hidden = !db;
}

$("checkin").addEventListener("click", () => {
  const c = getCheckins();
  if (!c[dayKey()]) {
    c[dayKey()] = timeText(new Date());
    saveCheckins(c);
    pushCheckin(dayKey(), c[dayKey()]);
  }
  render();
});
$("undo").addEventListener("click", () => {
  const c = getCheckins();
  delete c[dayKey()];
  saveCheckins(c);
  pushCheckin(dayKey(), null);
  render();
});

// ==== 家族用 ====
function renderFamily() {
  const c = db && familyCode ? remote : getCheckins();
  const time = c[dayKey()];
  $("family-status").textContent = time ? `今日は記録あり(${time})` : "今日は記録なし";

  const days = ["日", "月", "火", "水", "木", "金", "土"];
  $("week").innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ok = Boolean(c[dayKey(d)]);
    const li = document.createElement("li");
    li.className = ok ? "yes" : "";
    li.innerHTML = `${days[d.getDay()]}<span class="mark">${ok ? "○" : "－"}</span>${ok ? "あり" : "なし"}`;
    $("week").appendChild(li);
  }
}

$("connect").addEventListener("click", () => {
  familyCode = $("code-input").value.trim().toUpperCase();
  store.set("familyCode", familyCode);
  connect(familyCode);
});

function render() { role === "elder" ? renderElder() : renderFamily(); }

document.querySelectorAll("[data-role-btn]").forEach((b) =>
  b.addEventListener("click", () => showRole(b.dataset.roleBtn))
);
$("code-input").value = familyCode;
showRole(role);
connect(familyCode);
