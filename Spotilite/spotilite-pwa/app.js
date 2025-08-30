const state = {
  results: [],
  queue: [],
  currentIndex: -1,
  db: null,
  cacheLimitMB: 80,
  repeatMode: 'none', // 'none', 'all', 'one'
  shuffle: false,
};

const API_BASE = "http://localhost:3000";

const audio = document.getElementById('audio');
const npCover = document.getElementById('npCover');
const npTitle = document.getElementById('npTitle');
const npArtist = document.getElementById('npArtist');
const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');
const queueList = document.getElementById('queueList');
const cacheUsageEl = document.getElementById('cacheUsage');
const cacheLimitEl = document.getElementById('cacheLimit');
cacheLimitEl.textContent = state.cacheLimitMB + " MB";

// Carregar lamejs via CDN
const lamejsScript = document.createElement('script');
lamejsScript.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
document.head.appendChild(lamejsScript);

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('spotilite-db', 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('songs')) {
        const store = db.createObjectStore('songs', { keyPath: 'id' });
        store.createIndex('lastUsed', 'lastUsed', { unique: false });
        store.createIndex('size', 'size', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function dbPutSong(record) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('songs', 'readwrite');
    tx.objectStore('songs').put(record);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function dbGetSong(id) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('songs', 'readonly');
    const req = tx.objectStore('songs').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

async function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('songs', 'readonly');
    const req = tx.objectStore('songs').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = reject;
  });
}

async function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('songs', 'readwrite');
    tx.objectStore('songs').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function bytesToMB(bytes) { return bytes / 1024 / 1024; }

async function updateCacheUsage() {
  const all = await dbGetAll();
  const total = all.reduce((sum, r) => sum + (r.size || 0), 0);
  cacheUsageEl.textContent = `${(await bytesToMB(total)).toFixed(1)} MB`;
  return total;
}

async function enforceCacheLimit() {
  let total = await updateCacheUsage();
  const limitBytes = state.cacheLimitMB * 1024 * 1024;
  if (total <= limitBytes) return;

  const all = await dbGetAll();
  all.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
  for (const rec of all) {
    if (total <= limitBytes) break;
    await dbDelete(rec.id);
    total -= rec.size || 0;
  }
  await updateCacheUsage();
}

// Função para compactar áudio para MP3 usando lamejs
async function compressAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Configurar lamejs
  const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128); // Mono, 128kbps
  const samples = audioBuffer.getChannelData(0); // Canal esquerdo (mono)
  const sampleBlockSize = 1152; // Bloco típico para MP3
  const mp3Data = [];

  // Converter amostras para inteiros 16-bit
  const intSamples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    intSamples[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  }

  // Codificar em blocos
  for (let i = 0; i < intSamples.length; i += sampleBlockSize) {
    const block = intSamples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3Encoder.encodeBuffer(block);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  // Finalizar codificação
  const mp3buf = mp3Encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  // Criar blob MP3
  const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
  audioContext.close();
  return mp3Blob;
}

// API Search
async function searchApi(query) {
  const resp = await fetch(`${API_BASE}/musicas`);
  const all = await resp.json();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(m =>
    (m.title || '').toLowerCase().includes(q) ||
    (m.artist || '').toLowerCase().includes(q) ||
    (m.album || '').toLowerCase().includes(q)
  );
}

// UI Renderers
function renderResults() {
  resultsList.innerHTML = '';
  state.results.forEach(track => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = track.cover || 'icons/icon-512.png';
    img.alt = track.title || 'sem título';

    const info = document.createElement('div');
    info.className = 'info';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = track.title || '—';

    const artist = document.createElement('div');
    artist.className = 'artist';
    artist.textContent = track.artist || '—';

    const album = document.createElement('div');
    album.className = 'album';
    album.textContent = track.album || '';

    const duration = document.createElement('div');
    duration.className = 'duration';
    duration.textContent = formatTime(track.duration || 0);

    info.appendChild(title);
    info.appendChild(artist);
    info.appendChild(album);
    info.appendChild(duration);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'icon play';
    playBtn.innerHTML = `<i class="ri-play-line"></i>`;
    playBtn.title = 'Reproduzir';
    playBtn.onclick = () => addToQueueAndPlay(track);

    const cacheBtn = document.createElement('button');
    cacheBtn.className = 'icon cache';
    cacheBtn.innerHTML = `<i class="ri-download-2-line"></i>`;
    cacheBtn.title = 'Salvar no cache para offline';
    cacheBtn.onclick = () => ensureCached(track);

    actions.appendChild(playBtn);
    actions.appendChild(cacheBtn);

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);
    resultsList.appendChild(card);
  });
}

async function renderCachedSongs() {
  const all = await dbGetAll();
  const cachedList = document.getElementById("cachedList");
  cachedList.innerHTML = "";

  if (all.length === 0) {
    cachedList.innerHTML = "<p>Nenhuma música offline salva.</p>";
    return;
  }

  all.forEach(rec => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = rec.cover || 'icons/icon-512.png';
    img.alt = rec.title;

    const info = document.createElement("div");
    info.className = "info";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = rec.title;

    const artist = document.createElement("div");
    artist.className = "artist";
    artist.textContent = rec.artist || "—";

    const album = document.createElement("div");
    album.className = "album";
    album.textContent = rec.album || "";

    const duration = document.createElement("div");
    duration.className = "duration";
    duration.textContent = formatTime(rec.duration || 0);

    info.appendChild(title);
    info.appendChild(artist);
    info.appendChild(album);
    info.appendChild(duration);

    const actions = document.createElement("div");
    actions.className = "actions";

    const playBtn = document.createElement("button");
    playBtn.className = "icon play";
    playBtn.innerHTML = `<i class="ri-play-line"></i>`;
    playBtn.title = "Reproduzir";
    playBtn.onclick = () => {
      state.queue = [rec, ...state.queue];
      state.currentIndex = 0;
      playAt(0);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "icon";
    delBtn.innerHTML = `<i class="ri-delete-bin-7-line"></i>`;
    delBtn.title = "Remover do cache";
    delBtn.onclick = async () => {
      await dbDelete(rec.id);
      await updateCacheUsage();
      renderCachedSongs();
    };

    actions.appendChild(playBtn);
    actions.appendChild(delBtn);

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);
    cachedList.appendChild(card);
  });
}

function renderQueue() {
  queueList.innerHTML = '';
  state.queue.forEach((t, idx) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.index = idx;
    li.className = idx === state.currentIndex ? 'playing' : '';
    const img = document.createElement('img');
    img.src = t.cover || 'icons/icon-512.png';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="title">${t.title || '—'}</div><div class="artist">${t.artist || '—'}</div>`;
    const play = document.createElement('button');
    play.className = 'icon';
    play.innerHTML = `<i class="ri-play-line"></i>`;
    play.onclick = () => playAt(idx);
    const del = document.createElement('button');
    del.className = 'icon';
    del.innerHTML = `<i class="ri-delete-bin-7-line"></i>`;
    del.onclick = () => {
      state.queue.splice(idx, 1);
      if (idx < state.currentIndex) state.currentIndex--;
      else if (idx === state.currentIndex && state.currentIndex >= state.queue.length) state.currentIndex = state.queue.length - 1;
      renderQueue();
    };
    li.appendChild(img);
    li.appendChild(meta);
    li.appendChild(play);
    li.appendChild(del);
    queueList.appendChild(li);

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      const toIndex = idx;
      if (fromIndex !== toIndex) {
        const [moved] = state.queue.splice(fromIndex, 1);
        state.queue.splice(toIndex, 0, moved);
        if (state.currentIndex === fromIndex) state.currentIndex = toIndex;
        else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) state.currentIndex--;
        else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) state.currentIndex++;
        renderQueue();
      }
    });
  });
}

function setNowPlaying(track) {
  npCover.src = track.cover || 'icons/icon-512.png';
  npTitle.textContent = track.title || '—';
  npArtist.textContent = `${track.artist || '—'} • ${track.album || ''}`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      artwork: [
        { src: track.cover || 'icons/icon-512.png', sizes: '96x96', type: 'image/png' },
        { src: track.cover || 'icons/icon-512.png', sizes: '256x256', type: 'image/png' },
      ]
    });
  }
  renderQueue();
}

async function ensureCached(track) {
  const id = String(track.id);
  const existing = await dbGetSong(id);
  if (existing?.blob) {
    await dbPutSong({ ...existing, lastUsed: Date.now() });
    await updateCacheUsage();
    renderCachedSongs();
    return existing.blob;
  }
  const resp = await fetch(track.url, { mode: 'cors' });
  let blob = await resp.blob();
  
  // Compactar o áudio para MP3
  try {
    blob = await compressAudio(blob);
  } catch (e) {
    console.error('Erro ao compactar áudio:', e);
    // Fallback: usar blob original se a compactação falhar
  }

  const rec = {
    id,
    title: track.title,
    artist: track.artist || '',
    album: track.album || '',
    duration: track.duration || 0,
    cover: track.cover || 'icons/icon-512.png',
    size: blob.size,
    lastUsed: Date.now(),
    blob,
  };
  await dbPutSong(rec);
  await enforceCacheLimit();
  await updateCacheUsage();
  renderCachedSongs();
  return blob;
}

async function playTrack(track) {
  setNowPlaying(track);
  try {
    const rec = await dbGetSong(String(track.id));
    let src;
    if (rec?.blob) {
      await dbPutSong({ ...rec, lastUsed: Date.now() });
      src = URL.createObjectURL(rec.blob);
    } else {
      const blob = await ensureCached(track);
      src = URL.createObjectURL(blob);
    }
    audio.src = src;
    await audio.play();
    playPauseBtn.innerHTML = `<i class="ri-pause-line"></i>`;
  } catch (e) {
    console.error(e);
  }
}

function addToQueueAndPlay(track) {
  state.queue.push(track);
  renderQueue();
  if (state.currentIndex === -1) {
    state.currentIndex = 0;
    playAt(0);
  }
}

function playAt(idx) {
  if (idx < 0 || idx >= state.queue.length) return;
  state.currentIndex = idx;
  const track = state.queue[idx];
  playTrack(track);
}

function shuffleQueue() {
  if (state.queue.length <= 1) return;
  const currentTrack = state.queue[state.currentIndex];
  state.queue = state.queue.filter((_, i) => i !== state.currentIndex);
  state.queue.sort(() => Math.random() - 0.5);
  state.queue.unshift(currentTrack);
  state.currentIndex = 0;
  renderQueue();
}

// Controls
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const volume = document.getElementById('volume');
const seek = document.getElementById('seek');
const timeLabel = document.getElementById('timeLabel');
const nowPlaying = document.getElementById('nowPlaying');
const queueToggleBtn = document.getElementById('queueToggleBtn');
const queueSection = document.querySelector('.queue');

playPauseBtn.onclick = () => {
  if (audio.paused) {
    audio.play().then(() => {
      playPauseBtn.innerHTML = `<i class="ri-pause-line"></i>`;
    }).catch(console.error);
  } else {
    audio.pause();
    playPauseBtn.innerHTML = `<i class="ri-play-line"></i>`;
  }
};

prevBtn.onclick = () => {
  if (state.currentIndex > 0) {
    playAt(state.currentIndex - 1);
  } else if (state.repeatMode === 'all' && state.queue.length > 0) {
    playAt(state.queue.length - 1);
  }
};

nextBtn.onclick = () => {
  if (state.currentIndex < state.queue.length - 1) {
    playAt(state.currentIndex + 1);
  } else if (state.repeatMode === 'all' && state.queue.length > 0) {
    playAt(0);
  }
};

volume.oninput = () => audio.volume = Number(volume.value);

shuffleBtn.onclick = () => {
  state.shuffle = !state.shuffle;
  if (state.shuffle) {
    shuffleQueue();
    shuffleBtn.style.color = 'var(--accent)';
    shuffleBtn.style.background = '#2a2a2a';
  } else {
    shuffleBtn.style.color = 'var(--text)';
    shuffleBtn.style.background = '#2a2a2a';
  }
};

repeatBtn.onclick = () => {
  if (state.repeatMode === 'none') {
    state.repeatMode = 'all';
    repeatBtn.innerHTML = `<i class="ri-repeat-line"></i>`;
    repeatBtn.style.color = 'var(--accent)';
    repeatBtn.style.background = '#2a2a2a';
  } else if (state.repeatMode === 'all') {
    state.repeatMode = 'one';
    repeatBtn.innerHTML = `<i class="ri-repeat-one-line"></i>`;
    repeatBtn.style.color = 'var(--accent)';
    repeatBtn.style.background = '#2a2a2a';
  } else {
    state.repeatMode = 'none';
    repeatBtn.innerHTML = `<i class="ri-repeat-line"></i>`;
    repeatBtn.style.color = 'var(--text)';
    repeatBtn.style.background = '#2a2a2a';
  }
};

audio.addEventListener('timeupdate', () => {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || Math.max(audio.duration || 0, 1);
  const percent = Math.min(100, Math.floor((cur / dur) * 100));
  seek.value = isFinite(percent) ? percent : 0;
  timeLabel.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
});

seek.oninput = () => {
  const dur = audio.duration || 0;
  if (dur > 0) audio.currentTime = (Number(seek.value) / 100) * dur;
};

audio.addEventListener('ended', () => {
  if (state.repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play();
  } else if (state.currentIndex < state.queue.length - 1) {
    playAt(state.currentIndex + 1);
  } else if (state.repeatMode === 'all' && state.queue.length > 0) {
    playAt(0);
  } else {
    audio.pause();
    playPauseBtn.innerHTML = `<i class="ri-play-line"></i>`;
  }
});

nowPlaying.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen().catch(console.error);
  }
};

queueToggleBtn.onclick = () => {
  queueSection.classList.toggle('visible');
  queueToggleBtn.style.color = queueSection.classList.contains('visible') ? 'var(--accent)' : 'var(--text)';
};

function formatTime(s) {
  s = Math.floor(s || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    audio.play();
    playPauseBtn.innerHTML = `<i class="ri-pause-line"></i>`;
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
    playPauseBtn.innerHTML = `<i class="ri-play-line"></i>`;
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => prevBtn.click());
  navigator.mediaSession.setActionHandler('nexttrack', () => nextBtn.click());
}

document.getElementById('searchBtn').onclick = doSearch;
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

async function doSearch() {
  const q = searchInput.value.trim();
  const data = await searchApi(q);
  state.results = data.map(t => ({
    id: t.id,
    title: t.title,
    url: t.url,
    artist: t.artist || '',
    album: t.album || '',
    duration: t.duration || 0,
    cover: t.cover || 'icons/icon-512.png'
  }));
  renderResults();
}

document.getElementById('clearCacheBtn').onclick = async () => {
  const all = await dbGetAll();
  for (const rec of all) await dbDelete(rec.id);
  await updateCacheUsage();
  renderCachedSongs();
  alert('Cache limpo.');
};

(async function init() {
  state.db = await openDB();
  await updateCacheUsage();
  renderCachedSongs();
})();