(() => {
  const SONGS_API = "https://radio-songs-api.karanbharti9541.workers.dev/songs";
  let songsRequest;

  function getSongs() {
    if (!songsRequest) {
      songsRequest = fetch(SONGS_API)
        .then((response) => {
          if (!response.ok) throw new Error(`Songs API returned ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data.songs)) throw new Error("Songs API response is missing the songs list");
          return data.songs.filter((song) => song && song.title && song.streamUrl);
        });
    }
    return songsRequest;
  }

  function stationLabel() {
    if (location.pathname === "/" || location.pathname.endsWith("/index.html")) return "Radio Gali";
    const pageTitle = document.title.replace(/\s*[—|]\s*Radio Gali\s*$/i, "").trim();
    if (pageTitle) return pageTitle;
    const heading = document.querySelector("h1");
    return heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Radio Gali";
  }

  function makePlayer(label) {
    const root = document.createElement("section");
    root.className = "drive-radio";
    root.setAttribute("aria-label", `${label} Google Drive song player`);

    const heading = document.createElement("div");
    heading.className = "drive-radio-heading";
    const title = document.createElement("strong");
    title.textContent = `${label} · Google Drive songs`;
    const count = document.createElement("span");
    count.className = "drive-radio-count";
    count.textContent = "Gaane load ho rahe hain…";
    heading.append(title, count);

    const search = document.createElement("input");
    search.className = "drive-radio-search";
    search.type = "search";
    search.placeholder = "Gaana ya artist dhoondo";
    search.setAttribute("aria-label", `${label} songs search`);

    const audio = document.createElement("audio");
    audio.className = "drive-radio-audio";
    audio.controls = true;
    audio.preload = "none";
    audio.setAttribute("aria-label", `${label} song playback controls`);

    const status = document.createElement("p");
    status.className = "drive-radio-status";
    status.setAttribute("role", "status");
    status.textContent = "Drive se songs list aa rahi hai…";

    const list = document.createElement("ul");
    list.className = "drive-radio-list";
    list.setAttribute("aria-label", `${label} songs`);

    root.append(heading, search, audio, status, list);

    let allSongs = [];
    let activeSongId = "";

    function playSong(song) {
      document.querySelectorAll(".drive-radio-audio").forEach((otherAudio) => {
        if (otherAudio !== audio) otherAudio.pause();
      });
      activeSongId = song.id || song.streamUrl;
      audio.src = song.streamUrl;
      status.textContent = `Abhi baj raha hai · ${song.title}`;
      void audio.play().catch(() => {
        status.textContent = "Gaana play nahi hua. Dobara Play dabao.";
      });
      renderList();
    }

    function renderList() {
      const query = search.value.trim().toLocaleLowerCase();
      const matches = allSongs.filter((song) => song.title.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      matches.forEach((song) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "drive-radio-track";
        button.setAttribute("aria-current", String((song.id || song.streamUrl) === activeSongId));
        button.textContent = song.title;
        button.addEventListener("click", () => playSong(song));
        item.append(button);
        list.append(item);
      });

      if (!allSongs.length) return;
      count.textContent = `${allSongs.length} gaane · ${label}`;
      if (!matches.length) status.textContent = "Is naam se koi gaana nahi mila.";
      else if (!audio.paused && activeSongId) {
        const currentSong = allSongs.find((song) => (song.id || song.streamUrl) === activeSongId);
        status.textContent = currentSong ? `Abhi baj raha hai · ${currentSong.title}` : `${matches.length} gaane mile · gaana chunein.`;
      } else status.textContent = `${matches.length} gaane mile · gaana chunein ya player use karein.`;
    }

    search.addEventListener("input", () => {
      renderList();
    });
    audio.addEventListener("play", () => {
      document.querySelectorAll(".drive-radio-audio").forEach((otherAudio) => {
        if (otherAudio !== audio) otherAudio.pause();
      });
    });
    audio.addEventListener("ended", () => {
      const currentIndex = allSongs.findIndex((song) => (song.id || song.streamUrl) === activeSongId);
      if (currentIndex >= 0 && allSongs.length > 1) playSong(allSongs[(currentIndex + 1) % allSongs.length]);
    });

    getSongs()
      .then((songs) => {
        allSongs = songs;
        renderList();
      })
      .catch(() => {
        count.textContent = "Songs load nahi hue";
        status.textContent = "Drive songs API se connect nahi hua. Page refresh karke phir try karein.";
      });

    function playSelected(selector) {
      const startPlayback = (songs) => {
        allSongs = songs;
        renderList();
        const song = selector(songs);
        if (!song) return;
        if ((song.id || song.streamUrl) === activeSongId && audio.src) {
          void audio.play().catch(() => {
            status.textContent = "Gaana resume nahi hua. Player par Play dabao.";
          });
        } else playSong(song);
      };
      if (allSongs.length) startPlayback(allSongs);
      else {
        status.textContent = "Songs aa rahe hain…";
        getSongs().then(startPlayback).catch(() => {
          status.textContent = "Drive songs load nahi hue. Refresh karke phir try karein.";
        });
      }
    }

    root.playFirst = () => playSelected((songs) => songs[0]);
    root.playRandom = () => playSelected((songs) => songs[Math.floor(Math.random() * songs.length)]);

    return root;
  }

  function addPanel(grid, label) {
    const panel = document.createElement("article");
    panel.className = "panel drive-radio-panel";
    const eyebrow = document.createElement("div");
    eyebrow.className = "tag";
    eyebrow.textContent = "ON THE SPEAKERS";
    const heading = document.createElement("h2");
    heading.textContent = "Google Drive playlist";
    const description = document.createElement("p");
    description.textContent = `${label} ke songs yahin search karke play karo.`;
    panel.append(eyebrow, heading, description, makePlayer(label));
    grid.append(panel);
  }

  function mount() {
    const label = stationLabel();
    const embeds = [...document.querySelectorAll('iframe[src*="open.spotify.com/embed"]')];
    let hasStationPlayer = false;

    embeds.forEach((embed) => {
      if (embed.id === "stationMusic") {
        const host = embed.closest(".music-player");
        if (!host) return;
        host.append(makePlayer(label));
        hasStationPlayer = true;
        return;
      }

      const journey = embed.closest(".journey-player");
      if (journey) return;

      const panel = embed.closest(".panel");
      if (panel) {
        panel.append(makePlayer(label));
        hasStationPlayer = true;
      }
    });

    if (!hasStationPlayer && !document.querySelector(".drive-radio")) {
      const container = document.querySelector("main .grid") || document.querySelector("main");
      if (container) addPanel(container, label);
    }

    document.querySelectorAll("#start, #play").forEach((startButton) => {
      startButton.addEventListener("click", () => {
        const player = document.querySelector("main .drive-radio") || document.querySelector("#player .drive-radio");
        player?.playFirst?.();
      });
    });

    const surprise = document.querySelector("#randomStation");
    if (surprise) {
      surprise.addEventListener("click", () => {
        document.querySelector("#player .drive-radio")?.playRandom?.();
      });
    }

    const modalPause = document.querySelector("#pauseBtn");
    const modalAudio = document.querySelector("#player .drive-radio-audio");
    if (modalPause && modalAudio) {
      modalPause.addEventListener("click", () => {
        if (modalAudio.paused && modalAudio.src) void modalAudio.play().catch(() => {});
        else if (!modalAudio.paused) modalAudio.pause();
      });
    }

    if (document.querySelector("#player")) {
      document.querySelector("#player .player-card")?.classList.add("drive-radio-modal-card");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
