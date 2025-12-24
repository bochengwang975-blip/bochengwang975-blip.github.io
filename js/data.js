import { hashPassword, randomSalt, uuid, formatDate } from "./utils.js";

const createUser = async ({ username, role, password, name, email, className, major, mustChangePassword = false }) => {
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
    mustChangePassword,
    failedAttempts: 0,
    lockUntil: null
  };
};

export const seedData = async () => {
  const admin = await createUser({ username: "admin", role: "admin", password: "admin123", name: "教务管理员", email: "admin@campus.edu" });
  const sys = await createUser({ username: "sysadmin", role: "system", password: "sys123", name: "系统管理员", email: "sys@campus.edu" });
  const teacher1 = await createUser({ username: "teacher1", role: "teacher", password: "teach123", name: "王老师", email: "teacher1@campus.edu" });
  const teacher2 = await createUser({ username: "teacher2", role: "teacher", password: "teach123", name: "刘老师", email: "teacher2@campus.edu" });
  const teacher3 = await createUser({ username: "teacher3", role: "teacher", password: "teach123", name: "陈老师", email: "teacher3@campus.edu" });
  const teacher4 = await createUser({ username: "teacher4", role: "teacher", password: "teach123", name: "周老师", email: "teacher4@campus.edu" });
  const student1 = await createUser({ username: "student1", role: "student", password: "stud123", name: "李华", email: "student1@campus.edu", className: "计科22-1", major: "计算机科学" });
  const student2 = await createUser({ username: "student2", role: "student", password: "stud123", name: "张敏", email: "student2@campus.edu", className: "信安22-2", major: "信息安全" });
  const student3 = await createUser({ username: "student3", role: "student", password: "stud123", name: "王强", email: "student3@campus.edu", className: "计科22-2", major: "计算机科学" });
  const student4 = await createUser({ username: "student4", role: "student", password: "stud123", name: "赵丽", email: "student4@campus.edu", className: "软工22-1", major: "软件工程" });
  const student5 = await createUser({ username: "student5", role: "student", password: "stud123", name: "孙伟", email: "student5@campus.edu", className: "信安22-1", major: "信息安全" });

  const courses = [
    {
      id: uuid(),
      code: "CS101",
      name: "Web全栈开发",
      credits: 3,
      department: "计算机学院",
      teacherIds: [teacher1.id],
      capacity: 60,
      time: { day: 1, period: 3 },
      location: "A402",
      summary: "HTML5 + CSS3 + JS 现代前端实战，结合本地存储完成课程与成绩管理小型系统。",
      tags: ["前端", "项目制", "实战"],
      banner: "images/banner_web1.jpg",
      materials: [
        { id: uuid(), title: "课程大纲", type: "doc", url: "#", desc: "PDF 大纲示例", date: "2025/12/01" },
        { id: uuid(), title: "示例视频", type: "video", url: "#", desc: "15 分钟演示", date: "2025/12/05" }
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
      teacherIds: [teacher1.id],
      capacity: 80,
      time: { day: 3, period: 5 },
      location: "B202",
      summary: "链表、树、图及算法复杂度分析，含课程实验与阶段测验。",
      tags: ["算法", "核心必修"],
      banner: "images/banner_ds.jpg",
      materials: [{ id: uuid(), title: "实验指导书", type: "doc", url: "#", desc: "实验 1-6 文档", date: "2025/12/10" }],
      tasks: [
        { id: uuid(), title: "实验 1：线性表", type: "assignment", due: "2025-12-30", weight: 0.1, description: "实现顺序表与链表增删查改。" },
        { id: uuid(), title: "实验 2：树与遍历", type: "assignment", due: "2026-01-07", weight: 0.1, description: "二叉树与遍历实现。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-18", weight: 0.6, description: "闭卷考试。" }
      ]
    },
    {
      id: uuid(),
      code: "CS301",
      name: "Python编程基础",
      credits: 3,
      department: "计算机学院",
      teacherIds: [teacher2.id],
      capacity: 70,
      time: { day: 2, period: 1 },
      location: "A301",
      summary: "Python语法基础、面向对象编程、文件操作与数据处理。",
      tags: ["编程", "基础", "Python"],
      banner: "images/banner_py.jpg",
      materials: [
        { id: uuid(), title: "Python教程", type: "doc", url: "#", desc: "完整教程PDF", date: "2025/12/01" },
        { id: uuid(), title: "编程练习", type: "doc", url: "#", desc: "50道练习题", date: "2025/12/08" }
      ],
      tasks: [
        { id: uuid(), title: "作业 1：基础语法", type: "assignment", due: "2025-12-25", weight: 0.2, description: "完成Python基础语法练习。" },
        { id: uuid(), title: "作业 2：面向对象", type: "assignment", due: "2026-01-03", weight: 0.3, description: "实现类和对象相关程序。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-15", weight: 0.5, description: "闭卷考试，涵盖全部内容。" }
      ]
    },
    {
      id: uuid(),
      code: "CS302",
      name: "数据库系统原理",
      credits: 4,
      department: "计算机学院",
      teacherIds: [teacher2.id],
      capacity: 65,
      time: { day: 4, period: 2 },
      location: "B301",
      summary: "关系数据库设计、SQL语言、事务处理与并发控制。",
      tags: ["数据库", "核心必修", "SQL"],
      banner: "images/banner_web2.png",
      materials: [
        { id: uuid(), title: "数据库教材", type: "doc", url: "#", desc: "第1-8章", date: "2025/12/02" },
        { id: uuid(), title: "实验手册", type: "doc", url: "#", desc: "MySQL实验", date: "2025/12/10" }
      ],
      tasks: [
        { id: uuid(), title: "实验 1：数据库设计", type: "assignment", due: "2025-12-27", weight: 0.15, description: "完成ER图设计与表结构创建。" },
        { id: uuid(), title: "实验 2：SQL查询", type: "assignment", due: "2026-01-04", weight: 0.15, description: "完成复杂SQL查询练习。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-16", weight: 0.7, description: "闭卷考试。" }
      ]
    },
    {
      id: uuid(),
      code: "CS401",
      name: "计算机网络",
      credits: 3,
      department: "计算机学院",
      teacherIds: [teacher3.id],
      capacity: 75,
      time: { day: 1, period: 5 },
      location: "C201",
      summary: "TCP/IP协议栈、网络层路由、传输层协议与应用层服务。",
      tags: ["网络", "协议", "核心必修"],
      banner: "images/banner_web1.jpg",
      materials: [
        { id: uuid(), title: "网络协议详解", type: "doc", url: "#", desc: "TCP/IP详解", date: "2025/12/03" },
        { id: uuid(), title: "实验指导", type: "doc", url: "#", desc: "Wireshark抓包实验", date: "2025/12/12" }
      ],
      tasks: [
        { id: uuid(), title: "实验 1：网络配置", type: "assignment", due: "2025-12-29", weight: 0.2, description: "完成网络配置与测试。" },
        { id: uuid(), title: "实验 2：协议分析", type: "assignment", due: "2026-01-06", weight: 0.3, description: "使用Wireshark分析网络包。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-17", weight: 0.5, description: "闭卷考试。" }
      ]
    },
    {
      id: uuid(),
      code: "CS402",
      name: "操作系统",
      credits: 4,
      department: "计算机学院",
      teacherIds: [teacher3.id],
      capacity: 70,
      time: { day: 3, period: 1 },
      location: "C202",
      summary: "进程管理、内存管理、文件系统与I/O管理。",
      tags: ["系统", "核心必修", "理论"],
      banner: "images/banner_ds.jpg",
      materials: [
        { id: uuid(), title: "操作系统原理", type: "doc", url: "#", desc: "教材PDF", date: "2025/12/04" },
        { id: uuid(), title: "实验代码", type: "doc", url: "#", desc: "Linux系统调用实验", date: "2025/12/15" }
      ],
      tasks: [
        { id: uuid(), title: "实验 1：进程管理", type: "assignment", due: "2025-12-31", weight: 0.15, description: "实现进程创建与调度模拟。" },
        { id: uuid(), title: "实验 2：内存管理", type: "assignment", due: "2026-01-08", weight: 0.15, description: "实现页面置换算法。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-19", weight: 0.7, description: "闭卷考试。" }
      ]
    },
    {
      id: uuid(),
      code: "CS501",
      name: "机器学习基础",
      credits: 3,
      department: "计算机学院",
      teacherIds: [teacher4.id],
      capacity: 50,
      time: { day: 2, period: 3 },
      location: "D101",
      summary: "监督学习、无监督学习、神经网络基础与应用实践。",
      tags: ["AI", "机器学习", "前沿"],
      banner: "images/banner_web2.png",
      materials: [
        { id: uuid(), title: "机器学习导论", type: "doc", url: "#", desc: "课程讲义", date: "2025/12/05" },
        { id: uuid(), title: "Python实践", type: "video", url: "#", desc: "Scikit-learn教程", date: "2025/12/18" }
      ],
      tasks: [
        { id: uuid(), title: "作业 1：线性回归", type: "assignment", due: "2026-01-02", weight: 0.25, description: "实现线性回归算法。" },
        { id: uuid(), title: "作业 2：分类算法", type: "assignment", due: "2026-01-10", weight: 0.25, description: "实现KNN和决策树算法。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-20", weight: 0.5, description: "开卷考试。" }
      ]
    },
    {
      id: uuid(),
      code: "CS502",
      name: "软件工程",
      credits: 3,
      department: "计算机学院",
      teacherIds: [teacher4.id],
      capacity: 60,
      time: { day: 5, period: 2 },
      location: "D102",
      summary: "软件开发流程、需求分析、系统设计与项目管理。",
      tags: ["工程", "项目管理", "实践"],
      banner: "images/banner_web1.jpg",
      materials: [
        { id: uuid(), title: "软件工程方法", type: "doc", url: "#", desc: "敏捷开发指南", date: "2025/12/06" },
        { id: uuid(), title: "项目案例", type: "doc", url: "#", desc: "真实项目分析", date: "2025/12/20" }
      ],
      tasks: [
        { id: uuid(), title: "项目 1：需求分析", type: "assignment", due: "2026-01-01", weight: 0.3, description: "完成项目需求文档。" },
        { id: uuid(), title: "项目 2：系统设计", type: "assignment", due: "2026-01-11", weight: 0.3, description: "完成系统架构设计。" },
        { id: uuid(), title: "期末考试", type: "exam", due: "2026-01-21", weight: 0.4, description: "开卷考试。" }
      ]
    }
  ];

  const enrollments = [
    {
      id: uuid(),
      courseId: courses[0].id,
      studentId: student1.id,
      progress: 1,
      tasks: [
        { taskId: courses[0].tasks[0].id, score: 90, status: "已评分" },
        { taskId: courses[0].tasks[1].id, score: 95, status: "已评分" },
        { taskId: courses[0].tasks[2].id, score: 88, status: "已评分" }
      ],
      finalGrade: null,
      published: false,
      comments: "表现积极，代码规范。"
    },
    {
      id: uuid(),
      courseId: courses[1].id,
      studentId: student1.id,
      progress: 0.3,
      tasks: [
        { taskId: courses[1].tasks[0].id, score: 88, status: "已评分" },
        { taskId: courses[1].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[1].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[0].id,
      studentId: student2.id,
      progress: 0.8,
      tasks: [
        { taskId: courses[0].tasks[0].id, score: 85, status: "已评分" },
        { taskId: courses[0].tasks[1].id, score: 90, status: "已评分" },
        { taskId: courses[0].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: "学习认真，作业质量较高。"
    },
    {
      id: uuid(),
      courseId: courses[1].id,
      studentId: student2.id,
      progress: 0.5,
      tasks: [
        { taskId: courses[1].tasks[0].id, score: 82, status: "已评分" },
        { taskId: courses[1].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[1].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[2].id,
      studentId: student1.id,
      progress: 0.6,
      tasks: [
        { taskId: courses[2].tasks[0].id, score: 88, status: "已评分" },
        { taskId: courses[2].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[2].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: "Python基础扎实。"
    },
    {
      id: uuid(),
      courseId: courses[2].id,
      studentId: student3.id,
      progress: 0.4,
      tasks: [
        { taskId: courses[2].tasks[0].id, score: 75, status: "已评分" },
        { taskId: courses[2].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[2].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[3].id,
      studentId: student2.id,
      progress: 0.7,
      tasks: [
        { taskId: courses[3].tasks[0].id, score: 90, status: "已评分" },
        { taskId: courses[3].tasks[1].id, score: 85, status: "已评分" },
        { taskId: courses[3].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: "数据库设计思路清晰。"
    },
    {
      id: uuid(),
      courseId: courses[3].id,
      studentId: student4.id,
      progress: 0.5,
      tasks: [
        { taskId: courses[3].tasks[0].id, score: 80, status: "已评分" },
        { taskId: courses[3].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[3].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[4].id,
      studentId: student3.id,
      progress: 0.6,
      tasks: [
        { taskId: courses[4].tasks[0].id, score: 87, status: "已评分" },
        { taskId: courses[4].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[4].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: "网络实验完成良好。"
    },
    {
      id: uuid(),
      courseId: courses[4].id,
      studentId: student5.id,
      progress: 0.3,
      tasks: [
        { taskId: courses[4].tasks[0].id, score: 78, status: "已评分" },
        { taskId: courses[4].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[4].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[5].id,
      studentId: student4.id,
      progress: 0.4,
      tasks: [
        { taskId: courses[5].tasks[0].id, score: 83, status: "已评分" },
        { taskId: courses[5].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[5].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[6].id,
      studentId: student3.id,
      progress: 0.5,
      tasks: [
        { taskId: courses[6].tasks[0].id, score: null, status: "待提交" },
        { taskId: courses[6].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[6].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: ""
    },
    {
      id: uuid(),
      courseId: courses[7].id,
      studentId: student5.id,
      progress: 0.6,
      tasks: [
        { taskId: courses[7].tasks[0].id, score: 85, status: "已评分" },
        { taskId: courses[7].tasks[1].id, score: null, status: "待提交" },
        { taskId: courses[7].tasks[2].id, score: null, status: "待提交" }
      ],
      finalGrade: null,
      published: false,
      comments: "需求分析文档撰写规范。"
    }
  ];

  const classes = [
    { id: uuid(), name: "计科22-1", counselor: "赵老师" },
    { id: uuid(), name: "计科22-2", counselor: "周老师" },
    { id: uuid(), name: "信安22-1", counselor: "王老师" },
    { id: uuid(), name: "信安22-2", counselor: "张老师" },
    { id: uuid(), name: "软工22-1", counselor: "简老师" },
    { id: uuid(), name: "软工22-2", counselor: "徐老师" },
  ];

  const logs = [
    { id: uuid(), actor: "system", action: "初始化数据", at: formatDate(), details: "系统引导数据已生成。" }
  ];

  return {
    users: [admin, sys, teacher1, teacher2, teacher3, teacher4, student1, student2, student3, student4, student5],
    courses,
    enrollments,
    classes,
    logs,
    resetTokens: [],
    schedules: []
  };
};