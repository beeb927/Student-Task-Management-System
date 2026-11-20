const mysql = require("mysql2/promise");
require("dotenv").config();

// A pool keeps several connections open and reuses them (faster than opening one per request)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true, // return DATETIME/DATE as plain strings (no timezone shifting)
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;