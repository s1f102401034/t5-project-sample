// ==== データ層 ====
// 今はこの端末のlocalStorageに保存するだけ。
// 家族と共有するときは、このstoreの中身をFirebaseなどに差し替える。
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

// checkins = { "2026-10-26": "10:32", ... }
const getCheckins = () => store.get("checkins", {});
const saveCheckins = (c) => store.set("checkins", c);

// ==== 画面の切り替え ====
const $ = (id) => document.getElementById(id);
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

// ==== 高齢者用 ====
function renderElder() {
  const time = getCheckins()[dayKey()];
  $("greeting").textContent = "本人用の画面";
  $("checkin").classList.toggle("done", Boolean(time));
  $("checkin-main").textContent = time ? "記録済み" : "記録ボタン";
  $("checkin-sub").textContent = time ? "記録されました" : "押すと記録されます";
  $("elder-status").textContent = time ? `記録した時刻: ${time}` : "";
  $("undo").hidden = !time;
}

$("checkin").addEventListener("click", () => {
  const c = getCheckins();
  if (!c[dayKey()]) { c[dayKey()] = timeText(new Date()); saveCheckins(c); }
  render();
});
$("undo").addEventListener("click", () => {
  const c = getCheckins();
  delete c[dayKey()];
  saveCheckins(c);
  render();
});

// ==== 家族用 ====
function renderFamily() {
  const c = getCheckins();
  const time = c[dayKey()];
  $("family-status").textContent = time
    ? `今日は記録あり(${time})`
    : "今日は記録なし";

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

function render() { role === "elder" ? renderElder() : renderFamily(); }

document.querySelectorAll("[data-role-btn]").forEach((b) =>
  b.addEventListener("click", () => showRole(b.dataset.roleBtn))
);
showRole(role);
