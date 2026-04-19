// ════════════════════════════════════════════
//  個人花展 - JS 邏輯
// ════════════════════════════════════════════

const QUALITY_ORDER = {'仙':0,'華':1,'珍':2,'普':3,'凡':4};

let allFlowers = [];
let allMembers = [];
let allOwnership = [];
let currentMember = null;
let currentFlowers = [];

// ── 從 Sheet 載入資料 ──
async function loadData() {
  const { apiKey, sheetId } = SHEET_CONFIG;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=flowers!A1:Z&ranges=members!A1:E&ranges=ownership!A1:B&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('資料載入失敗');
  const data = await res.json();
  const [fSheet, mSheet, oSheet] = data.valueRanges;

  // flowers
  const fH = fSheet.values[0];
  allFlowers = fSheet.values.slice(1).map(row => {
    const f = {};
    fH.forEach((h, i) => { f[h] = row[i] || ''; });
    f.id = Number(f.id);
    f.score = Number(f.score);
    f.order = Number(f.order) || 999;
    return f;
  });

  // members
  const mH = mSheet.values[0];
  allMembers = mSheet.values.slice(1).map(row => {
    const m = {};
    mH.forEach((h, i) => { m[h.toLowerCase()] = row[i] || ''; });
    m.gameId = m.gameid || '';
    return m;
  }).filter(m => (m.left || '').toLowerCase() !== 'true');

  // ownership
  allOwnership = oSheet.values.slice(1).map(row => ({
    gameId: row[0] || '',
    flowerId: Number(row[1] || 0)
  }));
}

// ── 找成員 ──
function findMember(query) {
  const q = query.trim().toLowerCase();
  return allMembers.find(m =>
    m.nickname.toLowerCase() === q ||
    m.gameid === q ||
    m.gameId === q
  );
}

// ── 取得成員擁有的花 ──
function getMemberFlowers(gameId) {
  const ownedIds = new Set(
    allOwnership.filter(o => o.gameId === gameId).map(o => o.flowerId)
  );
  return allFlowers
    .filter(f => ownedIds.has(f.id))
    .sort((a, b) => {
      const qd = (QUALITY_ORDER[a.quality] ?? 9) - (QUALITY_ORDER[b.quality] ?? 9);
      return qd !== 0 ? qd : (a.order ?? 999) - (b.order ?? 999);
    });
}

// ── 渲染花展 ──
async function renderShowcase(member, flowers) {
  currentMember = member;
  currentFlowers = flowers;

  // 用戶資訊
  const initial = (member.nickname || member.gameId || '?')[0];
  document.getElementById('user-initial').textContent = initial;
  document.getElementById('user-name').textContent = member.nickname || member.gameId;
  document.getElementById('user-gameid').textContent = member.gameId;
  // 移除共擁有顯示
  document.getElementById('user-total').textContent = '';

  // 顯示 HTML 版本（iOS 和非 iOS 都一樣）
  document.getElementById('showcase-card').style.display = 'block';

  const groups = {};
  flowers.forEach(f => {
    if (!groups[f.quality]) groups[f.quality] = [];
    groups[f.quality].push(f);
  });

  const container = document.getElementById('quality-sections');
  container.innerHTML = '';

  const qualityOrder = ['仙', '華', '珍', '普', '凡'];
  qualityOrder.forEach(q => {
    if (!groups[q] || groups[q].length === 0) return;
    const section = document.createElement('div');
    section.className = `quality-section q-${q}`;
    section.innerHTML = `
      <div class="quality-title">
        <span class="quality-badge q-${q}">${q} 品</span>
        <span class="quality-count">${groups[q].length} 種</span>
      </div>
      <div class="flower-grid-showcase">
        <div class="flower-items">
          ${groups[q].map(f => `
            <div class="flower-item">
              <div class="flower-circle">
                ${f.img ? `<img src="${f.img}" alt="${f.name}" loading="lazy" onerror="this.parentElement.innerHTML='🌸'">` : '🌸'}
              </div>
              <div class="flower-label">${f.name}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    container.appendChild(section);
  });

  if (flowers.length === 0) {
    container.innerHTML = '<div class="empty-state">🌸 此成員尚無花卉資料</div>';
  }

  // 顯示按鈕，iOS 改文字
  const btn = document.getElementById('downloadBtn');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  btn.textContent = isIOS ? '🖼 生成圖片' : '📥 下載圖片';
  btn.style.display = '';
}

async function quickSelect(gameId) {
  selectedMember = allMembers.find(m => (m.gameId || m.gameid) === gameId);
  if (selectedMember) {
    document.getElementById('searchInput').value = selectedMember.nickname;
    await searchSelected();
  }
}

// ── 模糊搜尋 ──
let selectedMember = null;

function onSearchInput() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const list = document.getElementById('suggestList');
  if (!q) { list.style.display = 'none'; return; }

  const matches = allMembers.filter(m =>
    m.nickname.toLowerCase().includes(q) ||
    (m.gameid || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (matches.length === 0) { list.style.display = 'none'; return; }

  list.innerHTML = matches.map(m => `
    <div class="suggest-item" onclick="selectMember('${m.gameId || m.gameid}')">
      <span class="suggest-nick">${m.nickname}</span>
      <span class="suggest-id">${m.gameId || m.gameid}</span>
      <span class="suggest-role">${m.note || '成員'}</span>
    </div>`).join('');
  list.style.display = 'block';
}

function selectMember(gameId) {
  selectedMember = allMembers.find(m => (m.gameId || m.gameid) === gameId);
  if (selectedMember) {
    document.getElementById('searchInput').value = selectedMember.nickname;
    document.getElementById('suggestList').style.display = 'none';
  }
}

function onSearchKey(e) {
  if (e.key === 'Escape') {
    document.getElementById('suggestList').style.display = 'none';
  }
  if (e.key === 'Enter') searchSelected();
}

// 點外面關閉下拉
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrapper')) {
    document.getElementById('suggestList').style.display = 'none';
  }
});

async function searchSelected() {
  const member = selectedMember || (() => {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    return allMembers.find(m =>
      m.nickname.toLowerCase() === q || (m.gameid || '').toLowerCase() === q
    );
  })();
  if (!member) { alert('請從下拉選單選擇成員'); return; }
  const flowers = getMemberFlowers(member.gameId || member.gameid);
  await renderShowcase(member, flowers);
  document.getElementById('downloadBtn').style.display = '';
  selectedMember = null;
}

// ══════════════════════════════════════════════
//  [TEST] Canvas 繪製下載 - iOS 測試版
// ══════════════════════════════════════════════

// ── 圖片預載（PC 用，解決跨域）──
async function preloadImages(container) {
  const imgs = container.querySelectorAll('img');
  await Promise.all([...imgs].map(img => new Promise(resolve => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', img.src, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; resolve(); };
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => resolve();
    xhr.send();
  })));
}

// ── 載入圖片為 ImageBitmap（iOS 可用）──
async function loadImageBitmap(src) {
  try {
    const res = await fetch(src, { mode: 'cors' });
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch(e) {
    // fallback：用 Image 元素載入
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        createImageBitmap(img).then(resolve).catch(() => resolve(null));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}

// ── Canvas 繪製花展 ──
async function drawShowcaseToCanvas(member, flowers, cardWidth) {
  const QUALITY_ORDER = {'仙':0,'華':1,'珍':2,'普':3,'凡':4};
  const QC = {
    '仙': { bg: 'rgba(255,78,138,0.08)', border: 'rgba(255,78,138,0.4)', badge: '#ff6b9d' },
    '華': { bg: 'rgba(255,140,0,0.08)',  border: 'rgba(255,140,0,0.4)',  badge: '#ffb347' },
    '珍': { bg: 'rgba(155,89,182,0.08)', border: 'rgba(155,89,182,0.4)', badge: '#c39bd3' },
    '普': { bg: 'rgba(74,144,217,0.08)', border: 'rgba(74,144,217,0.4)', badge: '#74b9ff' },
    '凡': { bg: 'rgba(127,140,110,0.08)','border': 'rgba(127,140,110,0.4)', badge: '#a8b89a' }
  };

  // 按品質分組
  const groups = {};
  flowers.forEach(f => {
    if (!groups[f.quality]) groups[f.quality] = [];
    groups[f.quality].push(f);
  });

  const PAD = 16;
  const SECTION_PAD = 12;
  const HEADER_H = 80;
  const BADGE_H = 36;

  // 固定 4 欄，根據寬度計算圓圈大小
  const COLS = 4;
  const availW = (cardWidth || 400) - PAD * 2 - SECTION_PAD * 2;
  const CIRCLE = Math.floor((availW - (COLS - 1) * 8) / COLS);
  const LABEL_H = 20;
  const ITEM_H = CIRCLE + LABEL_H + 6;

  // 計算總高度
  let totalH = HEADER_H + PAD;
  const qualityOrder = ['仙','華','珍','普','凡'];
  const usedGroups = qualityOrder.filter(q => groups[q]?.length);
  usedGroups.forEach(q => {
    const rows = Math.ceil(groups[q].length / COLS);
    totalH += BADGE_H + rows * ITEM_H + SECTION_PAD * 2 + 12 + PAD;
  });

  const W = cardWidth || 480;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = totalH * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // 背景
  ctx.fillStyle = '#fff8f5';
  ctx.fillRect(0, 0, W, totalH);

  // Header
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  grad.addColorStop(0, '#c2510b');
  grad.addColorStop(0.6, '#e96a1e');
  grad.addColorStop(1, '#f4a46a');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, HEADER_H, 0);
  ctx.fill();

  // 頭像圓圈
  ctx.save();
  ctx.beginPath();
  ctx.arc(PAD + 24, HEADER_H / 2, 24, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Microsoft JhengHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((member.nickname || '?')[0], PAD + 24, HEADER_H / 2);
  ctx.restore();

  // 暱稱
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Microsoft JhengHei, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(member.nickname || '', PAD + 58, HEADER_H / 2 - 10);
  ctx.font = '12px Microsoft JhengHei, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(member.gameId || member.gameid || '', PAD + 58, HEADER_H / 2 + 10);

  // 公會 badge
  ctx.font = 'bold 12px Microsoft JhengHei, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('♡璀璨♡', W - PAD, HEADER_H / 2 - 8);
  ctx.font = '10px Microsoft JhengHei, sans-serif';
  ctx.fillText('400117', W - PAD, HEADER_H / 2 + 8);

  let y = HEADER_H + PAD;

  for (const q of usedGroups) {
    const items = groups[q];
    const qc = QC[q] || QC['凡'];
    const rows = Math.ceil(items.length / COLS);
    const sectionH = BADGE_H + rows * ITEM_H + SECTION_PAD * 2;

    // 區塊背景
    ctx.fillStyle = qc.bg;
    ctx.strokeStyle = qc.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, PAD, y, W - PAD * 2, sectionH, 12);
    ctx.fill();
    ctx.stroke();

    // 品質 badge
    ctx.fillStyle = qc.badge;
    roundRect(ctx, PAD + SECTION_PAD, y + 10, 48, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Microsoft JhengHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q + ' 品', PAD + SECTION_PAD + 24, y + 21);

    // 數量
    ctx.fillStyle = '#9e6b7e';
    ctx.font = '11px Microsoft JhengHei, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${items.length} 種`, PAD + SECTION_PAD + 56, y + 21);

    let iy = y + BADGE_H;

    for (let i = 0; i < items.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ix = PAD + SECTION_PAD + col * (CIRCLE + 8);
      const itemY = iy + row * ITEM_H;

      // 圓形圖片
      ctx.save();
      ctx.beginPath();
      ctx.arc(ix + CIRCLE / 2, itemY + CIRCLE / 2, CIRCLE / 2, 0, Math.PI * 2);
      ctx.clip();

      const bitmap = await loadImageBitmap(items[i].img);
      if (bitmap) {
        // 擷取中心區域（跳過上方文字）
        const bw = bitmap.width, bh = bitmap.height;
        const sy = bh * 0.2; // 跳過上方 20%
        const sh = bh * 0.6;
        const sw = Math.min(bw, sh);
        const sx = (bw - sw) / 2;
        ctx.drawImage(bitmap, sx, sy, sw, sh, ix, itemY, CIRCLE, CIRCLE);
      } else {
        ctx.fillStyle = '#fef0e7';
        ctx.fillRect(ix, itemY, CIRCLE, CIRCLE);
      }
      ctx.restore();

      // 圓形邊框
      ctx.beginPath();
      ctx.arc(ix + CIRCLE / 2, itemY + CIRCLE / 2, CIRCLE / 2, 0, Math.PI * 2);
      ctx.strokeStyle = qc.badge;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 花名
      ctx.fillStyle = '#5d3a4a';
      ctx.font = '11px Microsoft JhengHei, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = items[i].name.length > 5 ? items[i].name.slice(0, 5) + '…' : items[i].name;
      ctx.fillText(label, ix + CIRCLE / 2, itemY + CIRCLE + 4);
    }

    y += sectionH + PAD;
  }

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── 下載/生成圖片 ──
async function downloadImage() {
  const btn = document.getElementById('downloadBtn');
  const name = document.getElementById('user-name').textContent || '花展';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;

  try {
    if (isIOS) {
      // iOS：用 Canvas 繪製，取代頁面上的 HTML 花展
      const cardWidth = Math.min(window.innerWidth - 32, 680);
      const canvas = await drawShowcaseToCanvas(currentMember, currentFlowers, cardWidth);
      const dataUrl = canvas.toDataURL('image/png');

      // 取代 showcase-card 為圖片
      const card = document.getElementById('showcase-card');
      card.style.display = 'none';

      // 清除舊圖片容器（重新生成時避免疊加）
      const oldImg = document.getElementById('ios-canvas-img');
      if (oldImg) oldImg.remove();

      const imgContainer = document.createElement('div');
      imgContainer.id = 'ios-canvas-img';
      imgContainer.style.cssText = 'max-width:680px;margin:0 auto;text-align:center;padding:0 16px;';
      card.parentNode.insertBefore(imgContainer, card.nextSibling);

      imgContainer.innerHTML = `
        <img src="${dataUrl}" style="max-width:100%;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.12);">
        <div style="margin-top:12px;color:#9e6b7e;font-size:13px;padding:10px;background:rgba(233,106,30,0.08);border-radius:8px;">
          📱 長按圖片 → 儲存至相片
        </div>`;
      btn.textContent = '🔄 重新生成';
      btn.onclick = () => location.href = 'flower-showcase-test.html';

      // 隱藏搜尋區和成員按鈕，避免疊加
      document.getElementById('search-area').style.display = 'none';

      // 隱藏搜尋區和成員按鈕，避免疊加
      document.getElementById('search-area').style.display = 'none';

      // 底部加「返回」按鈕（只加一次）
      if (!document.getElementById('backBtn')) {
        const backBtn = document.createElement('button');
        backBtn.id = 'backBtn';
        backBtn.className = 'btn btn-secondary';
        backBtn.textContent = '← 返回';
        backBtn.onclick = () => location.href = 'flower-showcase-test.html';
        document.querySelector('.fab-bar').insertBefore(backBtn, btn);
      }

      // 彈出提示
      alert('✅ 圖片已生成！\n請長按圖片儲存至相片。');
    } else {
      // 非 iOS：html2canvas 下載
      const card = document.getElementById('showcase-card');
      await preloadImages(card);
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: false,
        allowTaint: true,
        backgroundColor: '#fff8f5',
        logging: false,
        imageTimeout: 0
      });
      const link = document.createElement('a');
      link.download = `${name}_花展.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      btn.textContent = '📥 下載圖片';
    }
  } catch(e) {
    alert('生成失敗：' + e.message);
    const isIOS2 = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    btn.textContent = isIOS2 ? '🖼 生成圖片' : '📥 下載圖片';
  } finally {
    btn.disabled = false;
  }
}

// ── 初始化 ──
(async () => {
  const loadingEl = document.getElementById('loading');
  try {
    await loadData();
    loadingEl.style.display = 'none';
    // ── 成員快速按鈕 ──
  const btns = document.getElementById('memberBtns');
  btns.innerHTML = allMembers.map(m => `
    <button class="member-btn" onclick="quickSelect('${m.gameId || m.gameid}')">${m.nickname}</button>
  `).join('');
  document.getElementById('search-area').style.display = '';

    // 支援 URL 參數 ?user=暱稱
    const params = new URLSearchParams(location.search);
    const userParam = params.get('user');
    if (userParam) {
      document.getElementById('searchInput').value = userParam;
      selectedMember = findMember(userParam);
      if (selectedMember) searchSelected();
    }
  } catch(e) {
    loadingEl.innerHTML = `<div style="color:#c2185b;">⚠️ 資料載入失敗：${e.message}</div>`;
  }
})();
