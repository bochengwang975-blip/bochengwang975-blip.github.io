import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { addCourse, addTaskToCourse, getCourseEnrollments, recordTaskScore, publishFinalGrade } from "./courses.js";
import { setupNav } from "./common.js";
import { checkScheduleConflict, generateWeeklySchedule, formatTime, formatLocation } from "./schedule.js";

const courseList = document.getElementById("teacher-courses");
const courseForm = document.getElementById("course-form");
const taskForm = document.getElementById("task-form");
const taskSelect = document.getElementById("task-course");
const gradeSelect = document.getElementById("grade-course");
const taskList = document.getElementById("task-list");
const gradeRows = document.getElementById("grade-rows");
const infoBox = document.getElementById("teacher-info");

let currentUser = null;
let currentCourseId = null;

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
};

const bindCourseButtons = () => {
  courseList.querySelectorAll("[data-choose]").forEach(btn =>
    btn.addEventListener("click", () => {
      currentCourseId = btn.dataset.choose;
      renderCourseSelects();
      renderTasks();
      renderGrades();
    })
  );
};

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
  if (courses.length) currentCourseId = taskSelect.value;
};

// 教师端冲突检测
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

courseForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(courseForm);
  const timeDay = form.get("time-day");
  const timePeriod = form.get("time-period");
  const location = form.get("location")?.trim();

  if (!timeDay || !timePeriod) {
    alert("请选择上课时间和节次");
    return;
  }

  if (!location) {
    alert("请输入上课地点");
    return;
  }

  // 检查冲突
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

  // 将新任务同步到已有选课记录
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
    const taskSummary = e.tasks
      .map(t => {
        const taskDef = course.tasks.find(ct => ct.id === t.taskId);
        return `${taskDef?.title || "任务"}:${t.score ?? "-"}`;
      })
      .join(" / ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${student?.name || e.studentId}</td>
      <td>
        <select data-task="${e.id}">
          ${course.tasks.map(t => `<option value="${t.id}">${t.title}</option>`).join("")}
        </select>
        <div class="muted">${taskSummary || "暂无记录"}</div>
      </td>
      <td>${e.finalGrade ?? "-"}</td>
      <td>
        <input type="number" min="0" max="100" data-task-score="${e.id}" placeholder="任务分" />
        <button class="mini" data-save-task="${e.id}">保存任务分</button>
      </td>
      <td>
        <input type="number" min="0" max="100" data-final="${e.id}" placeholder="期末成绩" />
        <button class="mini" data-publish="${e.id}">${e.published ? "更新" : "发布"}</button>
      </td>
    `;
    gradeRows.appendChild(tr);
  });

  gradeRows.querySelectorAll("[data-save-task]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.saveTask;
      const enrollment = (await getCourseEnrollments(courseId)).find(e => e.id === id);
      const taskId = gradeRows.querySelector(`[data-task='${id}']`).value;
      const score = gradeRows.querySelector(`[data-task-score='${id}']`).value;
      await recordTaskScore(courseId, enrollment.studentId, taskId, score, currentUser.id);
      renderGrades();
    })
  );

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

// 教师课表视图
const teacherScheduleView = document.getElementById("teacher-schedule-view");

const renderTeacherSchedule = () => {
  if (!teacherScheduleView) return;
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
  teacherScheduleView.innerHTML = html;
};

const init = async () => {
  currentUser = await requireAuth(["teacher"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("teacher");
  infoBox.textContent = `${currentUser.name}（${currentUser.username}），邮箱：${currentUser.email}`;
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
