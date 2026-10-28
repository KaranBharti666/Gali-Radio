(() => {
  const SONGS_API = "https://radio-songs-api.karanbharti9541.workers.dev/songs";
  const PAGE_SIZE = 40;
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
    let renderLimit = PAGE_SIZE;
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

    search.addEventListener("input", () => { renderLimit = PAGE_SIZE; renderList(); });
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
    if (surprise) surprise.addEventListener("click", () => document.querySelector("#player .drive-radio")?.playRandom?.());

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
