# 🎵 SpotiLite – Player de Música (PWA + API)

O **SpotiLite** é um **reprodutor de música moderno e leve**, inspirado no design do Spotify.  
Ele foi desenvolvido para rodar como um **PWA (Progressive Web App)** no frontend e se conectar a uma **API própria** no backend.  

Criado por **Inocêncio José**, líder da **Orion Technologies**, o projeto traz o conceito de separar **frontend e backend em pastas distintas**, reforçando a ideia de **API independente**.  

---

## 📂 Estrutura do Projeto

O repositório é organizado em **duas pastas principais**:

```

📦 SpotiLite
┣ 📂 spotilite-pwa   → (Frontend)
┗ 📂 spotilite-api            → (Backend/API)

````

### 🔹 **1. spotilite-pwa (Frontend)**
Contém o player que roda no navegador como um **PWA**.

Arquivos principais:
- `index.html` → Player principal  
- `about.html` → Página "Sobre"  
- `styles.css` → Estilos (tema escuro estilo Spotify)  
- `app.js` → Lógica do player (busca, fila, cache, controles, offline)  

> ⚠️ Essa pasta deve ser servida em um **servidor estático** (ex.: Netlify, Vercel, ou Live Server do VSCode).  
> Não execute dentro da mesma pasta da API.  

---

### 🔹 **2. spotilite-api (Backend)**
Contém a API em **Node.js + Express** que serve as músicas locais e metadados.

Arquivos principais:
- `server.js` → Servidor Express  
- `musicas/` → Pasta onde você deve colocar seus arquivos **.mp3**  
- `covers/` → Capas extraídas automaticamente pelo servidor  

Endpoints expostos:
- `GET /musicas` → Lista músicas com metadados (título, artista, álbum, duração, capa)  
- `GET /musicas/:file` → Stream da música escolhida  
- `GET /covers/...` → Capas extraídas automaticamente  

> ⚠️ A API deve ser executada **separadamente** em sua própria pasta (`spotilite-api`) para garantir o conceito de **backend independente**.  

---

## ⚙️ Como rodar o projeto

### 🔸 1. Clonar o repositório
```bash
git clone https://github.com/inocencio-jose/spotilite.git
cd spotilite
````

---

### 🔸 2. Rodar a API (backend)

```bash
cd spotilite-api
npm install
node server.js
```

A API ficará disponível em:
👉 `http://localhost:3000`

---

### 🔸 3. Rodar o Frontend (SpotilitePWA)

Abra outra aba do terminal e vá para a pasta **SpotilitePWA**:

```bash
cd spotilite-pwa
```

Agora basta abrir o arquivo `index.html` no navegador, ou servir a pasta com Live Server / Netlify / Vercel.

O frontend consumirá a API no `http://localhost:3000`.

---

## 🚀 Funcionalidades

* 🎶 Player de música com suporte **offline (cache no navegador)**
* 📑 Fila de reprodução dinâmica
* 🔎 Busca e organização de músicas
* 🎨 Interface responsiva estilo Spotify (tema escuro)
* 🖼️ API que extrai automaticamente metadados e capas dos arquivos MP3

---

## 🏗️ Tecnologias usadas

### **Frontend (SpotilitePWA)**

* HTML, CSS, JavaScript
* PWA (Progressive Web App)

### **Backend (API)**

* Node.js + Express
* music-metadata (extração de metadados e capas)

---

## 👨‍💻 Autor

**Inocêncio José**

* Líder e fundador da [Orion Technologies](https://facebook.com/oriontechnologies)
* GitHub: [inocencio-jose](https://github.com/inocencio-jose)
* LinkedIn: [Inocêncio José](https://www.linkedin.com/in/inocêncio-josé-233778346)

---

## 📜 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.