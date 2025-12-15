import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { hashPassword, randomSalt, uuid, parseCSV } from "./utils.js";
import { setupNav } from "./common.js";

const classForm = document.getElementById("class-form");
const classList = document.getElementById("class-list");
const csvInput = document.getElementById("csv-input");
const importBtn = document.getElementById("import-btn");
const importResult = document.getElementById("import-result");
const resetForm = document.getElementById("reset-form");
const reviewRows = document.getElementById("review-rows");
const publishAllBtn = document.getElementById("publish-all");

let currentUser = null;

const renderClasses = () => {
  const data = getData();
  classList.innerHTML = "";
  data.classes.forEach(c => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.textContent = `${c.name}（${c.size || "-"}人），辅导员：${c.counselor || "未填"}`;
    classList.appendChild(row);
  });
};

classForm?.addEventListener("submit", e => {
  e.preventDefault();
  const form = new FormData(classForm);
  const c = Object.fromEntries(form.entries());
  const data = getData();
  data.classes.push({ id: uuid(), name: c.name, size: Number(c.size) || 0, counselor: c.counselor });
  saveData(data);
  addLog(currentUser.id, "新增班级", c.name);
  classForm.reset();
  renderClasses();
});

importBtn?.addEventListener("click", async () => {
  const text = csvInput.value.trim();
  if (!text) return;
  const rows = parseCSV(text);
  const data = getData();
  let success = 0;
  for (const r of rows) {
    const username = r.student_no || r.username || r.email?.split("@")[0];
    if (!username || data.users.some(u => u.username === username)) continue;
    const salt = randomSalt();
    const passwordHash = await hashPassword(r.password || "init123", salt);
    data.users.push({
      id: uuid(),
      username,
      name: r.name || username,
      email: r.email || `${username}@campus.edu`,
      role: "student",
      className: r.className || "",
      major: r.major || "",
      salt,
      passwordHash
    });
    success++;
  }
  saveData(data);
  addLog(currentUser.id, "导入学生", `成功导入 ${success} 条记录`);
  importResult.textContent = `已导入 ${success} 条学生记录`;
  csvInput.value = "";
});

resetForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(resetForm);
  const username = form.get("username").trim();
  const newPwd = form.get("newPassword").trim();
  const data = getData();
  const user = data.users.find(u => u.username === username);
  if (!user) {
    alert("未找到用户");
    return;
  }
  const salt = randomSalt();
  user.salt = salt;
  user.passwordHash = await hashPassword(newPwd, salt);
  saveData(data);
  addLog(currentUser.id, "重置密码", `为用户 ${username} 重置密码`);
  alert("密码已重置");
  resetForm.reset();
});

const renderReview = () => {
  const data = getData();
  const pending = data.enrollments.filter(e => !e.published && e.finalGrade !== null && e.finalGrade !== undefined);
  reviewRows.innerHTML = "";
  pending.forEach(e => {
    const course = data.courses.find(c => c.id === e.courseId);
    const student = data.users.find(u => u.id === e.studentId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${course?.name || "-"}</td>
      <td>${student?.name || "-"}</td>
      <td>${e.finalGrade}</td>
      <td><button class="mini" data-publish="${e.id}">发布</button></td>
    `;
    reviewRows.appendChild(tr);
  });

  reviewRows.querySelectorAll("[data-publish]").forEach(btn =>
    btn.addEventListener("click", () => {
      const data = getData();
      const record = data.enrollments.find(e => e.id === btn.dataset.publish);
      record.published = true;
      saveData(data);
      addLog(currentUser.id, "审核发布成绩", `发布课程 ${record.courseId} 学生 ${record.studentId}`);
      renderReview();
    })
  );
};

publishAllBtn?.addEventListener("click", () => {
  const data = getData();
  let count = 0;
  data.enrollments.forEach(e => {
    if (!e.published && e.finalGrade !== null && e.finalGrade !== undefined) {
      e.published = true;
      count++;
    }
  });
  saveData(data);
  addLog(currentUser.id, "批量发布成绩", `发布 ${count} 条记录`);
  renderReview();
});

const init = async () => {
  currentUser = await requireAuth(["admin"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("admin");
  renderClasses();
  renderReview();
};

init();
