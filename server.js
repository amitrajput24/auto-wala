const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const DATA = path.join(__dirname, "data");
const MUSIC = path.join(DATA, "music");

fs.mkdirSync(MUSIC, { recursive: true });

const dbFile = path.join(DATA, "songs.json");

if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, "[]");
}

const read = () =>
  JSON.parse(fs.readFileSync(dbFile, "utf8"));

const write = (data) =>
  fs.writeFileSync(
    dbFile,
    JSON.stringify(data, null, 2)
  );

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MUSIC);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const safe =
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2) +
      ext;

    cb(null, safe);
  }
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    const allowed =
      /audio\/|\.mp3$|\.wav$|\.m4a$|\.ogg$|\.aac$/i;

    if (
      allowed.test(
        file.mimetype + " " + file.originalname
      )
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  express.static(path.join(__dirname, "public"))
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/music", express.static(MUSIC));

app.use(
  "/admin",
  express.static(path.join(__dirname, "admin"))
);


/* LOGIN */

app.post("/api/login", (req, res) => {
  const correct =
    req.body.password === ADMIN_PASSWORD;

  res.json({
    ok: correct,
    token: correct ? ADMIN_PASSWORD : ""
  });
});


/* GET SONGS */

app.get("/api/songs", (req, res) => {
  res.json(read());
});


/* AUTH */

function auth(req, res, next) {

  const token =
    req.headers.authorization || "";

  if (
    token ===
    "Bearer " + ADMIN_PASSWORD
  ) {
    return next();
  }

  res.status(401).json({
    error: "Unauthorized"
  });
}


/* MULTIPLE SONG UPLOAD */

app.post(
  "/api/songs",
  auth,
  upload.array("audio", 50),
  (req, res) => {

    if (
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        error: "No audio files selected"
      });
    }

    const artist =
      req.body.artist ||
      "Various Artists";

    const songs = req.files.map(
      (file) => ({
        id:
          Date.now().toString() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2),

        title:
          path.parse(
            file.originalname
          ).name,

        artist: artist,

        audio:
          "/music/" +
          file.filename,

        cover: "",

        createdAt:
          new Date().toISOString()
      })
    );

    const all = read();

    songs.reverse().forEach(
      (song) => {
        all.unshift(song);
      }
    );

    write(all);

    res.json({
      ok: true,
      count: songs.length,
      songs: songs
    });
  }
);


/* DELETE SONG */

app.delete(
  "/api/songs/:id",
  auth,
  (req, res) => {

    const all = read();

    const song = all.find(
      (x) =>
        x.id === req.params.id
    );

    if (!song) {
      return res.status(404).json({
        error: "Song not found"
      });
    }

    if (song.audio) {

      const file = path.join(
        __dirname,
        "data",
        song.audio.replace(
          "/music/",
          "music/"
        )
      );

      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    write(
      all.filter(
        (x) =>
          x.id !== req.params.id
      )
    );

    res.json({
      ok: true
    });
  }
);


/* START SERVER */

app.listen(
  PORT,
  () => {
    console.log(
      "Auto Wala running on http://localhost:" +
      PORT
    );
  }
);
