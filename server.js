```js
const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const SUPABASE_URL =
  (process.env.SUPABASE_URL || "").replace(/\/+$/, "");

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || "";

const SUPABASE_BUCKET = "songs";

/* =========================
   CHECK ENVIRONMENT
========================= */

if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL missing");
}

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY missing");
}

/* =========================
   EXPRESS
========================= */

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

/* =========================
   STATIC FILES
========================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.use(
  "/admin",
  express.static(
    path.join(__dirname, "admin")
  )
);

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   MULTER
========================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 50,
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed =
      /audio\/|\.mp3$|\.wav$|\.m4a$|\.ogg$|\.aac$/i;

    if (
      allowed.test(
        file.mimetype +
        " " +
        file.originalname
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only audio files are allowed"
        )
      );
    }
  }
});

/* =========================
   SUPABASE REQUEST
========================= */

async function supabaseRequest(
  endpoint,
  options = {}
) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_KEY
  ) {
    throw new Error(
      "Supabase environment variables are missing"
    );
  }

  const response = await fetch(
    SUPABASE_URL + endpoint,
    {
      ...options,

      headers: {
        apikey:
          SUPABASE_SERVICE_KEY,

        Authorization:
          "Bearer " +
          SUPABASE_SERVICE_KEY,

        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data = null;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.error(
      "Supabase error:",
      response.status,
      data
    );

    throw new Error(
      data?.message ||
      data?.error_description ||
      data?.error ||
      "Supabase request failed"
    );
  }

  return data;
}

/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",
  (req, res) => {
    const correct =
      req.body.password ===
      ADMIN_PASSWORD;

    res.json({
      ok: correct,

      token:
        correct
          ? ADMIN_PASSWORD
          : ""
    });
  }
);

/* =========================
   AUTH
========================= */

function auth(req, res, next) {
  const token =
    req.headers.authorization || "";

  if (
    token ===
    "Bearer " +
    ADMIN_PASSWORD
  ) {
    return next();
  }

  return res.status(401).json({
    error:
      "Unauthorized"
  });
}

/* =========================
   GET SONGS
========================= */

app.get(
  "/api/songs",
  async (req, res) => {
    try {
      const rows =
        await supabaseRequest(
          "/rest/v1/songs" +
          "?select=*" +
          "&order=created_at.desc"
        );

      const songs =
        (rows || []).map(song => ({
          id:
            song.id,

          title:
            song.title,

          artist:
            song.artist,

          audio:
            song.audio,

          cover:
            song.cover || "",

          createdAt:
            song.created_at
        }));

      res.json(songs);

    } catch (error) {
      console.error(
        "GET SONGS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load songs"
      });
    }
  }
);

/* =========================
   UPLOAD SONGS
========================= */

app.post(
  "/api/songs",
  auth,
  upload.array("audio", 50),

  async (req, res) => {
    try {
      if (
        !req.files ||
        req.files.length === 0
      ) {
        return res.status(400).json({
          error:
            "No audio files selected"
        });
      }

      const artist =
        (
          req.body &&
          req.body.artist
        ) ||
        "Various Artists";

      const uploadedSongs = [];

      for (
        const file
        of req.files
      ) {

        /* FILE NAME */

        const ext =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();

        const baseName =
          path
            .parse(
              file.originalname
            )
            .name
            .replace(
              /[^a-zA-Z0-9_-]/g,
              "_"
            );

        const uniqueName =
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2) +
          "-" +
          baseName +
          ext;

        /* UPLOAD TO STORAGE */

        await supabaseRequest(
          "/storage/v1/object/" +
          SUPABASE_BUCKET +
          "/" +
          encodeURIComponent(
            uniqueName
          ),

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                file.mimetype ||
                "audio/mpeg",

              "x-upsert":
                "false"
            },

            body:
              file.buffer
          }
        );

        /* PUBLIC URL */

        const audioUrl =
          SUPABASE_URL +
          "/storage/v1/object/public/" +
          SUPABASE_BUCKET +
          "/" +
          encodeURIComponent(
            uniqueName
          );

        /* DATABASE RECORD */

        const song = {
          id:
            Date.now()
              .toString() +
            "-" +
            Math.random()
              .toString(36)
              .slice(2),

          title:
            path.parse(
              file.originalname
            ).name,

          artist:
            artist,

          audio:
            audioUrl,

          cover:
            "",

          created_at:
            new Date()
              .toISOString()
        };

        await supabaseRequest(
          "/rest/v1/songs",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Prefer":
                "return=minimal"
            },

            body:
              JSON.stringify(song)
          }
        );

        uploadedSongs.push({
          id:
            song.id,

          title:
            song.title,

          artist:
            song.artist,

          audio:
            song.audio,

          cover:
            song.cover,

          createdAt:
            song.created_at
        });
      }

      res.json({
        ok:
          true,

        count:
          uploadedSongs.length,

        songs:
          uploadedSongs
      });

    } catch (error) {
      console.error(
        "UPLOAD ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Upload failed"
      });
    }
  }
);

/* =========================
   DELETE SONG
========================= */

app.delete(
  "/api/songs/:id",
  auth,

  async (req, res) => {
    try {

      /* GET SONG */

      const rows =
        await supabaseRequest(
          "/rest/v1/songs" +
          "?id=eq." +
          encodeURIComponent(
            req.params.id
          ) +
          "&select=*"
        );

      if (
        !rows ||
        rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Song not found"
        });
      }

      const song =
        rows[0];

      /* FIND STORAGE FILE */

      let storagePath =
        null;

      const marker =
        "/storage/v1/object/public/" +
        SUPABASE_BUCKET +
        "/";

      if (
        song.audio &&
        song.audio.includes(
          marker
        )
      ) {
        storagePath =
          song.audio.split(
            marker
          )[1];

        storagePath =
          decodeURIComponent(
            storagePath
          );
      }

      /* DELETE STORAGE */

      if (storagePath) {
        try {
          await supabaseRequest(
            "/storage/v1/object/" +
            SUPABASE_BUCKET +
            "/" +
            encodeURIComponent(
              storagePath
            ),

            {
              method:
                "DELETE"
            }
          );

        } catch (storageError) {
          console.error(
            "Storage delete error:",
            storageError
          );
        }
      }

      /* DELETE DATABASE ROW */

      await supabaseRequest(
        "/rest/v1/songs" +
        "?id=eq." +
        encodeURIComponent(
          req.params.id
        ),

        {
          method:
            "DELETE"
        }
      );

      res.json({
        ok:
          true
      });

    } catch (error) {
      console.error(
        "DELETE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Delete failed"
      });
    }
  }
);

/* =========================
   ONLINE USERS
========================= */

const onlineUsers =
  new Map();

const ONLINE_TIMEOUT =
  60 * 1000;

/* REMOVE INACTIVE USERS */

setInterval(
  () => {
    const now =
      Date.now();

    for (
      const [
        visitorId,
        lastSeen
      ]
      of onlineUsers
    ) {
      if (
        now - lastSeen >
        ONLINE_TIMEOUT
      ) {
        onlineUsers.delete(
          visitorId
        );
      }
    }
  },
  30000
);

/* =========================
   HEARTBEAT
========================= */

app.post(
  "/api/heartbeat",
  (req, res) => {

    let visitorId =
      req.body &&
      req.body.visitorId;

    if (
      !visitorId ||
      typeof visitorId !==
      "string"
    ) {
      visitorId =
        "visitor-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2);
    }

    visitorId =
      visitorId.slice(
        0,
        100
      );

    onlineUsers.set(
      visitorId,
      Date.now()
    );

    /* CLEAN OLD USERS */

    const now =
      Date.now();

    for (
      const [
        id,
        lastSeen
      ]
      of onlineUsers
    ) {
      if (
        now - lastSeen >
        ONLINE_TIMEOUT
      ) {
        onlineUsers.delete(
          id
        );
      }
    }

    res.json({
      ok:
        true,

      online:
        onlineUsers.size
    });
  }
);

/* =========================
   STATUS
========================= */

app.get(
  "/api/status",
  (req, res) => {

    const now =
      Date.now();

    for (
      const [
        id,
        lastSeen
      ]
      of onlineUsers
    ) {
      if (
        now - lastSeen >
        ONLINE_TIMEOUT
      ) {
        onlineUsers.delete(
          id
        );
      }
    }

    res.json({
      ok:
        true,

      service:
        "Auto Wala",

      online:
        onlineUsers.size,

      uptime:
        process.uptime(),

      time:
        new Date()
          .toISOString()
    });
  }
);

/* =========================
   VISIT API
========================= */

app.post(
  "/api/visit",
  (req, res) => {
    res.json({
      ok:
        true
    });
  }
);

/* =========================
   PLAY API
========================= */

app.post(
  "/api/play",

  async (req, res) => {
    try {

      const songId =
        req.body &&
        req.body.songId;

      if (
        !songId ||
        typeof songId !==
        "string"
      ) {
        return res.status(400).json({
          error:
            "songId required"
        });
      }

      const rows =
        await supabaseRequest(
          "/rest/v1/songs" +
          "?id=eq." +
          encodeURIComponent(
            songId
          ) +
          "&select=id,title,artist"
        );

      if (
        !rows ||
        rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Song not found"
        });
      }

      res.json({
        ok:
          true
      });

    } catch (error) {

      console.error(
        "PLAY ERROR:",
        error
      );

      res.json({
        ok:
          false
      });
    }
  }
);

/* =========================
   ANALYTICS
========================= */

app.get(
  "/api/analytics",
  auth,

  (req, res) => {

    const now =
      Date.now();

    for (
      const [
        id,
        lastSeen
      ]
      of onlineUsers
    ) {
      if (
        now - lastSeen >
        ONLINE_TIMEOUT
      ) {
        onlineUsers.delete(
          id
        );
      }
    }

    res.json({
      ok:
        true,

      online:
        onlineUsers.size,

      totalVisits:
        0,

      totalPlays:
        0
    });
  }
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        error:
          "Upload error: " +
          error.message
      });
    }

    res.status(500).json({
      error:
        error.message ||
        "Server error"
    });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      "🚕 Auto Wala running on port " +
      PORT
    );

    console.log(
      "☁️ Supabase bucket: " +
      SUPABASE_BUCKET
    );
  }
);
```
