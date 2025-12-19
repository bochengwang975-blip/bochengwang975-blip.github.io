import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { addCourse, addTaskToCourse, getCourseEnrollments, recordTaskScore, publishFinalGrade } from "./courses.js";
import { setupNav } from "./common.js";

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
    item.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${c.name}</strong> <span class="muted">${c.code}</span>
          <p class="muted">${c.summary}</p>
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

courseForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(courseForm);
  const payload = Object.fromEntries(form.entries());
  await addCourse(payload, currentUser.id);
  courseForm.reset();
  renderCourses();
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

const init = async () => {
  currentUser = await requireAuth(["teacher"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("teacher");
  infoBox.textContent = `${currentUser.name}（${currentUser.username}），邮箱：${currentUser.email}`;
  renderCourses();
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
