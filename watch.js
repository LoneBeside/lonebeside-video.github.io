'use strict';

/* ============ watch overlay ============ */
function loadPlayer(v, s) {
  const p = $('#player');
  p.pause();
  if (state.watchUrl) { URL.revokeObjectURL(state.watchUrl); state.watchUrl = null; }
  const url = URL.createObjectURL(v.blob);
  state.watchUrl = url;
  p.src = url;
  p.poster = coverOf(s) || '';
  p.play().catch(() => {});
}

function openWatch(vid) {
  const v = videoById(vid);
  if (!v) { toast('视频不存在'); return; }
  const s = findSeries(v.seriesId);
  if (!s) return;
  state.currentVid = vid;
  state.currentSid = s.id;
  closeDrawers();
  $('#watch').classList.add('on');
  document.body.classList.add('locked');
  v.views = (v.views || 0) + 1;
  dbPut('videos', v).catch(() => {});
  loadPlayer(v, s);
  paintWatch(v, s);
  renderRank();
}

function closeWatch(unlock) {
  const p = $('#player');
  p.pause();
  p.removeAttribute('src');
  try { p.load(); } catch (e) {}
  if (state.watchUrl) { URL.revokeObjectURL(state.watchUrl); state.watchUrl = null; }
  $('#watch').classList.remove('on');
  state.currentVid = null;
  if (unlock !== false && !$('.drawer.on')) document.body.classList.remove('locked');
}

function paintWatch(v, s) {
  $('#wSeries').textContent = s.title;
  $('#wEp').textContent = epLabel(v);
  $('#wTitle').textContent = s.title + ' · ' + epLabel(v);
  $('#wMeta').textContent = `${fmtBytes(v.size)} · ${fmtDur(v.duration)} · ${v.views || 0} 次播放 · 上传于 ${timeAgo(v.createdAt)}`;

  const src = coverOf(s);
  $('#wCover').innerHTML = src
    ? `<img src="${src}" alt="">`
    : `<span style="display:grid;place-items:center;height:100%;font-family:'Cormorant Garamond',serif;font-size:22px;color:rgba(239,230,213,.5);background:linear-gradient(150deg,#3d473c,#5a4436)">${esc((s.title || '番')[0])}</span>`;
  const coverImg = $('#wCover img');
  if (coverImg) coverImg.addEventListener('error', () => { coverImg.style.display = 'none'; });
  $('#wSeriesName').textContent = s.title;
  $('#wSeriesDesc').textContent = s.desc || '暂无简介';

  $('#wLike').classList.toggle('on', !!s.liked);
  $('#wLikeN').textContent = fmtNum(s.likes);
  $('#wFav').classList.toggle('on', !!s.favorited);
  $('#wFavTxt').textContent = s.favorited ? '已收藏' : '收藏';

  const vids = videosOf(s.id);
  $('#wEpsCount').textContent = vids.length + ' 集';
  $('#wEpList').innerHTML = vids.map(item => `
    <button class="ep-chip ${item.id === state.currentVid ? 'on' : ''}" data-epv="${item.id}">${esc(epLabel(item))}</button>
  `).join('');

  renderComments(v);
}

function renderComments(v) {
  const list = (v.comments || []).slice().sort((a, b) => a.at - b.at);
  $('#wCommentCount').textContent = list.length ? list.length + ' 条' : '';
  $('#commentList').innerHTML = list.length ? list.map(c => `
    <div class="comment">
      <span class="avatar">${esc((c.author || '我')[0])}</span>
      <div class="comment-body">
        <div class="c-top"><b>${esc(c.author || '我')}</b><time>${timeAgo(c.at)}</time></div>
        <p>${esc(c.text)}</p>
      </div>
    </div>`).join('') : '<div class="comment-empty">还没有评论<br>来说第一句吧 ✦</div>';
}

function bindWatch() {
  $('#watchClose').addEventListener('click', () => closeWatch());
  $('#watchBack').addEventListener('click', () => {
    const sid = state.currentSid;
    closeWatch(false);
    const s = sid ? findSeries(sid) : null;
    if (s) {
      state.currentSid = sid;
      renderSeriesDrawer(s);
      openDrawer($('#seriesDrawer'));
    }
  });

  $('#wLike').addEventListener('click', () => {
    if (state.currentSid) toggleLike(state.currentSid);
  });
  $('#wFav').addEventListener('click', () => {
    if (state.currentSid) toggleFav(state.currentSid);
  });
  $('#wDownload').addEventListener('click', () => {
    if (state.currentVid) downloadVideo(state.currentVid);
  });

  $('#wEpList').addEventListener('click', e => {
    const btn = e.target.closest('[data-epv]');
    if (!btn) return;
    if (btn.dataset.epv === state.currentVid) return;
    openWatch(btn.dataset.epv);
  });

  $('#commentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#commentInput');
    const text = input.value.trim();
    const v = videoById(state.currentVid);
    if (!v || !text) return;
    v.comments = v.comments || [];
    v.comments.push({ id: uid(), author: '我', text: text.slice(0, 200), at: Date.now() });
    try {
      await dbPut('videos', v);
      input.value = '';
      renderComments(v);
      const list = $('#commentList');
      list.scrollTop = list.scrollHeight;
      toast('评论已发布');
    } catch (err) {
      toast('评论保存失败：' + err.message);
    }
  });
}
