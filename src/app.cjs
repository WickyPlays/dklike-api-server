const express = require("express");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const { convertLinkToDownloadable } = require("./converter.cjs");

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const XLSX_FILE = path.resolve(__dirname, "database/charts.xlsx");
const successMessage = { message: "Operation was successful." };

function initializeDatabase() {
  if (!fs.existsSync(XLSX_FILE)) {
    const workbook = xlsx.utils.book_new();
    const sheets = {
      contents: [["id", "contentType", "title", "publisher", "description", "downloadUrl", "imageUrl", "date", "downloadCount", "voteAverageScore", "songInfo"]],
      votes: [["id", "contentId", "userId", "name", "score", "comment", "like", "date"]],
      likes: [["userId", "voteId"]],
    };
    Object.entries(sheets).forEach(([name, data]) => xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(data), name));
    xlsx.writeFile(workbook, XLSX_FILE);
  }
}

initializeDatabase();

function readSheet(sheetName) {
  const workbook = xlsx.readFile(XLSX_FILE);
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function writeSheet(sheetName, data) {
  const workbook = xlsx.readFile(XLSX_FILE);
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
  xlsx.writeFile(workbook, XLSX_FILE);
}

app.get("/", async (req, res) => {
  const contents = readSheet("contents");
  res.render("main", { contents, currentPage: 1, totalPages: 1, totalCount: contents.length, searchBy: "title", search: "" });
});

app.get("/support", async (req, res) => {
  res.status(200).json({
    contents: true
  });
});

app.get("/contents", (req, res) => {
  const contents = readSheet("contents").map(c => ({ ...c, downloadUrl: convertLinkToDownloadable(c.downloadUrl) }));
  res.status(200).json({ contents });
});

app.get("/contents/:id", (req, res) => {
  console.log("ASD")
  const content = readSheet("contents").find(c => c.id == req.params.id);
  if (content) content.downloadUrl = convertLinkToDownloadable(content.downloadUrl);
  console.log(content)
  res.status(200).json({ contents: content });
});

app.put("/contents/:id/downloaded", (req, res) => {
  const contents = readSheet("contents");
  const index = contents.findIndex(c => c.id == req.params.id);
  if (index !== -1) contents[index].downloadCount++;
  writeSheet("contents", contents);
  res.status(200).send(successMessage);
});

app.get("/contents/:id/description", (req, res) => {
  const content = readSheet("contents").find(c => c.id == req.params.id);
  if (content) {
    res.status(200).json({ description: content.description, imageUrl: content.imageUrl, downloadUrl: convertLinkToDownloadable(content.downloadUrl) });
  } else {
    res.status(404).send({ error: "Content not found" });
  }
});

app.get("/votes", (req, res) => {
  res.status(200).json({ votes: readSheet("votes") });
});

app.get("/contents/:id/vote", (req, res) => {
  res.status(200).json({ votes: readSheet("votes").filter(v => v.contentId == req.params.id) });
});

app.post("/contents/:id/vote", (req, res) => {
  const votes = readSheet("votes");
  const newVote = { id: votes.length + 1, ...req.body, contentId: req.params.id };
  votes.push(newVote);
  writeSheet("votes", votes);
  res.status(200).send(successMessage);
});

app.put("/likes/:userId", (req, res) => {
  const likes = readSheet("likes");
  likes.push({ userId: req.params.userId, voteId: req.body.voteId });
  writeSheet("likes", likes);
  res.status(200).send(successMessage);
});

const EXPRESS_PORT = process.env.PORT || 3000;
app.listen(EXPRESS_PORT, () => console.log("server running"));
