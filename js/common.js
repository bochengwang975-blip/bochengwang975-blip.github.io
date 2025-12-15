import { getSessionUser } from "./storage.js";

export const setupNav = active => {
  const nav = document.querySelector(".nav-links");
  if (!nav) return;
  const user = getSessionUser();
  // 根据角色仅展示对应入口，避免显示其他端口
  const roleMap = {
    student: [{ href: "student.html", label: "学生端", key: "student" }],
    teacher: [{ href: "teacher.html", label: "教师端", key: "teacher" }],
    admin: [{ href: "admin.html", label: "教务端", key: "admin" }],
    system: [{ href: "system.html", label: "系统管理", key: "system" }]
  };
  const guestLinks = [{ href: "index.html", label: "首页", key: "home" }];
  const links = user ? roleMap[user.role] || guestLinks : guestLinks;
  nav.innerHTML = "";
  links.forEach(link => {
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = link.label;
    if (active === link.key) a.classList.add("active");
    nav.appendChild(a);
  });

  const authBtn = document.createElement("a");
  authBtn.href = user ? "logout.html" : "login.html";
  authBtn.textContent = user ? `退出 (${user.name || user.username})` : "登录 / 注册";
  nav.appendChild(authBtn);

  const brandName = document.querySelector(".brand .tagline");
  if (brandName && user) {
    brandName.textContent = `${user.role.toUpperCase()} 模式`;
  }
  if (brandName && !user) {
    brandName.textContent = "成绩管理教学平台";
  }
};
