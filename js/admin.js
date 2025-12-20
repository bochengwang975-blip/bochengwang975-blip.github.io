import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog, findUserByUsername } from "./storage.js";
import { hashPassword, randomSalt, uuid, parseCSV } from "./utils.js";
import { setupNav } from "./common.js";
import { checkScheduleConflict, generateWeeklySchedule, formatTime, formatLocation, DAY_NAMES, PERIOD_NAMES } from "./schedule.js";

let currentUser = null;
let editingClassId = null;
let editingStudentId = null;
let editingCourseId = null;
let editingTeacherId = null;

// ==================== 标签页切换 ====================
const tabs = document.querySelectorAll("#main-tabs .tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    panels.forEach(p => p.classList.add("hidden"));
    document.getElementById(`${targetTab}-panel`).classList.remove("hidden");
    
    // 切换标签时刷新数据
    if (targetTab === "classes") renderClasses();
    else if (targetTab === "students") {
      renderClassSelect();
      renderStudents();
    } else if (targetTab === "courses") {
      renderTeacherSelect();
      renderCourses();
      renderAdminSchedule();
    } else if (targetTab === "teachers") renderTeachers();
    else if (targetTab === "relations") {
      renderRelationClassSelect();
      renderRelationCourseSelect();
      renderRelationCourseStudentsSelect();
    } else if (targetTab === "grades") {
      renderGradeCourses();
    }
  });
});

// ==================== 班级管理 ====================
const classForm = document.getElementById("class-form");
const classList = document.getElementById("class-list");
const classSubmitBtn = document.getElementById("class-submit-btn");
const classCancelBtn = document.getElementById("class-cancel-btn");

const renderClasses = () => {
  const data = getData();
  classList.innerHTML = "";
  if (!data.classes || data.classes.length === 0) {
    classList.innerHTML = "<div class='muted'>暂无班级数据</div>";
    return;
  }
  data.classes.forEach(c => {
    const item = document.createElement("div");
    item.className = "list-item";
    const studentCount = data.users?.filter(u => u.role === "student" && u.className === c.name).length || 0;
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${c.name}</strong>
          <p class="muted">学生人数：${studentCount} | 辅导员：${c.counselor || "未设置"}</p>
        </div>
        <div>
          <button class="mini" data-edit-class="${c.id}">编辑</button>
          <button class="mini" data-delete-class="${c.id}" style="color:rgb(255, 255, 255);">删除</button>
        </div>
      </div>
    `;
    classList.appendChild(item);
  });
  bindClassActions();
};

const bindClassActions = () => {
  classList.querySelectorAll("[data-edit-class]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editClass;
      editClass(id);
    });
  });
  classList.querySelectorAll("[data-delete-class]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteClass;
      if (confirm("确定要删除这个班级吗？")) {
        deleteClass(id);
      }
    });
  });
};

const editClass = (id) => {
  const data = getData();
  const cls = data.classes.find(c => c.id === id);
  if (!cls) return;
  document.getElementById("class-id").value = cls.id;
  document.getElementById("class-name").value = cls.name || "";
  document.getElementById("class-counselor").value = cls.counselor || "";
  classSubmitBtn.textContent = "更新班级";
  classCancelBtn.style.display = "inline-block";
  editingClassId = id;
  classForm.scrollIntoView({ behavior: "smooth" });
};

const deleteClass = (id) => {
  const data = getData();
  const cls = data.classes.find(c => c.id === id);
  if (!cls) return;
  // 检查是否有学生关联
  const students = data.users?.filter(u => u.role === "student" && u.className === cls.name) || [];
  if (students.length > 0) {
    alert(`该班级还有 ${students.length} 名学生，请先处理学生数据`);
    return;
  }
  data.classes = data.classes.filter(c => c.id !== id);
  saveData(data);
  addLog(currentUser.id, "删除班级", cls.name);
  renderClasses();
  resetClassForm();
};

classForm?.addEventListener("submit", e => {
  e.preventDefault();
  const form = new FormData(classForm);
  const data = getData();
  const name = form.get("name").trim();
  const counselor = form.get("counselor").trim();
  
  if (editingClassId) {
    // 更新
    const cls = data.classes.find(c => c.id === editingClassId);
    if (cls) {
      const oldName = cls.name;
      cls.name = name;
      cls.counselor = counselor;
      // 更新关联学生的班级名称
      data.users?.forEach(u => {
        if (u.role === "student" && u.className === oldName) {
          u.className = name;
        }
      });
      saveData(data);
      addLog(currentUser.id, "更新班级", name);
    }
  } else {
    // 新增
    if (data.classes.some(c => c.name === name)) {
      alert("班级名称已存在");
      return;
    }
    data.classes.push({ id: uuid(), name, counselor });
    saveData(data);
    addLog(currentUser.id, "新增班级", name);
  }
  renderClasses();
  resetClassForm();
});

const resetClassForm = () => {
  classForm.reset();
  document.getElementById("class-id").value = "";
  classSubmitBtn.textContent = "添加班级";
  classCancelBtn.style.display = "none";
  editingClassId = null;
};

classCancelBtn?.addEventListener("click", resetClassForm);

// ==================== 学生管理 ====================
const studentForm = document.getElementById("student-form");
const studentList = document.getElementById("student-list");
const studentSearch = document.getElementById("student-search");
const studentClassSelect = document.getElementById("student-class");
const studentSubmitBtn = document.getElementById("student-submit-btn");
const studentCancelBtn = document.getElementById("student-cancel-btn");
const csvInput = document.getElementById("csv-input");
const fileInput = document.getElementById("file-input");
const importBtn = document.getElementById("import-btn");
const importResult = document.getElementById("import-result");
const initialPasswordInput = document.getElementById("initial-password");

const renderClassSelect = () => {
  const data = getData();
  studentClassSelect.innerHTML = "<option value=''>选择班级</option>";
  (data.classes || []).forEach(c => {
    const option = document.createElement("option");
    option.value = c.name;
    option.textContent = c.name;
    studentClassSelect.appendChild(option);
  });
};

const renderStudents = (searchTerm = "") => {
  const data = getData();
  const students = (data.users || []).filter(u => u.role === "student");
  let filtered = students;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = students.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.username.toLowerCase().includes(term)
    );
  }
  
  studentList.innerHTML = "";
  if (filtered.length === 0) {
    studentList.innerHTML = "<div class='muted'>暂无学生数据</div>";
    return;
  }
  
  filtered.forEach(s => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${s.name}</strong> <span class="muted">(${s.username})</span>
          <p class="muted">班级：${s.className || "未分配"} | 专业：${s.major || "未设置"} | 邮箱：${s.email || "未设置"}</p>
        </div>
        <div>
          <button class="mini" data-edit-student="${s.id}">编辑</button>
          <button class="mini" data-reset-password-student="${s.id}" style="color:rgb(255, 255, 255);">重置密码</button>
          <button class="mini" data-delete-student="${s.id}" style="color:rgb(255, 255, 255);">删除</button>
        </div>
      </div>
    `;
    studentList.appendChild(item);
  });
  bindStudentActions();
};

const bindStudentActions = () => {
  studentList.querySelectorAll("[data-edit-student]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editStudent;
      editStudent(id);
    });
  });
  studentList.querySelectorAll("[data-reset-password-student]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.resetPasswordStudent;
      await resetStudentPassword(id);
    });
  });
  studentList.querySelectorAll("[data-delete-student]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteStudent;
      if (confirm("确定要删除这个学生吗？")) {
        deleteStudent(id);
      }
    });
  });
};

const editStudent = (id) => {
  const data = getData();
  const student = data.users.find(u => u.id === id && u.role === "student");
  if (!student) return;
  document.getElementById("student-id").value = student.id;
  document.getElementById("student-username").value = student.username || "";
  document.getElementById("student-name").value = student.name || "";
  document.getElementById("student-email").value = student.email || "";
  document.getElementById("student-class").value = student.className || "";
  document.getElementById("student-major").value = student.major || "";
  studentSubmitBtn.textContent = "更新学生";
  studentCancelBtn.style.display = "inline-block";
  editingStudentId = id;
  studentForm.scrollIntoView({ behavior: "smooth" });
};

const resetStudentPassword = async (id) => {
  const data = getData();
  const student = data.users.find(u => u.id === id && u.role === "student");
  if (!student) return;
  
  const newPassword = prompt(`为 ${student.name} (${student.username}) 设置新密码：\n（留空将使用默认密码 Student123）`, "Student123");
  if (newPassword === null) return; // 用户取消
  
  const password = newPassword.trim() || "Student123";
  if (password.length < 6) {
    alert("密码长度不能少于6位");
    return;
  }
  
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  student.salt = salt;
  student.passwordHash = passwordHash;
  student.mustChangePassword = true; // 强制首次登录修改密码
  
  saveData(data);
  addLog(currentUser.id, "重置学生密码", `${student.name} (${student.username})`);
  alert(`密码已重置为：${password}\n学生首次登录时需要修改密码。`);
  renderStudents(studentSearch.value);
};

const deleteStudent = (id) => {
  const data = getData();
  const student = data.users.find(u => u.id === id);
  if (!student) return;
  // 检查是否有选课记录
  const enrollments = data.enrollments?.filter(e => e.studentId === id) || [];
  if (enrollments.length > 0) {
    alert(`该学生还有 ${enrollments.length} 条选课记录，请先处理选课数据`);
    return;
  }
  data.users = data.users.filter(u => u.id !== id);
  saveData(data);
  addLog(currentUser.id, "删除学生", student.name);
  renderStudents(studentSearch.value);
  resetStudentForm();
};

studentForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(studentForm);
  const data = getData();
  const username = form.get("username").trim();
  const name = form.get("name").trim();
  const email = form.get("email").trim();
  const className = form.get("className").trim();
  const major = form.get("major").trim();
  
  if (editingStudentId) {
    // 更新
    const student = data.users.find(u => u.id === editingStudentId);
    if (student) {
      // 检查用户名是否被其他用户使用
      if (username !== student.username && findUserByUsername(username)) {
        alert("用户名已存在");
        return;
      }
      student.username = username;
      student.name = name;
      student.email = email || `${username}@campus.edu`;
      student.className = className;
      student.major = major;
      saveData(data);
      addLog(currentUser.id, "更新学生", name);
    }
  } else {
    // 新增
    if (findUserByUsername(username)) {
      alert("用户名已存在");
      return;
    }
    const salt = randomSalt();
    const passwordHash = await hashPassword("Student123", salt);
    const newStudent = {
      id: uuid(),
      username,
      name,
      email: email || `${username}@campus.edu`,
      role: "student",
      className,
      major,
      salt,
      passwordHash,
      mustChangePassword: true
    };
    data.users.push(newStudent);
    saveData(data);
    addLog(currentUser.id, "新增学生", name);
  }
  renderStudents(studentSearch.value);
  resetStudentForm();
});

const resetStudentForm = () => {
  studentForm.reset();
  document.getElementById("student-id").value = "";
  studentSubmitBtn.textContent = "添加学生";
  studentCancelBtn.style.display = "none";
  editingStudentId = null;
};

studentCancelBtn?.addEventListener("click", resetStudentForm);
studentSearch?.addEventListener("input", e => renderStudents(e.target.value));

// ==================== 批量导入学生账号 ====================
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

      // 检查班级是否存在
      if (className && !data.classes.some(c => c.name === className)) {
        skipped++;
        errors.push(`学号 ${username} (${name || username})：班级 "${className}" 不存在，无法导入`);
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
    
    // 清空输入并刷新学生列表
    csvInput.value = "";
    fileInput.value = "";
    renderStudents(studentSearch.value);
    renderClassSelect(); // 刷新班级选择（可能新增了班级）
  } catch (err) {
    importResult.textContent = "导入失败: " + err.message;
    importResult.style.color = "#e74c3c";
  }
});

// ==================== 课程管理 ====================
const courseForm = document.getElementById("course-form");
const courseList = document.getElementById("course-list");
const courseSearch = document.getElementById("course-search");
const courseTeachersDiv = document.getElementById("course-teachers");
const courseSubmitBtn = document.getElementById("course-submit-btn");
const courseCancelBtn = document.getElementById("course-cancel-btn");

const renderTeacherSelect = () => {
  const data = getData();
  const teachers = (data.users || []).filter(u => u.role === "teacher");
  courseTeachersDiv.innerHTML = "";
  if (teachers.length === 0) {
    courseTeachersDiv.innerHTML = "<div class='muted'>暂无教师数据，请先添加教师</div>";
    return;
  }
  teachers.forEach(t => {
    const label = document.createElement("label");
    label.style.display = "block";
    label.style.marginBottom = "0.5rem";
    label.innerHTML = `
      <input type="checkbox" value="${t.id}" data-teacher-id="${t.id}" />
      ${t.name} (${t.username})
    `;
    courseTeachersDiv.appendChild(label);
  });
};

const renderCourses = (searchTerm = "") => {
  const data = getData();
  const courses = data.courses || [];
  let filtered = courses;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = courses.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.code.toLowerCase().includes(term)
    );
  }
  
  courseList.innerHTML = "";
  if (filtered.length === 0) {
    courseList.innerHTML = "<div class='muted'>暂无课程数据</div>";
    return;
  }
  
  filtered.forEach(c => {
    const item = document.createElement("div");
    item.className = "list-item";
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    const teachers = teacherIds.map(tid => {
      const t = data.users.find(u => u.id === tid);
      return t ? t.name : "未知";
    }).join(", ") || "未分配";
    const timeStr = c.time ? formatTime(c.time) : (c.schedule || "未设置");
    const locationStr = c.location || (c.schedule ? "" : "未设置");
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${c.name}</strong> <span class="muted">(${c.code})</span>
          <p class="muted">学分：${c.credits || 0} | 院系：${c.department || "未设置"} | 教师：${teachers}</p>
          <p class="muted">时间：${timeStr} | 地点：${locationStr}</p>
          <p class="muted">${c.summary || ""}</p>
        </div>
        <div>
          <button class="mini" data-edit-course="${c.id}">编辑</button>
          <button class="mini" data-delete-course="${c.id}" style="color:rgb(255, 255, 255);">删除</button>
        </div>
      </div>
    `;
    courseList.appendChild(item);
  });
  bindCourseActions();
};

const bindCourseActions = () => {
  courseList.querySelectorAll("[data-edit-course]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editCourse;
      editCourse(id);
    });
  });
  courseList.querySelectorAll("[data-delete-course]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteCourse;
      if (confirm("确定要删除这门课程吗？")) {
        deleteCourse(id);
      }
    });
  });
};

const editCourse = (id) => {
  const data = getData();
  const course = data.courses.find(c => c.id === id);
  if (!course) return;
  document.getElementById("course-id").value = course.id;
  document.getElementById("course-code").value = course.code || "";
  document.getElementById("course-name").value = course.name || "";
  document.getElementById("course-credits").value = course.credits || "";
  document.getElementById("course-department").value = course.department || "";
  document.getElementById("course-capacity").value = course.capacity || "";
  
  // 设置时间和地点
  const time = course.time || (course.schedule ? null : null);
  if (time && time.day && time.period) {
    document.getElementById("course-time-day").value = time.day;
    document.getElementById("course-time-period").value = time.period;
  } else {
    document.getElementById("course-time-day").value = "";
    document.getElementById("course-time-period").value = "";
  }
  document.getElementById("course-location").value = course.location || "";
  document.getElementById("course-historical-average").value = course.historicalAverage !== undefined && course.historicalAverage !== null ? course.historicalAverage : "";
  
  document.getElementById("course-summary").value = course.summary || "";
  
  // 设置教师选择
  const teacherIds = course.teacherIds || (course.teacherId ? [course.teacherId] : []);
  courseTeachersDiv.querySelectorAll("input[type='checkbox']").forEach(cb => {
    cb.checked = teacherIds.includes(cb.value);
  });
  
  courseSubmitBtn.textContent = "更新课程";
  courseCancelBtn.style.display = "inline-block";
  editingCourseId = id;
  courseForm.scrollIntoView({ behavior: "smooth" });
  checkConflictOnChange();
};

const deleteCourse = (id) => {
  const data = getData();
  const course = data.courses.find(c => c.id === id);
  if (!course) return;
  // 检查是否有选课记录
  const enrollments = data.enrollments?.filter(e => e.courseId === id) || [];
  if (enrollments.length > 0) {
    alert(`该课程还有 ${enrollments.length} 条选课记录，请先处理选课数据`);
    return;
  }
  data.courses = data.courses.filter(c => c.id !== id);
  saveData(data);
  addLog(currentUser.id, "删除课程", course.name);
  renderCourses(courseSearch.value);
  resetCourseForm();
};

// 冲突检测函数
const checkConflictOnChange = () => {
  const timeDay = document.getElementById("course-time-day").value;
  const timePeriod = document.getElementById("course-time-period").value;
  const location = document.getElementById("course-location").value.trim();
  const warningDiv = document.getElementById("schedule-conflict-warning");
  
  if (!timeDay || !timePeriod) {
    warningDiv.style.display = "none";
    return;
  }

  const selectedTeachers = Array.from(courseTeachersDiv.querySelectorAll("input[type='checkbox']:checked"))
    .map(cb => cb.value);
  
  if (selectedTeachers.length === 0) {
    warningDiv.style.display = "none";
    return;
  }

  const newCourse = {
    id: editingCourseId || null,
    time: { day: parseInt(timeDay), period: parseInt(timePeriod) },
    location,
    teacherIds: selectedTeachers
  };

  const conflictResult = checkScheduleConflict(newCourse);
  
  if (conflictResult.hasConflict) {
    warningDiv.style.display = "block";
    const messages = conflictResult.conflicts.map(c => c.message).join("；");
    warningDiv.textContent = `⚠️ 排课冲突：${messages}`;
    warningDiv.style.background = "#fff3cd";
    warningDiv.style.borderColor = "#ffc107";
    warningDiv.style.color = "#856404";
  } else {
    warningDiv.style.display = "none";
  }
};

// 监听时间和地点变化
document.getElementById("course-time-day")?.addEventListener("change", checkConflictOnChange);
document.getElementById("course-time-period")?.addEventListener("change", checkConflictOnChange);
document.getElementById("course-location")?.addEventListener("input", checkConflictOnChange);
courseTeachersDiv?.addEventListener("change", checkConflictOnChange);

courseForm?.addEventListener("submit", e => {
  e.preventDefault();
  const form = new FormData(courseForm);
  const data = getData();
  const code = form.get("code").trim();
  const name = form.get("name").trim();
  const credits = Number(form.get("credits")) || 0;
  const department = form.get("department").trim();
  const capacity = Number(form.get("capacity")) || 0;
  const timeDay = form.get("time-day");
  const timePeriod = form.get("time-period");
  const location = form.get("location").trim();
  const historicalAverage = form.get("historicalAverage") ? Number(form.get("historicalAverage")) : null;
  const summary = form.get("summary").trim();
  
  // 获取选中的教师
  const selectedTeachers = Array.from(courseTeachersDiv.querySelectorAll("input[type='checkbox']:checked"))
    .map(cb => cb.value);
  
  if (selectedTeachers.length === 0) {
    alert("请至少选择一名授课教师");
    return;
  }

  if (!timeDay || !timePeriod) {
    alert("请选择上课时间和节次");
    return;
  }

  if (!location) {
    alert("请输入上课地点");
    return;
  }

  // 构建时间和地点对象
  const time = { day: parseInt(timeDay), period: parseInt(timePeriod) };
  
  // 检查冲突
  const newCourse = {
    id: editingCourseId || null,
    time,
    location,
    teacherIds: selectedTeachers
  };

  const conflictResult = checkScheduleConflict(newCourse);
  if (conflictResult.hasConflict) {
    const messages = conflictResult.conflicts.map(c => c.message).join("；");
    if (!confirm(`检测到排课冲突：${messages}\n\n是否仍要继续添加/更新课程？`)) {
      return;
    }
  }
  
  if (editingCourseId) {
    // 更新
    const course = data.courses.find(c => c.id === editingCourseId);
    if (course) {
      // 检查课程代码是否被其他课程使用
      if (code !== course.code && data.courses.some(c => c.code === code)) {
        alert("课程代码已存在");
        return;
      }
      course.code = code;
      course.name = name;
      course.credits = credits;
      course.department = department;
      course.capacity = capacity;
      course.time = time;
      course.location = location;
      course.summary = summary;
      course.teacherIds = selectedTeachers;
      course.historicalAverage = historicalAverage;
      // 兼容旧数据：删除旧的schedule字段
      if (course.schedule) delete course.schedule;
      if (course.teacherId) delete course.teacherId;
      saveData(data);
      addLog(currentUser.id, "更新课程", name);
    }
  } else {
    // 新增
    if (data.courses.some(c => c.code === code)) {
      alert("课程代码已存在");
      return;
    }
    const newCourse = {
      id: uuid(),
      code,
      name,
      credits,
      department,
      capacity,
      time,
      location,
      summary,
      teacherIds: selectedTeachers,
      historicalAverage,
      tags: [],
      materials: [],
      tasks: []
    };
    data.courses.push(newCourse);
    saveData(data);
    addLog(currentUser.id, "新增课程", name);
  }
  renderCourses(courseSearch.value);
  renderAdminSchedule();
  resetCourseForm();
});

const resetCourseForm = () => {
  courseForm.reset();
  document.getElementById("course-id").value = "";
  document.getElementById("course-historical-average").value = "";
  courseTeachersDiv.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);
  document.getElementById("schedule-conflict-warning").style.display = "none";
  courseSubmitBtn.textContent = "添加课程";
  courseCancelBtn.style.display = "none";
  editingCourseId = null;
};

courseCancelBtn?.addEventListener("click", resetCourseForm);
courseSearch?.addEventListener("input", e => renderCourses(e.target.value));

// ==================== 管理员课表视图 ====================
const adminScheduleView = document.getElementById("admin-schedule-view");

const renderAdminSchedule = () => {
  const scheduleData = generateWeeklySchedule(null, "admin");
  const { schedule } = scheduleData;

  let html = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">时间</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">周一</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">周二</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">周三</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">周四</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5;">周五</th>
        </tr>
      </thead>
      <tbody>
  `;

  const periodLabels = ["上午第1节", "上午第2节", "下午第1节", "下午第2节", "晚上"];
  
  for (let period = 0; period < 5; period++) {
    html += `<tr>`;
    html += `<td style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; font-weight: bold;">${periodLabels[period]}</td>`;
    
    for (let day = 0; day < 5; day++) {
      const cellContent = schedule[day][period];
      html += `<td style="border: 1px solid #ddd; padding: 0.5rem; vertical-align: top; min-height: 80px;">`;
      
      if (cellContent && Array.isArray(cellContent) && cellContent.length > 0) {
        cellContent.forEach(item => {
          html += `
            <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #e3f2fd; border-radius: 4px; font-size: 0.9em;">
              <strong>${item.course.name}</strong><br/>
              <span class="muted">${item.course.code}</span><br/>
              <span class="muted">${item.location}</span><br/>
              <span class="muted">${item.teachers}</span>
            </div>
          `;
        });
      } else {
        html += `<span class="muted" style="font-size: 0.9em;">-</span>`;
      }
      
      html += `</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  adminScheduleView.innerHTML = html;
};

// ==================== 教师管理 ====================
const teacherForm = document.getElementById("teacher-form");
const teacherList = document.getElementById("teacher-list");
const teacherSearch = document.getElementById("teacher-search");
const teacherSubmitBtn = document.getElementById("teacher-submit-btn");
const teacherCancelBtn = document.getElementById("teacher-cancel-btn");

const renderTeachers = (searchTerm = "") => {
  const data = getData();
  const teachers = (data.users || []).filter(u => u.role === "teacher");
  let filtered = teachers;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = teachers.filter(t => 
      t.name.toLowerCase().includes(term) || 
      t.username.toLowerCase().includes(term)
    );
  }
  
  teacherList.innerHTML = "";
  if (filtered.length === 0) {
    teacherList.innerHTML = "<div class='muted'>暂无教师数据</div>";
    return;
  }
  
  filtered.forEach(t => {
    const item = document.createElement("div");
    item.className = "list-item";
    // 统计该教师教授的课程数
    const courseCount = (data.courses || []).filter(c => {
      const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
      return teacherIds.includes(t.id);
    }).length;
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${t.name}</strong> <span class="muted">(${t.username})</span>
          <p class="muted">院系：${t.department || "未设置"} | 邮箱：${t.email || "未设置"} | 授课：${courseCount} 门</p>
        </div>
        <div>
          <button class="mini" data-edit-teacher="${t.id}">编辑</button>
          <button class="mini" data-reset-password-teacher="${t.id}" style="color:rgb(255, 255, 255);">重置密码</button>
          <button class="mini" data-delete-teacher="${t.id}" style="color:rgb(255, 255, 255);">删除</button>
        </div>
      </div>
    `;
    teacherList.appendChild(item);
  });
  bindTeacherActions();
};

const bindTeacherActions = () => {
  teacherList.querySelectorAll("[data-edit-teacher]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editTeacher;
      editTeacher(id);
    });
  });
  teacherList.querySelectorAll("[data-reset-password-teacher]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.resetPasswordTeacher;
      await resetTeacherPassword(id);
    });
  });
  teacherList.querySelectorAll("[data-delete-teacher]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteTeacher;
      if (confirm("确定要删除这位教师吗？")) {
        deleteTeacher(id);
      }
    });
  });
};

const editTeacher = (id) => {
  const data = getData();
  const teacher = data.users.find(u => u.id === id && u.role === "teacher");
  if (!teacher) return;
  document.getElementById("teacher-id").value = teacher.id;
  document.getElementById("teacher-username").value = teacher.username || "";
  document.getElementById("teacher-name").value = teacher.name || "";
  document.getElementById("teacher-email").value = teacher.email || "";
  document.getElementById("teacher-department").value = teacher.department || "";
  teacherSubmitBtn.textContent = "更新教师";
  teacherCancelBtn.style.display = "inline-block";
  editingTeacherId = id;
  teacherForm.scrollIntoView({ behavior: "smooth" });
};

const resetTeacherPassword = async (id) => {
  const data = getData();
  const teacher = data.users.find(u => u.id === id && u.role === "teacher");
  if (!teacher) return;
  
  const newPassword = prompt(`为 ${teacher.name} (${teacher.username}) 设置新密码：\n（留空将使用默认密码 Teacher123）`, "Teacher123");
  if (newPassword === null) return; // 用户取消
  
  const password = newPassword.trim() || "Teacher123";
  if (password.length < 6) {
    alert("密码长度不能少于6位");
    return;
  }
  
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  teacher.salt = salt;
  teacher.passwordHash = passwordHash;
  teacher.mustChangePassword = true; // 强制首次登录修改密码
  
  saveData(data);
  addLog(currentUser.id, "重置教师密码", `${teacher.name} (${teacher.username})`);
  alert(`密码已重置为：${password}\n教师首次登录时需要修改密码。`);
  renderTeachers(teacherSearch.value);
};

const deleteTeacher = (id) => {
  const data = getData();
  const teacher = data.users.find(u => u.id === id);
  if (!teacher) return;
  // 检查是否有课程关联
  const courses = data.courses?.filter(c => {
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    return teacherIds.includes(id);
  }) || [];
  if (courses.length > 0) {
    alert(`该教师还教授 ${courses.length} 门课程，请先处理课程数据`);
    return;
  }
  data.users = data.users.filter(u => u.id !== id);
  saveData(data);
  addLog(currentUser.id, "删除教师", teacher.name);
  renderTeachers(teacherSearch.value);
  resetTeacherForm();
};

teacherForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(teacherForm);
  const data = getData();
  const username = form.get("username").trim();
  const name = form.get("name").trim();
  const email = form.get("email").trim();
  const department = form.get("department").trim();
  
  if (editingTeacherId) {
    // 更新
    const teacher = data.users.find(u => u.id === editingTeacherId);
    if (teacher) {
      // 检查用户名是否被其他用户使用
      if (username !== teacher.username && findUserByUsername(username)) {
        alert("用户名已存在");
        return;
      }
      teacher.username = username;
      teacher.name = name;
      teacher.email = email || `${username}@campus.edu`;
      teacher.department = department;
      saveData(data);
      addLog(currentUser.id, "更新教师", name);
    }
  } else {
    // 新增
    if (findUserByUsername(username)) {
      alert("用户名已存在");
      return;
    }
    const salt = randomSalt();
    const passwordHash = await hashPassword("Teacher123", salt);
    const newTeacher = {
      id: uuid(),
      username,
      name,
      email: email || `${username}@campus.edu`,
      role: "teacher",
      department,
      salt,
      passwordHash,
      mustChangePassword: true // 标记首次登录需修改密码
    };
    data.users.push(newTeacher);
    saveData(data);
    addLog(currentUser.id, "新增教师", name);
    // 刷新教师选择列表
    renderTeacherSelect();
  }
  renderTeachers(teacherSearch.value);
  resetTeacherForm();
});

const resetTeacherForm = () => {
  teacherForm.reset();
  document.getElementById("teacher-id").value = "";
  teacherSubmitBtn.textContent = "添加教师";
  teacherCancelBtn.style.display = "none";
  editingTeacherId = null;
};

teacherCancelBtn?.addEventListener("click", resetTeacherForm);
teacherSearch?.addEventListener("input", e => renderTeachers(e.target.value));

// ==================== 关系映射 ====================
const relationClassSelect = document.getElementById("relation-class-select");
const classStudentsList = document.getElementById("class-students-list");
const relationCourseSelect = document.getElementById("relation-course-select");
const courseTeachersList = document.getElementById("course-teachers-list");
const relationCourseStudentsSelect = document.getElementById("relation-course-students-select");
const courseStudentsList = document.getElementById("course-students-list");

const renderRelationClassSelect = () => {
  const data = getData();
  relationClassSelect.innerHTML = "<option value=''>选择班级</option>";
  (data.classes || []).forEach(c => {
    const option = document.createElement("option");
    option.value = c.name;
    option.textContent = c.name;
    relationClassSelect.appendChild(option);
  });
};

const renderRelationCourseSelect = () => {
  const data = getData();
  relationCourseSelect.innerHTML = "<option value=''>选择课程</option>";
  (data.courses || []).forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.name} (${c.code})`;
    relationCourseSelect.appendChild(option);
  });
};

const renderRelationCourseStudentsSelect = () => {
  const data = getData();
  relationCourseStudentsSelect.innerHTML = "<option value=''>选择课程</option>";
  (data.courses || []).forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.name} (${c.code})`;
    relationCourseStudentsSelect.appendChild(option);
  });
};

relationClassSelect?.addEventListener("change", e => {
  const className = e.target.value;
  if (!className) {
    classStudentsList.innerHTML = "";
    return;
  }
  const data = getData();
  const students = (data.users || []).filter(u => u.role === "student" && u.className === className);
  classStudentsList.innerHTML = "";
  if (students.length === 0) {
    classStudentsList.innerHTML = "<div class='muted'>该班级暂无学生</div>";
    return;
  }
  students.forEach(s => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${s.name}</strong> <span class="muted">(${s.username})</span>
      <p class="muted">专业：${s.major || "未设置"} | 邮箱：${s.email || "未设置"}</p>
    `;
    classStudentsList.appendChild(item);
  });
});

relationCourseSelect?.addEventListener("change", e => {
  const courseId = e.target.value;
  if (!courseId) {
    courseTeachersList.innerHTML = "";
    return;
  }
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  if (!course) {
    courseTeachersList.innerHTML = "";
    return;
  }
  const teacherIds = course.teacherIds || (course.teacherId ? [course.teacherId] : []);
  courseTeachersList.innerHTML = "";
  if (teacherIds.length === 0) {
    courseTeachersList.innerHTML = "<div class='muted'>该课程暂无授课教师</div>";
    return;
  }
  teacherIds.forEach(tid => {
    const teacher = data.users.find(u => u.id === tid);
    if (teacher) {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${teacher.name}</strong> <span class="muted">(${teacher.username})</span>
        <p class="muted">院系：${teacher.department || "未设置"} | 邮箱：${teacher.email || "未设置"}</p>
      `;
      courseTeachersList.appendChild(item);
    }
  });
});

relationCourseStudentsSelect?.addEventListener("change", e => {
  const courseId = e.target.value;
  if (!courseId) {
    courseStudentsList.innerHTML = "";
    return;
  }
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  if (!course) {
    courseStudentsList.innerHTML = "";
    return;
  }
  // 获取该课程的所有选课记录
  const enrollments = (data.enrollments || []).filter(e => e.courseId === courseId);
  courseStudentsList.innerHTML = "";
  if (enrollments.length === 0) {
    courseStudentsList.innerHTML = "<div class='muted'>该课程暂无选课学生</div>";
    return;
  }
  enrollments.forEach(enrollment => {
    const student = data.users.find(u => u.id === enrollment.studentId);
    if (student) {
      const item = document.createElement("div");
      item.className = "list-item";
      // 显示学生信息和选课状态
      const finalGrade = enrollment.finalGrade !== null && enrollment.finalGrade !== undefined 
        ? ` | 成绩：${enrollment.finalGrade}` 
        : "";
      const published = enrollment.published ? "（已发布）" : "（待发布）";
      item.innerHTML = `
        <strong>${student.name}</strong> <span class="muted">(${student.username})</span>
        <p class="muted">班级：${student.className || "未分配"} | 专业：${student.major || "未设置"}${finalGrade}${published}</p>
      `;
      courseStudentsList.appendChild(item);
    }
  });
});

// ==================== 成绩审核 ====================
const gradeCourseList = document.getElementById("grade-course-list");
const gradeCourseSearch = document.getElementById("grade-course-search");
const gradeDetailPanel = document.getElementById("grade-detail-panel");
const gradeDetailTitle = document.getElementById("grade-detail-title");
const gradeStatistics = document.getElementById("grade-statistics");
const gradeDetailTable = document.getElementById("grade-detail-table");
const gradeApproveAllBtn = document.getElementById("grade-approve-all-btn");
const gradeCloseDetailBtn = document.getElementById("grade-close-detail-btn");
const setHistoricalAverageInput = document.getElementById("set-historical-average");
const saveHistoricalAverageBtn = document.getElementById("save-historical-average-btn");
let currentGradeCourseId = null;

// 计算课程成绩统计
const calculateCourseStatistics = (courseId) => {
  const data = getData();
  const enrollments = (data.enrollments || []).filter(e => e.courseId === courseId);
  const gradesWithScore = enrollments.filter(e => e.finalGrade !== null && e.finalGrade !== undefined);
  
  if (gradesWithScore.length === 0) {
    return {
      total: enrollments.length,
      graded: 0,
      excellentRate: 0,
      passRate: 0,
      averageScore: 0,
      publishedCount: 0,
      unpublishedCount: 0
    };
  }
  
  const excellentCount = gradesWithScore.filter(e => e.finalGrade > 90).length;
  const passCount = gradesWithScore.filter(e => e.finalGrade >= 60).length;
  const totalScore = gradesWithScore.reduce((sum, e) => sum + e.finalGrade, 0);
  const averageScore = totalScore / gradesWithScore.length;
  const excellentRate = (excellentCount / gradesWithScore.length) * 100;
  const passRate = (passCount / gradesWithScore.length) * 100;
  const publishedCount = enrollments.filter(e => e.published).length;
  const unpublishedCount = enrollments.filter(e => !e.published && e.finalGrade !== null && e.finalGrade !== undefined).length;
  
  return {
    total: enrollments.length,
    graded: gradesWithScore.length,
    excellentRate,
    passRate,
    averageScore,
    publishedCount,
    unpublishedCount
  };
};

// 检查课程是否异常
const checkCourseAnomaly = (courseId, stats) => {
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  const anomalies = [];
  
  // 课程维度：优秀率>40%或及格率<60%
  if (stats.excellentRate > 40) {
    anomalies.push({ type: "excellent", message: `优秀率过高：${stats.excellentRate.toFixed(1)}%` });
  }
  if (stats.passRate < 60 && stats.graded > 0) {
    anomalies.push({ type: "pass", message: `及格率过低：${stats.passRate.toFixed(1)}%` });
  }
  
  // 学生维度：平均分异常（与往年平均分比较）
  if (course && course.historicalAverage !== undefined && course.historicalAverage !== null) {
    const diff = stats.averageScore - course.historicalAverage;
    const diffPercent = (diff / course.historicalAverage) * 100;
    if (Math.abs(diffPercent) > 20) { // 差异超过20%
      anomalies.push({ 
        type: "average", 
        message: `平均分异常：当前${stats.averageScore.toFixed(1)}分，往年${course.historicalAverage}分，差异${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}%` 
      });
    }
  }
  
  return anomalies;
};

// 渲染课程成绩列表
const renderGradeCourses = (searchTerm = "") => {
  const data = getData();
  const courses = data.courses || [];
  let filtered = courses;
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = courses.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.code.toLowerCase().includes(term)
    );
  }
  
  gradeCourseList.innerHTML = "";
  if (filtered.length === 0) {
    gradeCourseList.innerHTML = "<div class='muted'>暂无课程数据</div>";
    return;
  }
  
  filtered.forEach(course => {
    const stats = calculateCourseStatistics(course.id);
    const anomalies = checkCourseAnomaly(course.id, stats);
    const hasAnomaly = anomalies.length > 0;
    
    const item = document.createElement("div");
    item.className = "list-item";
    if (hasAnomaly) {
      item.style.borderLeft = "4px solid #e74c3c";
      item.style.background = "#fff5f5";
    }
    
    let anomalyBadges = "";
    if (hasAnomaly) {
      anomalyBadges = anomalies.map(a => 
        `<span style="display: inline-block; margin-left: 0.5rem; padding: 0.2rem 0.5rem; background: #e74c3c; color: white; border-radius: 3px; font-size: 0.85em;">⚠️ ${a.message}</span>`
      ).join("");
    }
    
    const publishedStatus = stats.publishedCount > 0 
      ? `<span style="color: #27ae60;">已发布：${stats.publishedCount}人</span>` 
      : "";
    const unpublishedStatus = stats.unpublishedCount > 0 
      ? `<span style="color: #e67e22;">待审核：${stats.unpublishedCount}人</span>` 
      : "";
    
    item.innerHTML = `
      <div class="flex-between">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong>${course.name}</strong> <span class="muted">(${course.code})</span>
            ${hasAnomaly ? '<span style="color: #e74c3c; font-size: 1.2em;">⚠️</span>' : ''}
          </div>
          ${anomalyBadges}
          <p class="muted" style="margin-top: 0.5rem;">
            选课人数：${stats.total} | 已录入成绩：${stats.graded} | 
            优秀率（>90分）：${stats.excellentRate.toFixed(1)}% | 
            及格率（≥60分）：${stats.passRate.toFixed(1)}% | 
            平均分：${stats.averageScore.toFixed(1)}分
            ${course.historicalAverage !== undefined && course.historicalAverage !== null 
              ? ` | 往年平均分：${course.historicalAverage}分` 
              : ''}
          </p>
          <p class="muted">
            ${publishedStatus} ${unpublishedStatus ? ' | ' + unpublishedStatus : ''}
          </p>
        </div>
        <div>
          <button class="mini" data-view-grade="${course.id}">查看详情</button>
        </div>
      </div>
    `;
    gradeCourseList.appendChild(item);
  });
  
  bindGradeCourseActions();
};

// 绑定课程操作
const bindGradeCourseActions = () => {
  gradeCourseList.querySelectorAll("[data-view-grade]").forEach(btn => {
    btn.addEventListener("click", () => {
      const courseId = btn.dataset.viewGrade;
      renderGradeDetail(courseId);
    });
  });
};

// 渲染课程成绩详情
const renderGradeDetail = (courseId) => {
  currentGradeCourseId = courseId;
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  if (!course) return;
  
  // 设置往年平均分输入框的值
  if (setHistoricalAverageInput) {
    setHistoricalAverageInput.value = course.historicalAverage !== undefined && course.historicalAverage !== null 
      ? course.historicalAverage 
      : "";
  }
  
  const enrollments = (data.enrollments || []).filter(e => e.courseId === courseId);
  const stats = calculateCourseStatistics(courseId);
  const anomalies = checkCourseAnomaly(courseId, stats);
  
  // 设置标题
  gradeDetailTitle.textContent = `${course.name} (${course.code}) - 成绩详情`;
  
  // 显示统计信息
  let statsHtml = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div><strong>选课人数：</strong>${stats.total}</div>
      <div><strong>已录入成绩：</strong>${stats.graded}</div>
      <div><strong>优秀率（>90分）：</strong>${stats.excellentRate.toFixed(1)}%</div>
      <div><strong>及格率（≥60分）：</strong>${stats.passRate.toFixed(1)}%</div>
      <div><strong>平均分：</strong>${stats.averageScore.toFixed(1)}分</div>
      ${course.historicalAverage !== undefined && course.historicalAverage !== null 
        ? `<div><strong>往年平均分：</strong>${course.historicalAverage}分</div>` 
        : ''}
      <div><strong>已发布：</strong>${stats.publishedCount}人</div>
      <div><strong>待审核：</strong>${stats.unpublishedCount}人</div>
    </div>
  `;
  
  if (anomalies.length > 0) {
    statsHtml += `
      <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
        <strong style="color: #856404;">⚠️ 异常提醒：</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; color: #856404;">
          ${anomalies.map(a => `<li>${a.message}</li>`).join("")}
        </ul>
      </div>
    `;
  }
  
  gradeStatistics.innerHTML = statsHtml;
  
  // 显示学生成绩列表
  gradeDetailTable.innerHTML = "";
  if (enrollments.length === 0) {
    gradeDetailTable.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 1rem;' class='muted'>暂无选课学生</td></tr>";
  } else {
    enrollments.forEach(enrollment => {
      const student = data.users.find(u => u.id === enrollment.studentId);
      if (!student) return;
      
      const tr = document.createElement("tr");
      const grade = enrollment.finalGrade !== null && enrollment.finalGrade !== undefined ? enrollment.finalGrade : "-";
      const status = enrollment.published ? "已发布" : (enrollment.finalGrade !== null && enrollment.finalGrade !== undefined ? "待审核" : "未录入");
      const statusColor = enrollment.published ? "#27ae60" : (enrollment.finalGrade !== null && enrollment.finalGrade !== undefined ? "#e67e22" : "#95a5a6");
      
      tr.innerHTML = `
        <td style="border: 1px solid #ddd; padding: 0.5rem;">${student.username}</td>
        <td style="border: 1px solid #ddd; padding: 0.5rem;">${student.name}</td>
        <td style="border: 1px solid #ddd; padding: 0.5rem;">${student.className || "未分配"}</td>
        <td style="border: 1px solid #ddd; padding: 0.5rem;">${grade}</td>
        <td style="border: 1px solid #ddd; padding: 0.5rem; color: ${statusColor};">${status}</td>
        <td style="border: 1px solid #ddd; padding: 0.5rem;">
          ${!enrollment.published && enrollment.finalGrade !== null && enrollment.finalGrade !== undefined
            ? `<button class="mini" data-approve-grade="${enrollment.id}">审核通过</button>`
            : enrollment.published
            ? `<span class="muted">已发布</span>`
            : `<span class="muted">未录入</span>`}
        </td>
      `;
      gradeDetailTable.appendChild(tr);
    });
    
    // 绑定审核按钮
    gradeDetailTable.querySelectorAll("[data-approve-grade]").forEach(btn => {
      btn.addEventListener("click", () => {
        const enrollmentId = btn.dataset.approveGrade;
        approveGrade(enrollmentId);
      });
    });
  }
  
  gradeDetailPanel.style.display = "block";
  gradeDetailPanel.scrollIntoView({ behavior: "smooth" });
};

// 审核通过单个成绩
const approveGrade = (enrollmentId) => {
  const data = getData();
  const enrollment = data.enrollments.find(e => e.id === enrollmentId);
  if (!enrollment) return;
  
  if (enrollment.finalGrade === null || enrollment.finalGrade === undefined) {
    alert("该学生成绩尚未录入");
    return;
  }
  
  if (enrollment.published) {
    alert("该成绩已经发布");
    return;
  }
  
  enrollment.published = true;
  saveData(data);
  // 获取课程名称和学生名称
  const course = data.courses.find(c => c.id === enrollment.courseId);
  const student = data.users.find(u => u.id === enrollment.studentId);
  const courseName = course ? course.name : enrollment.courseId;
  const studentName = student ? student.name : enrollment.studentId;
  addLog(currentUser.id, "审核通过成绩", `课程 ${courseName} 学生 ${studentName} 成绩 ${enrollment.finalGrade}`);
  
  // 刷新详情和列表
  renderGradeDetail(currentGradeCourseId);
  renderGradeCourses(gradeCourseSearch.value);
};

// 批量审核通过
gradeApproveAllBtn?.addEventListener("click", () => {
  if (!currentGradeCourseId) return;
  
  const data = getData();
  const enrollments = data.enrollments.filter(e => 
    e.courseId === currentGradeCourseId && 
    !e.published && 
    e.finalGrade !== null && 
    e.finalGrade !== undefined
  );
  
  if (enrollments.length === 0) {
    alert("没有待审核的成绩");
    return;
  }
  
  if (!confirm(`确定要批量审核通过 ${enrollments.length} 条成绩吗？`)) {
    return;
  }
  
  enrollments.forEach(enrollment => {
    enrollment.published = true;
  });
  
  saveData(data);
  // 获取课程名称
  const course = data.courses.find(c => c.id === currentGradeCourseId);
  const courseName = course ? course.name : currentGradeCourseId;
  addLog(currentUser.id, "批量审核通过成绩", `课程 ${courseName} 共 ${enrollments.length} 条成绩`);
  
  // 刷新详情和列表
  renderGradeDetail(currentGradeCourseId);
  renderGradeCourses(gradeCourseSearch.value);
});

// 设置往年平均分
saveHistoricalAverageBtn?.addEventListener("click", () => {
  if (!currentGradeCourseId) return;
  
  const value = setHistoricalAverageInput.value.trim();
  const historicalAverage = value ? Number(value) : null;
  
  if (value && (isNaN(historicalAverage) || historicalAverage < 0 || historicalAverage > 100)) {
    alert("请输入0-100之间的有效数字");
    return;
  }
  
  const data = getData();
  const course = data.courses.find(c => c.id === currentGradeCourseId);
  if (!course) return;
  
  course.historicalAverage = historicalAverage;
  saveData(data);
  addLog(currentUser.id, "设置课程往年平均分", `${course.name} (${course.code}): ${historicalAverage !== null ? historicalAverage + '分' : '已清除'}`);
  
  // 刷新详情和列表
  renderGradeDetail(currentGradeCourseId);
  renderGradeCourses(gradeCourseSearch.value);
  
  alert(historicalAverage !== null ? `已设置往年平均分为 ${historicalAverage} 分` : "已清除往年平均分");
});

// 关闭详情
gradeCloseDetailBtn?.addEventListener("click", () => {
  gradeDetailPanel.style.display = "none";
  currentGradeCourseId = null;
  setHistoricalAverageInput.value = "";
});

// 搜索课程
gradeCourseSearch?.addEventListener("input", e => {
  renderGradeCourses(e.target.value);
});

// ==================== 初始化 ====================
const init = async () => {
  currentUser = await requireAuth(["admin"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("admin");
  
  // 初始化渲染
  renderClasses();
  renderClassSelect();
  renderStudents();
  renderTeacherSelect();
  renderCourses();
  renderAdminSchedule();
  renderTeachers();
  renderRelationClassSelect();
  renderRelationCourseSelect();
  renderRelationCourseStudentsSelect();
  renderGradeCourses();
};

init();

