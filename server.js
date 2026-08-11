const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";


/* =========================
   DIRECTORIES
========================= */

const DATA = path.join(__dirname, "data");
const MUSIC = path.join(DATA, "music");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(MUSIC, { recursive: true });


/* =========================
   DATABASE FILES
========================= */

const dbFile =
  path.join(DATA, "songs.json");

const analyticsFile =
  path.join(DATA, "analytics.json");


if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, "[]");
}


if (!fs.existsSync(analyticsFile)) {

  fs.writeFileSync(
    analyticsFile,
    JSON.stringify({
      totalVisits: 0,
      totalPlays: 0,
      visitors: {},
      plays: {},
      lastUpdated: new Date().toISOString()
    }, null, 2)
  );

}


/* =========================
   DATABASE HELPERS
========================= */

function readSongs() {

  try {

    return JSON.parse(
      fs.readFileSync(
        dbFile,
        "utf8"
      )
    );

  } catch (error) {

    console.error(
      "songs.json error:",
      error
    );

    return [];

  }

}


function writeSongs(data) {

  fs.writeFileSync(
    dbFile,
    JSON.stringify(
      data,
      null,
      2
    )
  );

}


function readAnalytics() {

  try {

    return JSON.parse(
      fs.readFileSync(
        analyticsFile,
        "utf8"
      )
    );

  } catch (error) {

    return {
      totalVisits: 0,
      totalPlays: 0,
      visitors: {},
      plays: {},
      lastUpdated:
        new Date().toISOString()
    };

  }

}


function writeAnalytics(data) {

  data.lastUpdated =
    new Date().toISOString();

  fs.writeFileSync(
    analyticsFile,
    JSON.stringify(
      data,
      null,
      2
    )
  );

}


/* =========================
   LIVE ONLINE USERS
========================= */

/*
  visitorId -> last heartbeat timestamp

  A visitor is considered online
  if heartbeat was received within
  the last 60 seconds.
*/

const onlineUsers = new Map();

const ONLINE_TIMEOUT = 60 * 1000;


/* Remove inactive users */

setInterval(() => {

  const now = Date.now();

  for (
    const [
      visitorId,
      lastSeen
    ] of onlineUsers
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

}, 30000);


/* =========================
   MULTER UPLOAD
========================= */

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(
          null,
          MUSIC
        );

      },

    filename:
      (req, file, cb) => {

        const ext =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();

        const safeName =
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2) +
          ext;

        cb(
          null,
          safeName
        );

      }

  });


const upload =
  multer({

    storage,

    limits: {

      files: 50,

      /*
        100 MB maximum per file.
        Change if required.
      */

      fileSize:
        100 * 1024 * 1024

    },

    fileFilter:
      (req, file, cb) => {

        const allowed =
          /audio\/|\.mp3$|\.wav$|\.m4a$|\.ogg$|\.aac$/i;

        if (
          allowed.test(
            file.mimetype +
            " " +
            file.originalname
          )
        ) {

          cb(
            null,
            true
          );

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
   MIDDLEWARE
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


/* Public files */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* Music files */

app.use(
  "/music",
  express.static(MUSIC)
);


/* Admin files */

app.use(
  "/admin",
  express.static(
    path.join(
      __dirname,
      "admin"
    )
  )
);


/* =========================
   HOME
========================= */

app.get(
  "/",
  (req, res) => {

    const indexFile =
      path.join(
        __dirname,
        "index.html"
      );

    if (
      fs.existsSync(indexFile)
    ) {

      return res.sendFile(
        indexFile
      );

    }

    res.send(
      "Auto Wala is running 🚕"
    );

  }
);


/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",
  (req, res) => {

    const password =
      req.body &&
      req.body.password;

    const correct =
      password ===
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
   GET SONGS
========================= */

app.get(
  "/api/songs",
  (req, res) => {

    res.json(
      readSongs()
    );

  }
);


/* =========================
   AUTH
========================= */

function auth(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization ||
    "";

  const expected =
    "Bearer " +
    ADMIN_PASSWORD;


  if (
    header === expected
  ) {

    return next();

  }


  return res.status(401).json({

    error:
      "Unauthorized"

  });

}


/* =========================
   MULTIPLE SONG UPLOAD
========================= */

app.post(
  "/api/songs",

  auth,

  upload.array(
    "audio",
    50
  ),

  (req, res) => {

    try {

      if (
        !req.files ||
        req.files.length === 0
      ) {

        return res
          .status(400)
          .json({

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


      const songs =
        req.files.map(
          file => ({

            id:
              Date.now()
                .toString() +
              "-" +
              Math.random()
                .toString(36)
                .slice(2),

            title:
              path
                .parse(
                  file.originalname
                )
                .name,

            artist:
              artist,

            audio:
              "/music/" +
              file.filename,

            cover:
              "",

            createdAt:
              new Date()
                .toISOString()

          })
        );


      const all =
        readSongs();


      /*
        Newest songs appear first.
      */

      songs
        .reverse()
        .forEach(
          song => {
            all.unshift(
              song
            );
          }
        );


      writeSongs(all);


      res.json({

        ok: true,

        count:
          songs.length,

        songs:
          songs

      });

    } catch (error) {

      console.error(
        "Upload error:",
        error
      );

      res
        .status(500)
        .json({

          error:
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

  (req, res) => {

    try {

      const all =
        readSongs();


      const song =
        all.find(
          item =>
            item.id ===
            req.params.id
        );


      if (!song) {

        return res
          .status(404)
          .json({

            error:
              "Song not found"

          });

      }


      /*
        Delete actual audio file.
      */

      if (
        song.audio
      ) {

        const filename =
          path.basename(
            song.audio
          );


        const file =
          path.join(
            MUSIC,
            filename
          );


        if (
          fs.existsSync(file)
        ) {

          fs.unlinkSync(
            file
          );

        }

      }


      const remaining =
        all.filter(
          item =>
            item.id !==
            req.params.id
        );


      writeSongs(
        remaining
      );


      /*
        Remove analytics
        for deleted song.
      */

      const analytics =
        readAnalytics();


      if (
        analytics.plays &&
        analytics.plays[
          req.params.id
        ]
      ) {

        delete analytics.plays[
          req.params.id
        ];

        writeAnalytics(
          analytics
        );

      }


      res.json({
        ok: true
      });


    } catch (error) {

      console.error(
        "Delete error:",
        error
      );

      res
        .status(500)
        .json({

          error:
            "Delete failed"

        });

    }

  }
);


/* =========================
   LIVE HEARTBEAT
========================= */

app.post(
  "/api/heartbeat",
  (req, res) => {

    let visitorId =
      req.body &&
      req.body.visitorId;


    /*
      If browser doesn't provide
      an ID, create one.
    */

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


    /*
      Keep ID reasonably small.
    */

    visitorId =
      visitorId.slice(
        0,
        100
      );


    onlineUsers.set(
      visitorId,
      Date.now()
    );


    /*
      Remove expired users
      before counting.
    */

    const now =
      Date.now();


    for (
      const [
        id,
        lastSeen
      ] of onlineUsers
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

      ok: true,

      online:
        onlineUsers.size

    });

  }
);


/* =========================
   VISITOR TRACKING
========================= */

app.post(
  "/api/visit",
  (req, res) => {

    try {

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


      const analytics =
        readAnalytics();


      /*
        Count unique visitors.
      */

      if (
        !analytics.visitors
      ) {

        analytics.visitors =
          {};

      }


      if (
        !analytics.visitors[
          visitorId
        ]
      ) {

        analytics.visitors[
          visitorId
        ] = {

          firstVisit:
            new Date()
              .toISOString(),

          lastVisit:
            new Date()
              .toISOString()

        };


        analytics.totalVisits =
          (
            analytics.totalVisits ||
            0
          ) + 1;


      } else {

        analytics.visitors[
          visitorId
        ].lastVisit =
          new Date()
            .toISOString();

      }


      writeAnalytics(
        analytics
      );


      res.json({

        ok: true

      });


    } catch (error) {

      console.error(
        "Visit error:",
        error
      );

      res.json({

        ok: false

      });

    }

  }
);


/* =========================
   SONG PLAY TRACKING
========================= */

app.post(
  "/api/play",
  (req, res) => {

    try {

      const songId =
        req.body &&
        req.body.songId;


      if (
        !songId ||
        typeof songId !==
        "string"
      ) {

        return res
          .status(400)
          .json({

            error:
              "songId required"

          });

      }


      const songs =
        readSongs();


      const song =
        songs.find(
          item =>
            item.id ===
            songId
        );


      if (!song) {

        return res
          .status(404)
          .json({

            error:
              "Song not found"

          });

      }


      const analytics =
        readAnalytics();


      if (
        !analytics.plays
      ) {

        analytics.plays =
          {};

      }


      if (
        !analytics.plays[
          songId
        ]
      ) {

        analytics.plays[
          songId
        ] = {

          title:
            song.title,

          artist:
            song.artist,

          plays:
            0

        };

      }


      analytics.plays[
        songId
      ].plays += 1;


      analytics.totalPlays =
        (
          analytics.totalPlays ||
          0
        ) + 1;


      writeAnalytics(
        analytics
      );


      res.json({

        ok: true,

        plays:
          analytics.plays[
            songId
          ].plays

      });


    } catch (error) {

      console.error(
        "Play tracking error:",
        error
      );

      res.json({

        ok: false

      });

    }

  }
);


/* =========================
   ADMIN ANALYTICS
========================= */

app.get(
  "/api/analytics",
  auth,
  (req, res) => {

    try {

      const analytics =
        readAnalytics();


      /*
        Calculate current online.
      */

      const now =
        Date.now();


      for (
        const [
          id,
          lastSeen
        ] of onlineUsers
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


      /*
        Convert plays object
        into sorted array.
      */

      const mostPlayed =
        Object.values(
          analytics.plays || {}
        )
        .sort(
          (a, b) =>
            (b.plays || 0) -
            (a.plays || 0)
        );


      res.json({

        ok: true,

        online:
          onlineUsers.size,

        totalVisits:
          analytics.totalVisits ||
          0,

        totalPlays:
          analytics.totalPlays ||
          0,

        mostPlayed:
          mostPlayed,

        lastUpdated:
          analytics.lastUpdated

      });


    } catch (error) {

      console.error(
        "Analytics error:",
        error
      );

      res
        .status(500)
        .json({

          error:
            "Unable to load analytics"

        });

    }

  }
);


/* =========================
   SIMPLE STATUS API
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
      ] of onlineUsers
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

      ok: true,

      service:
        "Auto Wala",

      online:
        onlineUsers.size,

      songs:
        readSongs().length,

      uptime:
        process.uptime(),

      time:
        new Date()
          .toISOString()

    });

  }
);


/* =========================
   MULTER ERROR HANDLER
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error instanceof
      multer.MulterError
    ) {

      return res
        .status(400)
        .json({

          error:
            "Upload error: " +
            error.message

        });

    }


    if (
      error
    ) {

      console.error(
        error
      );


      return res
        .status(400)
        .json({

          error:
            error.message ||
            "Something went wrong"

        });

    }


    next();

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
      "🎵 Songs:",
      readSongs().length
    );

  }
);
