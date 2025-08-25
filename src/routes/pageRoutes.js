const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");
const { convertLinkToDownloadable } = require("../converter.js");

function transformContent(content) {
  return {
    id: Number(content.id),
    contentType: Number(content.contentType),
    title: content.title,
    publisher: content.publisher,
    description: content.description,
    downloadUrl: convertLinkToDownloadable(content.downloadUrl),
    imageUrl: content.imageUrl,
    date: new Date(content.date),
    downloadCount: Number(content.downloadCount),
    voteAverageScore: Number(content.voteAverageScore),
    songInfo: JSON.parse(
      content.songInfo || '{"difficulties":[0,0,0,0,0],"hasLua":false}'
    ),
  };
}

router.get("/", async (req, res) => {
  const db = await dbPromise;

  const searchBy = req.query.searchBy || "title";
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const sortBy = req.query.sortBy || "id";
  const sortOrder = req.query.sortOrder && req.query.sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
  const itemsPerPage = 15;
  const offset = (page - 1) * itemsPerPage;

  try {
    let whereClause = "";
    let params = [itemsPerPage, offset];
    let baseParams = [];

    if (search.trim()) {
      whereClause = `WHERE ${searchBy} LIKE ?`;
      baseParams = [`%${search}%`];
      params = [...baseParams, ...params];
    }

    let orderBy = "";
    let column = "";
    switch (sortBy) {
      case "id":
        column = "id";
        break;
      case "type":
        column = "contentType";
        break;
      case "title":
        column = "title";
        break;
      case "publisher":
        column = "publisher";
        break;
      case "date":
        column = "date";
        break;
      case "downloads":
        column = "downloadCount";
        break;
      case "score":
        column = "voteAverageScore";
        break;
      case "lua":
        column = `json_extract(songInfo, '$.hasLua')`;
        break;
      default:
        column = "id";
    }
    const order = sortOrder.toUpperCase();
    orderBy = `ORDER BY ${column} ${order}`;

    const totalContentsQuery = `
      SELECT COUNT(*) AS count FROM contents ${whereClause}
    `;
    const totalContents = await db.get(totalContentsQuery, baseParams);
    const totalPages = Math.ceil(totalContents.count / itemsPerPage);

    const contentsQuery = `
      SELECT * FROM contents ${whereClause} ${orderBy} LIMIT ? OFFSET ?
    `;
    const contents = await db.all(contentsQuery, params);

    const list = contents.map(transformContent);
    const contentsWithFormattedDate = list.map((content) => ({
      ...content,
      date: content.date.toISOString().slice(0, 10).replace(/-/g, "/"),
    }));

    res.render("main", {
      contents: contentsWithFormattedDate,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalContents.count,
      searchBy: searchBy,
      search: search,
      sortBy: sortBy,
      sortOrder: sortOrder,
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;