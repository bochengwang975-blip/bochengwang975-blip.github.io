import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { hashPassword, randomSalt, uuid, parseCSV } from "./utils.js";
import { setupNav } from "./common.js";

const classForm = document.getElementById("class-form");
const classList = document.getElementById("class-list");
const csvInput = document.getElementById("csv-input");
const fileInput = document.getElementById("file-input");
const importBtn = document.getElementById("import-btn");
const importResult = document.getElementById("import-result");
const initialPasswordInput = document.getElementById("initial-password");
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

// 解析Excel文件
const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (err) {
        reject(new Error("Excel文件解析失败: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
};

// 解析CSV文件
const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parseCSV(text);
        resolve(rows);
      } catch (err) {
        reject(new Error("CSV文件解析失败: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, 'UTF-8');
  });
};

// 处理文件上传
fileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  importResult.textContent = "正在解析文件...";
  importResult.style.color = "";

  try {
    let rows = [];
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
      rows = await parseExcelFile(file);
    } else if (fileName.endsWith('.csv')) {
      rows = await parseCSVFile(file);
    } else {
      throw new Error("不支持的文件格式，请使用 .xls, .xlsx 或 .csv 文件");
    }

    // 将解析的数据填充到文本框中，供用户查看和编辑
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const csvText = headers.join(',') + '\n' + 
        rows.map(row => headers.map(h => row[h] || '').join(',')).join('\n');
      csvInput.value = csvText;
      importResult.textContent = `已解析 ${rows.length} 条记录，请点击"批量导入"按钮完成导入`;
      importResult.style.color = "#27ae60";
    } else {
      importResult.textContent = "文件中没有数据";
      importResult.style.color = "#e74c3c";
    }
  } catch (err) {
    importResult.textContent = err.message;
    importResult.style.color = "#e74c3c";
  }
});

// 批量导入学生账号
importBtn?.addEventListener("click", async () => {
  const text = csvInput.value.trim();
  if (!text) {
    importResult.textContent = "请先选择文件或输入CSV文本";
    importResult.style.color = "#e74c3c";
    return;
  }

  const initialPassword = (initialPasswordInput?.value || "Student123").trim();
  if (!initialPassword) {
    importResult.textContent = "请输入统一初始密码";
    importResult.style.color = "#e74c3c";
    return;
  }

  importResult.textContent = "正在导入...";
  importResult.style.color = "";

  try {
    const rows = parseCSV(text);
    if (rows.length === 0) {
      importResult.textContent = "没有可导入的数据";
      importResult.style.color = "#e74c3c";
      return;
    }

    const data = getData();
    let success = 0;
    let skipped = 0;
    const errors = [];

    for (const r of rows) {
      // 支持多种字段名：student_no, 学号, username等
      const username = r.student_no || r.学号 || r.username || r["学号"] || "";
      const name = r.name || r.姓名 || r["姓名"] || "";
      const className = r.className || r.班级 || r["班级"] || "";

      if (!username) {
        skipped++;
        errors.push(`第 ${success + skipped} 行：缺少学号`);
        continue;
      }

      // 检查用户名是否已存在
      if (data.users.some(u => u.username === username)) {
        skipped++;
        errors.push(`学号 ${username} 已存在，已跳过`);
        continue;
      }

      // 创建学生账号，设置统一初始密码和强制修改密码标志
      const salt = randomSalt();
      const passwordHash = await hashPassword(initialPassword, salt);
      data.users.push({
        id: uuid(),
        username: username.toString(),
        name: name || username,
        email: `${username}@campus.edu`,
        role: "student",
        className: className || "",
        major: r.major || r.专业 || r["专业"] || "",
        salt,
        passwordHash,
        mustChangePassword: true // 标记首次登录需修改密码
      });
      success++;
    }

    saveData(data);
    addLog(currentUser.id, "批量导入学生账号", `成功导入 ${success} 条记录，跳过 ${skipped} 条，初始密码：${initialPassword}`);

    let resultMsg = `成功导入 ${success} 条学生记录`;
    if (skipped > 0) {
      resultMsg += `，跳过 ${skipped} 条`;
    }
    if (errors.length > 0 && errors.length <= 5) {
      resultMsg += "\n" + errors.join("\n");
    } else if (errors.length > 5) {
      resultMsg += `\n（前5条错误：${errors.slice(0, 5).join("；")}）`;
    }

    importResult.textContent = resultMsg;
    importResult.style.color = success > 0 ? "#27ae60" : "#e74c3c";
    
    // 清空输入
    csvInput.value = "";
    fileInput.value = "";
  } catch (err) {
    importResult.textContent = "导入失败: " + err.message;
    importResult.style.color = "#e74c3c";
  }
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
