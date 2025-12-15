import { ensureSeeded, getData, saveData, setSessionUser, clearSession, getSessionUser, addLog, findUserByUsername } from "./storage.js";
import { hashPassword, randomSalt, uuid } from "./utils.js";

const createUser = async ({ username, password, role, name, email, className, major }) => {
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  return { id: uuid(), username, role, name, email, salt, passwordHash, className: className || "", major: major || "" };
};

export const login = async (username, password) => {
  await ensureSeeded();
  const data = getData();
  const user = data.users.find(u => u.username === username);
  if (!user) throw new Error("用户不存在");
  const hashed = await hashPassword(password, user.salt);
  if (hashed !== user.passwordHash) throw new Error("密码错误");
  setSessionUser(user.id);
  addLog(user.id, "登录系统", `以角色 ${user.role} 登录`);
  return user;
};

export const register = async ({ username, password, name, email, role = "student", className, major }) => {
  await ensureSeeded();
  if (findUserByUsername(username)) throw new Error("用户名已存在");
  const user = await createUser({ username, password, role, name, email, className, major });
  const data = getData();
  data.users.push(user);
  saveData(data);
  addLog(user.id, "注册账号", `新注册角色 ${role}`);
  return user;
};

export const logout = () => {
  const current = getSessionUser();
  clearSession();
  addLog(current?.id || "system", "退出登录", "用户主动退出");
};

export const requireAuth = async (roles = []) => {
  await ensureSeeded();
  const user = getSessionUser();
  if (!user) {
    window.location.href = `login.html?redirect=${encodeURIComponent(location.pathname.split("/").pop())}`;
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    alert("无权访问该页面");
    window.location.href = "index.html";
    return null;
  }
  return user;
};

export const requestPasswordReset = async email => {
  await ensureSeeded();
  const data = getData();
  const user = data.users.find(u => u.email === email);
  if (!user) throw new Error("未找到对应邮箱的用户");
  const token = uuid();
  const expires = Date.now() + 30 * 60 * 1000;
  data.resetTokens.push({ token, userId: user.id, expires });
  saveData(data);
  addLog(user.id, "申请密码重置", "通过邮箱验证流程生成 token");
  return token;
};

export const resetPassword = async (token, newPassword) => {
  await ensureSeeded();
  const data = getData();
  const record = data.resetTokens.find(t => t.token === token);
  if (!record) throw new Error("无效的重置请求");
  if (Date.now() > record.expires) throw new Error("重置链接已过期");
  const user = data.users.find(u => u.id === record.userId);
  if (!user) throw new Error("用户不存在");
  const salt = randomSalt();
  user.salt = salt;
  user.passwordHash = await hashPassword(newPassword, salt);
  data.resetTokens = data.resetTokens.filter(t => t.token !== token);
  saveData(data);
  addLog(user.id, "完成密码重置", "通过邮箱验证后的密码更新");
  return true;
};
