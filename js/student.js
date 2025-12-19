import { requireAuth } from "./auth.js";
import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { searchCourses, enrollCourse, dropEnrollment } from "./courses.js";
import { setupNav } from "./common.js";
import { generateWeeklySchedule, formatTime, formatLocation } from "./schedule.js";

const myCoursesEl = document.getElementById("my-courses");
const availableCoursesEl = document.getElementById("available-courses");
const gradeTable = document.getElementById("grade-table");
const searchInput = document.getElementById("student-search");
const detailBody = document.getElementById("detail-body");
const exportBtn = document.getElementById("export-grade");
const infoBox = document.getElementById("student-info");

let currentUser = null;

const renderInfo = user => {
  infoBox.textContent = `${user.name}（${user.username}），专业：${user.major || "未填"}，班级：${user.className || "未填"}，邮箱：${user.email}`;
};

const renderMyCourses = () => {
  const data = getData();
  const enrollments = data.enrollments.filter(e => e.studentId === currentUser.id);
  myCoursesEl.innerHTML = "";
  enrollments.forEach(e => {
    const course = data.courses.find(c => c.id === e.courseId);
    const teacherIds = course?.teacherIds || (course?.teacherId ? [course.teacherId] : []);
    const teachers = teacherIds.map(tid => data.users.find(u => u.id === tid)).filter(Boolean);
    const teacherNames = teachers.map(t => t.name).join(", ") || "教师待定";
    const submitted = e.tasks.filter(t => t.status === "已提交" || t.status === "已评分").length;
    const total = e.tasks.length || 1;
    const timeStr = course.time ? formatTime(course.time) : (course.schedule || "未设置");
    const locationStr = course.location || (course.schedule ? "" : "未设置");
    const card = document.createElement("div");
    card.className = "list-item";
    card.innerHTML = `
      <div class="flex-between">
        <div>
          <div class="badge">${course.code}</div>
          <strong>${course.name}</strong> / ${teacherNames}
          <p class="muted">时间：${timeStr} | 地点：${locationStr}</p>
          <p class="muted">任务进度：${submitted}/${total}，课程进度 ${(e.progress * 100).toFixed(0)}%</p>
        </div>
        <div class="table-actions">
          <button class="mini" data-detail="${course.id}">查看详情</button>
          <button class="secondary mini" data-drop="${course.id}">退选</button>
        </div>
      </div>
    `;
    myCoursesEl.appendChild(card);
  });

  myCoursesEl.querySelectorAll("[data-detail]").forEach(btn =>
    btn.addEventListener("click", () => renderDetail(btn.dataset.detail))
  );
  myCoursesEl.querySelectorAll("[data-drop]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("确认退选该课程？")) return;
      await dropEnrollment(btn.dataset.drop, currentUser.id);
      renderMyCourses();
      renderAvailableCourses(searchInput.value);
      renderGrades();
      renderStudentSchedule();
      detailBody.innerHTML = "";
    })
  );
};

const renderAvailableCourses = async keyword => {
  const data = getData();
  const enrolledCourseIds = new Set(data.enrollments.filter(e => e.studentId === currentUser.id).map(e => e.courseId));
  const courses = (await searchCourses(keyword)).filter(c => !enrolledCourseIds.has(c.id));
  availableCoursesEl.innerHTML = "";
  courses.forEach(c => {
    const row = document.createElement("div");
    row.className = "list-item";
    const timeStr = c.time ? formatTime(c.time) : (c.schedule || "未设置");
    const locationStr = c.location || (c.schedule ? "" : "未设置");
    row.innerHTML = `
      <div class="flex-between">
        <div>
          <strong>${c.name}</strong> <span class="muted">${c.code}</span>
          <p class="muted">${c.summary}</p>
          <p class="muted">时间：${timeStr} | 地点：${locationStr}</p>
        </div>
        <button class="mini" data-enroll="${c.id}">选课</button>
      </div>
    `;
    availableCoursesEl.appendChild(row);
  });
  availableCoursesEl.querySelectorAll("[data-enroll]").forEach(btn =>
    btn.addEventListener("click", async () => {
      await enrollCourse(btn.dataset.enroll, currentUser.id);
      renderMyCourses();
      renderAvailableCourses(searchInput.value);
      renderGrades();
      renderStudentSchedule();
    })
  );
};

const renderGrades = () => {
  const data = getData();
  const enrollments = data.enrollments.filter(e => e.studentId === currentUser.id);
  gradeTable.innerHTML = "";
  enrollments.forEach(e => {
    const course = data.courses.find(c => c.id === e.courseId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${course.name}</td>
      <td>${e.finalGrade ?? "-"}</td>
      <td>${e.published ? "已发布" : "待发布"}</td>
      <td class="muted">${e.comments || ""}</td>
    `;
    gradeTable.appendChild(tr);
  });
};

const renderDetail = courseId => {
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  const enrollment = data.enrollments.find(e => e.courseId === courseId && e.studentId === currentUser.id);
  if (!course || !enrollment) return;
  const taskRows = course.tasks
    .map(t => {
      const result = enrollment.tasks.find(x => x.taskId === t.id);
      const status = result?.status || "未开始";
      const score = result?.score ?? "-";
      return `
        <tr>
          <td>${t.title}</td>
          <td>${t.type}</td>
          <td>${t.due}</td>
          <td>${status}</td>
          <td>${score}</td>
          <td><button class="mini" data-submit="${t.id}">标记已提交</button></td>
        </tr>
      `;
    })
    .join("");

  const materials = (course.materials || [])
    .map(m => `<li class="list-item">${m.title} (${m.type}) - ${m.desc}</li>`)
    .join("");

  const timeStr = course.time ? formatTime(course.time) : (course.schedule || "未设置");
  const locationStr = course.location || (course.schedule ? "" : "未设置");
  detailBody.innerHTML = `
    <div class="highlight">
      <h4>${course.name}</h4>
      <p class="muted">${course.summary}</p>
      <p class="muted">时间：${timeStr} | 地点：${locationStr} | 学分：${course.credits}</p>
    </div>
    <h4>任务与提交</h4>
    <div class="scroll">
      <table>
        <thead>
          <tr><th>任务</th><th>类型</th><th>截止</th><th>状态</th><th>分数</th><th>操作</th></tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>
    <h4>课程资料</h4>
    <ul class="list">${materials || "<li class='list-item'>暂无资料</li>"}</ul>
  `;

  detailBody.querySelectorAll("[data-submit]").forEach(btn =>
    btn.addEventListener("click", () => {
      const taskId = btn.dataset.submit;
      const data = getData();
      const enroll = data.enrollments.find(e => e.courseId === courseId && e.studentId === currentUser.id);
      enroll.tasks = enroll.tasks.map(t => (t.taskId === taskId ? { ...t, status: "已提交" } : t));
      saveData(data);
      addLog(currentUser.id, "提交任务", `课程 ${course.name} 任务 ${taskId} 标记已提交`);
      renderDetail(courseId);
      renderMyCourses();
    })
  );
};

const exportGrades = () => {
  const data = getData();
  const enrollments = data.enrollments.filter(e => e.studentId === currentUser.id);
  const lines = [["课程", "成绩", "状态", "备注"]];
  enrollments.forEach(e => {
    const course = data.courses.find(c => c.id === e.courseId);
    lines.push([course.name, e.finalGrade ?? "-", e.published ? "已发布" : "待发布", e.comments || ""]);
  });
  const csv = lines.map(l => l.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grade.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// 学生课表视图
const studentScheduleView = document.getElementById("student-schedule-view");

const renderStudentSchedule = () => {
  if (!studentScheduleView) return;
  const scheduleData = generateWeeklySchedule(currentUser.id, "student");
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
  studentScheduleView.innerHTML = html;
};

const init = async () => {
  currentUser = await requireAuth(["student"]);
  if (!currentUser) return;
  await ensureSeeded();
  setupNav("student");
  renderInfo(currentUser);
  renderMyCourses();
  renderAvailableCourses("");
  renderGrades();
  renderStudentSchedule();
};

init();

searchInput?.addEventListener("input", e => renderAvailableCourses(e.target.value));
exportBtn?.addEventListener("click", exportGrades);
