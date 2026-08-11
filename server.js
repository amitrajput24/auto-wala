const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend
app.use(express.static(__dirname));

// Online heartbeat
app.post("/api/heartbeat", (req, res) => {
  res.json({
    online: 1
  });
});

// Visit
app.post("/api/visit", (req, res) => {
  res.json({
    ok: true
  });
});

// Song play
app.post("/api/play", (req, res) => {
  res.json({
    ok: true
  });
});

// Open website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Auto Wala running on port ${PORT}`);
});
