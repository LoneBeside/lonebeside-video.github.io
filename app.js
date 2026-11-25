'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const IC = {
  play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>',
  heart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.6-9.2-8.4C.9 8 2.6 4.5 6.2 4.5c2 0 3.4 1.1 4.3 2.4.9-1.3 2.3-2.4 4.3-2.4 3.6 0 5.3 3.5 3.4 7.1C19 15.4 12 20 12 20z"/></svg>',
  book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>',
  camera: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
};

const state = {
  cat: '全部', sort: 'new', keyword: '',
  series: [], videos: [],
  currentSid: null, currentVid: null,
  pendingCoverSid: null, watchUrl: null,
  uploadFiles: [], uploading: false, newCoverFile: null
};

const coverCache = new Map();

/* ============ data helpers ============ */
function findSeries(id) { return state.series.find(s => s.id === id) || null; }
function videosOf(sid) { return state.videos.filter(v => v.seriesId === sid).sort((a, b) => a.ep - b.ep); }
function videoById(id) { return state.videos.find(v => v.id === id) || null; }
function totalBytes(vids) { return vids.reduce((n, v) => n + (v.size || 0), 0); }
function seriesScore(s) {
  const vids = videosOf(s.id);
  return (s.likes || 0) * 2 + (s.favorited ? 20 : 0) + vids.reduce((n, v) => n + (v.views || 0), 0);
}
function coverOf(s) {
  if (!s) return '';
  if (s.coverBlob) {
    if (!coverCache.has(s.id)) coverCache.set(s.id, URL.createObjectURL(s.coverBlob));
    return coverCache.get(s.id);
  }
  return s.coverUrl || '';
}
function clearCoverCache(id) {
  const u = coverCache.get(id);
  if (u) URL.revokeObjectURL(u);
  coverCache.delete(id);
}
function epLabel(v) { return v.title || ('第 ' + pad2(v.ep) + ' 话'); }

/* ============ drawer helpers ============ */
function openDrawer(el) {
  $$('.drawer.on').forEach(d => d.classList.remove('on'));
  el.classList.add('on');
  $('#scrim').classList.add('on');
  document.body.classList.add('locked');
}
function closeDrawers() {
  if (state.uploading) { toast('正在写入，请稍候…'); return; }
  $$('.drawer.on').forEach(d => d.classList.remove('on'));
  $('#scrim').classList.remove('on');
  if (!$('#watch').classList.contains('on')) document.body.classList.remove('locked');
}
function toast(msg) {
  $('#toastText').textContent = msg;
  const el = $('#toast');
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ============ render ============ */
function updateCounts() {
  const has = state.series.filter(s => videosOf(s.id).length > 0).length;
  const fav = state.series.filter(s => s.favorited).length;
  $('#cntAll').textContent = state.series.length;
  $('#cntHas').textContent = has;
  $('#cntEmpty').textContent = state.series.length - has;
  $('#cntFav').textContent = fav;
  $('#navFavN').textContent = fav;
  $('#statSeries').textContent = state.series.length;
  $('#statVideos').textContent = state.videos.length;
  $('#statFavs').textContent = fav;
}

function filteredSeries() {
  const kw = state.keyword.trim().toLowerCase();
  let list = state.series.filter(s => {
    const vids = videosOf(s.id);
    const has = vids.length > 0;
    let ok = state.cat === '全部' ||
      (state.cat === '有视频' && has) ||
      (state.cat === '暂无视频' && !has) ||
      (state.cat === '我的收藏' && s.favorited);
    if (ok && kw) {
      const hay = [s.title, s.original, s.desc, s.tags.join(' '), vids.map(v => v.title).join(' ')]
        .join(' ').toLowerCase();
      ok = hay.includes(kw);
    }
    return ok;
  });
  if (state.sort === 'videos') list.sort((a, b) => videosOf(b.id).length - videosOf(a.id).length);
  else if (state.sort === 'hot') list.sort((a, b) => seriesScore(b) - seriesScore(a));
  else if (state.sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
  else list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list;
}

function cardHTML(s, i) {
  const vids = videosOf(s.id);
  const has = vids.length > 0;
  const src = coverOf(s);
  return `
    <article class="card" data-sid="${s.id}" style="animation-delay:${Math.min(i * 40, 320)}ms">
      <div class="poster">
        <div class="ph">${esc((s.title || '番')[0])}</div>
        ${src ? `<img src="${src}" alt="${esc(s.title)}" loading="lazy">` : ''}
        <div class="shade"></div>
        <span class="badge-status ${has ? '' : 'done'}"><i></i>${has ? vids.length + ' 集' : '暂无视频'}</span>
        <button class="cover-edit" data-cover="${s.id}" title="更换封面" aria-label="更换封面">${IC.camera}</button>
        <div class="quick"><button class="quick-btn" data-open="${s.id}">${IC.play}<span>进入系列</span></button></div>
        <div class="poster-bottom">
          <span class="epbadge">${has ? fmtBytes(totalBytes(vids)) : '等待上传'}</span>
          <span class="epcount">${has ? vids.length : 0}<small>集</small></span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">
          <h3>${esc(s.title)}<em>${esc(s.original || ' ')}</em></h3>
        </div>
        <div class="card-meta">
          ${s.tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          ${has ? `<span class="sep"></span><span>${timeAgo(s.updatedAt)}更新</span>` : `<span class="sep"></span><span>待上传</span>`}
        </div>
        <div class="card-actions">
          <button class="act-btn like-btn ${s.liked ? 'on' : ''}" data-like="${s.id}" title="点赞">${IC.heart}<b>${fmtNum(s.likes)}</b></button>
          <button class="act-btn fav-btn ${s.favorited ? 'on' : ''}" data-fav="${s.id}" title="收藏">${IC.book}<span>${s.favorited ? '已收藏' : '收藏'}</span></button>
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const list = filteredSeries();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $('#resultCount').textContent = list.length;
  $('#empty').classList.toggle('show', list.length === 0);
  $$('#grid .poster img').forEach(img => {
    img.addEventListener('error', () => { img.style.display = 'none'; });
  });
}

function renderUpdates() {
  const list = [...state.videos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const box = $('#updateList');
  if (!list.length) {
    box.innerHTML = '<div class="comment-empty">还没有视频<br>上传后会出现在这里</div>';
    $('#latestHint').textContent = '共 0 个视频';
    return;
  }
  box.innerHTML = list.map(v => {
    const s = findSeries(v.seriesId);
    if (!s) return '';
    const src = coverOf(s);
    return `
      <div class="update-row" data-play="${v.id}">
        <div class="update-thumb">
          <div class="ph">${esc((s.title || '番')[0])}</div>
          ${src ? `<img src="${src}" alt="" loading="lazy">` : ''}
        </div>
        <div class="update-info">
          <h4>${esc(s.title)} <em>${esc(epLabel(v))}</em></h4>
          <p>${fmtBytes(v.size)} · ${fmtDur(v.duration)} · ${timeAgo(v.createdAt)}</p>
        </div>
        <div class="update-meta">
          <time>${v.views || 0} 次播放</time>
          <span class="mini-dlbtn">${IC.play}播放</span>
        </div>
      </div>`;
  }).join('');
  $$('#updateList img').forEach(img => img.addEventListener('error', () => { img.style.display = 'none'; }));
  $('#latestHint').textContent = `共 ${state.videos.length} 个视频`;
}

function renderRank() {
  const list = state.series.filter(s => videosOf(s.id).length > 0)
    .map(s => ({ s, vids: videosOf(s.id) }))
    .sort((a, b) => b.vids.reduce((n, v) => n + (v.views || 0), 0) - a.vids.reduce((n, v) => n + (v.views || 0), 0))
    .slice(0, 6);
  $('#rankList').innerHTML = list.length ? list.map(({ s, vids }, i) => {
    const views = vids.reduce((n, v) => n + (v.views || 0), 0);
    return `
      <div class="rank-row" data-open="${s.id}">
        <span class="rank-num">${pad2(i + 1)}</span>
        <span class="rank-name">${esc(s.title)}</span>
        <span class="rank-hot"><b>${fmtNum(views)}</b> 次</span>
      </div>`;
  }).join('') : '<div class="comment-empty">暂无播放数据</div>';
}

function updateMiniStorage() {
  if (!navigator.storage || !navigator.storage.estimate) return;
  navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
    const pct = quota ? Math.min(100, usage / quota * 100) : 0;
    $('#storePct').textContent = pct >= 0.1 ? pct.toFixed(1) + '%' : '<0.1%';
    $('#storeBar').style.width = Math.max(pct, 1.6) + '%';
    $('#storeUsed').textContent = fmtBytes(usage);
  }).catch(() => {});
}

function renderAll() {
  updateCounts();
  renderGrid();
  renderUpdates();
  renderRank();
  updateMiniStorage();
}

async function refresh() {
  state.series = await dbAll('series');
  state.videos = await dbAll('videos');
  renderAll();
}

/* ============ social ============ */
function paintSocial(s) {
  $$(`[data-like="${s.id}"]`).forEach(el => {
    el.classList.toggle('on', !!s.liked);
    const b = el.querySelector('b');
    if (b) b.textContent = fmtNum(s.likes);
  });
  $$(`[data-fav="${s.id}"]`).forEach(el => {
    el.classList.toggle('on', !!s.favorited);
    const sp = el.querySelector('span');
    if (sp) sp.textContent = s.favorited ? '已收藏' : '收藏';
  });
  if (state.currentSid === s.id) {
    const like = $('#wLike'), fav = $('#wFav');
    if (like) { like.classList.toggle('on', !!s.liked); $('#wLikeN').textContent = fmtNum(s.likes); }
    if (fav) { fav.classList.toggle('on', !!s.favorited); $('#wFavTxt').textContent = s.favorited ? '已收藏' : '收藏'; }
  }
  updateCounts();
}

async function toggleLike(sid) {
  const s = findSeries(sid);
  if (!s) return;
  s.liked = !s.liked;
  s.likes = Math.max(0, (s.likes || 0) + (s.liked ? 1 : -1));
  paintSocial(s);
  try { await dbPut('series', s); } catch (e) { toast('保存失败，请检查存储空间'); }
  if (state.cat === '我的收藏') renderGrid();
}

async function toggleFav(sid) {
  const s = findSeries(sid);
  if (!s) return;
  s.favorited = !s.favorited;
  paintSocial(s);
  try { await dbPut('series', s); } catch (e) { toast('保存失败，请检查存储空间'); }
  if (state.cat === '我的收藏') renderGrid();
  toast(s.favorited ? '已加入我的收藏' : '已取消收藏');
}

/* ============ series drawer ============ */
function openSeries(sid) {
  const s = findSeries(sid);
  if (!s) return;
  state.currentSid = sid;
  renderSeriesDrawer(s);
  closeDrawers();
  openDrawer($('#seriesDrawer'));
}

function renderSeriesDrawer(s) {
  const vids = videosOf(s.id);
  const src = coverOf(s);
  const rows = vids.map(v => `
    <div class="ep-row">
      <span class="ep-no">${esc(epLabel(v)).replace(/[^0-9]/g, '').slice(-2) || '01'}</span>
      <div class="ep-txt">
        <b>${esc(epLabel(v))}</b>
        <small>${fmtBytes(v.size)} · ${fmtDur(v.duration)} · ${v.views || 0} 次播放</small>
      </div>
      <div class="ep-btns">
        <button class="play" data-play="${v.id}" title="播放">${IC.play}</button>
        <button data-dl="${v.id}" title="下载">${IC.down}</button>
        <button class="del" data-delvid="${v.id}" title="删除">${IC.trash}</button>
      </div>
    </div>`).join('');

  $('#seriesDrawer').innerHTML = `
    <div class="drawer-head">
      <button class="drawer-close" data-close-drawer aria-label="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="drawer-cover">
        <div class="ph">${esc((s.title || '番')[0])}</div>
        ${src ? `<img src="${src}" alt="">` : ''}
      </div>
      <div class="drawer-title">
        <h3>${esc(s.title)}</h3>
        <div class="sub">${esc(s.original || '无原名')} · ${vids.length} 集 · ${fmtBytes(totalBytes(vids))}</div>
        <div class="tags"><span class="green">${vids.length ? '已收录' : '空系列'}</span>${s.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="drawer-body">
      <div class="drawer-actions">
        <button class="act-lg ${s.liked ? 'on' : ''}" data-like="${s.id}">${IC.heart} 点赞 <b>${fmtNum(s.likes)}</b></button>
        <button class="act-lg fav ${s.favorited ? 'on' : ''}" data-fav="${s.id}">${IC.book} <span>${s.favorited ? '已收藏' : '收藏'}</span></button>
        <button class="act-lg" data-cover="${s.id}">${IC.camera} 更换封面</button>
      </div>
      <div class="fld-head"><label>剧集 · ${vids.length}</label><span>按集数排序</span></div>
      ${vids.length ? rows : `<div class="series-empty">这个系列还没有视频<br><button class="btn-primary" data-addvideo="${s.id}">${IC.up} 上传第一个视频</button></div>`}
    </div>
    <div class="drawer-foot">
      <div class="sum">
        <div class="l"><small>本系列共</small><b>${vids.length} 集 · ${fmtBytes(totalBytes(vids))}</b></div>
        <div class="l" style="text-align:right"><small>最后更新</small><b>${timeAgo(s.updatedAt)}</b></div>
      </div>
      <button class="cta" data-addvideo="${s.id}">${IC.up} 上传视频到本系列</button>
      <button class="danger-link" data-delseries="${s.id}">删除本系列</button>
    </div>`;

  const img = $('#seriesDrawer .drawer-cover img');
  if (img) img.addEventListener('error', () => { img.style.display = 'none'; });
  $('#seriesDrawer .drawer-body').scrollTop = 0;
}

/* ============ download / delete ============ */
function downloadVideo(vid) {
  const v = videoById(vid);
  if (!v || !v.blob) { toast('视频文件不存在'); return; }
  const s = findSeries(v.seriesId);
  const mime = v.mime || '';
  const ext = mime.includes('webm') ? 'webm' : (mime.includes('matroska') || mime.includes('mkv')) ? 'mkv' : 'mp4';
  const url = URL.createObjectURL(v.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName(`${s ? s.title : 'video'}_${epLabel(v)}`) + '.' + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  toast('已开始下载');
}

async function deleteVideo(vid) {
  const v = videoById(vid);
  if (!v) return;
  const s = findSeries(v.seriesId);
  if (!confirm(`确定删除「${s ? s.title : ''} · ${epLabel(v)}」？\n文件会从浏览器存储中移除。`)) return;
  try {
    await dbDel('videos', vid);
    state.videos = state.videos.filter(x => x.id !== vid);
    if (s) { s.updatedAt = Date.now(); await dbPut('series', s); }
    if (state.currentVid === vid) closeWatch();
    await refresh();
    if ($('#seriesDrawer').classList.contains('on') && state.currentSid === (s ? s.id : '')) {
      const fresh = findSeries(state.currentSid);
      if (fresh) renderSeriesDrawer(fresh);
    }
    toast('视频已删除');
  } catch (e) { toast('删除失败：' + e.message); }
}

async function deleteSeries(sid) {
  const s = findSeries(sid);
  if (!s) return;
  const vids = videosOf(sid);
  if (!confirm(`确定删除系列「${s.title}」及其 ${vids.length} 个视频？\n此操作不可恢复。`)) return;
  try {
    for (const v of vids) await dbDel('videos', v.id);
    await dbDel('series', sid);
    clearCoverCache(sid);
    if (state.currentSid === sid && $('#watch').classList.contains('on')) closeWatch();
    closeDrawers();
    await refresh();
    toast('系列已删除');
  } catch (e) { toast('删除失败：' + e.message); }
}

/* ============ cover ============ */
$('#coverInput').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  const sid = state.pendingCoverSid;
  e.target.value = '';
  if (!file || !sid) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  const s = findSeries(sid);
  if (!s) return;
  clearCoverCache(sid);
  s.coverBlob = file;
  s.coverUrl = '';
  s.updatedAt = Date.now();
  try {
    await dbPut('series', s);
    renderGrid();
    renderUpdates();
    if ($('#seriesDrawer').classList.contains('on') && state.currentSid === sid) renderSeriesDrawer(s);
    toast('封面已更新');
  } catch (err) { toast('封面保存失败：' + err.message); }
});

/* ============ search / filter ============ */
function doSearch(val) {
  state.keyword = val;
  renderGrid();
  $('#library').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setCat(cat) {
  state.cat = cat;
  $$('#catChips .chip').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderGrid();
}

/* ============ events ============ */
function bindGlobal() {
  document.addEventListener('click', e => {
    const coverBtn = e.target.closest('[data-cover]');
    if (coverBtn) {
      state.pendingCoverSid = coverBtn.dataset.cover;
      $('#coverInput').click();
      return;
    }
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) { toggleLike(likeBtn.dataset.like); return; }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { toggleFav(favBtn.dataset.fav); return; }
    const upBtn = e.target.closest('[data-upload]');
    if (upBtn) { openUpload(); return; }
    const addBtn = e.target.closest('[data-addvideo]');
    if (addBtn) { openUpload(addBtn.dataset.addvideo); return; }
    const closeBtn = e.target.closest('[data-close-drawer]');
    if (closeBtn) { closeDrawers(); return; }
    const playBtn = e.target.closest('[data-play]');
    if (playBtn) { openWatch(playBtn.dataset.play); return; }
    const dlBtn = e.target.closest('[data-dl]');
    if (dlBtn) { downloadVideo(dlBtn.dataset.dl); return; }
    const delVid = e.target.closest('[data-delvid]');
    if (delVid) { deleteVideo(delVid.dataset.delvid); return; }
    const delSeries = e.target.closest('[data-delseries]');
    if (delSeries) { deleteSeries(delSeries.dataset.delseries); return; }
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) { openSeries(openBtn.dataset.open); return; }
    const card = e.target.closest('.card');
    if (card) { openSeries(card.dataset.sid); }
  });

  $('#scrim').addEventListener('click', closeDrawers);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('#watch').classList.contains('on')) { closeWatch(); return; }
    closeDrawers();
    $('#sortMenu').classList.remove('open');
  });
}

function bindStatic() {
  window.addEventListener('scroll', () => {
    $('#nav').classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  $('#catChips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (btn) setCat(btn.dataset.cat);
  });

  $('#sortBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('#sortMenu').classList.toggle('open');
  });
  $('#sortMenu').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $$('#sortMenu button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.sort = btn.dataset.sort;
    $('#sortLabel').textContent = btn.textContent;
    $('#sortMenu').classList.remove('open');
    renderGrid();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.sort-wrap')) $('#sortMenu').classList.remove('open');
  });

  const heroSearch = $('#heroSearch'), navSearch = $('#navSearch');
  $('#heroGo').addEventListener('click', () => doSearch(heroSearch.value));
  heroSearch.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(heroSearch.value); });
  heroSearch.addEventListener('input', () => { state.keyword = heroSearch.value; renderGrid(); });
  navSearch.addEventListener('input', () => { state.keyword = navSearch.value; renderGrid(); });
  navSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') { doSearch(navSearch.value); }
  });
  $$('.quick-tags button').forEach(b => b.addEventListener('click', () => {
    heroSearch.value = b.dataset.tag;
    state.keyword = b.dataset.tag;
    setCat('全部');
    renderGrid();
    document.getElementById('library').scrollIntoView({ behavior: 'smooth' });
  }));

  ['navUpload', 'heroUpload', 'uploadFab'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => openUpload());
  });
  const goFav = e => { e.preventDefault(); setCat('我的收藏'); document.getElementById('library').scrollIntoView({ behavior: 'smooth' }); };
  $('#navFav').addEventListener('click', goFav);
  $('#footFav').addEventListener('click', goFav);
  $('#footHelp').addEventListener('click', () => toast('上传的视频保存在浏览器本地，请固定使用同一浏览器与地址打开'));

  $('#videoInput').addEventListener('change', e => {
    addUploadFiles(e.target.files);
    e.target.value = '';
  });
}

function observeReveal() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal:not(.in)').forEach(el => io.observe(el));
}

/* ============ init ============ */
document.addEventListener('DOMContentLoaded', async () => {
  bindGlobal();
  bindStatic();
  if (location.protocol === 'file:') {
    $('#notice').classList.add('on');
    return;
  }
  try {
    db = await openDB();
    await seedIfEmpty();
    await refresh();
    bindWatch();
    bindUpload();
    observeReveal();
    updateMiniStorage();
  } catch (err) {
    console.error(err);
    toast('初始化失败：' + (err && err.message ? err.message : err));
  }
});
