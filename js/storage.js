import { seedData } from "./data.js";
import { formatDate, uuid } from "./utils.js";

export const STORAGE_KEY = "gm-data-v1";
export const SESSION_KEY = "gm-session";

export const ensureSeeded = async () => {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (!cached) {
    const seeded = await seedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  }
};

export const getData = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

export const saveData = data => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const addLog = (actorId, action, details) => {
  const data = getData();
  data.logs = data.logs || [];
  const now = new Date();
  data.logs.unshift({ 
    id: uuid(), 
    actor: actorId || "system", 
    action, 
    details, 
    at: formatDate(now),
    timestamp: now.getTime() // 添加时间戳用于时间范围计算
  });
  data.logs = data.logs.slice(0, 200);
  saveData(data);
};

// 解析日志时间，支持时间戳和格式化字符串
const parseLogTime = (log) => {
  if (log.timestamp) {
    return log.timestamp;
  }
  // 如果没有时间戳，尝试解析格式化字符串
  // 格式：2024年1月1日 12:00 或 2024-1-1 12:00
  try {
    const dateStr = log.at;
    if (!dateStr) return 0;
    
    // 移除中文日期格式，转换为标准格式
    let normalized = dateStr
      .replace(/年/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 尝试解析日期
    const parsed = new Date(normalized);
    if (isNaN(parsed.getTime())) {
      // 如果解析失败，返回一个很早的时间戳（保留旧日志）
      return 0;
    }
    return parsed.getTime();
  } catch (e) {
    // 解析失败返回0（很早的时间戳），旧日志会被保留
    return 0;
  }
};

// 清空指定时间范围内的日志
export const clearLogs = (timeRange) => {
  const data = getData();
  if (!data.logs || data.logs.length === 0) {
    return 0;
  }
  
  const now = Date.now();
  let cutoffTime = 0;
  
  switch (timeRange) {
    case '1h':
      cutoffTime = now - 60 * 60 * 1000; // 1小时前
      break;
    case '24h':
      cutoffTime = now - 24 * 60 * 60 * 1000; // 24小时前
      break;
    case '1w':
      cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 一周前
      break;
    case '1m':
      cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 一个月前
      break;
    case 'all':
      cutoffTime = Infinity; // 全部清空
      break;
    default:
      return 0;
  }
  
  const originalCount = data.logs.length;
  
  if (cutoffTime === Infinity) {
    // 清空全部
    data.logs = [];
  } else {
    // 过滤掉指定时间范围内的日志
    data.logs = data.logs.filter(log => {
      const logTime = parseLogTime(log);
      return logTime < cutoffTime; // 保留早于截止时间的日志
    });
  }
  
  const deletedCount = originalCount - data.logs.length;
  saveData(data);
  return deletedCount;
};

export const setSessionUser = userId => localStorage.setItem(SESSION_KEY, userId);
export const clearSession = () => localStorage.removeItem(SESSION_KEY);
export const getSessionUser = () => {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const data = getData();
  return data.users.find(u => u.id === id) || null;
};

export const backupData = () => getData();

export const restoreData = obj => {
  saveData(obj);
  addLog("system", "恢复数据", "通过前端导入 JSON 备份恢复。");
};

export const findUserByUsername = username => {
  const data = getData();
  return data.users.find(u => u.username === username);
};

export const updateUser = (userId, fields) => {
  const data = getData();
  data.users = data.users.map(u => (u.id === userId ? { ...u, ...fields } : u));
  saveData(data);
};

export const upsertUser = user => {
  const data = getData();
  const exists = data.users.find(u => u.id === user.id);
  if (exists) {
    data.users = data.users.map(u => (u.id === user.id ? user : u));
  } else {
    data.users.push(user);
  }
  saveData(data);
};

export const upsertCourse = course => {
  const data = getData();
  const exists = data.courses.find(c => c.id === course.id);
  if (exists) {
    data.courses = data.courses.map(c => (c.id === course.id ? { ...c, ...course } : c));
  } else {
    data.courses.push(course);
  }
  saveData(data);
};

export const upsertEnrollment = enrollment => {
  const data = getData();
  const exists = data.enrollments.find(e => e.id === enrollment.id);
  if (exists) {
    data.enrollments = data.enrollments.map(e => (e.id === enrollment.id ? { ...e, ...enrollment } : e));
  } else {
    data.enrollments.push(enrollment);
  }
  saveData(data);
};
