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
  data.logs.unshift({ id: uuid(), actor: actorId || "system", action, details, at: formatDate() });
  data.logs = data.logs.slice(0, 200);
  saveData(data);
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
