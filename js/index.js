import { ensureSeeded, getData, getSessionUser } from "./storage.js";
import { searchCourses, enrollCourse } from "./courses.js";
import { setupNav } from "./common.js";
import { formatTime, formatLocation } from "./schedule.js";

const courseCards = document.getElementById("course-cards");
const searchInput = document.getElementById("search");

const renderCourses = async keyword => {
  await ensureSeeded();
  const data = getData();
  const user = getSessionUser();
  const courses = await searchCourses(keyword);
  courseCards.innerHTML = "";
  courses.forEach(c => {
    const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
    const teachers = teacherIds.map(tid => data.users.find(u => u.id === tid)).filter(Boolean);
    const teacherNames = teachers.map(t => t.name).join(", ") || "未分配";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="flex-between">
        <div>
          <div class="badge">${c.code}</div>
          <h3>${c.name}</h3>
          <p class="muted">${c.summary}</p>
          <div class="flex">
            <span class="chip">院系：${c.department}</span>
            <span class="chip">学分：${c.credits}</span>
            <span class="chip">教师：${teacherNames}</span>
          </div>
          <p class="muted">时间：${c.time ? formatTime(c.time) : (c.schedule || "未设置")} | 地点：${c.location ? formatLocation(c.location) : (c.schedule ? "" : "未设置")}</p>
        </div>
      </div>
      <div class="flex-between">
        <div class="flex">
          ${(c.tags || []).map(t => `<span class="pill">${t}</span>`).join("")}
        </div>
        <div class="table-actions">
          <a class="btn secondary mini" href="student.html?course=${c.id}">查看详情</a>
          ${user && user.role === "student" ? `<button class="mini" data-enroll="${c.id}">选课</button>` : ""}
        </div>
      </div>
    `;
    courseCards.appendChild(card);
  });

  // bind enroll buttons
  courseCards.querySelectorAll("[data-enroll]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const courseId = btn.dataset.enroll;
      if (!user) {
        alert("请先登录学生账号再选课");
        location.href = "login.html";
        return;
      }
      await enrollCourse(courseId, user.id);
      alert("选课成功，前往学生端查看任务与成绩");
    });
  });
};

const init = async () => {
  await ensureSeeded();
  setupNav("home");
  renderCourses("");
};

init();

searchInput?.addEventListener("input", e => renderCourses(e.target.value));
