const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();

// เชื่อมต่อ SQLite
const db = new sqlite3.Database("./db/attendance.db");

// สร้างตารางเช็คชื่อถ้ายังไม่มี
db.run(`CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
)`);

// เช็คชื่อ
router.post("/", (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: "กรุณาเลือกนักเรียน" });

  const date = new Date().toISOString().split("T")[0];

  db.run(
    "INSERT INTO attendance (student_id, date) VALUES (?, ?)",
    [student_id, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "เช็คชื่อสำเร็จ", id: this.lastID });
    }
  );
});

// ดึงข้อมูลการเช็คชื่อ
router.get("/", (req, res) => {
  db.all(
    `SELECT students.name, attendance.date FROM attendance 
     JOIN students ON attendance.student_id = students.id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;
