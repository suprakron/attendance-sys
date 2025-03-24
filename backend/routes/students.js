const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// เชื่อมต่อ SQLite Database
const db = new sqlite3.Database("./db/attendance.db");
let students = [];

// สร้างตารางถ้ายังไม่มี
db.run(`CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  studentId TEXT NOT NULL,
  grade TEXT NOT NULL
)`);

// ดึงรายชื่อนักเรียนทั้งหมด
router.get("/", (req, res) => {
  db.all("SELECT * FROM students", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// เพิ่มนักเรียนใหม่จากฟอร์มกรอกข้อมูล
router.post("/add", (req, res) => {
  const { name, studentId, grade } = req.body;
  if (!name || !studentId || !grade) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
  }

  // บันทึกข้อมูลนักเรียนลงฐานข้อมูล
  db.run("INSERT INTO students (name, studentId, grade) VALUES (?, ?, ?)", [name, studentId, grade], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "เพิ่มนักเรียนสำเร็จ", student: { id: this.lastID, name, studentId, grade } });
  });
});

// อัปโหลดไฟล์ Excel และบันทึกข้อมูลลงฐานข้อมูล
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
  }

  // อ่านไฟล์ Excel
  const workbook = xlsx.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // เพิ่มนักเรียนจากไฟล์ลงฐานข้อมูล
  const insertPromises = data.map((student) => {
    const { name, studentId, grade } = student;

    if (!name || !studentId || !grade) {
      return Promise.reject(new Error("ข้อมูลในไฟล์ไม่ครบ"));
    }

    return new Promise((resolve, reject) => {
      db.run("INSERT INTO students (name, studentId, grade) VALUES (?, ?, ?)", [name, studentId, grade], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  // หลังจากเสร็จสิ้นการเพิ่มข้อมูลแล้ว
  Promise.all(insertPromises)
    .then(() => {
      fs.unlinkSync(req.file.path); // ลบไฟล์หลังจากประมวลผลเสร็จ
      res.json({ message: "อัปโหลดไฟล์สำเร็จ", studentCount: data.length });
    })
    .catch((err) => {
      fs.unlinkSync(req.file.path); // ลบไฟล์หากเกิดข้อผิดพลาด
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์", error: err.message });
    });
});

// ดึงข้อมูลนักเรียนจากฐานข้อมูล
router.get("/students", (req, res) => {
  db.all("SELECT * FROM students", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});
// API: บันทึกการเช็คชื่อ
router.post('/attendance', (req, res) => {
  const { attendanceData } = req.body;

  if (!attendanceData || attendanceData.length === 0) {
    return res.status(400).json({ message: "กรุณาเลือกสถานะการเช็คชื่อสำหรับนักเรียน" });
  }

  // นำข้อมูลการเช็คชื่อไปบันทึกในฐานข้อมูล
  const insertPromises = attendanceData.map(item => {
    return new Promise((resolve, reject) => {
      const { studentId, status } = item;
      // สมมติว่าใช้ตาราง Attendance เก็บข้อมูล
      db.run("INSERT INTO attendance (studentId, status) VALUES (?, ?)", [studentId, status], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  // หลังจากบันทึกข้อมูลเสร็จ
  Promise.all(insertPromises)
    .then(() => {
      res.json({ message: "บันทึกการเช็คชื่อสำเร็จ" });
    })
    .catch(err => {
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกการเช็คชื่อ", error: err.message });
    });
});

module.exports = router;
