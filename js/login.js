import { ensureSeeded, getSessionUser } from "./storage.js";
import { login, register, requestPasswordReset, resetPassword } from "./auth.js";
import { setupNav } from "./common.js";

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    panels.forEach(p => p.classList.add("hidden"));
    document.getElementById(target).classList.remove("hidden");
  });
});

const passwordStrong = pwd => pwd.length >= 6 && /[a-zA-Z]/.test(pwd) && /\d/.test(pwd);

const loginForm = document.getElementById("login-form");
loginForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(loginForm);
  const username = form.get("username").trim();
  const password = form.get("password").trim();
  try {
    const user = await login(username, password);
    const redirectParam = new URLSearchParams(location.search).get("redirect");
    const roleTarget = {
      student: "student.html",
      teacher: "teacher.html",
      admin: "admin.html",
      system: "system.html"
    }[user.role];
    const redirect = redirectParam || roleTarget || "index.html";
    location.href = redirect;
  } catch (err) {
    alert(err.message);
  }
});

const registerForm = document.getElementById("register-form");
registerForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(registerForm);
  const payload = Object.fromEntries(form.entries());
  const pwd = payload.password.trim();
  if (!passwordStrong(pwd)) {
    alert("密码需包含字母和数字，长度不少于 6 位");
    return;
  }
  try {
    await register({
      username: payload.username.trim(),
      password: pwd,
      name: payload.name.trim(),
      email: payload.email.trim(),
      role: payload.role,
      className: payload.className.trim(),
      major: payload.major.trim()
    });
    location.href = "student.html";
  } catch (err) {
    alert(err.message);
  }
});

const tokenDisplay = document.getElementById("token-display");
const resetRequest = document.getElementById("reset-request");
resetRequest?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(resetRequest);
  const email = form.get("email").trim();
  try {
    const token = await requestPasswordReset(email);
    tokenDisplay.textContent = `已生成临时 token：${token}（30 分钟内有效）`;
  } catch (err) {
    alert(err.message);
  }
});

const resetConfirm = document.getElementById("reset-confirm");
resetConfirm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(resetConfirm);
  const token = form.get("token").trim();
  const newPwd = form.get("newPassword").trim();
  if (!passwordStrong(newPwd)) {
    alert("密码需包含字母和数字，长度不少于 6 位");
    return;
  }
  try {
    await resetPassword(token, newPwd);
    alert("密码已重置，请重新登录");
    location.href = "login.html";
  } catch (err) {
    alert(err.message);
  }
});

const init = async () => {
  await ensureSeeded();
  const user = getSessionUser();
  if (user) {
    // 已登录则直接跳转角色页
    const redirect = new URLSearchParams(location.search).get("redirect") || `${user.role}.html`;
    location.href = redirect;
    return;
  }
  setupNav("home");
};

init();
