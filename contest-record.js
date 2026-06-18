// ══════════════════════════════════════════════════════════
// contest-record.js — 競賽成績辨識邏輯
// 需要全域變數：APPS_SCRIPT_URL, SHEET_ID, API_KEY
// ══════════════════════════════════════════════════════════

let uploadedFiles = [];
let parsedData = [];
let opponentData = [];
let membersCache = null;

// ── 預設日期為最近的週日 ──
function setDefaultPeriod() {
  const el = document.getElementById('periodInput');
  if (!el) return;
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 0 : day;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - diff);
  el.valueAsDate = lastSunday;
}

// ── 初始化所有事件監聽器 ──
function initContestRecord() {
  setDefaultPeriod();

  // 總結截圖拖放
  const summaryDz = document.getElementById('summaryDropZone');
  if (summaryDz) {
    summaryDz.addEventListener('dragover', e => { e.preventDefault(); summaryDz.classList.add('drag-over'); });
    summaryDz.addEventListener('dragleave', () => summaryDz.classList.remove('drag-over'));
    summaryDz.addEventListener('drop', e => { e.preventDefault(); summaryDz.classList.remove('drag-over'); handleSummaryFile(e.dataTransfer.files[0]); });
  }

  // 成員截圖拖放
  const dz = document.getElementById('dropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
  }

  // 對手排名拖放
  const oppDz = document.getElementById('opponentDropZone');
  if (oppDz) {
    oppDz.addEventListener('dragover', e => { e.preventDefault(); oppDz.classList.add('drag-over'); });
    oppDz.addEventListener('dragleave', () => oppDz.classList.remove('drag-over'));
    oppDz.addEventListener('drop', e => { e.preventDefault(); oppDz.classList.remove('drag-over'); handleOpponentFiles(e.dataTransfer.files); });
  }
}

// ── 總結截圖 OCR ──
async function handleSummaryFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const status = document.getElementById('summaryStatus');
  status.style.display = 'block';
  status.style.color = '#1565c0';
  status.textContent = '⏳ 辨識總結中...';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION' }] }] })
    });
    const data = await res.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

    // 解析總結資訊
    const membersMatch = text.match(/在\s*(\d+)\s*名/);
    const totalMatch = text.match(/總獲得\s*([\d,]+)\s*積分/) || text.match(/([\d,]{4,})\s*積分/);
    const rankMatch = text.match(/位列\s*(.+?名)/) || text.match(/(甲級|乙級|丙級).{0,4}(第.名)/);
    const gradeMatch = text.match(/(甲級|乙級|丙級)\s*公會/);

    if (membersMatch) document.getElementById('sumMembers').value = membersMatch[1];
    if (totalMatch) document.getElementById('sumTotal').value = totalMatch[1].replace(/,/g, '');
    if (rankMatch) document.getElementById('sumRank').value = rankMatch[1] || (rankMatch[1] + rankMatch[2]);
    if (gradeMatch) document.getElementById('sumGrade').value = gradeMatch[1] + '公會';

    status.style.color = '#2e7d32';
    status.textContent = '✅ 辨識完成，請確認數據';
  } catch(e) {
    status.style.color = '#c62828';
    status.textContent = '❌ 辨識失敗：' + e.message;
  }
}

// ── 成員截圖檔案處理 ──
function handleFiles(fileList) {
  const newFiles = [...fileList].filter(f => f.type.startsWith('image/'));
  uploadedFiles = uploadedFiles.concat(newFiles);
  if (!uploadedFiles.length) return;
  renderPreviews();
  document.getElementById('ocrBtn').disabled = false;
}

function renderPreviews() {
  const list = document.getElementById('previewList');
  list.innerHTML = uploadedFiles.map((f, i) =>
    `<div style="position:relative;">
      <img src="${URL.createObjectURL(f)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid var(--border);" />
      <button onclick="removeFile(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#e65100;color:#fff;border:none;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      <div style="font-size:0.65rem;color:var(--text-muted);text-align:center;margin-top:2px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i+1}</div>
    </div>`
  ).join('');
}

function removeFile(idx) {
  uploadedFiles.splice(idx, 1);
  renderPreviews();
  if (!uploadedFiles.length) document.getElementById('ocrBtn').disabled = true;
}

function clearAll() {
  uploadedFiles = [];
  parsedData = [];
  document.getElementById('previewList').innerHTML = '';
  document.getElementById('ocrBtn').disabled = true;
  document.getElementById('resultCard').style.display = 'none';
  const rawCard = document.getElementById('rawCard');
  if (rawCard) rawCard.style.display = 'none';
  document.getElementById('progressWrap').style.display = 'none';
}

// ── OCR（Google Cloud Vision API）──
async function startOCR() {
  if (!uploadedFiles.length) return;
  const btn = document.getElementById('ocrBtn');
  btn.disabled = true; btn.textContent = '⏳ 辨識中...';
  const pw = document.getElementById('progressWrap');
  const pf = document.getElementById('progressFill');
  const pt = document.getElementById('progressText');
  pw.style.display = 'block';
  pf.style.width = '10%';
  pt.textContent = '上傳圖片至 Google Vision...';

  let allText = '';

  for (let i = 0; i < uploadedFiles.length; i++) {
    pt.textContent = `辨識第 ${i+1}/${uploadedFiles.length} 張...`;
    pf.style.width = Math.round(10 + (i / uploadedFiles.length) * 80) + '%';

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(uploadedFiles[i]);
    });

    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }]
      })
    });

    if (!res.ok) {
      const err = await res.json();
      pt.textContent = `❌ API 錯誤：${err.error?.message || res.status}`;
      btn.disabled = false; btn.textContent = '🔍 開始辨識';
      return;
    }

    const data = await res.json();
    const pages = data.responses?.[0]?.fullTextAnnotation?.pages || [];
    let reconstructed = '';
    for (const page of pages) {
      const words = [];
      for (const block of (page.blocks || [])) {
        for (const para of (block.paragraphs || [])) {
          for (const word of (para.words || [])) {
            const text = word.symbols.map(s => s.text).join('');
            const vertices = word.boundingBox?.vertices || [];
            const y = vertices[0]?.y || 0;
            const x = vertices[0]?.x || 0;
            words.push({ text, x, y });
          }
        }
      }
      words.sort((a, b) => a.y - b.y || a.x - b.x);
      const lines = [];
      let currentLine = [];
      let lastY = -999;
      for (const w of words) {
        if (w.y - lastY > 20 && currentLine.length) {
          lines.push(currentLine.sort((a, b) => a.x - b.x).map(w => w.text).join(' '));
          currentLine = [];
        }
        currentLine.push(w);
        lastY = w.y;
      }
      if (currentLine.length) {
        lines.push(currentLine.sort((a, b) => a.x - b.x).map(w => w.text).join(' '));
      }
      reconstructed += lines.join('\n') + '\n';
    }

    allText += reconstructed;
  }

  pf.style.width = '95%';
  pt.textContent = '解析結果中...';

  parsedData = parseOCRText(allText);
  await matchWithMembers(parsedData);

  parsedData.forEach(d => {
    if (d.score >= 1400)      d.title = '王者花匠';
    else if (d.score >= 1300) d.title = '大師花匠';
    else if (d.score >= 1000) d.title = '黃金花匠';
    else if (d.score >= 700)  d.title = '白銀花匠';
    else if (d.score >= 500)  d.title = '青銅花匠';
    else                      d.title = '無稱號';
  });

  parsedData.sort((a, b) => b.score - a.score);

  const seen = new Set();
  parsedData = parsedData.filter(d => {
    const key = `${d.nickname}_${d.score}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  renderResult();

  pf.style.width = '100%';
  btn.disabled = false; btn.textContent = '🔍 開始辨識';
  pt.textContent = `✅ 辨識完成！共 ${parsedData.length} 筆`;
}

// ── 從 Sheet 讀取成員資料 ──
async function loadMembers() {
  if (membersCache) return membersCache;
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/members!A1:E?key=${API_KEY}`);
    const data = await res.json();
    const rows = (data.values || []).slice(1);
    membersCache = rows
      .filter(r => (r[3] || '').toLowerCase() !== 'true')
      .map(r => ({ gameId: r[0]||'', nickname: r[1]||'', role: r[2]||'成員', server: r[4]||'' }));
    return membersCache;
  } catch(e) { return []; }
}

// ── 編輯距離（Levenshtein） ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}

async function matchWithMembers(data) {
  const members = await loadMembers();
  if (!members.length) return;

  const stripSymbols = s => s.replace(/\s/g, '').replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]|[❤♡♥☆★●○◎◇◆□■△▲▽▼♪♫✿❀✦✧☀️⭐️❤️💕💖💗💙💚💛🧡💜🖤🤍🤎💝💞💟❣️💔🌸🌺🌷🌹🌻💐🌼🍀☘️🍃🌿🎀✨⚡️🔥💫⭕️❌⬆️⬇️❗️❓]/gu, '');

  for (const d of data) {
    const ocrClean = stripSymbols(d.nickname);

    let match = members.find(m => stripSymbols(m.nickname) === ocrClean);

    if (!match) {
      match = members.find(m => {
        const mClean = stripSymbols(m.nickname);
        if (mClean.length < 2 || ocrClean.length < 2) return false;
        return ocrClean.includes(mClean) || mClean.includes(ocrClean);
      });
    }

    if (!match && ocrClean.length >= 2) {
      let bestDist = 999, bestMatch = null;
      for (const m of members) {
        const mClean = stripSymbols(m.nickname);
        if (Math.abs(mClean.length - ocrClean.length) > 1) continue;
        const dist = levenshtein(ocrClean, mClean);
        if (dist <= 1 && dist < bestDist) { bestDist = dist; bestMatch = m; }
      }
      if (bestMatch) match = bestMatch;
    }

    if (match) {
      d.nickname = match.nickname;
      d.role = match.role;
      if (match.server && !d.server) d.server = match.server;
    } else {
      if (!d.role) d.role = '成員';
    }
  }
}

// ── 解析 OCR 文字 ──
function parseOCRText(text) {
  const results = [];
  let currentTitle = '';

  const TITLES = ['王者花匠', '大師花匠', '黃金花匠', '白銀花匠', '青銅花匠'];
  const ROLES = ['副會長', '會長', '理事', '菁英', '成員', '分會成員'];

  const cleaned = text
    .replace(/商店\s*/g, '')
    .replace(/[sS$]\s*(\d+)\s*[.\s·．、]\s*/g, (m, num) => `s${num}.`)
    .replace(/副\s*會\s*長/g, '副會長')
    .replace(/會\s*長/g, '會長')
    .replace(/理\s*事/g, '理事')
    .replace(/菁\s*英/g, '菁英')
    .replace(/成\s*員/g, '成員')
    .replace(/分\s*會\s*成\s*員/g, '分會成員');

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l);

  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{3,4}$/.test(lines[i]) && merged.length > 0 && /s\d+\./.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += ' ' + lines[i];
    } else {
      merged.push(lines[i]);
    }
  }

  for (const line of merged) {
    const titleMatch = TITLES.find(t => line.includes(t));
    if (titleMatch && !line.match(/s\d+\./)) { currentTitle = titleMatch; continue; }

    const match = line.match(/s(\d+)\.(.+?)(\d{3,4})\s*$/);
    if (!match) continue;

    const server = 's' + match[1];
    let middle = match[2].trim();
    const score = parseInt(match[3]);

    let role = '';
    for (const r of ROLES) {
      if (middle.includes(r)) {
        role = r;
        middle = middle.replace(r, '').trim();
        break;
      }
    }

    let nickname = middle
      .replace(/^[.\s·．、]+/, '')
      .replace(/^菜\s*米\s*/g, '')
      .replace(/^米果\s*/g, '')
      .replace(/[書与與]\s*[書与與]?\s*$/g, '')
      .replace(/[()（）]/g, '')
      .replace(/商店\s*/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (!nickname || score < 100) continue;

    results.push({ server, nickname, role, score, title: currentTitle });
  }

  return results;
}

// ── 顯示結果 ──
function renderResult() {
  const card = document.getElementById('resultCard');
  const tbody = document.getElementById('resultBody');

  if (!parsedData.length) {
    card.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">⚠️ 未能辨識到成員資料，請確認截圖清晰度</td></tr>';
    checkMissing();
    return;
  }

  card.style.display = 'block';
  let lastTitle = '';
  tbody.innerHTML = parsedData.map((d, i) => {
    let titleRow = '';
    if (d.title && d.title !== lastTitle) {
      lastTitle = d.title;
      titleRow = `<tr class="title-divider"><td colspan="7">🏆 ${d.title}</td></tr>`;
    }
    return titleRow + `<tr>
      <td>${i+1}</td>
      <td><input value="${d.server}" onchange="updateRow(${i},'server',this.value)" style="width:60px;" /></td>
      <td><input value="${d.nickname}" onchange="updateRow(${i},'nickname',this.value)" /></td>
      <td><select onchange="updateRow(${i},'role',this.value)">
        ${['會長','副會長','理事','菁英','成員','分會成員',''].map(r => `<option ${d.role===r?'selected':''}>${r}</option>`).join('')}
      </select></td>
      <td><input type="number" value="${d.score}" onchange="updateScore(${i},this.value)" style="width:70px;" /></td>
      <td>${d.title}</td>
      <td><button onclick="removeRow(${i})" style="background:none;border:none;color:#e65100;cursor:pointer;font-size:1rem;" title="刪除">✕</button></td>
    </tr>`;
  }).join('');

  checkMissing();
}

function updateRow(idx, field, value) {
  parsedData[idx][field] = value;
}

function updateScore(idx, value) {
  parsedData[idx].score = Number(value);
  const s = parsedData[idx].score;
  if (s >= 1400)      parsedData[idx].title = '王者花匠';
  else if (s >= 1300) parsedData[idx].title = '大師花匠';
  else if (s >= 1000) parsedData[idx].title = '黃金花匠';
  else if (s >= 700)  parsedData[idx].title = '白銀花匠';
  else if (s >= 500)  parsedData[idx].title = '青銅花匠';
  else                parsedData[idx].title = '無稱號';
}

function removeRow(idx) {
  parsedData.splice(idx, 1);
  resortAndRender();
}

function addManualRow() {
  parsedData.push({ server: '', nickname: '', role: '成員', score: 0, title: '無稱號' });
  resortAndRender();
  setTimeout(() => {
    const tbody = document.getElementById('resultBody');
    tbody.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function resortAndRender() {
  parsedData.forEach(d => {
    const s = d.score;
    if (s >= 1400)      d.title = '王者花匠';
    else if (s >= 1300) d.title = '大師花匠';
    else if (s >= 1000) d.title = '黃金花匠';
    else if (s >= 700)  d.title = '白銀花匠';
    else if (s >= 500)  d.title = '青銅花匠';
    else                d.title = '無稱號';
  });
  parsedData.sort((a, b) => b.score - a.score);
  renderResult();
}

// ── 檢查缺少的成員 ──
async function checkMissing() {
  const members = await loadMembers();
  if (!members.length) return;

  const foundNames = new Set(parsedData.map(d => d.nickname));
  const missing = members.filter(m => !foundNames.has(m.nickname));

  const alertEl = document.getElementById('missingAlert');
  const list = document.getElementById('missingList');

  if (missing.length > 0 && missing.length < members.length) {
    alertEl.style.display = '';
    list.innerHTML = missing.map(m =>
      `<button onclick="addMissingMember('${m.nickname.replace(/'/g,"\\'")}','${m.role}')" style="padding:3px 10px;border-radius:8px;border:1px solid #ffcc80;background:#fff;color:#e65100;font-size:0.8rem;cursor:pointer;font-weight:600;">＋ ${m.nickname}</button>`
    ).join('');
  } else {
    alertEl.style.display = 'none';
  }
}

function addMissingMember(nickname, role) {
  const score = parseInt(prompt(`請輸入 ${nickname} 的分數：`));
  if (isNaN(score) || score <= 0) return;

  parsedData.push({ server: '', nickname, role, score, title: '' });
  resortAndRender();
}


// ── 儲存到 Sheet（整批） ──
async function saveToSheet() {
  const period = document.getElementById('periodInput').value.trim();
  if (!period) { alert('請填入競賽期數'); return; }
  if (!parsedData.length) { alert('沒有資料可儲存'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '⏳ 儲存中...';

  const pw = document.getElementById('saveProgressWrap');
  const pf = document.getElementById('saveProgressFill');
  const pt = document.getElementById('saveProgressText');
  pw.style.display = 'block';
  pf.style.width = '0%';
  pt.textContent = `準備儲存 ${parsedData.length} 筆...`;

  try {
    const BATCH_SIZE = 10;
    const total = parsedData.length;
    let done = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = parsedData.slice(i, i + BATCH_SIZE);
      const records = batch.map(d => ([period, d.server, d.nickname, d.role, d.score, d.title]));
      const params = encodeURIComponent(JSON.stringify({
        action: 'addContestBatch',
        records: records
      }));

      await new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = `${APPS_SCRIPT_URL}?data=${params}`;
      });

      done += batch.length;
      pf.style.width = Math.round(done / total * 100) + '%';
      pt.textContent = `儲存中 ${done}/${total}...`;
    }

    pf.style.width = '100%';
    pt.textContent = `✅ 已儲存 ${total} 筆！`;

    // 儲存公會總結（如果有填）
    const sumMembers = document.getElementById('sumMembers').value.trim();
    const sumTotal = document.getElementById('sumTotal').value.trim();
    const sumRank = document.getElementById('sumRank').value.trim();
    const sumGrade = document.getElementById('sumGrade').value.trim();
    if (sumTotal) {
      await new Promise(resolve => {
        const params = encodeURIComponent(JSON.stringify({
          action: 'addContestSummary',
          period, members: sumMembers, total: sumTotal, rank: sumRank, grade: sumGrade
        }));
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = `${APPS_SCRIPT_URL}?data=${params}`;
      });
    }

    alert(`✅ 已儲存 ${total} 筆成績到 Sheet！`);
  } catch(e) {
    pt.textContent = '❌ 儲存失敗';
    alert('❌ 儲存失敗：' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 儲存到 Sheet';
  }
}

// ── 對手排名辨識 ──
async function handleOpponentFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  const status = document.getElementById('opponentStatus');
  status.style.display = 'block';
  status.style.color = '#1565c0';
  status.textContent = `⏳ 辨識 ${files.length} 張截圖中...`;

  try {
    let allParsed = [];

    for (let fi = 0; fi < files.length; fi++) {
      status.textContent = `⏳ 辨識第 ${fi+1}/${files.length} 張...`;

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(files[fi]);
      });

      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION' }] }] })
      });
      const data = await res.json();
      const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

      const parsed = parseOpponentText(text);
      allParsed = allParsed.concat(parsed);
    }

    // 去重（同公會名只保留一筆）
    const seen = new Set();
    allParsed = allParsed.filter(d => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });

    // 按分數大到小重新編排名次
    allParsed.sort((a, b) => b.score - a.score);
    allParsed.forEach((d, i) => d.rank = i + 1);

    if (allParsed.length) {
      opponentData = allParsed;
      renderOpponentTable();
      status.style.color = '#2e7d32';
      status.textContent = `✅ 辨識完成！共 ${allParsed.length} 筆，請確認`;
    } else {
      status.style.color = '#e65100';
      status.textContent = '⚠️ 未能辨識到排名資料，請手動填寫';
    }
  } catch(e) {
    status.style.color = '#c62828';
    status.textContent = '❌ 辨識失敗：' + e.message;
  }
}

function parseOpponentText(text) {
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/船[隻只]/.test(lines[i])) { startIdx = i + 1; break; }
  }
  const dataLines = lines.slice(startIdx);

  const NOISE = ['甲級聯賽','乙級聯賽','丙級聯賽','甲級','乙級','丙級','聯賽',
    '競賽榮譽','競賽','榮譽','任務','排名','獎勵','船隻','船只','商店'];

  const names = [];
  for (const line of dataLines) {
    const nameMatches = line.match(/[\u4e00-\u9fff]{2,6}/g) || [];
    for (const n of nameMatches) {
      if (NOISE.includes(n) || NOISE.some(noise => n.includes(noise))) continue;
      if (!names.includes(n)) names.push(n);
    }
  }

  const allScores = [];
  for (const line of dataLines) {
    const scoreMatches = line.match(/\d{4,5}/g) || [];
    for (const s of scoreMatches) allScores.push(parseInt(s));
  }

  const scoreCounts = {};
  for (const s of allScores) scoreCounts[s] = (scoreCounts[s] || 0) + 1;

  const uniqueScores = [];
  const seenScores = new Set();
  for (const s of allScores) {
    if (!seenScores.has(s) && scoreCounts[s] <= 2) {
      seenScores.add(s);
      uniqueScores.push(s);
    }
  }

  uniqueScores.sort((a, b) => b - a);

  const count = Math.min(names.length, uniqueScores.length);
  for (let i = 0; i < count; i++) {
    results.push({ rank: i + 1, name: names[i], score: uniqueScores[i] });
  }

  return results;
}

function renderOpponentTable() {
  const table = document.getElementById('opponentTable');
  const tbody = document.getElementById('opponentBody');
  const btnRow = document.getElementById('opponentBtnRow');
  table.style.display = '';
  btnRow.style.display = '';

  tbody.innerHTML = opponentData.map((d, i) =>
    `<tr${d.name === '璀璨' ? ' style="background:#fef0e7;font-weight:700;"' : ''}>
      <td>${d.rank}</td>
      <td><input value="${d.name}" onchange="opponentData[${i}].name=this.value" /></td>
      <td><input type="number" value="${d.score}" onchange="opponentData[${i}].score=Number(this.value)" style="width:80px;" /></td>
      <td><button onclick="opponentData.splice(${i},1);renderOpponentTable();" style="background:none;border:none;color:#e65100;cursor:pointer;">✕</button></td>
    </tr>`
  ).join('');
}

function addOpponentRow() {
  opponentData.push({ rank: opponentData.length + 1, name: '', score: 0 });
  renderOpponentTable();
}

async function saveOpponents() {
  const period = document.getElementById('periodInput').value.trim();
  if (!period) { alert('請填入競賽期數'); return; }
  if (!opponentData.length) { alert('沒有對手資料可儲存'); return; }

  try {
    const records = opponentData.map(d => ([period, d.rank, d.name, d.score]));
    const params = encodeURIComponent(JSON.stringify({
      action: 'addContestOpponents',
      records: records
    }));
    await new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = `${APPS_SCRIPT_URL}?data=${params}`;
    });
    alert(`✅ 已儲存 ${opponentData.length} 筆對手排名！`);
  } catch(e) {
    alert('❌ 儲存失敗：' + e.message);
  }
}