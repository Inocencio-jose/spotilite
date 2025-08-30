const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const mm = require("music-metadata");

const app = express();
const PORT = 3000;

app.use(cors());

const MUSIC_DIR = path.join(__dirname, "musicas");
const COVER_DIR = path.join(__dirname, "covers");

// garante que a pasta covers exista
if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR);

// Função para extrair metadados de um arquivo de música
async function getMetadata(file, index) {
  const filePath = path.join(MUSIC_DIR, file);
  try {
    const metadata = await mm.parseFile(filePath);

    // tenta pegar capa
    let coverUrl = "";
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      const coverName = `${path.basename(file, ".mp3")}.jpg`;
      const coverPath = path.join(COVER_DIR, coverName);
      fs.writeFileSync(coverPath, pic.data); // salva a capa como arquivo
      coverUrl = `http://localhost:${PORT}/covers/${coverName}`;
    }

    return {
      id: index + 1,
      title: metadata.common.title || path.basename(file, ".mp3"),
      artist: metadata.common.artist || "Desconhecido",
      album: metadata.common.album || "",
      duration: metadata.format.duration || 0,
      url: `http://localhost:${PORT}/musicas/${encodeURIComponent(file)}`,
      cover: coverUrl,
    };
  } catch (err) {
    console.error("Erro ao ler metadados:", err.message);
    return {
      id: index + 1,
      title: path.basename(file, ".mp3"),
      artist: "Desconhecido",
      album: "",
      duration: 0,
      url: `http://localhost:${PORT}/musicas/${encodeURIComponent(file)}`,
      cover: "",
    };
  }
}

// endpoint para listar músicas
app.get("/musicas", async (req, res) => {
  try {
    const files = fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith(".mp3"));
    const lista = await Promise.all(files.map((f, i) => getMetadata(f, i)));
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar músicas" });
  }
});

// endpoint para servir arquivos de música
app.get("/musicas/:file", (req, res) => {
  const filePath = path.join(MUSIC_DIR, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).send("Arquivo não encontrado");
  res.setHeader("Content-Type", "audio/mpeg");
  fs.createReadStream(filePath).pipe(res);
});

// endpoint para servir capas
app.use("/covers", express.static(COVER_DIR));

app.listen(PORT, () => {
  console.log("🎵 Spotilite API conectada");
  console.log(`Você pode acessar apartir de Localhost/spotilite-pwa ou use o app windows já instalado`);
});