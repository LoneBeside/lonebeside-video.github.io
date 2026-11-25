'use strict';

/* ============ IndexedDB ============ */
const DB_NAME = 'hikari_video_db';
const DB_VER = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('series')) d.createObjectStore('series', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('videos')) {
        const s = d.createObjectStore('videos', { keyPath: 'id' });
        s.createIndex('seriesId', 'seriesId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('数据库被占用，请关闭其他标签页'));
  });
}

function rq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbAll(store) {
  return rq(db.transaction(store).objectStore(store).getAll());
}
function dbGet(store, key) {
  return rq(db.transaction(store).objectStore(store).get(key));
}
function dbPut(store, value) {
  return rq(db.transaction(store, 'readwrite').objectStore(store).put(value));
}
function dbDel(store, key) {
  return rq(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

/* ============ utils ============ */
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtNum(n) {
  n = n || 0;
  return n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}
function fmtBytes(b) {
  if (!b) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return (v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)) + ' ' + units[i];
}
function fmtDur(sec) {
  if (!sec) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + pad2(s);
}
function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60e3) return '刚刚';
  if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前';
  if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前';
  if (d < 86400e3 * 7) return Math.floor(d / 86400e3) + ' 天前';
  const t = new Date(ts);
  return `${t.getMonth() + 1} 月 ${t.getDate()} 日`;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
function coverUrl(prompt) {
  return 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
    encodeURIComponent(prompt) + '&image_size=portrait_4_3';
}

/* read video duration without adding to page */
function probeDuration(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    let settled = false;
    const done = val => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      try { v.load(); } catch (e) {}
      URL.revokeObjectURL(url);
      resolve(val || 0);
    };
    const timer = setTimeout(() => done(0), 4000);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/* ============ seed demo content ============ */
async function seedIfEmpty() {
  const existing = await dbAll('series');
  if (existing.length) return;

  const fetchBlob = async p => {
    try { const r = await fetch(p); return r.ok ? await r.blob() : null; } catch (e) { return null; }
  };
  const [f1, f2] = await Promise.all([
    fetchBlob('assets/demo/flower.mp4'),
    fetchBlob('assets/demo/bunny.mp4')
  ]);
  const [d1, d2] = await Promise.all([
    f1 ? probeDuration(f1) : 0,
    f2 ? probeDuration(f2) : 0
  ]);

  const now = Date.now();
  const series = [
    {
      id: 'demo-star', title: '镜のむこう', original: '镜的另一侧',
      desc: '内置示例系列，用来体验播放、评论、点赞与下载。可以删除后上传你自己的番剧。',
      tags: ['奇幻', '日常', '治愈'], coverUrl: coverUrl('anime key visual, quiet cream room with an antique gilt oval mirror, a girl with long blonde hair reflected in the glass, another figure in a sage green robe seen from behind, terracotta red robe, soft warm afternoon light, muted ivory sage and rust palette, watercolor anime illustration, no text'),
      likes: 1280, liked: false, favorited: true, createdAt: now - 6 * 864e5, updatedAt: now - 2 * 3600e3
    },
    {
      id: 'demo-deep', title: '琥珀信笺', original: '琥珀の手紙',
      desc: '示例系列：琥珀色的午后与旧信纸，附一个演示视频。',
      tags: ['悬疑', '治愈', '复古'], coverUrl: coverUrl('anime key visual, old letters and an amber glass bottle on a wooden desk, dried flowers, dust in warm sunlight, sepia cream and terracotta palette, nostalgic vintage anime illustration, no text'),
      likes: 864, liked: false, favorited: false, createdAt: now - 9 * 864e5, updatedAt: now - 26 * 3600e3
    },
    {
      id: 'demo-moon', title: '暮色列车', original: '暮色列車',
      desc: '示例剧场版：单集结构，演示封面与下载。',
      tags: ['剧场版', '奇幻'], coverUrl: coverUrl('anime movie poster art, vintage train crossing golden dusk fields, warm salmon and ochre sky, retro sepia tones, glowing window lights, quiet cinematic atmosphere, highly detailed anime illustration, no text'),
      likes: 2210, liked: false, favorited: false, createdAt: now - 12 * 864e5, updatedAt: now - 3 * 864e5
    },
    {
      id: 'demo-rain', title: '雨后庭院', original: '雨上がりの庭',
      desc: '这是一个空系列，用来体验「暂无视频」状态与上传流程。',
      tags: ['治愈', '日常'], coverUrl: coverUrl('anime key visual, quiet walled courtyard after rain, stone path, green leaves and cream plaster walls, potted plants, soft warm light, watercolor anime style, calm and warm, no text'),
      likes: 96, liked: false, favorited: false, createdAt: now - 2 * 864e5, updatedAt: now - 2 * 864e5
    }
  ];
  for (const s of series) await dbPut('series', s);

  const videos = [];
  if (f1) {
    videos.push({
      id: 'demo-v1', seriesId: 'demo-star', ep: 1, title: '第 01 话', blob: f1,
      mime: f1.type || 'video/mp4', size: f1.size, duration: d1, views: 342,
      createdAt: now - 2 * 3600e3,
      comments: [
        { id: uid(), author: '星野', text: '色调好温柔，已经收藏了。', at: now - 95 * 60e3 },
        { id: uid(), author: 'Kaze', text: '这个系列还会继续更新吗？', at: now - 40 * 60e3 }
      ]
    });
  }
  if (f2) {
    videos.push({
      id: 'demo-v2', seriesId: 'demo-star', ep: 2, title: '第 02 话', blob: f2,
      mime: f2.type || 'video/mp4', size: f2.size, duration: d2, views: 218,
      createdAt: now - 55 * 60e3, comments: []
    });
    videos.push({
      id: 'demo-v3', seriesId: 'demo-deep', ep: 1, title: '第 01 话', blob: f1 || f2,
      mime: (f1 || f2).type || 'video/mp4', size: (f1 || f2).size, duration: f1 ? d1 : d2, views: 96,
      createdAt: now - 26 * 3600e3,
      comments: [{ id: uid(), author: '潮汐', text: '琥珀色的氛围感太对了。', at: now - 20 * 3600e3 }]
    });
    videos.push({
      id: 'demo-v4', seriesId: 'demo-moon', ep: 1, title: '正片', blob: f2,
      mime: f2.type || 'video/mp4', size: f2.size, duration: d2, views: 51,
      createdAt: now - 3 * 864e5, comments: []
    });
  }
  for (const v of videos) await dbPut('videos', v);
}
