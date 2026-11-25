'use strict';

/* ============ uploader ============ */
function openUpload(sid) {
  if (!db) { toast('请通过「启动网站.bat」打开再上传'); return; }
  state.uploadFiles = [];
  state.newCoverFile = null;
  buildSeriesOptions(sid);
  $('#nsTitle').value = '';
  $('#nsOriginal').value = '';
  $('#nsTags').value = '';
  $('#nsDesc').value = '';
  $('#nsCover').value = '';
  $('#nsCoverName').textContent = '未选择，之后也可更换';
  renderUploadFiles();
  syncUploadUI();
  closeDrawers();
  openDrawer($('#uploadDrawer'));
}

function buildSeriesOptions(sid) {
  const sel = $('#seriesSelect');
  const sorted = state.series.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  sel.innerHTML = sorted.map(s =>
    `<option value="${s.id}">${esc(s.title)} · ${videosOf(s.id).length} 集</option>`
  ).join('') + '<option value="new">＋ 新建系列</option>';
  const want = sid && state.series.some(s => s.id === sid) ? sid
    : (sorted.length ? sorted[0].id : 'new');
  sel.value = want;
  toggleNewSeriesFields();
}

function toggleNewSeriesFields() {
  const isNew = $('#seriesSelect').value === 'new';
  $('#newSeriesFields').classList.toggle('hidden', !isNew);
}

function addUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  const vids = files.filter(f =>
    (f.type && f.type.startsWith('video/')) || /\.(mp4|webm|mkv|mov|m4v|avi)$/i.test(f.name)
  );
  if (!vids.length) { toast('请选择视频文件'); return; }
  vids.forEach(file => {
    state.uploadFiles.push({ id: uid(), file, status: '' });
  });
  renderUploadFiles();
  syncUploadUI();
}

function renderUploadFiles() {
  $('#fileList').innerHTML = state.uploadFiles.map((it, i) => `
    <div class="file-row" data-idx="${i}">
      <span class="f-ico">${IC.play}</span>
      <div class="file-txt">
        <b>${esc(it.file.name)}</b>
        <small>${fmtBytes(it.file.size)}${it.status ? ' · ' + esc(it.status) : ''}</small>
      </div>
      <button class="rm" data-rm="${i}" title="移除">×</button>
    </div>`).join('');
}

function syncUploadUI() {
  const n = state.uploadFiles.length;
  const total = state.uploadFiles.reduce((s, it) => s + it.file.size, 0);
  $('#pendingCount').textContent = n + ' 个文件';
  $('#pendingSize').textContent = fmtBytes(total);
  const btn = $('#uploadSubmit');
  btn.disabled = state.uploading || n === 0;
  btn.textContent = state.uploading ? '正在写入…' : '上传并加入系列';
  $('#uploadHint').textContent = state.uploading
    ? '正在写入本地存储，请勿关闭页面'
    : (n ? '确认系列后即可上传' : '选择视频后即可上传');
}

async function submitUpload() {
  if (state.uploading) return;
  if (!state.uploadFiles.length) { toast('请先选择视频文件'); return; }

  let series = null;
  if ($('#seriesSelect').value === 'new') {
    const title = $('#nsTitle').value.trim();
    if (!title) { toast('请填写系列名称'); $('#nsTitle').focus(); return; }
    series = {
      id: uid(),
      title,
      original: $('#nsOriginal').value.trim(),
      desc: $('#nsDesc').value.trim(),
      tags: $('#nsTags').value.split(/[,，、\s]+/).filter(Boolean),
      coverBlob: state.newCoverFile || undefined,
      coverUrl: '',
      likes: 0, liked: false, favorited: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    try {
      await dbPut('series', series);
    } catch (e) {
      toast('新建系列失败：' + (e.message || e));
      return;
    }
  } else {
    series = findSeries($('#seriesSelect').value);
    if (!series) { toast('请选择归属系列'); return; }
  }

  state.uploading = true;
  syncUploadUI();

  const eps = videosOf(series.id).map(v => v.ep || 0);
  let nextEp = (eps.length ? Math.max(...eps) : 0) + 1;
  let saved = 0;

  try {
    for (let i = 0; i < state.uploadFiles.length; i++) {
      const item = state.uploadFiles[i];
      item.status = '写入中…';
      renderUploadFiles();
      $('#uploadHint').textContent = `正在写入 ${i + 1} / ${state.uploadFiles.length}：${item.file.name}`;

      const dur = await probeDuration(item.file);
      const video = {
        id: uid(), seriesId: series.id, ep: nextEp,
        title: '第 ' + pad2(nextEp) + ' 话',
        blob: item.file,
        mime: item.file.type || 'video/mp4',
        size: item.file.size,
        duration: dur,
        views: 0,
        createdAt: Date.now(),
        comments: []
      };
      await dbPut('videos', video);
      item.status = '已保存';
      renderUploadFiles();
      nextEp++;
      saved++;
    }

    series.updatedAt = Date.now();
    await dbPut('series', series);
    state.uploading = false;
    await refresh();
    closeDrawers();
    toast(`已上传 ${saved} 个视频`);
    openSeries(series.id);
  } catch (err) {
    state.uploading = false;
    syncUploadUI();
    console.error(err);
    if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) {
      toast('存储空间不足，请删除一些视频后重试');
    } else {
      toast('上传失败：' + (err.message || err));
    }
    await refresh();
  }
}

function bindUpload() {
  const drop = $('#drop');
  drop.addEventListener('click', () => $('#videoInput').click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hot'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hot'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('hot');
    addUploadFiles(e.dataTransfer.files);
  });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { if (!e.target.closest('#drop')) e.preventDefault(); });

  $('#fileList').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (!rm || state.uploading) return;
    state.uploadFiles.splice(Number(rm.dataset.rm), 1);
    renderUploadFiles();
    syncUploadUI();
  });

  $('#seriesSelect').addEventListener('change', toggleNewSeriesFields);

  $('#pickCoverBtn').addEventListener('click', () => $('#nsCover').click());
  $('#nsCover').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('请选择图片文件'); e.target.value = ''; return; }
    state.newCoverFile = f;
    $('#nsCoverName').textContent = f.name;
  });

  $('#uploadSubmit').addEventListener('click', submitUpload);
}
