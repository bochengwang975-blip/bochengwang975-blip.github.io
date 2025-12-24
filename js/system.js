import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, backupData, restoreData, addLog, getSessionUser, clearLogs, getAutoBackupInfo, getAutoBackup, performAutoBackup } from "./storage.js";
import { setupNav } from "./common.js";
import { downloadJSON, hashPassword } from "./utils.js";

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
const backupStatusText = document.getElementById("backup-status-text");
const downloadAutoBackupBtn = document.getElementById("download-auto-backup-btn");

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
  renderBackupStatus();
});

// 渲染自动备份状态
const renderBackupStatus = () => {
  const backupInfo = getAutoBackupInfo();
  
  if (!backupInfo) {
    backupStatusText.innerHTML = "暂无自动备份记录<br><span style='font-size: 0.85em; color: #999;'>系统将在首次访问时创建备份</span>";
    downloadAutoBackupBtn.style.display = "none";
    return;
  }
  
  const now = Date.now();
  const timeSinceBackup = now - backupInfo.timestamp;
  const hoursSinceBackup = Math.floor(timeSinceBackup / (60 * 60 * 1000));
  const minutesSinceBackup = Math.floor((timeSinceBackup % (60 * 60 * 1000)) / (60 * 1000));
  const daysSinceBackup = Math.floor(hoursSinceBackup / 24);
  
  let statusHTML = `<strong>最后备份时间：</strong>${backupInfo.date}<br>`;
  
  if (daysSinceBackup > 0) {
    statusHTML += `<span style='color: #e67e22;'>距离上次备份：${daysSinceBackup}天${hoursSinceBackup % 24}小时</span><br>`;
    statusHTML += `系统将在下次访问时自动备份`;
  } else if (hoursSinceBackup < 24) {
    const remainingHours = 24 - hoursSinceBackup - 1;
    const remainingMinutes = 60 - minutesSinceBackup;
    statusHTML += `距离上次备份：${hoursSinceBackup}小时${minutesSinceBackup > 0 ? minutesSinceBackup + "分钟" : ""}<br>`;
    statusHTML += `<span style='color: #27ae60;'>下次备份将在 ${remainingHours}小时${remainingMinutes > 0 ? remainingMinutes + "分钟" : ""}后自动执行</span>`;
  } else {
    statusHTML += `<span style='color: #e67e22;'>距离上次备份已超过24小时</span><br>`;
    statusHTML += `系统将在下次访问时自动备份`;
  }
  
  backupStatusText.innerHTML = statusHTML;
  downloadAutoBackupBtn.style.display = "inline-block";
};

// 下载自动备份
downloadAutoBackupBtn?.addEventListener("click", () => {
  const backupData = getAutoBackup();
  if (!backupData) {
    alert("没有可用的自动备份");
    return;
  }
  
  const backupInfo = getAutoBackupInfo();
  const filename = `auto-backup-${new Date(backupInfo.timestamp).toISOString().split('T')[0]}.json`;
  downloadJSON(backupData, filename);
  addLog(currentUser.id, "下载自动备份", `下载自动备份文件：${filename}`);
  renderLogs();
});

// 验证系统管理员密码
const verifySystemAdminPassword = async () => {
  const password = prompt("⚠️ 数据恢复属于高危操作，请输入系统管理员密码进行确认：\n\n此操作将覆盖所有现有数据，请谨慎操作！");
  
  if (password === null) {
    // 用户取消
    return false;
  }
  
  if (!password) {
    alert("密码不能为空");
    return false;
  }
  
  try {
    const data = getData();
    // 查找系统管理员用户
    const systemAdmin = data.users.find(u => u.role === "system");
    if (!systemAdmin) {
      alert("未找到系统管理员账户");
      return false;
    }
    
    // 验证密码
    const hashed = await hashPassword(password, systemAdmin.salt);
    if (hashed !== systemAdmin.passwordHash) {
      alert("密码错误，恢复操作已取消");
      addLog(currentUser.id, "恢复数据失败", "密码验证失败，恢复操作已取消");
      return false;
    }
    
    return true;
  } catch (err) {
    alert("验证过程中出现错误：" + err.message);
    return false;
  }
};

importFile?.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 先验证密码
  const verified = await verifySystemAdminPassword();
  if (!verified) {
    // 清空文件选择
    e.target.value = "";
    return;
  }
  
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      restoreData(obj);
      addLog(currentUser.id, "导入备份", `从文件 ${file.name} 恢复（已通过密码验证）`);
      renderLogs();
      renderBackupStatus();
      alert("数据已恢复");
    } catch (err) {
      alert("解析失败：" + err.message);
    }
  };
  reader.readAsText(file);
});

restoreBtn?.addEventListener("click", async () => {
  // 先验证密码
  const verified = await verifySystemAdminPassword();
  if (!verified) {
    return;
  }
  
  try {
    const obj = JSON.parse(restoreText.value);
    restoreData(obj);
    addLog(currentUser.id, "粘贴恢复", "通过文本恢复数据（已通过密码验证）");
    renderLogs();
    renderBackupStatus();
    alert("数据已恢复");
  } catch (err) {
    alert("JSON 格式不正确：" + err.message);
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
  renderBackupStatus();
  
  // 设置定期检查备份（每5分钟检查一次）
  setInterval(() => {
    performAutoBackup();
    renderBackupStatus();
    renderLogs();
  }, 5 * 60 * 1000);
};

init();
