const fs = require("fs");
const path = require("path");

const logoBase64 = fs.readFileSync(path.join(__dirname, "alphabeta.png")).toString("base64");
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

module.exports = { logoDataUrl };
