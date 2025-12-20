import { ensureSeeded, getData, saveData, addLog } from "./storage.js";
import { uuid } from "./utils.js";

export const listCourses = async () => {
  await ensureSeeded();
  return getData().courses;
};

export const searchCourses = async keyword => {
  const courses = await listCourses();
  if (!keyword) return courses;
  return courses.filter(c => `${c.name}${c.code}${c.department}${c.summary}`.toLowerCase().includes(keyword.toLowerCase()));
};

export const addCourse = async (course, teacherId) => {
  await ensureSeeded();
  const data = getData();
  const id = uuid();
  const teacherIds = course.teacherIds || (teacherId ? [teacherId] : []);

  let time = null;
  let location = "";

  if (course.time && course.time.day && course.time.period) {
    time = { day: parseInt(course.time.day), period: parseInt(course.time.period) };
  }

  if (course.location) {
    location = course.location.trim();
  }

  data.courses.push({
    id,
    code: course.code || `NEW-${Math.floor(Math.random() * 999)}`,
    name: course.name,
    credits: Number(course.credits) || 2,
    department: course.department || "未分配院系",
    teacherIds,
    capacity: course.capacity || 50,
    time,
    location,
    summary: course.summary || "",
    tags: course.tags || [],
    materials: course.materials || [], // 初始化课件资料
    tasks: course.tasks || []
  });
  saveData(data);
  addLog(teacherId || teacherIds[0], "创建课程", `新增课程 ${course.name}`);
  return id;
};

// 修改课程信息
export const updateCourse = async (courseId, updates) => {
    await ensureSeeded();
    const data = getData();
    const courseIndex = data.courses.findIndex(c => c.id === courseId);
    if (courseIndex === -1) throw new Error("课程不存在");

    const course = data.courses[courseIndex];
    const updatedCourse = { ...course, ...updates };
    delete updatedCourse.id;

    data.courses[courseIndex] = updatedCourse;
    saveData(data);
    return updatedCourse;
};

// 删除课程
export const deleteCourse = async (courseId, actorId) => {
    await ensureSeeded();
    const data = getData();
    const courseIndex = data.courses.findIndex(c => c.id === courseId);
    if (courseIndex === -1) throw new Error("课程不存在");

    const name = data.courses[courseIndex].name;
    data.courses.splice(courseIndex, 1);
    data.enrollments = data.enrollments.filter(e => e.courseId !== courseId);

    saveData(data);
    addLog(actorId, "删除课程", `删除了课程 ${name} 及所有相关记录`);
};

// 上传课件资料
export const addCourseMaterial = async (courseId, file, actorId) => {
    await ensureSeeded();
    const data = getData();
    const course = data.courses.find(c => c.id === courseId);
    if (!course) throw new Error("课程不存在");

    if (!course.materials) course.materials = [];

    const material = {
        id: uuid(),
        title: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        date: new Date().toLocaleDateString()
    };

    course.materials.push(material);
    saveData(data);
    addLog(actorId, "上传资料", `上传了课件 ${file.name}`);
    return material;
};

export const addTaskToCourse = async (courseId, task, actorId) => {
  await ensureSeeded();
  const data = getData();
  const course = data.courses.find(c => c.id === courseId);
  if (!course) throw new Error("课程不存在");
  course.tasks.push({ ...task, id: uuid() });
  saveData(data);
  addLog(actorId, "添加任务", `课程 ${course.name} 添加任务 ${task.title}`);
  return course.tasks;
};

export const enrollCourse = async (courseId, studentId) => {
  await ensureSeeded();
  const data = getData();
  const exists = data.enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (exists) return exists.id;
  const course = data.courses.find(c => c.id === courseId);
  const enrollment = {
    id: uuid(),
    courseId,
    studentId,
    progress: 0,
    tasks: (course?.tasks || []).map(t => ({ taskId: t.id, score: null, status: "未开始" })),
    finalGrade: null,
    published: false,
    comments: ""
  };
  data.enrollments.push(enrollment);
  saveData(data);
  addLog(studentId, "选课", `选择课程 ${course?.name || courseId}`);
  return enrollment.id;
};

export const getStudentEnrollments = async studentId => {
  await ensureSeeded();
  const data = getData();
  return data.enrollments.filter(e => e.studentId === studentId);
};

export const getCourseEnrollments = async courseId => {
  await ensureSeeded();
  const data = getData();
  return data.enrollments.filter(e => e.courseId === courseId);
};

export const recordTaskScore = async (courseId, studentId, taskId, score, actorId) => {
  await ensureSeeded();
  const data = getData();
  const enrollment = data.enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (!enrollment) throw new Error("未找到选课记录");
  enrollment.tasks = enrollment.tasks.map(t => (t.taskId === taskId ? { ...t, score: Number(score), status: "已评分" } : t));
  saveData(data);
  // 获取课程名称和任务名称
  const course = data.courses.find(c => c.id === courseId);
  const task = course?.tasks.find(t => t.id === taskId);
  const courseName = course ? course.name : courseId;
  const taskName = task ? task.title : taskId;
  addLog(actorId, "录入成绩", `课程 ${courseName} 任务 ${taskName} 录入 ${score}`);
};

export const publishFinalGrade = async (courseId, studentId, grade, actorId) => {
  await ensureSeeded();
  const data = getData();
  const enrollment = data.enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (!enrollment) throw new Error("未找到选课记录");
  enrollment.finalGrade = Number(grade);
  enrollment.published = false;
  saveData(data);
  // 获取课程名称和学生名称
  const course = data.courses.find(c => c.id === courseId);
  const student = data.users.find(u => u.id === studentId);
  const courseName = course ? course.name : courseId;
  const studentName = student ? student.name : studentId;
  addLog(actorId, "录入成绩", `课程 ${courseName} 学生 ${studentName} 成绩 ${grade}（待审核）`);
};

export const dropEnrollment = async (courseId, studentId) => {
  await ensureSeeded();
  const data = getData();
  data.enrollments = data.enrollments.filter(e => !(e.courseId === courseId && e.studentId === studentId));
  saveData(data);
  // 获取课程名称
  const course = data.courses.find(c => c.id === courseId);
  const courseName = course ? course.name : courseId;
  addLog(studentId, "退课", `退选课程 ${courseName}`);
};