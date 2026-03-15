const STORAGE_KEYS = {
  playlistUrl: 'iptv_playlist_url',
  playlistRaw: 'iptv_playlist_raw',
  favorites: 'iptv_favorites',
  lastChannelId: 'iptv_last_channel_id',
  lastCategory: 'iptv_last_category',
  qualityPref: 'iptv_quality_pref'
};

const state = {
  rawPlaylist: '',
  channels: [],
  categories: [],
  selectedCategory: 'Obľúbené',
  selectedChannelId: null,
  favorites: new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]')),
  qualityPref: localStorage.getItem(STORAGE_KEYS.qualityPref) || 'auto',
  overlayTimer: null,
  numericTimer: null,
  numericInput: '',
  focusMemory: null,
  currentPlayer: null,
  currentPlayerName: 'native',
  currentStreamUrl: '',
  reconnectTimer: null,
  manualStop: false,
};

const els = {
  clockTime: document.getElementById('clockTime'),
  clockDate: document.getElementById('clockDate'),
  categoryList: document.getElementById('categoryList'),
  channelList: document.getElementById('channelList'),
  channelCount: document.getElementById('channelCount'),
  channelSearch: document.getElementById('channelSearch'),
  video: document.getElementById('videoPlayer'),
  playerEmpty: document.getElementById('playerEmpty'),
  playerLiveBadge: document.getElementById('playerLiveBadge'),
  playerQualityBadge: document.getElementById('playerQualityBadge'),
  firstRunModal: document.getElementById('firstRunModal'),
  settingsModal: document.getElementById('settingsModal'),
  playlistUrlInput: document.getElementById('playlistUrlInput'),
  settingsPlaylistUrl: document.getElementById('settingsPlaylistUrl'),
  loadPlaylistBtn: document.getElementById('loadPlaylistBtn'),
  playlistFileInput: document.getElementById('playlistFileInput'),
  settingsFileInput: document.getElementById('settingsFileInput'),
  settingsLoadBtn: document.getElementById('settingsLoadBtn'),
  settingsRefreshBtn: document.getElementById('settingsRefreshBtn'),
  settingsClearBtn: document.getElementById('settingsClearBtn'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  channelOverlay: document.getElementById('channelOverlay'),
  overlayLogo: document.getElementById('overlayLogo'),
  overlayName: document.getElementById('overlayName'),
  overlayQuality: document.getElementById('overlayQuality'),
  numericOverlay: document.getElementById('numericOverlay'),
  toast: document.getElementById('toast'),
  qualityChoices: document.getElementById('qualityChoices'),
  subtitleToggleBtn: document.getElementById('subtitleToggleBtn'),
  audioTrackBtn: document.getElementById('audioTrackBtn')
};

function init() {
  bindEvents();
  tickClock();
  setInterval(tickClock, 1000);
  hydrateSettings();
  const raw = localStorage.getItem(STORAGE_KEYS.playlistRaw);
  if (raw) {
    try {
      loadPlaylistFromRaw(raw, false);
      els.firstRunModal.classList.add('hidden');
    } catch (err) {
      console.error(err);
      showToast('Nepodarilo sa obnoviť uložený playlist.');
      els.firstRunModal.classList.remove('hidden');
    }
  } else {
    els.firstRunModal.classList.remove('hidden');
    setTimeout(() => els.playlistUrlInput.focus(), 50);
  }
}

function bindEvents() {
  els.loadPlaylistBtn.addEventListener('click', () => handlePlaylistUrlLoad(els.playlistUrlInput.value));
  els.settingsLoadBtn.addEventListener('click', () => handlePlaylistUrlLoad(els.settingsPlaylistUrl.value));
  els.settingsRefreshBtn.addEventListener('click', async () => {
    const url = localStorage.getItem(STORAGE_KEYS.playlistUrl);
    if (!url) return showToast('Nie je uložená URL playlistu.');
    await handlePlaylistUrlLoad(url, true);
  });
  els.settingsClearBtn.addEventListener('click', clearPlaylist);
  els.openSettingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.playlistFileInput.addEventListener('change', (e) => handlePlaylistFile(e.target.files?.[0]));
  els.settingsFileInput.addEventListener('change', (e) => handlePlaylistFile(e.target.files?.[0]));
  els.channelSearch.addEventListener('input', renderChannels);
  document.addEventListener('keydown', handleGlobalKeys);

  els.video.addEventListener('error', () => scheduleReconnect('Stream sa prerušil. Skúšam obnoviť prehrávanie...'));
  els.video.addEventListener('ended', () => scheduleReconnect('Stream sa skončil. Skúšam obnoviť prehrávanie...'));
  els.video.addEventListener('stalled', () => scheduleReconnect('Stream sa spomalil. Skúšam obnoviť prehrávanie...'));

  [...els.qualityChoices.querySelectorAll('[data-quality]')].forEach(btn => {
    if (btn.dataset.quality === state.qualityPref) btn.classList.add('active');
    btn.addEventListener('click', () => setQuality(btn.dataset.quality));
  });

  els.subtitleToggleBtn.addEventListener('click', toggleSubtitles);
  els.audioTrackBtn.addEventListener('click', cycleAudioTracks);
}

function tickClock() {
  const now = new Date();
  els.clockTime.textContent = now.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  els.clockDate.textContent = now.toLocaleDateString('sk-SK');
}

function hydrateSettings() {
  const savedUrl = localStorage.getItem(STORAGE_KEYS.playlistUrl) || '';
  els.playlistUrlInput.value = savedUrl;
  els.settingsPlaylistUrl.value = savedUrl;
}

async function handlePlaylistUrlLoad(url, fromSettings = false) {
  if (!url) return showToast('Zadaj M3U URL.');
  try {
    showToast('Načítavam playlist...');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    localStorage.setItem(STORAGE_KEYS.playlistUrl, url);
    els.playlistUrlInput.value = url;
    els.settingsPlaylistUrl.value = url;
    loadPlaylistFromRaw(text, true);
    if (!fromSettings) els.firstRunModal.classList.add('hidden');
    closeSettings();
    showToast('Playlist bol načítaný.');
  } catch (err) {
    console.error(err);
    showToast('Nepodarilo sa načítať playlist. Skontroluj URL alebo CORS.');
  }
}

function handlePlaylistFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      loadPlaylistFromRaw(String(reader.result || ''), true);
      els.firstRunModal.classList.add('hidden');
      closeSettings();
      showToast('M3U súbor bol načítaný.');
    } catch (err) {
      console.error(err);
      showToast('Súbor sa nepodarilo načítať.');
    }
  };
  reader.readAsText(file);
}

function clearPlaylist() {
  [STORAGE_KEYS.playlistUrl, STORAGE_KEYS.playlistRaw, STORAGE_KEYS.lastChannelId, STORAGE_KEYS.lastCategory].forEach(k => localStorage.removeItem(k));
  state.channels = [];
  state.categories = [];
  state.selectedChannelId = null;
  renderCategories();
  renderChannels();
  stopPlayer();
  els.settingsPlaylistUrl.value = '';
  els.playlistUrlInput.value = '';
  els.firstRunModal.classList.remove('hidden');
  closeSettings();
  showToast('Playlist bol vymazaný.');
}

function parseAttributes(attrString = '') {
  const attrs = {};
  const regex = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = regex.exec(attrString))) attrs[m[1]] = m[2];
  return attrs;
}

function parseQuality(name, url) {
  const source = `${name} ${url}`.toUpperCase();
  if (source.includes('4K') || source.includes('2160')) return '4K';
  if (source.includes('FHD') || source.includes('FULLHD') || source.includes('1080')) return 'FHD';
  if (source.includes('HD') || source.includes('720')) return 'HD';
  if (source.includes('SD') || source.includes('576') || source.includes('480')) return 'SD';
  return 'AUTO';
}

function makeId(channel, idx) {
  return `${channel.name}__${channel.url}__${idx}`;
}

function loadPlaylistFromRaw(raw, persist = true) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const channels = [];
  let current = null;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#EXTINF')) {
      const attrsPart = trimmed.slice(trimmed.indexOf(':') + 1, trimmed.lastIndexOf(','));
      const name = trimmed.split(',').slice(1).join(',').trim() || 'Bez názvu';
      const attrs = parseAttributes(attrsPart);
      current = {
        name,
        group: attrs['group-title'] || 'Ostatné',
        logo: attrs['tvg-logo'] || '',
        tvgId: attrs['tvg-id'] || '',
        number: channels.length + 1,
      };
    } else if (!trimmed.startsWith('#') && current) {
      const channel = { ...current, url: trimmed, quality: parseQuality(current.name, trimmed) };
      channel.id = makeId(channel, idx);
      channels.push(channel);
      current = null;
    }
  });
  state.rawPlaylist = raw;
  state.channels = channels;
  const categoryMap = new Map();
  channels.forEach(ch => categoryMap.set(ch.group, (categoryMap.get(ch.group) || 0) + 1));
  state.categories = [{ name: 'Obľúbené', count: state.favorites.size }, ...[...categoryMap.entries()].map(([name, count]) => ({ name, count }))];
  state.selectedCategory = localStorage.getItem(STORAGE_KEYS.lastCategory) || state.categories[0]?.name || 'Obľúbené';
  if (persist) localStorage.setItem(STORAGE_KEYS.playlistRaw, raw);
  renderCategories();
  renderChannels();
  restoreLastChannel();
}

function getFilteredChannels() {
  let list = state.channels;
  if (state.selectedCategory === 'Obľúbené') list = list.filter(ch => state.favorites.has(ch.id));
  else list = list.filter(ch => ch.group === state.selectedCategory);
  const q = els.channelSearch.value.trim().toLowerCase();
  if (q) list = list.filter(ch => ch.name.toLowerCase().includes(q));
  return list;
}

function renderCategories() {
  els.categoryList.innerHTML = '';
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-item focusable';
    if (cat.name === state.selectedCategory) btn.classList.add('active');
    btn.innerHTML = `<span class="label">${escapeHtml(cat.name)}</span><span class="count">${cat.name === 'Obľúbené' ? state.favorites.size : cat.count}</span>`;
    btn.addEventListener('click', () => {
      state.selectedCategory = cat.name;
      localStorage.setItem(STORAGE_KEYS.lastCategory, cat.name);
      renderCategories();
      renderChannels();
    });
    els.categoryList.appendChild(btn);
  });
}

function channelLogoHtml(ch) {
  if (ch.logo) return `<img class="channel-logo" src="${escapeAttr(ch.logo)}" alt="${escapeAttr(ch.name)} logo" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'channel-logo placeholder',textContent:'TV'}))">`;
  return `<div class="channel-logo placeholder">TV</div>`;
}

function renderChannels() {
  const channels = getFilteredChannels();
  els.channelCount.textContent = channels.length;
  els.channelList.innerHTML = '';
  channels.forEach(ch => {
    const row = document.createElement('div');
    row.className = 'channel-item focusable';
    if (ch.id === state.selectedChannelId) row.classList.add('playing');
    row.innerHTML = `
      <div class="channel-left">
        ${channelLogoHtml(ch)}
        <div>
          <div class="channel-name">${escapeHtml(ch.number + '. ' + ch.name)}</div>
          <div class="channel-meta"><span class="badge badge-live">LIVE</span><span class="badge badge-quality">${escapeHtml(ch.quality)}</span></div>
        </div>
      </div>
      <div class="channel-right">
        <button class="favorite-btn ${state.favorites.has(ch.id) ? 'active' : ''}" aria-label="Obľúbené">★</button>
      </div>`;
    row.addEventListener('click', () => playChannel(ch));
    row.addEventListener('dblclick', () => toggleFavorite(ch.id));
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') playChannel(ch); });
    const favBtn = row.querySelector('.favorite-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(ch.id);
      renderChannels();
      renderCategories();
    });
    els.channelList.appendChild(row);
  });
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
}

function restoreLastChannel() {
  const id = localStorage.getItem(STORAGE_KEYS.lastChannelId);
  const channel = state.channels.find(ch => ch.id === id) || getFilteredChannels()[0];
  if (channel) playChannel(channel, false);
}

function playChannel(channel, autoPlay = true) {
  if (!channel) return;
  state.selectedChannelId = channel.id;
  state.currentStreamUrl = channel.url;
  state.manualStop = false;
  localStorage.setItem(STORAGE_KEYS.lastChannelId, channel.id);
  els.playerEmpty.classList.add('hidden');
  els.playerLiveBadge.classList.remove('hidden');
  els.playerQualityBadge.classList.remove('hidden');
  els.playerQualityBadge.textContent = channel.quality;
  renderChannels();
  showOverlay(channel);
  attachBestPlayer(channel, autoPlay).catch((err) => {
    console.error(err);
    showToast('Prehrávanie sa nepodarilo spustiť. Stream alebo TV browser ho nepodporuje.');
  });
}

function stopPlayer() {
  state.manualStop = true;
  clearTimeout(state.reconnectTimer);
  destroyActivePlayer();
  els.video.pause();
  els.video.removeAttribute('src');
  els.video.load();
  els.playerEmpty.classList.remove('hidden');
  els.playerLiveBadge.classList.add('hidden');
  els.playerQualityBadge.classList.add('hidden');
}

function destroyActivePlayer() {
  try {
    if (state.currentPlayerName === 'hls' && state.currentPlayer?.destroy) state.currentPlayer.destroy();
    if (state.currentPlayerName === 'dash' && state.currentPlayer?.reset) state.currentPlayer.reset();
    if (state.currentPlayerName === 'mpegts' && state.currentPlayer?.destroy) state.currentPlayer.destroy();
    if (state.currentPlayerName === 'shaka' && state.currentPlayer?.destroy) state.currentPlayer.destroy();
  } catch (err) {
    console.warn('Destroy player error', err);
  }
  state.currentPlayer = null;
  state.currentPlayerName = 'native';
}

function inferType(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'hls';
  if (clean.endsWith('.mpd')) return 'dash';
  if (clean.endsWith('.ts') || clean.includes('/udp/') || clean.includes('mpegts')) return 'mpegts';
  return 'native';
}

async function attachBestPlayer(channel, autoPlay = true) {
  const url = channel.url;
  const kind = inferType(url);
  destroyActivePlayer();
  clearTimeout(state.reconnectTimer);

  const candidates = [];
  if (kind === 'hls') candidates.push('hls', 'shaka', 'native');
  else if (kind === 'dash') candidates.push('dash', 'shaka', 'native');
  else if (kind === 'mpegts') candidates.push('mpegts', 'native');
  else candidates.push('native', 'hls', 'shaka');

  for (const candidate of candidates) {
    try {
      await attachPlayer(candidate, url, autoPlay);
      state.currentPlayerName = candidate;
      showToast(`Prehrávač: ${playerLabel(candidate)}`);
      return;
    } catch (err) {
      console.warn(`Player ${candidate} failed`, err);
      destroyActivePlayer();
    }
  }
  throw new Error('No compatible player available');
}

function playerLabel(name) {
  return ({ native: 'Natívny', hls: 'HLS.js', dash: 'dash.js', mpegts: 'mpegts.js', shaka: 'Shaka Player' })[name] || name;
}

function attachPlayer(name, url, autoPlay) {
  if (name === 'native') return attachNative(url, autoPlay);
  if (name === 'hls') return attachHls(url, autoPlay);
  if (name === 'dash') return attachDash(url, autoPlay);
  if (name === 'mpegts') return attachMpegTs(url, autoPlay);
  if (name === 'shaka') return attachShaka(url, autoPlay);
  return Promise.reject(new Error('Unknown player'));
}

function attachNative(url, autoPlay) {
  return new Promise((resolve, reject) => {
    els.video.src = url;
    const onLoaded = () => {
      cleanup();
      if (autoPlay) els.video.play().catch(() => {});
      resolve();
    };
    const onError = () => { cleanup(); reject(new Error('Native playback failed')); };
    const cleanup = () => {
      els.video.removeEventListener('loadedmetadata', onLoaded);
      els.video.removeEventListener('error', onError);
    };
    els.video.addEventListener('loadedmetadata', onLoaded, { once: true });
    els.video.addEventListener('error', onError, { once: true });
    els.video.load();
  });
}

function attachHls(url, autoPlay) {
  return new Promise((resolve, reject) => {
    if (!window.Hls) return reject(new Error('Hls.js unavailable'));
    if (window.Hls.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
      state.currentPlayer = hls;
      hls.loadSource(url);
      hls.attachMedia(els.video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) els.video.play().catch(() => {});
        resolve();
      });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) reject(new Error(data.type || 'HLS fatal error'));
      });
      return;
    }
    if (els.video.canPlayType('application/vnd.apple.mpegurl')) return attachNative(url, autoPlay).then(resolve).catch(reject);
    reject(new Error('HLS unsupported'));
  });
}

function attachDash(url, autoPlay) {
  return new Promise((resolve, reject) => {
    if (!window.dashjs?.MediaPlayer) return reject(new Error('dash.js unavailable'));
    const player = window.dashjs.MediaPlayer().create();
    state.currentPlayer = player;
    player.initialize(els.video, url, autoPlay);
    player.on('streamInitialized', () => resolve());
    player.on('error', () => reject(new Error('DASH playback failed')));
  });
}

function attachMpegTs(url, autoPlay) {
  return new Promise((resolve, reject) => {
    if (!window.mpegts?.isSupported?.()) return reject(new Error('mpegts.js unsupported'));
    const player = window.mpegts.createPlayer({ type: 'mpegts', isLive: true, url });
    state.currentPlayer = player;
    player.attachMediaElement(els.video);
    player.load();
    if (autoPlay) els.video.play().catch(() => {});
    const done = () => resolve();
    els.video.addEventListener('loadedmetadata', done, { once: true });
    setTimeout(() => resolve(), 1200);
  });
}

function attachShaka(url, autoPlay) {
  return new Promise((resolve, reject) => {
    if (!window.shaka?.Player) return reject(new Error('Shaka unavailable'));
    const player = new window.shaka.Player(els.video);
    state.currentPlayer = player;
    player.load(url).then(() => {
      if (autoPlay) els.video.play().catch(() => {});
      resolve();
    }).catch(reject);
  });
}

function scheduleReconnect(message) {
  if (state.manualStop || !state.currentStreamUrl) return;
  clearTimeout(state.reconnectTimer);
  showToast(message);
  state.reconnectTimer = setTimeout(() => {
    const current = state.channels.find(ch => ch.id === state.selectedChannelId);
    if (current) attachBestPlayer(current, true).catch(console.error);
  }, 1800);
}

function showOverlay(channel) {
  if (channel.logo) {
    els.overlayLogo.src = channel.logo;
    els.overlayLogo.classList.remove('hidden');
  } else els.overlayLogo.classList.add('hidden');
  els.overlayName.textContent = channel.name;
  els.overlayQuality.textContent = channel.quality;
  els.channelOverlay.classList.remove('hidden');
  clearTimeout(state.overlayTimer);
  state.overlayTimer = setTimeout(() => els.channelOverlay.classList.add('hidden'), 4000);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function openSettings() {
  state.focusMemory = document.activeElement;
  els.settingsModal.classList.remove('hidden');
  setTimeout(() => els.settingsPlaylistUrl.focus(), 60);
}
function closeSettings() {
  els.settingsModal.classList.add('hidden');
  if (state.focusMemory?.focus) setTimeout(() => state.focusMemory.focus(), 30);
}

function setQuality(val) {
  state.qualityPref = val;
  localStorage.setItem(STORAGE_KEYS.qualityPref, val);
  [...els.qualityChoices.querySelectorAll('[data-quality]')].forEach(btn => btn.classList.toggle('active', btn.dataset.quality === val));
  showToast(`Preferencia kvality: ${labelQualityPref(val)}`);
}
function labelQualityPref(v) {
  return ({ auto: 'Automaticky', high: 'Vysoká', medium: 'Stredná', low: 'Nízka' })[v] || 'Automaticky';
}

function toggleSubtitles() {
  if (!els.video.textTracks || !els.video.textTracks.length) return showToast('Titulky nie sú dostupné pre tento stream.');
  const tracks = Array.from(els.video.textTracks);
  const anyShowing = tracks.some(t => t.mode === 'showing');
  tracks.forEach(t => t.mode = anyShowing ? 'disabled' : 'showing');
  showToast(anyShowing ? 'Titulky vypnuté.' : 'Titulky zapnuté.');
}

function cycleAudioTracks() {
  const audioTracks = els.video.audioTracks;
  if (!audioTracks || !audioTracks.length) return showToast('Ďalšia zvuková stopa nie je dostupná.');
  let current = 0;
  for (let i = 0; i < audioTracks.length; i++) if (audioTracks[i].enabled) current = i;
  audioTracks[current].enabled = false;
  audioTracks[(current + 1) % audioTracks.length].enabled = true;
  showToast('Prepnutá zvuková stopa.');
}

function handleGlobalKeys(e) {
  if (!state.channels.length && els.firstRunModal.classList.contains('hidden')) return;

  if (/^\d$/.test(e.key) && !els.firstRunModal.classList.contains('hidden') === false) {
    state.numericInput += e.key;
    els.numericOverlay.textContent = state.numericInput;
    els.numericOverlay.classList.remove('hidden');
    clearTimeout(state.numericTimer);
    state.numericTimer = setTimeout(() => {
      const num = parseInt(state.numericInput, 10);
      const channel = state.channels.find(ch => ch.number === num);
      if (channel) playChannel(channel);
      else showToast(`Kanál ${num} neexistuje.`);
      state.numericInput = '';
      els.numericOverlay.classList.add('hidden');
    }, 1100);
  }

  if (e.key === 'ArrowUp' && document.activeElement === document.body) zapRelative(-1);
  if (e.key === 'ArrowDown' && document.activeElement === document.body) zapRelative(1);

  if (e.key === 'Backspace' || e.key === 'Escape') {
    if (!els.settingsModal.classList.contains('hidden')) {
      e.preventDefault();
      closeSettings();
      return;
    }
    if (!els.channelOverlay.classList.contains('hidden')) {
      els.channelOverlay.classList.add('hidden');
      e.preventDefault();
      return;
    }
  }

  const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (!typing && e.key === 'ArrowUp') { e.preventDefault(); zapRelative(-1); }
  if (!typing && e.key === 'ArrowDown') { e.preventDefault(); zapRelative(1); }
  if (!typing && e.key === 'Enter' && state.selectedChannelId) showOverlay(state.channels.find(ch => ch.id === state.selectedChannelId));
}

function zapRelative(offset) {
  const visible = getFilteredChannels();
  if (!visible.length) return;
  const idx = visible.findIndex(ch => ch.id === state.selectedChannelId);
  const next = visible[(idx + offset + visible.length) % visible.length] || visible[0];
  playChannel(next);
}

function escapeHtml(str = '') {
  return str.replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}
function escapeAttr(str = '') { return escapeHtml(str); }

init();
