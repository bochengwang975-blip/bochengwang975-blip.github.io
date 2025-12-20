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

const courseList = document.getElementById("teacher-courses");
const courseForm = document.getElementById("course-form");
const taskForm = document.getElementById("task-form");
const taskSelect = document.getElementById("task-course");
const gradeSelect = document.getElementById("grade-course");
const taskList = document.getElementById("task-list");
const gradeRows = document.getElementById("grade-rows");
const infoBox = document.getElementById("teacher-info");

const manageSection = document.getElementById("course-manage-section");
const previewModal = document.getElementById("preview-modal");
const editModal = document.getElementById("edit-modal");
const draftMsg = document.getElementById("draft-msg");

let currentUser = null;
let currentCourseId = null;

// 草稿箱
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
  const first = courses[0];
  if (first && !currentCourseId) currentCourseId = first.id;
  bindCourseButtons();
  renderCourseSelects();
  renderTasks();
  renderGrades();

  if (currentCourseId) {
    renderCourseManager(currentCourseId);
  } else {
    manageSection.classList.add("hidden");
  }
};

const bindCourseButtons = () => {
  courseList.querySelectorAll("[data-choose]").forEach(btn =>
    btn.addEventListener("click", () => {
      currentCourseId = btn.dataset.choose;
      renderCourseSelects();
      renderCourseManager(currentCourseId);
      renderTasks();
      renderGrades();
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
        if (confirm(`确定要删除课程 "${course.name}" 吗？此操作不可恢复，且会删除相关的选课和成绩记录！`)) {
            await deleteCourse(course.id, currentUser.id);
            alert("课程已删除");
            currentCourseId = null;
            renderCourses();
            renderTeacherSchedule();
        }
    };
};

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
    renderTeacherSchedule();
});

const renderCourseSelects = () => {
  const data = getData();
  const courses = data.courses.filter(c => {
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    return teacherIds.includes(currentUser.id);
  });
  [taskSelect, gradeSelect].forEach(select => {
    select.innerHTML = "";
    courses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === currentCourseId) opt.selected = true;
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

  const newCourse = {
    id: null,
    time: { day: parseInt(timeDay), period: parseInt(timePeriod) },
    location,
    teacherIds: [currentUser.id]
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

document.getElementById("teacher-course-time-day")?.addEventListener("change", checkTeacherConflict);
document.getElementById("teacher-course-time-period")?.addEventListener("change", checkTeacherConflict);
document.getElementById("teacher-course-location")?.addEventListener("input", checkTeacherConflict);

document.getElementById("btn-preview").addEventListener("click", () => {
    const formData = new FormData(courseForm);
    const data = Object.fromEntries(formData.entries());
    if (!data.name || !data["time-day"] || !data["time-period"] || !data.location) {
        alert("请填写完整的课程名称、时间及地点");
        return;
    }
    const timeStr = formatTime({ day: parseInt(data["time-day"]), period: parseInt(data["time-period"]) });
    document.getElementById("preview-content").innerHTML = `
        <p><strong>课程名称：</strong> ${data.name}</p>
        <p><strong>课程代码：</strong> ${data.code || "自动生成"}</p>
        <p><strong>院系：</strong> ${data.department}</p>
        <p><strong>时间地点：</strong> ${timeStr} @ ${data.location}</p>
        <p><strong>简介：</strong> ${data.summary || "无"}</p>
    `;
    previewModal.classList.remove("hidden");
});

document.getElementById("btn-confirm-create").addEventListener("click", () => {
    previewModal.classList.add("hidden");
    courseForm.requestSubmit();
});

courseForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(courseForm);
  const timeDay = form.get("time-day");
  const timePeriod = form.get("time-period");
  const location = form.get("location")?.trim();

  const newCourse = {
    id: null,
    time: { day: parseInt(timeDay), period: parseInt(timePeriod) },
    location,
    teacherIds: [currentUser.id]
  };

  const conflictResult = checkScheduleConflict(newCourse);
  if (conflictResult.hasConflict) {
    const messages = conflictResult.conflicts.map(c => c.message).join("；");
    if (!confirm(`检测到排课冲突：${messages}\n\n是否仍要继续创建课程？`)) {
      return;
    }
  }

  const payload = Object.fromEntries(form.entries());
  payload.time = newCourse.time;
  payload.location = location;
  await addCourse(payload, currentUser.id);
  clearDraft();
  courseForm.reset();
  document.getElementById("teacher-schedule-conflict-warning").style.display = "none";
  renderCourses();
  renderTeacherSchedule();
});

const renderTasks = () => {
  const data = getData();
  const course = data.courses.find(c => c.id === taskSelect.value);
  if (!course) {
    taskList.innerHTML = "<div class='muted'>请选择课程</div>";
    return;
  }
  taskList.innerHTML = "";
  course.tasks.forEach(t => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<strong>${t.title}</strong> <span class="muted">${t.type}</span> 截止 ${t.due} | 权重 ${t.weight || "-"} <p class="muted">${t.description}</p>`;
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
  data.enrollments
    .filter(e => e.courseId === course.id)
    .forEach(e => {
      const exists = e.tasks.some(t => t.taskId === course.tasks.slice(-1)[0].id);
      if (!exists) e.tasks.push({ taskId: course.tasks.slice(-1)[0].id, score: null, status: "未开始" });
    });
  saveData(data);
  addLog(currentUser.id, "新增任务同步", `课程 ${course.name} 的选课记录同步任务`);

  taskForm.reset();
  renderTasks();
  renderGrades();
});

const renderGrades = async () => {
  const data = getData();
  const courseId = gradeSelect.value;
  const course = data.courses.find(c => c.id === courseId);
  if (!course) return;
  const enrollments = await getCourseEnrollments(courseId);
  gradeRows.innerHTML = "";

  enrollments.forEach(e => {
    const student = data.users.find(u => u.id === e.studentId);

    const taskDetails = e.tasks.map(t => {
        const taskDef = course.tasks.find(ct => ct.id === t.taskId);
        let statusIcon = "⏳";
        let statusColor = "#666";
        let statusBg = "#f0f0f0";

        if (t.status === "已评分") {
            statusIcon = "✅";
            statusColor = "#2c8f5f";
            statusBg = "rgba(44, 143, 95, 0.1)";
        } else if (t.status === "已提交") {
            statusIcon = "📄";
            statusColor = "#b8831d";
            statusBg = "rgba(184, 131, 29, 0.1)";
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px 10px; background:#fff; border:1px solid #eee; border-radius:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="flex:1; overflow:hidden; padding-right:10px;">
                    <div style="font-weight:600; font-size:13px; color:#333; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${taskDef?.title || "未知任务"}</div>
                    <div style="display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 6px; border-radius:4px; background:${statusBg}; color:${statusColor};">
                        ${statusIcon} ${t.status}
                    </div>
                </div>
                <div style="flex-shrink:0;">
                    <input type="number" value="${t.score ?? ''}" placeholder="-"
                        style="width:50px; padding:6px; border:1px solid #ddd; border-radius:6px; text-align:center; font-weight:bold; color:var(--accent); outline:none; transition:border 0.2s;"
                        onfocus="this.style.borderColor='var(--accent)'"
                        onblur="this.style.borderColor='#ddd'"
                        data-task-id="${t.taskId}" data-enroll-id="${e.id}">
                </div>
            </div>
        `;
    }).join("");

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(0,0,0,0.05)";

    tr.innerHTML = `
      <td style="vertical-align: top; padding: 15px 10px;">
        <div style="font-weight:bold; font-size:1.05em; color:var(--text); margin-bottom:4px;">${student?.name || e.studentId}</div>
        <div class="muted" style="font-size:0.85em; margin-bottom:2px;">${e.studentId}</div>
        <div class="muted" style="font-size:0.85em;">${student?.className || "未知班级"}</div>
      </td>

      <td style="vertical-align: top; padding: 10px;">
        <div style="background: rgba(139, 21, 55, 0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(139, 21, 55, 0.05);">
            ${taskDetails || "<div class='muted' style='text-align:center; padding:10px;'>暂无任务</div>"}
            <button class="mini secondary" style="width:100%; margin-top:8px; background:#fff; border:1px solid #eee; color:var(--accent);" data-save-all="${e.id}">💾 批量保存分数</button>
        </div>
      </td>

      <td style="vertical-align: top; padding: 15px 10px;">
        <div style="display:flex; flex-direction:column; gap:10px;">
            <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">期末总评</label>
                <input type="number" min="0" max="100" data-final="${e.id}" value="${e.finalGrade||''}" placeholder="0-100"
                    style="width: 100%; font-size:16px; font-weight:bold; color:var(--accent); text-align:center; padding:8px;" />
            </div>
            <button class="mini" data-publish="${e.id}" style="width:100%; padding:8px;">${e.published ? "更新发布" : "发布成绩"}</button>
            <div style="font-size:11px; color:${e.published ? '#2c8f5f' : '#999'}; text-align:center;">
                ${e.published ? "✅ 已同步给学生" : "🔒 仅教师可见"}
            </div>
        </div>
      </td>
    `;
    gradeRows.appendChild(tr);
  });

  gradeRows.querySelectorAll("[data-save-all]").forEach(btn =>
    btn.addEventListener("click", async () => {
        const enrollId = btn.dataset.saveAll;
        const inputs = gradeRows.querySelectorAll(`input[data-enroll-id='${enrollId}']`);
        let hasValue = false;

        for (const input of inputs) {
            const taskId = input.dataset.taskId;
            const score = input.value;
            if (score !== "") {
                hasValue = true;
                await recordTaskScore(courseId, enrollments.find(e=>e.id===enrollId).studentId, taskId, score, currentUser.id);
            }
        }
        if(hasValue) {
            alert("分数已保存");
            renderGrades();
        } else {
            alert("请先输入分数");
        }
    })
  );

  gradeRows.querySelectorAll("[data-publish]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.publish;
      const enrollment = (await getCourseEnrollments(courseId)).find(e => e.id === id);
      const grade = gradeRows.querySelector(`[data-final='${id}']`).value;
      if(grade === "") return alert("请输入期末成绩");
      await publishFinalGrade(courseId, enrollment.studentId, grade, currentUser.id);
      renderGrades();
    })
  );
};

const renderTeacherSchedule = () => {
  if (!document.getElementById("teacher-schedule-view")) return;
  const scheduleData = generateWeeklySchedule(currentUser.id, "teacher");
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
  infoBox.textContent = `${currentUser.name}（${currentUser.username}），邮箱：${currentUser.email}`;
  loadDraft();
  renderCourses();
  renderTeacherSchedule();
};

init();

taskSelect?.addEventListener("change", () => {
  currentCourseId = taskSelect.value;
  renderTasks();
});
gradeSelect?.addEventListener("change", () => {
  currentCourseId = gradeSelect.value;
  renderGrades();
});