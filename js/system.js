import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, backupData, restoreData, addLog, getSessionUser, clearLogs } from "./storage.js";
import { setupNav } from "./common.js";
import { downloadJSON } from "./utils.js";

const logRows = document.getElementById("log-rows");
const backupBtn = document.getElementById("backup-btn");
const importFile = document.getElementById("import-file");
const restoreText = document.getElementById("restore-text");
const restoreBtn = document.getElementById("restore-btn");
const clearLogs1hBtn = document.getElementById("clear-logs-1h");
const clearLogs24hBtn = document.getElementById("clear-logs-24h");
const clearLogs1wBtn = document.getElementById("clear-logs-1w");
const clearLogs1mBtn = document.getElementById("clear-logs-1m");
const clearLogsAllBtn = document.getElementById("clear-logs-all");

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

// 清空日志功能
const handleClearLogs = (timeRange, label) => {
  if (!confirm(`确定要清空${label}的日志记录吗？此操作不可恢复。`)) {
    return;
  }
  
  const deletedCount = clearLogs(timeRange);
  addLog(currentUser.id, "清空日志", `清空${label}，共删除 ${deletedCount} 条记录`);
  renderLogs();
  alert(`已清空${label}的日志，共删除 ${deletedCount} 条记录`);
};

clearLogs1hBtn?.addEventListener("click", () => handleClearLogs("1h", "最近1小时"));
clearLogs24hBtn?.addEventListener("click", () => handleClearLogs("24h", "最近24小时"));
clearLogs1wBtn?.addEventListener("click", () => handleClearLogs("1w", "最近一周"));
clearLogs1mBtn?.addEventListener("click", () => handleClearLogs("1m", "最近一个月"));
clearLogsAllBtn?.addEventListener("click", () => handleClearLogs("all", "全部"));

const init = async () => {
  currentUser = await requireAuth(["system"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("system");
  renderLogs();
};

init();
