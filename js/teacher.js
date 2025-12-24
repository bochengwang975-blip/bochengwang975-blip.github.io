import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import {
    addCourse,
    addTaskToCourse,
    getCourseEnrollments,
    recordTaskScore,
    publishFinalGrade,
    updateCourse,
    deleteCourse,
    addCourseMaterial
} from "./courses.js";
import { setupNav } from "./common.js";
import { checkScheduleConflict, generateWeeklySchedule, formatTime } from "./schedule.js";
import { uuid } from "./utils.js";

const courseList = document.getElementById("teacher-courses");
const courseForm = document.getElementById("course-form");
const taskForm = document.getElementById("task-form");
const taskSelect = document.getElementById("task-course");
const gradeSelect = document.getElementById("grade-course");
const taskList = document.getElementById("task-list");
const gradeRows = document.getElementById("grade-rows");
const headerUserName = document.getElementById("header-user-name");

const manageSection = document.getElementById("course-manage-section");
const previewModal = document.getElementById("preview-modal");
const editModal = document.getElementById("edit-modal");
const draftMsg = document.getElementById("draft-msg");

const gradingModal = document.getElementById("grading-modal");
const gradeStudentName = document.getElementById("grade-student-name");
const gradeTaskTitle = document.getElementById("grade-task-title");
const gradeSubmissionContent = document.getElementById("grade-submission-content");
const gradeSubmitTime = document.getElementById("grade-submit-time");
const gradeScoreInput = document.getElementById("grade-score-input");
const btnConfirmGrade = document.getElementById("btn-confirm-grade");

const btnDownloadTemplate = document.getElementById("btn-download-template");
const fileInputImport = document.getElementById("excel-import-input");
const btnTriggerImport = document.getElementById("btn-trigger-import");
const importStatus = document.getElementById("import-status");

const bannerUpload = document.getElementById("banner-upload");
const btnSaveBanner = document.getElementById("btn-save-banner");
const btnRemoveBanner = document.getElementById("btn-remove-banner");
const currentBannerImg = document.getElementById("current-banner-img");
const noBannerText = document.getElementById("no-banner-text");

const navButtons = document.querySelectorAll(".nav-btn");
const moduleViews = document.querySelectorAll(".module-view");

let currentUser = null;
let currentCourseId = null;
let currentGradingInfo = null;

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

const initNavigation = () => {
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            moduleViews.forEach(view => {
                view.classList.remove("active");
                if (view.id === targetId) {
                    view.classList.add("active");
                }
            });
            if (targetId === 'module-tasks') { renderCourseSelects(); renderTasks(); }
            else if (targetId === 'module-grades') { renderCourseSelects(); renderGrades(); }
            else if (targetId === 'module-courses') { renderCourses(); }
            else if (targetId === 'module-schedule') { renderTeacherSchedule(); }
        });
    });
};

const DRAFT_KEY = "teacher_course_draft";
const saveDraft = () => {
    const formData = new FormData(courseForm);
    const data = Object.fromEntries(formData.entries());
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
};
const loadDraft = () => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
        const data = JSON.parse(draft);
        Object.keys(data).forEach(key => {
            const el = courseForm.elements[key];
            if (el) el.value = data[key];
        });
        draftMsg.classList.remove("hidden");
        checkTeacherConflict();
    }
};
const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    draftMsg.classList.add("hidden");
};
courseForm.addEventListener("input", saveDraft);

const renderCourses = () => {
  const data = getData();
  const courses = data.courses.filter(c => {
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    return teacherIds.includes(currentUser.id);
  });
  courseList.innerHTML = "";
  courses.forEach(c => {
    const item = document.createElement("div");
    item.className = "list-item";
    const timeStr = c.time ? formatTime(c.time) : (c.schedule || "未设置");
    const locationStr = c.location || (c.schedule ? "" : "未设置");
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${c.name}</strong> <span class="muted">${c.code}</span>
          <p class="muted">${c.summary}</p>
          <p class="muted">时间：${timeStr} | 地点：${locationStr}</p>
          <div class="flex">
            <span class="chip">学分 ${c.credits}</span>
            <span class="chip">${c.department}</span>
          </div>
        </div>
        <button class="mini" data-choose="${c.id}">管理</button>
      </div>
    `;
    courseList.appendChild(item);
  });
  if (courses.length > 0 && !currentCourseId) currentCourseId = courses[0].id;
  bindCourseButtons();
  renderCourseSelects();
  if (currentCourseId) renderCourseManager(currentCourseId);
};

const bindCourseButtons = () => {
  courseList.querySelectorAll("[data-choose]").forEach(btn =>
    btn.addEventListener("click", () => {
      currentCourseId = btn.dataset.choose;
      document.querySelector('[data-target="module-courses"]').click();
      renderCourseManager(currentCourseId);
      renderCourseSelects();
      manageSection.classList.remove("hidden");
      manageSection.scrollIntoView({ behavior: 'smooth' });
    })
  );
};

const renderCourseManager = (courseId) => {
    const data = getData();
    const course = data.courses.find(c => c.id === courseId);
    if (!course) {
        manageSection.classList.add("hidden");
        return;
    }
    manageSection.classList.remove("hidden");
    document.getElementById("manage-title").textContent = `${course.name} (${course.code})`;
    document.getElementById("manage-info").innerHTML = `
        <strong>时间：</strong>${course.time ? formatTime(course.time) : "未设置"} &nbsp;|&nbsp;
        <strong>地点：</strong>${course.location} &nbsp;|&nbsp;
        <strong>学分：</strong>${course.credits}
    `;
    document.getElementById("manage-summary").textContent = course.summary || "暂无简介";

    if (course.banner) {
        currentBannerImg.src = course.banner;
        currentBannerImg.style.display = "block";
        noBannerText.style.display = "none";
        btnRemoveBanner.style.display = "block";
    } else {
        currentBannerImg.src = "";
        currentBannerImg.style.display = "none";
        noBannerText.style.display = "block";
        btnRemoveBanner.style.display = "none";
    }

    const matList = document.getElementById("material-list");
    matList.innerHTML = "";
    if (course.materials && course.materials.length > 0) {
        course.materials.forEach(m => {
            const div = document.createElement("div");
            div.className = "list-item flex-between";
            div.style.padding = "8px";
            let icon = "📄";
            if (m.type.startsWith("image")) icon = "🖼️";
            if (m.type.startsWith("video") || m.type.startsWith("audio")) icon = "🎬";
            div.innerHTML = `
                <span>${icon} <a href="${m.url}" target="_blank">${m.title}</a></span>
                <span class="muted" style="font-size:12px">${m.date || "2025/12/20"}</span>
            `;
            matList.appendChild(div);
        });
    } else {
        matList.innerHTML = "<p class='muted'>暂无课件资料</p>";
    }

    document.getElementById("btn-edit-course").onclick = () => {
        const form = document.getElementById("edit-form");
        form.id.value = course.id;
        form.name.value = course.name;
        form.location.value = course.location;
        form.summary.value = course.summary;
        editModal.classList.remove("hidden");
    };

    document.getElementById("btn-delete-course").onclick = async () => {
        if (confirm(`确定要删除课程 "${course.name}" 吗？`)) {
            await deleteCourse(course.id, currentUser.id);
            alert("课程已删除");
            currentCourseId = null;
            renderCourses();
            renderTeacherSchedule();
        }
    };
};

btnSaveBanner.addEventListener("click", async () => {
    if (!currentCourseId) return alert("请先选择课程");
    const file = bannerUpload.files[0];
    if (!file) return alert("请先选择图片文件");

    try {
        const base64String = await fileToBase64(file);
        await updateCourse(currentCourseId, { banner: base64String, id: currentCourseId });
        alert("轮播图设置成功！请前往首页查看效果。");
        bannerUpload.value = "";
        renderCourseManager(currentCourseId);
    } catch (e) {
        alert("保存失败，图片可能过大");
        console.error(e);
    }
});

btnRemoveBanner.addEventListener("click", async () => {
    if (!currentCourseId) return;
    if(confirm("确定要移除轮播图吗？")) {
        await updateCourse(currentCourseId, { banner: null, id: currentCourseId });
        renderCourseManager(currentCourseId);
    }
});

document.getElementById("btn-upload").addEventListener("click", async () => {
    const fileInput = document.getElementById("file-upload");
    if (fileInput.files.length === 0) return alert("请选择文件");
    const file = fileInput.files[0];
    await addCourseMaterial(currentCourseId, file, currentUser.id);
    fileInput.value = "";
    renderCourseManager(currentCourseId);
});

document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = Object.fromEntries(formData.entries());
    const id = updates.id;
    await updateCourse(id, updates);
    editModal.classList.add("hidden");
    renderCourses();
    renderCourseManager(id);
    renderTeacherSchedule();
});

const renderCourseSelects = () => {
  const data = getData();
  const courses = data.courses.filter(c => {
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    return teacherIds.includes(currentUser.id);
  });

  [taskSelect, gradeSelect].forEach(select => {
    const currentVal = select.value || currentCourseId;
    select.innerHTML = "";
    courses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  });

  if (courses.length && (!currentCourseId || !courses.find(c=>c.id === currentCourseId))) {
      currentCourseId = courses[0].id;
  }
};

const checkTeacherConflict = () => {
  const timeDay = document.getElementById("teacher-course-time-day")?.value;
  const timePeriod = document.getElementById("teacher-course-time-period")?.value;
  const location = document.getElementById("teacher-course-location")?.value?.trim();
  const warningDiv = document.getElementById("teacher-schedule-conflict-warning");
  if (!timeDay || !timePeriod || !warningDiv) return;
  const newCourse = { id: null, time: { day: parseInt(timeDay), period: parseInt(timePeriod) }, location, teacherIds: [currentUser.id] };
  const conflictResult = checkScheduleConflict(newCourse);
  if (conflictResult.hasConflict) {
    warningDiv.style.display = "block";
    warningDiv.textContent = `⚠️ 排课冲突：${conflictResult.conflicts.map(c => c.message).join("；")}`;
    warningDiv.style.background = "#fff3cd"; warningDiv.style.borderColor = "#ffc107"; warningDiv.style.color = "#856404";
  } else { warningDiv.style.display = "none"; }
};
document.getElementById("teacher-course-time-day")?.addEventListener("change", checkTeacherConflict);
document.getElementById("teacher-course-time-period")?.addEventListener("change", checkTeacherConflict);
document.getElementById("teacher-course-location")?.addEventListener("input", checkTeacherConflict);

document.getElementById("btn-preview").addEventListener("click", () => {
    const formData = new FormData(courseForm);
    const data = Object.fromEntries(formData.entries());
    if (!data.name || !data["time-day"] || !data["time-period"] || !data.location) { return alert("请填写完整的课程信息"); }
    const timeStr = formatTime({ day: parseInt(data["time-day"]), period: parseInt(data["time-period"]) });

    document.getElementById("preview-content").innerHTML = `
        <p><strong>课程名称：</strong> ${data.name}</p>
        <p><strong>时间地点：</strong> ${timeStr} @ ${data.location}</p>
        <p><strong>课程简介：</strong> ${data.summary || "无"}</p>
    `;
    previewModal.classList.remove("hidden");
});
document.getElementById("btn-confirm-create").addEventListener("click", () => { previewModal.classList.add("hidden"); courseForm.requestSubmit(); });

courseForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(courseForm);
  const timeDay = form.get("time-day");
  const timePeriod = form.get("time-period");
  const location = form.get("location")?.trim();
  const newCourse = { id: null, time: { day: parseInt(timeDay), period: parseInt(timePeriod) }, location, teacherIds: [currentUser.id] };

  const conflictResult = checkScheduleConflict(newCourse);
  if (conflictResult.hasConflict) { if (!confirm(`检测到冲突，是否继续？`)) return; }

  const payload = Object.fromEntries(form.entries());
  payload.time = newCourse.time;
  payload.location = location;

  const bannerInput = document.getElementById("create-banner-input");
  if (bannerInput.files.length > 0) {
      try {
          const bannerBase64 = await fileToBase64(bannerInput.files[0]);
          payload.banner = bannerBase64;
      } catch (err) {
          console.error("图片处理失败", err);
          alert("图片处理失败，课程将不带轮播图创建");
      }
  }

  await addCourse(payload, currentUser.id);
  clearDraft();
  courseForm.reset();
  bannerInput.value = "";
  document.getElementById("teacher-schedule-conflict-warning").style.display = "none";
  alert("课程创建成功！");
  document.querySelector('[data-target="module-courses"]').click();
});

const renderTasks = () => {
  const data = getData();
  const courseId = taskSelect.value;
  const course = data.courses.find(c => c.id === courseId);
  if (!course) { taskList.innerHTML = "<div class='muted'>请选择课程</div>"; return; }
  taskList.innerHTML = "";
  course.tasks.forEach(t => {
    const item = document.createElement("div");
    item.className = "list-item";
    const weightPercent = t.weight ? `${Math.round(t.weight * 100)}%` : "0%";
    item.innerHTML = `<strong>${t.title}</strong> <span class="muted">${t.type}</span> 截止 ${t.due} | 权重 <span class="pill">${weightPercent}</span> <p class="muted">${t.description}</p>`;
    taskList.appendChild(item);
  });
};

taskForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(taskForm);
  const payload = Object.fromEntries(form.entries());
  await addTaskToCourse(taskSelect.value, payload, currentUser.id);

  const data = getData();
  const course = data.courses.find(c => c.id === taskSelect.value);
  data.enrollments.filter(e => e.courseId === course.id).forEach(e => {
      if (!e.tasks.some(t => t.taskId === course.tasks.slice(-1)[0].id)) e.tasks.push({ taskId: course.tasks.slice(-1)[0].id, score: null, status: "未开始" });
  });
  saveData(data);
  addLog(currentUser.id, "新增任务同步", `课程 ${course.name} 的选课记录同步任务`);
  taskForm.reset();
  renderTasks();
});

const calculateWeightedScore = (course, enrollment) => {
    let total = 0;
    course.tasks.forEach(taskDef => {
        const studentTask = enrollment.tasks.find(t => t.taskId === taskDef.id);
        const score = studentTask ? (Number(studentTask.score) || 0) : 0;
        const weight = Number(taskDef.weight) || 0;
        total += score * weight;
    });
    return Math.round(total * 10) / 10;
};

const renderGrades = async () => {
  const data = getData();
  const courseId = gradeSelect.value;
  const course = data.courses.find(c => c.id === courseId);
  if (!course) return;
  const enrollments = await getCourseEnrollments(courseId);
  gradeRows.innerHTML = "";

  enrollments.forEach(e => {
    const student = data.users.find(u => String(u.id) === String(e.studentId));

    const studentName = student ? student.name : "未知学生";
    const studentIdDisplay = e.studentId || "无ID";
    const className = student ? (student.className || "暂无班级") : "-";

    const calculatedGrade = calculateWeightedScore(course, e);

    const taskDetails = e.tasks.map(t => {
        const taskDef = course.tasks.find(ct => ct.id === t.taskId);

        if (!taskDef) return "";

        let statusIcon = t.status === "已评分" ? "✅" : (t.status === "已提交" ? "📄" : "⏳");
        let actionBtn = "";
        if (t.status === "已评分") {
            actionBtn = `<div style="font-weight:bold; color:#2c8f5f; margin-right:8px;">${t.score} 分</div><button class="mini secondary" style="padding:2px 6px;" data-grade-action="review" data-enroll-id="${e.id}" data-task-id="${t.taskId}" data-student-name="${studentName}">修改</button>`;
        } else if (t.status === "已提交") {
            actionBtn = `<button class="mini" style="background:var(--accent); color:white; padding:4px 10px;" data-grade-action="grade" data-enroll-id="${e.id}" data-task-id="${t.taskId}" data-student-name="${studentName}">批阅</button>`;
        } else {
            actionBtn = `<span class="muted" style="font-size:12px;">待提交</span>`;
        }
        return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px 10px; background:#fff; border:1px solid #eee; border-radius:8px;">
                <div style="flex:1;"><div style="font-weight:600; font-size:13px; color:#333;">${taskDef.title}</div></div>
                <div style="display:flex; align-items:center;">${actionBtn}</div></div>`;
    }).join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="vertical-align: top;">
        <strong>${studentName}</strong><br>
        <span class="muted">${studentIdDisplay}</span>
        <div class="muted" style="font-size:0.8em; margin-top:2px;">${className}</div>
      </td>
      <td style="vertical-align: top;">${taskDetails}</td>
      <td style="vertical-align: top;"><input type="text" readonly data-final="${e.id}" value="${calculatedGrade}" style="width: 100%; font-size:18px; font-weight:bold; color:var(--accent); text-align:center; background:#f5f5f5; border:1px solid #ddd;" /><button class="mini" data-publish="${e.id}" style="width:100%; margin-top:5px;">发布</button></td>`;
    gradeRows.appendChild(tr);
  });

  gradeRows.querySelectorAll("[data-grade-action]").forEach(btn => {
      btn.addEventListener("click", () => openGradingModal(btn.dataset.enrollId, btn.dataset.taskId, btn.dataset.studentName));
  });
  gradeRows.querySelectorAll("[data-publish]").forEach(btn =>
    btn.addEventListener("click", async () => {
        const id = btn.dataset.publish;
        const enrollment = (await getCourseEnrollments(courseId)).find(e => e.id === id);
        const grade = gradeRows.querySelector(`[data-final='${id}']`).value;
        await publishFinalGrade(courseId, enrollment.studentId, grade, currentUser.id);
        renderGrades();
    })
  );
};

btnDownloadTemplate.addEventListener("click", async () => {
    if (!currentCourseId) return alert("请先选择课程");
    const data = getData();
    const course = data.courses.find(c => c.id === currentCourseId);
    const enrollments = await getCourseEnrollments(currentCourseId);
    const headers = ["学号", "姓名", ...course.tasks.map(t=>t.title)];
    const rows = enrollments.map(e => {
        const student = data.users.find(u => u.id === e.studentId);
        const row = [e.studentId, student?.name || "未知"];
        course.tasks.forEach(t => {
            const taskRecord = e.tasks.find(tr => tr.taskId === t.id);
            row.push(taskRecord?.score || "");
        });
        return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "成绩单");
    XLSX.writeFile(wb, `${course.name}_成绩.xlsx`);
});

btnTriggerImport.addEventListener("click", () => fileInputImport.click());
fileInputImport.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importStatus.textContent = "读取中...";
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            await processGradeImport(jsonData);
            importStatus.textContent = "导入成功";
            fileInputImport.value = "";
            renderGrades();
            setTimeout(() => { importStatus.textContent = ""; }, 3000);
        } catch (error) { console.error(error); importStatus.textContent = "导入失败"; }
    };
    reader.readAsArrayBuffer(file);
});

const processGradeImport = async (jsonData) => {
    const data = getData();
    const course = data.courses.find(c => c.id === currentCourseId);
    for (const row of jsonData) {
        const studentId = row["学号"] || row["Student ID"];
        const studentName = row["姓名"] || row["Name"];
        if (!studentId) continue;
        const sIdStr = String(studentId);
        let user = data.users.find(u => u.id === sIdStr);
        if (!user) {
            user = { id: sIdStr, username: sIdStr, passwordHash: "placeholder", salt: "placeholder", name: studentName || sIdStr, email: `${sIdStr}@campus.edu`, role: "student", className: "导入班级", major: "未知" };
            data.users.push(user);
        }
        let enrollment = data.enrollments.find(e => e.courseId === currentCourseId && e.studentId === sIdStr);
        if (!enrollment) {
            enrollment = { id: uuid(), courseId: currentCourseId, studentId: sIdStr, progress: 0, tasks: [], finalGrade: null, published: false, comments: "" };
            data.enrollments.push(enrollment);
        }
        if (row["期末总评"] !== undefined && row["期末总评"] !== "") {
            enrollment.finalGrade = Number(row["期末总评"]);
        }
        course.tasks.forEach(task => {
            const score = row[task.title];
            if (score !== undefined && score !== "") {
                let taskRecord = enrollment.tasks.find(t => t.taskId === task.id);
                if (!taskRecord) { taskRecord = { taskId: task.id, score: null, status: "未开始" }; enrollment.tasks.push(taskRecord); }
                taskRecord.score = Number(score); taskRecord.status = "已评分";
            }
        });
    }
    saveData(data);
};

const openGradingModal = async (enrollId, taskId, studentName) => {
    const data = getData();
    const course = data.courses.find(c => c.id === currentCourseId);
    const taskDef = course.tasks.find(t => t.id === taskId);
    const enrollment = data.enrollments.find(e => e.id === enrollId);
    const taskRecord = enrollment.tasks.find(t => t.taskId === taskId);
    currentGradingInfo = { courseId: currentCourseId, studentId: enrollment.studentId, taskId: taskId };
    gradeStudentName.textContent = `学生：${studentName}`;
    gradeTaskTitle.textContent = `任务：${taskDef.title}`;
    gradeScoreInput.value = taskRecord.score || "";
    gradeSubmissionContent.innerHTML = `<p>模拟学生提交的作业内容...</p>`;
    gradeSubmitTime.textContent = new Date().toLocaleString();
    gradingModal.classList.remove("hidden");
};
btnConfirmGrade.addEventListener("click", async () => {
    if (!currentGradingInfo) return;
    const score = gradeScoreInput.value;
    if (score === "" || score < 0 || score > 100) return alert("无效分数");
    await recordTaskScore(currentGradingInfo.courseId, currentGradingInfo.studentId, currentGradingInfo.taskId, score, currentUser.id);
    gradingModal.classList.add("hidden");
    currentGradingInfo = null;
    renderGrades();
});

const renderTeacherSchedule = () => {
  if (!document.getElementById("teacher-schedule-view")) return;
  const scheduleData = generateWeeklySchedule(currentUser.id, "teacher");
  const { schedule } = scheduleData;

  let html = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; table-layout: fixed;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 10%;">时间</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 18%;">周一</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 18%;">周二</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 18%;">周三</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 18%;">周四</th>
          <th style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; width: 18%;">周五</th>
        </tr>
      </thead>
      <tbody>
  `;

  const periodLabels = ["上午第1节", "上午第2节", "下午第1节", "下午第2节", "晚上"];

  for (let period = 0; period < 5; period++) {
    html += `<tr>`;
    html += `<td style="border: 1px solid #ddd; padding: 0.5rem; background: #f5f5f5; font-weight: bold; height: 100px;">${periodLabels[period]}</td>`;

    for (let day = 0; day < 5; day++) {
      const cellContent = schedule[day][period];
      html += `<td style="border: 1px solid #ddd; padding: 0.5rem; vertical-align: top; height: 100px; overflow: hidden;">`;

      if (cellContent && Array.isArray(cellContent) && cellContent.length > 0) {
        cellContent.forEach(item => {
          html += `
            <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #e3f2fd; border-radius: 4px; font-size: 0.9em;">
              <strong>${item.course.name}</strong><br/>
              <span class="muted">${item.course.code}</span><br/>
              <span class="muted">${item.location}</span>
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
  document.getElementById("teacher-schedule-view").innerHTML = html;
};

const init = async () => {
  currentUser = await requireAuth(["teacher"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("teacher");
  headerUserName.textContent = `${currentUser.name} (${currentUser.username})`;
  initNavigation();
  loadDraft();
  renderCourses();
};
init();

taskSelect?.addEventListener("change", () => { currentCourseId = taskSelect.value; renderTasks(); });
gradeSelect?.addEventListener("change", () => { currentCourseId = gradeSelect.value; renderGrades(); });