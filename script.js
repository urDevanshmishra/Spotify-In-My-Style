console.log("Lets play some music!");

// ========================================
// FETCH SONGS FROM SERVER
// ========================================
async function getsongs() {
  const res = await fetch("./songs/");
  const response = await res.text();
  const div = document.createElement("div");
  div.innerHTML = response;
  const as = div.getElementsByTagName("a");
  const songs = [];
  
  for (let i = 0; i < as.length; i++) {
    const element = as[i];
    if (element.href.endsWith(".mp3")) {
      const href = element.getAttribute("href") || element.href;
      const parts = decodeURIComponent(href).split(/[\\/]/);
      const file = parts[parts.length - 1];
      const nameWithoutExt = file.replace(/\.mp3$/i, "");
      
      // Parse artist and song name from filename
      let artist = "Unknown Artist";
      let songName = nameWithoutExt;
      
      if (nameWithoutExt.includes(" - ")) {
        const splitParts = nameWithoutExt.split(" - ");
        artist = splitParts[0].trim();
        songName = splitParts.slice(1).join(" - ").trim();
      }
      
      songs.push({ file, display: songName, artist });
    }
  }
  return songs;
}

// ========================================
// GLOBAL VARIABLES
// ========================================
const audio = new Audio();
let currentPlayButton = null;
let currentIndex = -1;
let songsGlobal = [];
const fileIndexMap = {};
const favourites = new Set();
const FAVOURITE_KEY = "Favourite";
const FAV_STORAGE_KEY = "favourites";
let activeFilterArtist = null;

function loadFavouritesFromStorage() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      favourites.clear();
      parsed.forEach(f => favourites.add(f));
    }
  } catch (e) {
    console.warn("Failed to load favourites", e);
  }
}

function saveFavouritesToStorage() {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favourites]));
  } catch (e) {
    console.warn("Failed to save favourites", e);
  }
}

// Playbar control elements
let pbTitle, pbArtist, pbTime, pbSeek, pbToggle, pbPrev, pbNext, pbVolume, pbHeart;

// Track heart icon state for current song
function updateHeartUI(isLiked) {
  if (!pbHeart) return;
  const heartImg = pbHeart.querySelector("img");
  pbHeart.classList.toggle("liked", isLiked);
  if (heartImg) {
    heartImg.src = isLiked ? "heart2.svg" : "heart.svg";
    heartImg.alt = isLiked ? "Remove from favorites" : "Add to favorites";
  }
}

function isFavourite(song) {
  return Boolean(song && favourites.has(song.file));
}

// ========================================
// UPDATE PLAY/PAUSE BUTTON UI
// ========================================
function updatePlayButton(button, isPlaying) {
  if (!button) return;
  button.textContent = isPlaying ? "Pause" : "Play";
}

// ========================================
// UPDATE PLAYBAR INFO (SONG NAME & ARTIST)
// ========================================
function setPlaybar(song) {
  if (!song) return;
  if (pbTitle) pbTitle.textContent = song.display;
  if (pbArtist) pbArtist.textContent = song.artist || "Unknown Artist";
  updateHeartUI(isFavourite(song));
}

// ========================================
// FORMAT TIME (SECONDS TO MM:SS)
// ========================================
function formatTime(sec) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ========================================
// PLAY SONG AT SPECIFIC INDEX
// ========================================
function playIndex(index, button) {
  if (!songsGlobal.length || index < 0 || index >= songsGlobal.length) return;
  
  // If clicking the same song, toggle play/pause
  if (currentIndex === index) {
    if (audio.paused) {
      audio.play();
      updatePlayButton(button, true);
      if (pbToggle) pbToggle.innerHTML = '<img src="pause.svg" alt="Pause" width="20" height="20" />';
    } else {
      audio.pause();
      updatePlayButton(button, false);
      if (pbToggle) pbToggle.innerHTML = '<img src="play.svg" alt="Play" width="20" height="20" />';
    }
    return;
  }
  
  // Update previous button UI
  if (currentPlayButton && currentPlayButton !== button) {
    updatePlayButton(currentPlayButton, false);
  }
  
  // Load and play new song
  currentIndex = index;
  const song = songsGlobal[currentIndex];
  audio.src = `songs/${song.file}`;
  audio.play();
  
  currentPlayButton = button;
  updatePlayButton(currentPlayButton, true);
  setPlaybar(song);
  
  if (pbToggle) pbToggle.innerHTML = '<img src="pause.svg" alt="Pause" width="20" height="20" />';
}

// ========================================
// PLAY PREVIOUS SONG
// ========================================
function playPrevious() {
  if (currentIndex > 0) {
    playIndex(currentIndex - 1, currentPlayButton);
  }
}

// ========================================
// PLAY NEXT SONG
// ========================================
function playNext() {
  if (currentIndex < songsGlobal.length - 1) {
    playIndex(currentIndex + 1, currentPlayButton);
  }
}

// ========================================
// FUNCTION TO RENDER LIBRARY BY ARTIST
// ========================================
function renderLibrary(songsToDisplay, filterArtist = null) {
  activeFilterArtist = filterArtist || null;
  const songUl = document.querySelector(".songlist ul");
  if (!songUl) return;
  songUl.innerHTML = "";
  
  // Group songs by artist
  const artistGroups = {};
  const favouriteSongs = [];
  songsToDisplay.forEach(song => {
    const artistName = ((song.artist || "").toLowerCase() === "with you") ? FAVOURITE_KEY : song.artist;
    const songEntry = { ...song, artist: artistName };

    if (favourites.has(song.file) || artistName === FAVOURITE_KEY) {
      favouriteSongs.push(songEntry);
    }

    // Avoid duplicating favourite section in the main artist list
    if (artistName === FAVOURITE_KEY) return;

    if (!artistGroups[artistName]) {
      artistGroups[artistName] = [];
    }
    artistGroups[artistName].push(songEntry);
  });

  // Shared renderer for artist/favourite sections
  function appendArtistSection(artist, artistSongs, expanded = false, allowEmpty = false, emptyMessage = "No songs yet") {
    if ((!artistSongs || !artistSongs.length) && !allowEmpty) return;
    const artistContainer = document.createElement("li");
    artistContainer.className = "artist-container";
    if (expanded) artistContainer.classList.add("expanded");

    const artistCard = document.createElement("div");
    artistCard.className = "song-card artist-card";
    artistCard.innerHTML = `<div class="song-left">
        <img src="music.svg" alt="music icon" class="invert song-icon" />
        <div class="song-info"><div class="song-name">${artist}</div></div>
      </div><div class="expand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>`;

    const songsContainer = document.createElement("div");
    songsContainer.className = "songs-container";

    if (artistSongs && artistSongs.length) {
      artistSongs.forEach(song => {
        const songCard = document.createElement("div");
        songCard.className = "song-card song-item";

        const playBtn = document.createElement("button");
        playBtn.className = "play-button";
        playBtn.textContent = "Play";

        playBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          playIndex(fileIndexMap[song.file], playBtn);
        });

        songCard.innerHTML = `<div class="song-left">
            <img src="music.svg" alt="music icon" class="invert song-icon" />
            <div class="song-info">
              <div class="song-name">${song.display}</div>
              <div class="artist-name">${song.artist}</div>
            </div>
          </div>`;
        songCard.appendChild(playBtn);
        songsContainer.appendChild(songCard);
      });
    } else if (allowEmpty) {
      const emptyState = document.createElement("div");
      emptyState.className = "song-card song-item empty";
      emptyState.textContent = emptyMessage;
      songsContainer.appendChild(emptyState);
    }

    artistCard.addEventListener("click", () => {
      artistContainer.classList.toggle("expanded");
    });

    artistContainer.appendChild(artistCard);
    artistContainer.appendChild(songsContainer);
    songUl.appendChild(artistContainer);
  }

  // If filtering by a specific artist, render just that artist (or favourites)
  if (filterArtist) {
    if (filterArtist === FAVOURITE_KEY) {
      appendArtistSection(FAVOURITE_KEY, favouriteSongs, true, true, "No favourites yet");
      return;
    }

    const artistSongs = artistGroups[filterArtist];
    if (artistSongs) {
      appendArtistSection(filterArtist, artistSongs, true);
    }
    return;
  }

  // Always show favourites section at top (even if empty)
  appendArtistSection(FAVOURITE_KEY, favouriteSongs, false, true, "No favourites yet");

  for (const artist in artistGroups) {
    appendArtistSection(artist, artistGroups[artist]);
  }
}

// ========================================
// MAIN INITIALIZATION FUNCTION
// ========================================
async function main() {
  loadFavouritesFromStorage();

  // Fetch all songs
  const songs = await getsongs();
  songsGlobal = songs;
  songsGlobal.forEach((s, i) => { fileIndexMap[s.file] = i; });
  
  // Group songs by artist
  const artistGroups = {};
  songs.forEach(song => {
    if (!artistGroups[song.artist]) {
      artistGroups[song.artist] = [];
    }
    artistGroups[song.artist].push(song);
  });
  
  // ========================================
  // PLAYBAR CONTROLS SETUP
  // ========================================
  pbTitle = document.querySelector(".playbar .song-name");
  pbArtist = document.querySelector(".playbar .artist-name");
  pbTime = document.querySelector(".songtime");
  pbSeek = document.querySelector(".seekbar");
  const circle = document.querySelector(".circle");
  const progress = document.querySelector(".progress");
  pbToggle = document.querySelector(".playpause");
  pbPrev = document.querySelector(".previous");
  pbNext = document.querySelector(".next");
  pbVolume = document.querySelector(".volume");
  pbHeart = document.querySelector(".heart");
  
  // ========================================
  // AUDIO TIME UPDATE (UPDATE SEEKBAR & TIME)
  // ========================================
  audio.addEventListener("timeupdate", () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    pbTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    if (circle) circle.style.left = percent + "%";
    if (progress) progress.style.width = percent + "%";
  });
  
  // ========================================
  // SEEKBAR CLICK TO SEEK
  // ========================================
  pbSeek.addEventListener("click", e => {
    let percent = (e.offsetX / e.currentTarget.getBoundingClientRect().width) * 100;
    circle.style.left = percent + "%";
    progress.style.width = percent + "%";
    audio.currentTime = (audio.duration * percent) / 100;
  });
  
  // ========================================
  // PLAYBAR PLAY/PAUSE TOGGLE
  // ========================================
  if (pbToggle) {
    pbToggle.addEventListener("click", () => {
      // If no song has been selected yet, start with the first song
      if (currentIndex === -1 && songsGlobal.length) {
        const firstButton = document.querySelector(".songlist .play-button");
        playIndex(0, firstButton);
        return;
      }

      if (audio.paused) {
        audio.play();
        pbToggle.innerHTML = '<img src="pause.svg" alt="Pause" width="20" height="20" />';
        if (currentPlayButton) updatePlayButton(currentPlayButton, true);
      } else {
        audio.pause();
        pbToggle.innerHTML = '<img src="play.svg" alt="Play" width="20" height="20" />';
        if (currentPlayButton) updatePlayButton(currentPlayButton, false);
      }
    });
  }
  
  // ========================================
  // PREVIOUS BUTTON
  // ========================================
  if (pbPrev) {
    pbPrev.addEventListener("click", playPrevious);
  }
  
  // ========================================
  // NEXT BUTTON
  // ========================================
  if (pbNext) {
    pbNext.addEventListener("click", playNext);
  }
  
  // ========================================
  // AUTO PLAY NEXT SONG WHEN CURRENT ENDS
  // ========================================
  audio.addEventListener("ended", () => {
    playNext();
  });
  
  // ========================================
  // VOLUME CONTROL
  // ========================================
  const volumeSlider = document.querySelector('.volume-slider');
  const volumeIcon = document.querySelector('.volume-icon');
  const volumeContainer = document.querySelector('.volume');
  let previousVolume = 70;
  
  if (volumeSlider && volumeIcon && volumeContainer) {
    // Set initial volume
    if (!volumeSlider.value) {
      volumeSlider.value = previousVolume;
    }
    audio.volume = volumeSlider.value / 100;
    
    // Update slider background to match current value
    function updateSliderBackground() {
      const value = volumeSlider.value;
      volumeSlider.style.background = `linear-gradient(to top, #1db954 0%, #1db954 ${value}%, #404040 ${value}%, #404040 100%)`;
    }
    
    // Initialize background
    updateSliderBackground();
    
    // Handle volume slider input
    volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value;
      audio.volume = volume / 100;
      updateSliderBackground();
      
      // Store non-zero volume for unmute
      if (volume > 0) {
        previousVolume = volume;
      }
    });
    
    // Click volume icon/container to toggle mute
    volumeContainer.addEventListener('click', (e) => {
      // Don't trigger if clicking the slider itself
      if (e.target === volumeSlider) return;
      
      if (volumeSlider.value > 0) {
        // Mute
        previousVolume = volumeSlider.value;
        volumeSlider.value = 0;
        audio.volume = 0;
      } else {
        // Unmute
        volumeSlider.value = previousVolume;
        audio.volume = previousVolume / 100;
      }
      updateSliderBackground();
    });
  }
  
  // ========================================
  // HEART/FAVORITE TOGGLE
  // ========================================
  if (pbHeart) {
    pbHeart.addEventListener("click", () => {
      if (currentIndex === -1 || !songsGlobal[currentIndex]) return;

      const currentSong = songsGlobal[currentIndex];
      const isLiked = favourites.has(currentSong.file);

      if (isLiked) {
        favourites.delete(currentSong.file);
      } else {
        favourites.add(currentSong.file);
      }

      updateHeartUI(!isLiked);
      saveFavouritesToStorage();
      renderLibrary(songsGlobal, activeFilterArtist);
    });
  }
  
  // ========================================
  // BUILD SONG LIST UI - INITIAL LOAD (ALL ARTISTS)
  // ========================================
  renderLibrary(songsGlobal);
  
  // ========================================
  // ADD CLICK HANDLERS TO CARDS IN SPOTLIGHT PLAYLISTS
  // ========================================
  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    card.addEventListener("click", (e) => {
      const artists = Object.keys(artistGroups);
      const dataArtist = (card.dataset.artist || "").trim();
      const titleText = (card.querySelector("h2")?.textContent || "").trim();

      const isFavouriteCard = [dataArtist, titleText]
        .some(val => val.toLowerCase() === FAVOURITE_KEY.toLowerCase());

      if (isFavouriteCard) {
        renderLibrary(songsGlobal, FAVOURITE_KEY);
        return;
      }

      let targetArtist = null;

      // 1) Prefer explicit data-artist if it exists in the grouped artists
      if (dataArtist && artists.includes(dataArtist)) {
        targetArtist = dataArtist;
      }
      // 2) Fallback to title text match
      else if (titleText && artists.includes(titleText)) {
        targetArtist = titleText;
      }
      // 3) Fallback to card order if nothing matched
      else {
        const cardIndex = Array.from(cards).indexOf(card);
        if (cardIndex < artists.length) {
          targetArtist = artists[cardIndex];
        }
      }

      if (targetArtist) {
        renderLibrary(songsGlobal, targetArtist);
      }
    });
    
    // Add hover effect
    card.style.cursor = "pointer";
    card.addEventListener("mouseenter", () => {
      card.style.transform = "scale(1.05)";
      card.style.transition = "transform 0.2s ease";
    });
    
    card.addEventListener("mouseleave", () => {
      card.style.transform = "scale(1)";
    });
  });
}

// ========================================
// START THE APP
// ========================================
main();

// =============================
// Mobile sidebar (hamburger)
// =============================
(function setupMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.querySelector(".hamburger-btn");
  const closeBtn = document.querySelector(".close-btn");
  const backdrop = document.querySelector(".backdrop");
  const BREAKPOINT = 768;

  if (!sidebar || !hamburger || !backdrop) return;

  function openSidebar() {
    sidebar.classList.add("open");
    document.body.classList.add("no-scroll");
    backdrop.classList.add("show");
    hamburger.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    document.body.classList.remove("no-scroll");
    backdrop.classList.remove("show");
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("open");
    if (isOpen) closeSidebar(); else openSidebar();
  });

  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  backdrop.addEventListener("click", closeSidebar);

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  // Auto-close if resizing to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > BREAKPOINT) closeSidebar();
  });

  // Close when clicking a link in the sidebar (mobile)
  sidebar.addEventListener("click", (e) => {
    const target = e.target;
    if (target.closest && target.closest("a")) closeSidebar();
  });
})();

// Volume Control Functionality
const volumeSlider = document.querySelector('.volume-slider');
const volumeIcon = document.querySelector('.volume-icon');

// Update volume icon based on volume level
function updateVolumeIcon() {
  const volume = volumeSlider.value;
  if (volume == 0) {
    volumeIcon.src = 'volume2.svg';
    volumeIcon.alt = 'Muted';
  } else {
    volumeIcon.src = 'volume.svg';
    volumeIcon.alt = 'Volume';
  }
}

// Update slider background gradient (vertical)
function updateSliderBackground() {
  const volume = volumeSlider.value;
  const percentage = volume;
  volumeSlider.style.background = `linear-gradient(to top, #1db954 0%, #1db954 ${percentage}%, #404040 ${percentage}%, #404040 100%)`;
}

// Handle volume slider input
volumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value;
  
  // Update icon
  updateVolumeIcon();
  
  // Update slider background
  updateSliderBackground();
  
  // If you have an audio element, set its volume
  // Example: audioElement.volume = volume / 100;
  
  console.log('Volume set to:', volume);
});

// Handle volume icon click to mute/unmute
const volumeContainer = document.querySelector('.volume');
let previousVolume = 70;

volumeIcon.addEventListener('click', (e) => {
  e.stopPropagation();
  
  if (volumeSlider.value > 0) {
    // Mute
    previousVolume = volumeSlider.value;
    volumeSlider.value = 0;
  } else {
    // Unmute
    volumeSlider.value = previousVolume;
  }
  
  updateVolumeIcon();
  updateSliderBackground();
});

// Initialize on page load
updateVolumeIcon();
updateSliderBackground();