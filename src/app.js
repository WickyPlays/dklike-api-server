require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const contentRoutes = require("./routes/contentRoutes.js");
const voteRoutes = require("./routes/voteRoutes.js");
const likeRoutes = require("./routes/likeRoutes.js");
const accountRoutes = require("./routes/accountRoutes.js");
const rankingRoutes = require("./routes/rankingRoutes.js");
const pageRoutes = require("./routes/pageRoutes.js");
const accountLoginRoute = require("./routes/accountLoginRoutes.js");
const { initializeDatabase } = require("./database.js");

const app = express();
app.use(express.json());
app.use(cors());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// JWT secret
const secret = process.env.JWT_SECRET;
app.set('jwtToken', secret);

// Initialize database
initializeDatabase();

// Routes
app.use("/contents", contentRoutes);
app.use("/votes", voteRoutes);
app.use("/likes", likeRoutes);
app.use("/accounts", accountRoutes);
app.use("/accountLogin", accountLoginRoute);
app.use("/ranking", rankingRoutes);
app.use('/', pageRoutes);

app.get("/support", async (req, res) => {
  res.status(200).json({
    contents: true,
    accounts: true,
    ranking: true,
  });
});

const EXPRESS_PORT = process.env.PORT || 3000;

app.listen(EXPRESS_PORT, () => {
  console.log("[DKLikeAPI] Server running");
});

module.exports = app;