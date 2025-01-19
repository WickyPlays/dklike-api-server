function convertLinkToDownloadable(link) {
  if (link.includes("drive.google.com")) {
    const match = link.match(/\/file\/d\/(.*?)\/(?:view|edit)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    } else {
      return link;
    }
  }

  return link
}

module.exports = {
  convertLinkToDownloadable
}
