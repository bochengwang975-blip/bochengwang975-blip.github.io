import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, backupData, restoreData, addLog, getSessionUser } from "./storage.js";
import { setupNav } from "./common.js";
import { downloadJSON } from "./utils.js";

const logRows = document.getElementById("log-rows");
const backupBtn = document.getElementById("backup-btn");
const importFile = document.getElementById("import-file");
const restoreText = document.getElementById("restore-text");
const restoreBtn = document.getElementById("restore-btn");

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
    alert("数据已恢复");
  } catch (err) {
    alert("JSON 格式不正确");
  }
});

const init = async () => {
  currentUser = await requireAuth(["system"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("system");
  renderLogs();
};

init();
