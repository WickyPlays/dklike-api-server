$(document).ready(function () {
  $("th").on("click", function () {
    const index = $(this).index();
    const rows = $("tbody tr").get();
    const isNumericColumn = $(this).hasClass("numeric");
    let isAscending = $(this).hasClass("sorted-asc");

    // Reset sorting arrows
    $("th").removeClass("sorted-asc sorted-desc");

    // Sort rows
    rows.sort((rowA, rowB) => {
      const cellA = $(rowA).children().eq(index).text();
      const cellB = $(rowB).children().eq(index).text();

      if (index === 0) {
        let valA = parseInt(cellA, 10);
        let valB = parseInt(cellB, 10);
        return isAscending ? valA - valB : valB - valA;
      }

      let valA = isNumericColumn
        ? parseFloat(cellA)
        : cellA.toLowerCase();
      let valB = isNumericColumn
        ? parseFloat(cellB)
        : cellB.toLowerCase();

      if (valA < valB) return isAscending ? -1 : 1;
      if (valA > valB) return isAscending ? 1 : -1;
      return 0;
    });

    $.each(rows, function (index, row) {
      $("tbody").append(row);
    });

    if (isAscending) {
      $(this).addClass("sorted-desc");
    } else {
      $(this).addClass("sorted-asc");
    }
  });
});