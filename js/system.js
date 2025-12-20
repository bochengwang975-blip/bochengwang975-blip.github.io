import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, backupData, restoreData, addLog, getSessionUser, clearLogs } from "./storage.js";
import { setupNav } from "./common.js";
import { downloadJSON } from "./utils.js";

const logRows = document.getElementById("log-rows");
const logSearch = document.getElementById("log-search");
const logSearchResult = document.getElementById("log-search-result");
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
let searchKeyword = "";

const renderLogs = (keyword = "") => {
  const data = getData();
  const logs = data.logs || [];
  searchKeyword = keyword.toLowerCase().trim();
  
  // 过滤日志
  let filteredLogs = logs;
  if (searchKeyword) {
    filteredLogs = logs.filter(l => {
      // 获取用户名称
      const actor = data.users.find(u => u.id === l.actor);
      const actorName = actor ? actor.name : l.actor;
      const actorUsername = actor ? actor.username : "";
      
      // 搜索用户名称、用户名、操作类型、详情
      return (
        actorName.toLowerCase().includes(searchKeyword) ||
        actorUsername.toLowerCase().includes(searchKeyword) ||
        l.action.toLowerCase().includes(searchKeyword) ||
        (l.details && l.details.toLowerCase().includes(searchKeyword)) ||
        (l.at && l.at.toLowerCase().includes(searchKeyword))
      );
    });
  }
  
  // 渲染日志
  logRows.innerHTML = "";
  if (filteredLogs.length === 0) {
    logRows.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1rem;" class="muted">${searchKeyword ? "未找到匹配的日志记录" : "暂无日志记录"}</td></tr>`;
  } else {
    filteredLogs.forEach(l => {
      const tr = document.createElement("tr");
      const actor = data.users.find(u => u.id === l.actor);
      const actorName = actor ? actor.name : l.actor;
      
      // 高亮搜索关键词
      const highlightText = (text, keyword) => {
        if (!keyword || !text) return text;
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
      };
      
      tr.innerHTML = `
        <td>${highlightText(l.at, searchKeyword)}</td>
        <td>${highlightText(actorName, searchKeyword)}</td>
        <td>${highlightText(l.action, searchKeyword)}</td>
        <td class="muted">${highlightText(l.details || "", searchKeyword)}</td>
      `;
      logRows.appendChild(tr);
    });
  }
  
  // 显示搜索结果统计
  if (searchKeyword) {
    logSearchResult.textContent = `找到 ${filteredLogs.length} 条匹配记录（共 ${logs.length} 条）`;
    logSearchResult.style.display = "block";
  } else {
    logSearchResult.textContent = `共 ${logs.length} 条日志记录`;
    logSearchResult.style.display = logs.length > 0 ? "block" : "none";
  }
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

// 搜索日志
logSearch?.addEventListener("input", (e) => {
  renderLogs(e.target.value);
});

const init = async () => {
  currentUser = await requireAuth(["system"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("system");
  renderLogs();
};

init();
