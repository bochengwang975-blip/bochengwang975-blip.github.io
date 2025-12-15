import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, backupData, restoreData, addLog, clearSession, getSessionUser } from "./storage.js";
import { setupNav } from "./common.js";
import { downloadJSON } from "./utils.js";

const logRows = document.getElementById("log-rows");
const backupBtn = document.getElementById("backup-btn");
const importFile = document.getElementById("import-file");
const restoreText = document.getElementById("restore-text");
const restoreBtn = document.getElementById("restore-btn");
const anomalyList = document.getElementById("anomaly-list");
const clearSessionBtn = document.getElementById("clear-session");

let currentUser = null;

const renderLogs = () => {
  const data = getData();
  logRows.innerHTML = "";
  data.logs.forEach(l => {
    const tr = document.createElement("tr");
    const actor = data.users.find(u => u.id === l.actor)?.name || l.actor;
    tr.innerHTML = `<td>${l.at}</td><td>${actor}</td><td>${l.action}</td><td class="muted">${l.details}</td>`;
    logRows.appendChild(tr);
  });
};

const renderAnomalies = () => {
  const data = getData();
  anomalyList.innerHTML = "";
  data.courses.forEach(c => {
    const enrolls = data.enrollments.filter(e => e.courseId === c.id && e.finalGrade !== null && e.finalGrade !== undefined);
    if (!enrolls.length) return;
    const avg = enrolls.reduce((s, e) => s + (e.finalGrade || 0), 0) / enrolls.length;
    const passRate = enrolls.filter(e => e.finalGrade >= 60).length / enrolls.length;
    if (avg < 65 || passRate < 0.6) {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${c.name}</strong> 平均分 ${avg.toFixed(1)}，及格率 ${(passRate * 100).toFixed(0)}%
        <p class="muted">标记为异常：低于阈值 (平均 65 / 及格率 60%)</p>
      `;
      anomalyList.appendChild(item);
    }
  });
  if (!anomalyList.children.length) anomalyList.innerHTML = "<div class='muted'>暂无异常</div>";
};

backupBtn?.addEventListener("click", () => {
  const data = backupData();
  downloadJSON(data, "grade-platform-backup.json");
  addLog(currentUser.id, "导出备份", "系统管理员导出数据");
  renderLogs();
});

importFile?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      restoreData(obj);
      addLog(currentUser.id, "导入备份", `从文件 ${file.name} 恢复`);
      renderLogs();
      renderAnomalies();
      alert("数据已恢复");
    } catch (err) {
      alert("解析失败：" + err.message);
    }
  };
  reader.readAsText(file);
});

restoreBtn?.addEventListener("click", () => {
  try {
    const obj = JSON.parse(restoreText.value);
    restoreData(obj);
    addLog(currentUser.id, "粘贴恢复", "通过文本恢复数据");
    renderLogs();
    renderAnomalies();
    alert("数据已恢复");
  } catch (err) {
    alert("JSON 格式不正确");
  }
});

clearSessionBtn?.addEventListener("click", () => {
  clearSession();
  addLog(currentUser.id, "清除 session", "系统管理员清空登录态");
  alert("已清空登录状态，请重新登录。");
});

const init = async () => {
  currentUser = await requireAuth(["system"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("system");
  renderLogs();
  renderAnomalies();
};

init();
