import { ensureSeeded, getData, getSessionUser } from "./storage.js";
import { searchCourses, enrollCourse } from "./courses.js";
import { setupNav } from "./common.js";
import { formatTime, formatLocation } from "./schedule.js";

const courseCards = document.getElementById("course-cards");
const searchInput = document.getElementById("search");
const carouselContainer = document.getElementById("home-carousel");
const carouselTrack = document.getElementById("carousel-track");
const carouselDots = document.getElementById("carousel-dots");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

let currentSlide = 0;
let slides = [];
let autoPlayInterval;

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

  if (!keyword && carouselTrack) {
      renderCarousel(courses);
  }

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

const renderCarousel = (courses) => {
    const bannerCourses = courses.filter(c => c.banner);
    if (bannerCourses.length === 0) {
        carouselContainer.classList.add("hidden");
        return;
    }

    carouselContainer.classList.remove("hidden");
    carouselTrack.innerHTML = "";
    carouselDots.innerHTML = "";
    slides = [];

    bannerCourses.forEach((c, index) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        slide.style.backgroundImage = `url(${c.banner})`;
        slide.innerHTML = `
            <div class="carousel-caption">
                <h2>${c.name}</h2>
                <p>${c.department} - ${c.summary}</p>
                <a href="student.html?course=${c.id}" class="btn">查看课程</a>
            </div>
        `;
        carouselTrack.appendChild(slide);
        slides.push(slide);

        const dot = document.createElement("div");
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener("click", () => goToSlide(index));
        carouselDots.appendChild(dot);
    });

    updateCarousel();
    startAutoPlay();
};

const updateCarousel = () => {
    carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll(".carousel-dot").forEach((d, i) => {
        d.classList.toggle("active", i === currentSlide);
    });
};

const goToSlide = (n) => {
    currentSlide = n;
    if (currentSlide >= slides.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    updateCarousel();
    resetAutoPlay();
};

const nextSlide = () => goToSlide(currentSlide + 1);
const prevSlide = () => goToSlide(currentSlide - 1);

const startAutoPlay = () => {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
    autoPlayInterval = setInterval(nextSlide, 5000);
};

const resetAutoPlay = () => {
    clearInterval(autoPlayInterval);
    startAutoPlay();
};

if (prevBtn) prevBtn.addEventListener("click", prevSlide);
if (nextBtn) nextBtn.addEventListener("click", nextSlide);

const init = async () => {
  await ensureSeeded();
  setupNav("home");
  renderCourses("");
};

init();

searchInput?.addEventListener("input", e => renderCourses(e.target.value));