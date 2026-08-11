const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

const SUPABASE_BUCKET = "songs";


/* CHECK SUPABASE */

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Supabase environment variables missing");
}


/* EXPRESS */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  express.static(path.join(__dirname, "public"))
);

app.use(
  "/admin",
  express.static(path.join(__dirname, "admin"))
);


/* MULTER */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 50
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


/* SUPABASE REQUEST */

async function supabaseRequest(
  endpoint,
  options = {}
) {

  const response =
    await fetch(
      SUPABASE_URL +
      endpoint,
      {
        ...options,

        headers: {
          apikey:
            SUPABASE_SERVICE_KEY,

          Authorization:
            "Bearer " +
            SUPABASE_SERVICE_KEY,

          ...options.headers
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


/* HOME */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


/* LOGIN */

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


/* AUTH */

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
    error: "Unauthorized"
  });

}


/* GET SONGS */

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

          id: song.id,

          title: song.title,

          artist: song.artist,

          audio: song.audio,

          cover: song.cover || "",

          createdAt:
            song.created_at

        }));

      res.json(songs);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Unable to load songs"
      });

    }

  }
);


/* UPLOAD SONGS */

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
        req.body.artist ||
        "Various Artists";


      const uploadedSongs = [];


      for (const file of req.files) {

        const ext =
          path.extname(
            file.originalname
          ).toLowerCase();


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


        /* UPLOAD TO SUPABASE STORAGE */

        await supabaseRequest(
          "/storage/v1/object/" +
          SUPABASE_BUCKET +
          "/" +
          encodeURIComponent(
            uniqueName
          ),
          {

            method: "POST",

            headers: {
              "Content-Type":
                file.mimetype ||
                "audio/mpeg",

              "x-upsert":
                "false"
            },

            body: file.buffer

          }
        );


        /* PUBLIC AUDIO URL */

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
            Date.now().toString() +
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
            new Date().toISOString()

        };


        await supabaseRequest(
          "/rest/v1/songs",
          {

            method: "POST",

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
          id: song.id,
          title: song.title,
          artist: song.artist,
          audio: song.audio,
          cover: song.cover,
          createdAt:
            song.created_at
        });

      }


      res.json({

        ok: true,

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


/* DELETE SONG */

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

      let storagePath = null;


      if (
        song.audio &&
        song.audio.includes(
          "/storage/v1/object/public/" +
          SUPABASE_BUCKET +
          "/"
        )
      ) {

        storagePath =
          song.audio.split(
            "/storage/v1/object/public/" +
            SUPABASE_BUCKET +
            "/"
          )[1];

        storagePath =
          decodeURIComponent(
            storagePath
          );

      }


      /* DELETE STORAGE FILE */

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
              method: "DELETE"
            }
          );

        } catch (storageError) {

          console.error(
            "Storage delete error:",
            storageError
          );

        }

      }


      /* DELETE DATABASE RECORD */

      await supabaseRequest(
        "/rest/v1/songs" +
        "?id=eq." +
        encodeURIComponent(
          req.params.id
        ),
        {
          method: "DELETE"
        }
      );


      res.json({
        ok: true
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


/* ERROR HANDLER */

app.use(
  (error, req, res, next) => {

    console.error(error);

    res.status(500).json({

      error:
        error.message ||
        "Server error"

    });

  }
);


/* START */

app.listen(
  PORT,
  () => {

    console.log(
      "🚕 Auto Wala running on port " +
      PORT
    );

  }
);
