// ════════════════════════════════════════════
//  個人花展 - JS 邏輯
// ════════════════════════════════════════════

const QUALITY_ORDER = {'仙':0,'華':1,'珍':2,'普':3,'凡':4};

let allFlowers = [];
let allMembers = [];
let allOwnership = [];

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
function renderShowcase(member, flowers) {
  const card = document.getElementById('showcase-card');

  // 用戶資訊
  const initial = (member.nickname || member.gameId || '?')[0];
  document.getElementById('user-initial').textContent = initial;
  document.getElementById('user-name').textContent = member.nickname || member.gameId;
  document.getElementById('user-gameid').textContent = member.gameId;
  document.getElementById('user-total').textContent = `共擁有 ${flowers.length} 種花`;

  // 按品質分組
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

  card.style.display = 'block';
}

// ── 搜尋 ──
async function search() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) { alert('請輸入成員暱稱或遊戲 ID'); return; }

  const member = findMember(query);
  if (!member) { alert(`找不到成員「${query}」`); return; }

  const flowers = getMemberFlowers(member.gameId);
  renderShowcase(member, flowers);
  document.getElementById('downloadBtn').style.display = '';
}

// ── 下載成圖 ──
async function downloadImage() {
  const card = document.getElementById('showcase-card');
  const btn = document.getElementById('downloadBtn');
  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;

  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff9fb',
      logging: false
    });
    const link = document.createElement('a');
    const name = document.getElementById('user-name').textContent || '花展';
    link.download = `${name}_花展.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    alert('下載失敗：' + e.message);
  } finally {
    btn.textContent = '📥 下載圖片';
    btn.disabled = false;
  }
}

// ── 初始化 ──
(async () => {
  const loadingEl = document.getElementById('loading');
  try {
    await loadData();
    loadingEl.style.display = 'none';
    document.getElementById('search-area').style.display = '';

    // 支援 URL 參數 ?user=暱稱
    const params = new URLSearchParams(location.search);
    const userParam = params.get('user');
    if (userParam) {
      document.getElementById('searchInput').value = userParam;
      await search();
    }
  } catch(e) {
    loadingEl.innerHTML = `<div style="color:#c2185b;">⚠️ 資料載入失敗：${e.message}</div>`;
  }
})();
