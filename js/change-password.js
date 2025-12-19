import { requireAuth, changePassword } from "./auth.js";
import { ensureSeeded, getSessionUser } from "./storage.js";
import { setupNav } from "./common.js";

const changePasswordForm = document.getElementById("change-password-form");
const errorMessage = document.getElementById("error-message");

const passwordStrong = pwd => pwd.length >= 6 && /[a-zA-Z]/.test(pwd) && /\d/.test(pwd);

changePasswordForm?.addEventListener("submit", async e => {
  e.preventDefault();
  errorMessage.textContent = "";
  
  const form = new FormData(changePasswordForm);
  const oldPassword = form.get("oldPassword").trim();
  const newPassword = form.get("newPassword").trim();
  const confirmPassword = form.get("confirmPassword").trim();

  if (!passwordStrong(newPassword)) {
    errorMessage.textContent = "密码需包含字母和数字，长度不少于 6 位";
    return;
  }

  if (newPassword !== confirmPassword) {
    errorMessage.textContent = "两次输入的密码不一致";
    return;
  }

  if (oldPassword === newPassword) {
    errorMessage.textContent = "新密码不能与当前密码相同";
    return;
  }

  try {
    const user = getSessionUser();
    if (!user) {
      errorMessage.textContent = "未登录，请先登录";
      setTimeout(() => {
        location.href = "login.html";
      }, 1500);
      return;
    }

    await changePassword(user.id, oldPassword, newPassword);
    // 密码修改成功，清除mustChangePassword标志后，根据用户角色跳转
    const roleTarget = {
      student: "student.html",
      teacher: "teacher.html",
      admin: "admin.html",
      system: "system.html"
    }[user.role];
    alert("密码修改成功！");
    location.href = roleTarget || "index.html";
  } catch (err) {
    errorMessage.textContent = err.message;
  }
});

const init = async () => {
  await ensureSeeded();
  const user = getSessionUser();
  if (!user) {
    alert("未登录，请先登录");
    location.href = "login.html";
    return;
  }
  // 如果不是强制修改密码的情况，也可以允许用户修改密码
  setupNav("home");
};

init();

