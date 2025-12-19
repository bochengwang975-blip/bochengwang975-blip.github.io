import { getData } from "./storage.js";

// 课表设置：一天上午2节课，下午2节课，晚上1节课
// period: 1-2 上午，3-4 下午，5 晚上
export const PERIODS = {
  MORNING_1: 1,    // 上午第1节
  MORNING_2: 2,    // 上午第2节
  AFTERNOON_1: 3,  // 下午第1节
  AFTERNOON_2: 4,  // 下午第2节
  EVENING: 5       // 晚上
};

export const DAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5
};

export const DAY_NAMES = {
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五"
};

export const PERIOD_NAMES = {
  1: "上午第1节",
  2: "上午第2节",
  3: "下午第1节",
  4: "下午第2节",
  5: "晚上"
};

/**
 * 检查课程时间冲突
 * @param {Object} newCourse - 新课程 { time: { day, period }, location, teacherIds, id? }
 * @param {Array} existingCourses - 现有课程列表
 * @returns {Object} { hasConflict: boolean, conflicts: Array }
 */
export const checkScheduleConflict = (newCourse, existingCourses = null) => {
  if (!existingCourses) {
    const data = getData();
    existingCourses = data.courses || [];
  }

  const conflicts = [];
  const { time, location, teacherIds, id } = newCourse;

  if (!time || !time.day || !time.period) {
    return { hasConflict: false, conflicts: [] };
  }

  existingCourses.forEach(course => {
    // 跳过自己（编辑时）
    if (id && course.id === id) return;

    const courseTime = course.time || (course.schedule ? parseSchedule(course.schedule) : null);
    if (!courseTime || !courseTime.day || !courseTime.period) return;

    // 检查时间是否相同
    if (courseTime.day === time.day && courseTime.period === time.period) {
      const courseLocation = course.location || (course.schedule ? parseScheduleLocation(course.schedule) : "");
      const courseTeacherIds = course.teacherIds || (course.teacherId ? [course.teacherId] : []);

      // 检查教师时间冲突
      const teacherConflict = teacherIds.some(tid => courseTeacherIds.includes(tid));
      if (teacherConflict) {
        conflicts.push({
          type: "teacher",
          message: `教师时间冲突：该时间段已有课程`,
          course: course
        });
      }

      // 检查地点冲突
      if (courseLocation === location && location) {
        conflicts.push({
          type: "location",
          message: `地点冲突：${location} 在该时间段已被占用`,
          course: course
        });
      }
    }
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
};

/**
 * 解析旧格式的schedule字符串（兼容性处理）
 */
const parseSchedule = (schedule) => {
  if (!schedule) return null;
  const dayMap = { "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5 };
  const periodMap = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };
  
  for (const [dayName, day] of Object.entries(dayMap)) {
    if (schedule.includes(dayName)) {
      // 尝试提取节次
      const periodMatch = schedule.match(/(\d+)[-到](\d+)/);
      if (periodMatch) {
        const startPeriod = parseInt(periodMatch[1]);
        return { day, period: startPeriod };
      }
      // 单个节次
      const singleMatch = schedule.match(/(\d+)\s*节/);
      if (singleMatch) {
        return { day, period: parseInt(singleMatch[1]) };
      }
    }
  }
  return null;
};

const parseScheduleLocation = (schedule) => {
  if (!schedule) return "";
  // 尝试提取地点（通常是字母+数字的组合，如A402）
  const locationMatch = schedule.match(/([A-Z]\d+)/);
  return locationMatch ? locationMatch[1] : "";
};

/**
 * 生成周课表数据
 * @param {String} userId - 用户ID（学生或教师）
 * @param {String} role - 用户角色 'student' | 'teacher' | 'admin'
 * @returns {Object} 课表数据 { schedule: 5x5数组, courses: 课程详情 }
 */
export const generateWeeklySchedule = (userId = null, role = "admin") => {
  const data = getData();
  const courses = data.courses || [];
  const enrollments = data.enrollments || [];

  // 初始化5x5课表（5天 x 5个时间段）
  const schedule = Array(5).fill(null).map(() => Array(5).fill(null));

  let relevantCourses = [];

  if (role === "student" && userId) {
    // 学生：获取已选课程
    const studentEnrollments = enrollments.filter(e => e.studentId === userId);
    relevantCourses = studentEnrollments.map(e => {
      const course = courses.find(c => c.id === e.courseId);
      return course;
    }).filter(Boolean);
  } else if (role === "teacher" && userId) {
    // 教师：获取授课课程
    relevantCourses = courses.filter(c => {
      const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
      return teacherIds.includes(userId);
    });
  } else if (role === "admin") {
    // 管理员：显示所有课程
    relevantCourses = courses;
  }

  // 填充课表
  relevantCourses.forEach(course => {
    const time = course.time || (course.schedule ? parseSchedule(course.schedule) : null);
    if (!time || !time.day || !time.period) return;

    const dayIndex = time.day - 1; // 转换为数组索引（0-4）
    const periodIndex = time.period - 1; // 转换为数组索引（0-4）

    if (dayIndex >= 0 && dayIndex < 5 && periodIndex >= 0 && periodIndex < 5) {
      const location = course.location || (course.schedule ? parseScheduleLocation(course.schedule) : "");
      const teacherIds = course.teacherIds || (course.teacherId ? [course.teacherId] : []);
      const teachers = teacherIds.map(tid => {
        const teacher = data.users.find(u => u.id === tid);
        return teacher ? teacher.name : "未知";
      }).join(", ");

      // 如果该时间段已有课程，创建数组存储多个课程
      if (schedule[dayIndex][periodIndex] === null) {
        schedule[dayIndex][periodIndex] = [];
      }
      schedule[dayIndex][periodIndex].push({
        course,
        location,
        teachers,
        time: `${DAY_NAMES[time.day]} ${PERIOD_NAMES[time.period]}`
      });
    }
  });

  return {
    schedule,
    courses: relevantCourses
  };
};

/**
 * 格式化时间显示
 */
export const formatTime = (time) => {
  if (!time || !time.day || !time.period) return "未设置";
  return `${DAY_NAMES[time.day]} ${PERIOD_NAMES[time.period]}`;
};

/**
 * 格式化地点显示
 */
export const formatLocation = (location) => {
  return location || "未设置";
};

