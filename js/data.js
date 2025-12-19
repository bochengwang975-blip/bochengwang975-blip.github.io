import { hashPassword, randomSalt, uuid, formatDate } from "./utils.js";

const createUser = async ({ username, role, password, name, email, className, major }) => {
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  return {
    id: uuid(),
    username,
    role,
    name,
    email,
    salt,
    passwordHash,
    className: className || "",
    major: major || "",
    failedAttempts: 0,
    lockUntil: null
  };
};

export const seedData = async () => {
  const admin = await createUser({ username: "admin", role: "admin", password: "admin123", name: "教务管理员", email: "admin@campus.edu" });
  const sys = await createUser({ username: "sysadmin", role: "system", password: "sys123", name: "系统管理员", email: "sys@campus.edu" });
  const teacher = await createUser({ username: "teacher1", role: "teacher", password: "teach123", name: "王老师", email: "teacher1@campus.edu" });
  const student = await createUser({ username: "student1", role: "student", password: "stud123", name: "李华", email: "student1@campus.edu", className: "计科22-1", major: "计算机科学" });
  const student2 = await createUser({ username: "student2", role: "student", password: "stud123", name: "张敏", email: "student2@campus.edu", className: "信安22-2", major: "信息安全" });

  const courses = [
    {
      id: uuid(),
      code: "CS101",
      name: "Web全栈开发",
      credits: 3,
      department: "计算机学院",
      teacherId: teacher.id,
      capacity: 60,
      schedule: "周一 3-4 节，A402",
      summary: "HTML5 + CSS3 + JS 现代前端实战，结合本地存储完成课程与成绩管理小型系统。",
      tags: ["前端", "项目制", "实战"],
      materials: [
        { id: uuid(), title: "课程大纲", type: "doc", url: "#", desc: "PDF 大纲示例" },
        { id: uuid(), title: "示例视频", type: "video", url: "#", desc: "15 分钟演示" }
      ],
      tasks: [
        { id: uuid(), title: "作业 1：页面布局", type: "assignment", due: "2025-12-28", weight: 0.25, description: "完成多页面布局与导航。" },
        { id: uuid(), title: "作业 2：数据管理", type: "assignment", due: "2026-01-05", weight: 0.25, description: "实现本地存储与数据导入导出。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-12", weight: 0.5, description: "闭卷考试，涵盖课程全部知识点。" }
      ]
    },
    {
      id: uuid(),
      code: "CS205",
      name: "数据结构",
      credits: 4,
      department: "计算机学院",
      teacherId: teacher.id,
      capacity: 80,
      schedule: "周三 5-6 节，B202",
      summary: "链表、树、图及算法复杂度分析，含课程实验与阶段测验。",
      tags: ["算法", "核心必修"],
      materials: [{ id: uuid(), title: "实验指导书", type: "doc", url: "#", desc: "实验 1-6 文档" }],
      tasks: [
        { id: uuid(), title: "实验 1：线性表", type: "assignment", due: "2025-12-30", weight: 0.2, description: "实现顺序表与链表增删查改。" },
        { id: uuid(), title: "实验 2：树与遍历", type: "assignment", due: "2026-01-07", weight: 0.2, description: "二叉树与遍历实现。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-18", weight: 0.6, description: "闭卷考试。" }
      ]
    }
  ];

  const enrollments = [
    {
      id: uuid(),
      courseId: courses[0].id,
      studentId: student.id,
      progress: 0.6,
      tasks: [
        { taskId: courses[0].tasks[0].id, score: 90, status: "已提交" },
        { taskId: courses[0].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[0].tasks[2].id, score: null, status: "未开始" }
      ],
      finalGrade: 85,
      published: true,
      comments: "表现积极，注意按时提交作业。"
    },
    {
      id: uuid(),
      courseId: courses[1].id,
      studentId: student.id,
      progress: 0.3,
      tasks: [
        { taskId: courses[1].tasks[0].id, score: 88, status: "已提交" },
        { taskId: courses[1].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[1].tasks[2].id, score: null, status: "未开始" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    }
  ];

  const classes = [
    { id: uuid(), name: "计科22-1", size: 40, counselor: "赵老师" },
    { id: uuid(), name: "信安22-2", size: 36, counselor: "周老师" }
  ];

  const logs = [
    { id: uuid(), actor: "system", action: "初始化数据", at: formatDate(), details: "系统引导数据已生成。" }
  ];

  return {
    users: [admin, sys, teacher, student, student2],
    courses,
    enrollments,
    classes,
    logs,
    resetTokens: [],
    schedules: []
  };
};
