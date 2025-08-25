const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

async function initializeDatabase() {
  try {
    // Create contents table
    await pool.query(`CREATE TABLE IF NOT EXISTS contents (
      id SERIAL PRIMARY KEY,
      content_type INTEGER NOT NULL,
      title TEXT,
      publisher TEXT,
      description TEXT,
      download_url TEXT,
      image_url TEXT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      download_count INTEGER DEFAULT 0,
      vote_average_score REAL DEFAULT 0,
      song_info TEXT
    )`);

    // Create votes table
    await pool.query(`CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      content_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT,
      score INTEGER,
      comment TEXT,
      "like" INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY(content_id) REFERENCES contents(id) ON DELETE CASCADE
    )`);

    // Create likes table
    await pool.query(`CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      vote_id INTEGER NOT NULL,
      PRIMARY KEY(user_id, vote_id),
      FOREIGN KEY(vote_id) REFERENCES votes(id) ON DELETE CASCADE
    )`);

    // Create accounts table
    await pool.query(`CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      account_id TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      token TEXT,
      name TEXT,
      icon INTEGER DEFAULT 0
    )`);

    // Create ranking table
    await pool.query(`CREATE TABLE IF NOT EXISTS ranking (
      id SERIAL PRIMARY KEY,
      song_title TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      chart_hash TEXT NOT NULL,
      account_id TEXT,
      score INTEGER,
      ab_count INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      UNIQUE(song_title, difficulty, chart_hash, account_id)
    )`);

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

async function getClient() {
  const client = await pool.connect();
  return client;
}

// Helper function to execute queries
async function query(text, params) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error("Query error:", error);
    throw error;
  }
}

module.exports = {
  pool,
  initializeDatabase,
  getClient,
  query,
};