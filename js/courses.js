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
  // 支持单个teacherId或teacherIds数组
  const teacherIds = course.teacherIds || (teacherId ? [teacherId] : []);
  data.courses.push({
    id,
    code: course.code || `NEW-${Math.floor(Math.random() * 999)}`,
    name: course.name,
    credits: Number(course.credits) || 2,
    department: course.department || "未分配院系",
    teacherIds,
    capacity: course.capacity || 50,
    schedule: course.schedule || "",
    summary: course.summary || "",
    tags: course.tags || [],
    materials: course.materials || [],
    tasks: course.tasks || []
  });
  saveData(data);
  addLog(teacherId || teacherIds[0], "创建课程", `新增课程 ${course.name}`);
  return id;
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
  addLog(actorId, "录入成绩", `课程 ${courseId} 任务 ${taskId} 录入 ${score}`);
};

export const publishFinalGrade = async (courseId, studentId, grade, actorId) => {
  await ensureSeeded();
  const data = getData();
  const enrollment = data.enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (!enrollment) throw new Error("未找到选课记录");
  enrollment.finalGrade = Number(grade);
  enrollment.published = true;
  saveData(data);
  addLog(actorId, "发布成绩", `课程 ${courseId} 学生 ${studentId} 成绩 ${grade}`);
};

export const dropEnrollment = async (courseId, studentId) => {
  await ensureSeeded();
  const data = getData();
  data.enrollments = data.enrollments.filter(e => !(e.courseId === courseId && e.studentId === studentId));
  saveData(data);
  addLog(studentId, "退课", `退选课程 ${courseId}`);
};
