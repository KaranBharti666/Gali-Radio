(() => {
  const SONGS_API = "https://radio-songs-api.karanbharti9541.workers.dev/songs";
  const PAGE_SIZE = 24;
  const SONGS_CACHE_KEY = "radio-gali-song-index-v4";
  const SONGS_CACHE_TTL = 30 * 60 * 1000;
  let songsRequest;

  const STATION_RULES = {
    "bus-driver": { folders:["bus driver","bus-driver","highway raat","truck wala","road trip"], words:["highway","truck","bus","safar","musafir","raahi","zindagi ek safar","papa kehte","yeh dosti","ilahi","suhana safar"] },
    "chai-tapri": { folders:["chai tapri","chai-tapri","tapri","chai"], words:["chai","yaaron","dosti","indipop","o sanam","dooba dooba","purani jeans","alvida","shaam","khoya khoya chand"] },
    "corporate-majdur": { folders:["corporate majdur","corporate","office","work focus"], words:["lofi","lo-fi","instrumental","acoustic","focus","ambient","piano","soft","calm","chill","no vocals"] },
    "desi-night-club": { folders:["desi night club","night club","club","party","dance"], words:["dance","party","dhoom","kajra re","dus bahane","where's the party","it's the time to disco","mauja hi mauja","desi girl","aaja nachle","dard-e-disco"] },
    "exam-night": { folders:["exam night","exam","study","focus","instrumental"], words:["instrumental","lofi","lo-fi","piano","ambient","focus","study","sleep","calm","no vocals","flute","meditation"] },
    "highway-dhaba": { folders:["highway dhaba","dhaba","punjabi dhaba","highway"], words:["punjabi","bhangra","dhol","dhaba","truck","highway","desi","gaddi","jatt","mustang","patiala","suit suit","brown rang"] },
    "old-cafe": { folders:["old school cafe","old cafe","retro cafe","evergreen","oldies"], words:["kishore","rafi","mukesh","lata","asha","hemant","manna dey","evergreen","oldies","retro","lag ja gale","pal pal dil ke paas","chura liya"] },
    "papa-ke-gaane": { folders:["papa ke gaane","papa","family classics"], words:["kishore","rafi","mukesh","lata","asha","mohammed rafi","old is gold","zindagi kaisi","mere sapno ki rani","roop tera mastana","gulabi aankhen","aanewala pal"] },
    "raju-mistri": { folders:["raju mistri","raju-mistri","mistri","workshop","indipop"], words:["indipop","pop","sukhbir","baba sehgal","daler","lucky ali","bombay vikings","silk route","shaan","salaam namaste","rock","beat","masti"] },
    "railway-platform": { folders:["railway platform","railway","platform","train journey"], words:["railway","train","platform","safar","musafir","raahi","zindagi ek safar","chhaiya chhaiya","yatra","yaad","ghar kab aaoge","pardesi"] },
    "rainy-window": { folders:["rainy window","rain","monsoon","baarish","barish"], words:["baarish","barish","rimjhim","bheegi","sawan","saawan","tip tip","bheegi si","geela","rain","mausam","boondein","romantic","ghazal","mellow"] },
    "ritu-radio": { folders:["ritu radio","ritu","season","monsoon","winter","summer"], words:["mausam","sawan","saawan","baarish","barish","thandi","dhoop","basant","bahaar","winter","summer","monsoon","spring"] },
    "saloon": { folders:["deluxe saloon","deluxe salon","saloon","salon","barber"], words:["90s","retro","radio","tip tip","chunari","gore gore","ole ole","tan tana tan","sarkai lo","koi mil gaya","saajan","aankh maare"] },
    "shaadi-baraat": { folders:["shaadi ki baraat","shaadi","baraat","wedding","sangeet"], words:["shaadi","baraat","wedding","dhol","bhangra","mehndi","sangeet","navrai majhi","gallaan goodiyaan","balle balle","mauja hi mauja","morni banke","cutiepie","saajan ji ghar aaye"] }
  };

  function getStationSlug() {
    const file = location.pathname.split("/").pop().replace(/\\.html?$/i, "");
    return file === "index" || !file ? "radio-gali" : file;
  }

  function normalizeText(value) {
    return String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").replace(/[_-]+/g, " ").replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim();
  }

  function selectStationSongs(label, songs) {
    const rule = STATION_RULES[getStationSlug()];
    if (!rule) return songs;
    const folderAliases = rule.folders.map(normalizeText);
    const inStationFolder = songs.filter(song => {
      const path = normalizeText(song.folderPath || song.folderName || "");
      return folderAliases.some(alias => path.includes(alias));
    });
    if (inStationFolder.length) return inStationFolder;

    const ranked = songs.map(song => {
      const title = normalizeText([song.title, song.filename, song.folderPath].join(" "));
      let score = 0;
      for (const word of rule.words) {
        const token = normalizeText(word);
        if (token && title.includes(token)) score += token.includes(" ") ? 4 : 2;
      }
      return { song, score };
    }).filter(item => item.score > 0).sort((a,b) => b.score - a.score);
    return ranked.map(item => item.song);
  }

  function readCachedSongs() {
    try {
      const cached = JSON.parse(localStorage.getItem(SONGS_CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.songs) && Date.now() - cached.savedAt < SONGS_CACHE_TTL) return cached.songs;
    } catch (_) {}
    return null;
  }

  function fetchSongs() {
    return fetch(SONGS_API, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`Songs API returned ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data.songs)) throw new Error("Songs API response is missing the songs list");
        const songs = data.songs.filter(song => song && song.title && song.streamUrl);
        try { localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), songs })); } catch (_) {}
        return songs;
      });
  }

  function getSongs() {
    if (!songsRequest) {
      const cached = readCachedSongs();
      if (cached) {
        songsRequest = Promise.resolve(cached);
        fetchSongs().then(() => {}).catch(() => {});
      } else {
        songsRequest = fetchSongs();
      }
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
    root.setAttribute("aria-label", `${label} song player`);

    const head = document.createElement("div");
    head.className = "drive-radio-head";
    const identity = document.createElement("div");
    identity.className = "drive-radio-identity";
    const disc = document.createElement("span");
    disc.className = "drive-radio-disc";
    disc.setAttribute("aria-hidden", "true");
    disc.textContent = "♫";
    const heading = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "drive-radio-eyebrow";
    eyebrow.textContent = "RADIO GALI · DRIVE STREAM";
    const name = document.createElement("strong");
    name.className = "drive-radio-name";
    name.textContent = label;
    heading.append(eyebrow, name);
    identity.append(disc, heading);
    const count = document.createElement("span");
    count.className = "drive-radio-count";
    count.textContent = "Loading…";
    head.append(identity, count);

    const search = document.createElement("input");
    search.className = "drive-radio-search";
    search.type = "search";
    search.placeholder = "Search all songs or artists";
    search.setAttribute("aria-label", `${label} songs search`);

    const now = document.createElement("div");
    now.className = "drive-radio-now";
    const nowLabel = document.createElement("span");
    nowLabel.className = "drive-radio-now-label";
    nowLabel.textContent = "NOW PLAYING";
    const currentTitle = document.createElement("strong");
    currentTitle.className = "drive-radio-current-title";
    currentTitle.textContent = "Choose a song to start";
    const currentArtist = document.createElement("span");
    currentArtist.className = "drive-radio-current-artist";
    currentArtist.textContent = "Your full song library is below";
    now.append(nowLabel, currentTitle, currentArtist);

    const audio = document.createElement("audio");
    audio.className = "drive-radio-audio";
    audio.preload = "none";
    audio.setAttribute("aria-label", `${label} song stream`);

    const seekRow = document.createElement("div");
    seekRow.className = "drive-radio-seek-row";
    const elapsed = document.createElement("span");
    elapsed.textContent = "0:00";
    const seek = document.createElement("input");
    seek.className = "drive-radio-seek";
    seek.type = "range";
    seek.min = "0";
    seek.max = "1000";
    seek.value = "0";
    seek.setAttribute("aria-label", "Seek through current song");
    const duration = document.createElement("span");
    duration.textContent = "0:00";
    seekRow.append(elapsed, seek, duration);

    const controls = document.createElement("div");
    controls.className = "drive-radio-controls";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "drive-radio-skip";
    previous.setAttribute("aria-label", "Previous song");
    previous.textContent = "⏮";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "drive-radio-toggle";
    toggle.setAttribute("aria-label", "Play song");
    toggle.textContent = "▶";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "drive-radio-skip";
    next.setAttribute("aria-label", "Next song");
    next.textContent = "⏭";
    const volumeWrap = document.createElement("label");
    volumeWrap.className = "drive-radio-volume";
    volumeWrap.setAttribute("aria-label", "Volume");
    const volumeIcon = document.createElement("span");
    volumeIcon.textContent = "◖";
    const volume = document.createElement("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.01";
    volume.value = "0.75";
    volume.setAttribute("aria-label", "Volume");
    volumeWrap.append(volumeIcon, volume);
    controls.append(previous, toggle, next, volumeWrap);

    const status = document.createElement("p");
    status.className = "drive-radio-status";
    status.setAttribute("role", "status");
    status.textContent = "Gaane load ho rahe hain…";

    const queueHead = document.createElement("div");
    queueHead.className = "drive-radio-queue-head";
    const queueTitle = document.createElement("strong");
    queueTitle.textContent = "YOUR LIBRARY";
    const queueCount = document.createElement("span");
    queueHead.append(queueTitle, queueCount);
    const list = document.createElement("ul");
    list.className = "drive-radio-list";
    list.setAttribute("aria-label", `${label} songs`);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "drive-radio-more";
    more.textContent = "Show more songs";

    root.append(head, search, now, audio, seekRow, controls, status, queueHead, list, more);

    let allSongs = [];
    let activeSongId = "";
    let visibleSongs = [];
    let renderLimit = PAGE_SIZE;\n    let searchTimer = 0;
    const songKey = (song) => song.id || song.streamUrl;
    const formatTime = (seconds) => {
      if (!Number.isFinite(seconds)) return "0:00";
      const mins = Math.floor(seconds / 60);
      return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    };

    function playSong(song) {
      document.querySelectorAll(".drive-radio-audio").forEach((otherAudio) => {
        if (otherAudio !== audio) otherAudio.pause();
      });
      activeSongId = songKey(song);
      audio.src = song.streamUrl;
      currentTitle.textContent = song.title;
      currentArtist.textContent = song.artist || song.album || "Google Drive stream";
      status.textContent = `Streaming · ${song.title}`;
      toggle.textContent = "Ⅱ";
      toggle.setAttribute("aria-label", "Pause song");
      void audio.play().catch(() => {
        status.textContent = "Stream start nahi hua. Play dobara dabao.";
        toggle.textContent = "▶";
        toggle.setAttribute("aria-label", "Play song");
      });
      renderList();
    }

    function renderList() {
      const query = search.value.trim().toLocaleLowerCase();
      visibleSongs = allSongs.filter((song) => `${song.title} ${song.artist || ""}`.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      visibleSongs.slice(0, renderLimit).forEach((song, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "drive-radio-track";
        const number = document.createElement("span");
        number.className = "drive-radio-track-number";
        number.textContent = songKey(song) === activeSongId && !audio.paused ? "♫" : String(index + 1).padStart(2, "0");
        const trackInfo = document.createElement("span");
        trackInfo.className = "drive-radio-track-info";
        const trackName = document.createElement("strong");
        trackName.textContent = song.title;
        const artist = document.createElement("small");
        artist.textContent = song.artist || "Tap to stream";
        trackInfo.append(trackName, artist);
        const playIcon = document.createElement("span");
        playIcon.className = "drive-radio-track-play";
        playIcon.textContent = songKey(song) === activeSongId && !audio.paused ? "Ⅱ" : "▶";
        button.setAttribute("aria-current", String(songKey(song) === activeSongId));
        button.append(number, trackInfo, playIcon);
        button.addEventListener("click", () => playSong(song));
        item.append(button);
        list.append(item);
      });
      queueCount.textContent = query ? `${visibleSongs.length} FOUND` : `${allSongs.length} TRACKS`;
      count.textContent = allSongs.length ? `${allSongs.length} songs` : "Loading…";
      more.hidden = renderLimit >= visibleSongs.length;
      if (!allSongs.length) return;
      if (!visibleSongs.length) status.textContent = "Is naam se koi gaana nahi mila.";
      else if (audio.paused) status.textContent = `${visibleSongs.length} gaane · kisi bhi track par tap karo.`;
    }

    function playAtOffset(offset) {
      if (!allSongs.length) return;
      const current = allSongs.findIndex((song) => songKey(song) === activeSongId);
      const nextIndex = current < 0 ? (offset < 0 ? allSongs.length - 1 : 0) : (current + offset + allSongs.length) % allSongs.length;
      playSong(allSongs[nextIndex]);
    }

    search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { renderLimit = PAGE_SIZE; renderList(); }, 120); });
    more.addEventListener("click", () => { renderLimit += PAGE_SIZE; renderList(); });
    toggle.addEventListener("click", () => {
      if (!audio.src) return playAtOffset(1);
      if (audio.paused) void audio.play().catch(() => {});
      else audio.pause();
    });
    previous.addEventListener("click", () => playAtOffset(-1));
    next.addEventListener("click", () => playAtOffset(1));
    volume.addEventListener("input", () => { audio.volume = Number(volume.value); });
    seek.addEventListener("input", () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    });
    audio.volume = Number(volume.value);
    audio.addEventListener("play", () => {
      root.classList.add("is-playing");
      toggle.textContent = "Ⅱ";
      toggle.setAttribute("aria-label", "Pause song");
      status.textContent = `Streaming · ${currentTitle.textContent}`;
      renderList();
    });
    audio.addEventListener("pause", () => {
      root.classList.remove("is-playing");
      toggle.textContent = "▶";
      toggle.setAttribute("aria-label", "Play song");
      renderList();
    });
    audio.addEventListener("timeupdate", () => {
      elapsed.textContent = formatTime(audio.currentTime);
      duration.textContent = formatTime(audio.duration);
      if (Number.isFinite(audio.duration) && audio.duration > 0) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    });
    audio.addEventListener("ended", () => playAtOffset(1));
    audio.addEventListener("error", () => { status.textContent = "Ye stream abhi unavailable hai. Koi aur gaana chunein."; });

    getSongs()
      .then((songs) => {
        allSongs = songs;
        renderList();
      })
      .catch(() => {
        count.textContent = "Unavailable";
        status.textContent = "Drive library load nahi hui. Page refresh karke phir try karein.";
      });

    function playSelected(selector) {
      const startPlayback = (songs) => {
        allSongs = songs;
        renderList();
        const song = selector(songs);
        if (song) playSong(song);
      };
      if (allSongs.length) startPlayback(allSongs);
      else {
        status.textContent = "Drive library load ho rahi hai…";
        getSongs().then(startPlayback).catch(() => {
          status.textContent = "Drive library load nahi hui. Refresh karke phir try karein.";
        });
      }
    }
    root.playFirst = () => playSelected((songs) => songs[0]);
    root.playRandom = () => playSelected((songs) => songs[Math.floor(Math.random() * songs.length)]);
    return root;
  }

  function mount() {
    const label = stationLabel();
    let hasStationPlayer = false;
    const stationEmbed = document.querySelector("#player #stationMusic");
    if (stationEmbed) {
      const musicSlot = stationEmbed.closest(".music-player") || stationEmbed.parentElement;
      musicSlot.replaceChildren(makePlayer(label));
      hasStationPlayer = true;
    }

    const pageEmbeds = [...document.querySelectorAll('main iframe[src*="open.spotify.com/embed"]')]
      .filter((embed) => !embed.closest(".journey-player") && embed.id !== "stationMusic");
    pageEmbeds.forEach((embed) => {
      const slot = embed.closest(".panel") || embed.parentElement;
      if (slot) {
        embed.replaceWith(makePlayer(label));
        hasStationPlayer = true;
        const heading = slot.querySelector("h2");
        const description = slot.querySelector("p");
        if (heading) heading.textContent = "Full song library";
        if (description) description.textContent = "Apna gaana dhoondo aur isi player se stream karo.";
      }
    });

    if (!hasStationPlayer) {
      const existingPlayer = document.querySelector("main .player");
      const player = makePlayer(label);
      if (existingPlayer) existingPlayer.replaceWith(player);
      else (document.querySelector("main .grid") || document.querySelector("main"))?.append(player);
    }

    document.querySelectorAll("#start, #play").forEach((startButton) => {
      startButton.addEventListener("click", () => {
        const player = document.querySelector("#player .drive-radio") || document.querySelector("main .drive-radio");
        player?.playFirst?.();
      });
    });

    const surprise = document.querySelector("#randomStation");
    if (surprise) surprise.addEventListener("click", () => {
      const modal = document.querySelector("#player");
      const player = modal?.querySelector(".drive-radio");
      if (!modal || !player) return;
      const title = document.querySelector("#playerTitle");
      const desc = document.querySelector("#playerDesc");
      if (title) title.textContent = "Surprise Mix";
      if (desc) desc.textContent = "A random track from your Radio Gali library is ready.";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      player.playRandom?.();
    });

    const modal = document.querySelector("#player");
    const stopModalStream = () => document.querySelector("#player .drive-radio-audio")?.pause();
    document.querySelector("#closePlayer")?.addEventListener("click", stopModalStream);
    modal?.addEventListener("click", (event) => { if (event.target === modal) stopModalStream(); });

    const modalPause = document.querySelector("#pauseBtn");
    if (modalPause) {
      modalPause.addEventListener("click", () => {
        const modalAudio = document.querySelector("#player .drive-radio-audio");
        if (modalAudio && !modalAudio.paused) modalAudio.pause();
        else if (modalAudio?.src) void modalAudio.play().catch(() => {});
      });
    }

    document.querySelectorAll("#special, #toggle, #effect, #mute, #switch").forEach((button) => button.remove());
    const legacyControls = document.querySelector("#player .player-controls");
    if (legacyControls) legacyControls.remove();
    const legacyVolume = document.querySelector("#player .volume");
    if (legacyVolume) legacyVolume.remove();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
