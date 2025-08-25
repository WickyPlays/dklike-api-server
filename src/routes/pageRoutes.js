const express = require("express");
const router = express.Router();
const { query } = require("../database");
const { convertLinkToDownloadable } = require("../converter.js");

function transformContent(content) {
  return {
    id: Number(content.id),
    contentType: Number(content.content_type),
    title: content.title,
    publisher: content.publisher,
    description: content.description,
    downloadUrl: convertLinkToDownloadable(content.download_url),
    imageUrl: content.image_url,
    date: new Date(content.date),
    downloadCount: Number(content.download_count),
    voteAverageScore: Number(content.vote_average_score),
    songInfo: JSON.parse(
      content.song_info || '{"difficulties":[0,0,0,0,0],"hasLua":false}'
    ),
  };
}

router.get("/", async (req, res) => {
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
      whereClause = `WHERE ${searchBy} ILIKE $1`;
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
        column = "content_type";
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
        column = "download_count";
        break;
      case "score":
        column = "vote_average_score";
        break;
      case "lua":
        column = `song_info ->> 'hasLua'`;
        break;
      default:
        column = "id";
    }
    const order = sortOrder.toUpperCase();
    orderBy = `ORDER BY ${column} ${order}`;

    const totalContentsQuery = `
      SELECT COUNT(*) AS count FROM contents ${whereClause}
    `;
    const totalContents = await query(totalContentsQuery, baseParams);
    const totalPages = Math.ceil(totalContents.rows[0].count / itemsPerPage);

    const contentsQuery = `
      SELECT * FROM contents ${whereClause} ${orderBy} LIMIT $1 OFFSET $2
    `;
    const contents = await query(contentsQuery, params);

    const list = contents.rows.map(transformContent);
    const contentsWithFormattedDate = list.map((content) => ({
      ...content,
      date: content.date.toISOString().slice(0, 10).replace(/-/g, "/"),
    }));

    res.render("main", {
      contents: contentsWithFormattedDate,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalContents.rows[0].count,
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