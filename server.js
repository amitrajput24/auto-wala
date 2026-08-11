<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auto Wala Admin</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 700px;
      margin: 30px auto;
      padding: 20px;
      background: #111;
      color: white;
    }

    h1 {
      text-align: center;
    }

    form {
      background: #222;
      padding: 20px;
      border-radius: 12px;
    }

    input, button {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      margin: 8px 0;
      border-radius: 8px;
      border: none;
    }

    button {
      background: #fff;
      color: #111;
      font-weight: bold;
      cursor: pointer;
    }

    .song {
      background: #222;
      padding: 15px;
      margin-top: 15px;
      border-radius: 12px;
    }

    audio {
      width: 100%;
      margin-top: 10px;
    }

    .delete {
      background: #d33;
      color: white;
    }

    #message {
      text-align: center;
      margin: 15px;
    }
  </style>
</head>

<body>

  <h1>🎵 Auto Wala Admin</h1>

  <form id="uploadForm">

    <input
      type="text"
      id="title"
      placeholder="Song title"
      required
    >

    <input
      type="text"
      id="artist"
      placeholder="Artist name"
    >

    <label>Song file:</label>
    <input
      type="file"
      id="audio"
      accept="audio/*"
      required
    >

    <label>Cover image (optional):</label>
    <input
      type="file"
      id="cover"
      accept="image/*"
    >

    <button type="submit">⬆️ Upload Song</button>

  </form>

  <div id="message"></div>

  <h2>Uploaded Songs</h2>

  <div id="songs"></div>

<script>

const token = localStorage.getItem("adminToken");

if (!token) {
  alert("Please login first");
  location.href = "/admin/";
}

async function loadSongs() {

  const response = await fetch("/api/songs");
  const songs = await response.json();

  const container = document.getElementById("songs");
  container.innerHTML = "";

  if (songs.length === 0) {
    container.innerHTML = "<p>No songs uploaded yet.</p>";
    return;
  }

  songs.forEach(song => {

    const div = document.createElement("div");
    div.className = "song";

    div.innerHTML = `
      <h3>${escapeHtml(song.title)}</h3>
      <p>${escapeHtml(song.artist)}</p>

      ${song.cover ? `<img src="${song.cover}" style="width:100%;max-height:250px;object-fit:cover;border-radius:8px;">` : ""}

      <audio controls src="${song.audio}"></audio>

      <button class="delete" onclick="deleteSong('${song.id}')">
        🗑️ Delete
      </button>
    `;

    container.appendChild(div);
  });
}

async function uploadSong(event) {

  event.preventDefault();

  const message = document.getElementById("message");
  message.innerText = "Uploading...";

  const formData = new FormData();

  formData.append(
    "title",
    document.getElementById("title").value
  );

  formData.append(
    "artist",
    document.getElementById("artist").value
  );

  formData.append(
    "audio",
    document.getElementById("audio").files[0]
  );

  const coverFile = document.getElementById("cover").files[0];

  if (coverFile) {
    formData.append("cover", coverFile);
  }

  try {

    const response = await fetch("/api/songs", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    message.innerText = "✅ Song uploaded successfully!";

    document.getElementById("uploadForm").reset();

    loadSongs();

  } catch (error) {

    message.innerText = "❌ " + error.message;

  }
}

async function deleteSong(id) {

  if (!confirm("Delete this song?")) {
    return;
  }

  const response = await fetch("/api/songs/" + id, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  const data = await response.json();

  if (data.ok) {
    loadSongs();
  } else {
    alert(data.error || "Delete failed");
  }
}

function escapeHtml(text) {

  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;

}

document
  .getElementById("uploadForm")
  .addEventListener("submit", uploadSong);

loadSongs();

</script>

</body>
</html>
