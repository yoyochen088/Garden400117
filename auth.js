// ════════════════════════════════════════════════════════════════
//  auth.js — Google 登入 + 成員綁定（共用模組）
//  需要全域變數：APPS_SCRIPT_URL, SHEET_ID, API_KEY（來自 config.js 或 inline）
// ════════════════════════════════════════════════════════════════

const GOOGLE_CLIENT_ID = '274674752247-pj9980era0e5r6bsn8bvrh88tqp2r59k.apps.googleusercontent.com';

// ── 登入狀態 ──
let authUser = null; // { odI, gName, gEmail, gameId, nickname, role }

function getAuthUser() {
  if (authUser) return authUser;
  const stored = localStorage.getItem('cuican_auth');
  if (stored) {
    try {
      authUser = JSON.parse(stored);
      return authUser;
    } catch (e) { localStorage.removeItem('cuican_auth'); }
  }
  return null;
}

function setAuthUser(user) {
  authUser = user;
  localStorage.setItem('cuican_auth', JSON.stringify(user));
}

function clearAuth() {
  authUser = null;
  localStorage.removeItem('cuican_auth');
}

function isLoggedIn() {
  return !!getAuthUser();
}

function isBound() {
  const u = getAuthUser();
  return u && u.gameId;
}

// ── Google Identity Services 載入 ──
function loadGoogleSDK() {
  return new Promise((resolve) => {
    if (window.google && window.google.accounts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ── Google 登入流程 ──
async function doLogin() {
  await loadGoogleSDK();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleResponse,
    auto_select: false
  });
  google.accounts.id.prompt((notification) => {
    // 如果 One Tap 被關閉或不支援，用彈窗
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      google.accounts.id.prompt();
    }
  });
}

// ── Google 回應處理 ──
async function handleGoogleResponse(response) {
  // 解析 JWT token（不需要後端驗證，前端解碼即可取得基本資料）
  const payload = parseJwt(response.credential);
  const googleId = payload.sub;
  const gName = payload.name || '';
  const gEmail = payload.email || '';

  // 檢查是否已綁定
  const check = await checkBinding(googleId);
  if (check.bound) {
    setAuthUser({ googleId, gName, gEmail, gameId: check.gameId, nickname: check.nickname, role: check.role });
    onAuthChanged();
    return;
  }

  // 未綁定 → 顯示成員選擇
  setAuthUser({ googleId, gName, gEmail, gameId: null, nickname: null, role: null });
  onAuthChanged();
  showBindDialog(googleId);
}

// ── 解析 JWT ──
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
  return JSON.parse(jsonPayload);
}

// ── 檢查 Google ID 是否已綁定成員 ──
async function checkBinding(googleId) {
  const params = encodeURIComponent(JSON.stringify({ action: 'checkGoogleId', googleId }));
  const res = await fetch(APPS_SCRIPT_URL + '?data=' + params);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { bound: false }; }
}

// ── 綁定 Google ID 到成員 ──
async function bindMember(googleId, gameId) {
  const params = encodeURIComponent(JSON.stringify({ action: 'bindGoogleId', googleId, gameId }));
  const res = await fetch(APPS_SCRIPT_URL + '?data=' + params);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { success: false }; }
}

// ── 登出 ──
function doLogout() {
  clearAuth();
  onAuthChanged();
  // Google 不需要呼叫 logout API
}

// ── 顯示綁定對話框 ──
async function showBindDialog(googleId) {
  // 取得成員清單
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/members!A1:E?key=${API_KEY}`);
  const data = await res.json();
  const rows = (data.values || []).slice(1)
    .filter(r => (r[3] || '').toLowerCase() !== 'true')
    .map(r => ({ gameId: r[0], nickname: r[1] }));

  // 建立 overlay
  const overlay = document.createElement('div');
  overlay.id = 'bind-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
      <h3 style="margin:0 0 8px;color:#a35d00;font-size:1.1rem;">🔗 綁定公會成員</h3>
      <p style="font-size:0.85rem;color:#9e7040;margin-bottom:16px;">請選擇你的遊戲角色，綁定後即可使用完整功能。</p>
      <select id="bind-select" style="width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #f5deb3;font-size:0.9rem;margin-bottom:16px;">
        <option value="">— 選擇你的角色 —</option>
        ${rows.map(r => `<option value="${r.gameId}">${r.nickname} (${r.gameId})</option>`).join('')}
      </select>
      <div style="display:flex;gap:10px;">
        <button id="bind-confirm" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#e96a1e,#f4a46a);color:#fff;font-weight:700;cursor:pointer;">確認綁定</button>
        <button id="bind-cancel" style="padding:10px 16px;border-radius:10px;border:1.5px solid #f5deb3;background:#fff;color:#a08050;font-weight:600;cursor:pointer;">稍後再說</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('bind-confirm').onclick = async () => {
    const gameId = document.getElementById('bind-select').value;
    if (!gameId) { alert('請選擇角色'); return; }
    const result = await bindMember(googleId, gameId);
    if (result.success) {
      const user = getAuthUser();
      user.gameId = result.gameId;
      user.nickname = result.nickname;
      user.role = result.role;
      setAuthUser(user);
      overlay.remove();
      onAuthChanged();
    } else if (result.error === 'already_bound') {
      alert('此角色已被其他帳號綁定');
    } else {
      alert('綁定失敗：' + (result.error || '未知錯誤'));
    }
  };

  document.getElementById('bind-cancel').onclick = () => {
    overlay.remove();
  };
}

// ── 狀態變更 callback（由 header.js 覆寫） ──
function onAuthChanged() {
  if (typeof window._onAuthChanged === 'function') window._onAuthChanged();
}

// ── 頁面保護（在受保護頁面呼叫） ──
function requireAuth() {
  if (!isBound()) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fffaf3;padding:20px;">
        <div style="text-align:center;max-width:400px;">
          <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
          <h2 style="color:#a35d00;margin-bottom:8px;">需要登入才能使用</h2>
          <p style="color:#9e7040;font-size:0.9rem;margin-bottom:20px;">請先使用 Google 登入並綁定公會成員身份。</p>
          <button onclick="doLogin()" style="padding:12px 28px;border-radius:20px;border:none;background:#fff;color:#444;font-size:0.95rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #ddd;display:inline-flex;align-items:center;gap:10px;">
            <img src="https://developers.google.com/identity/images/g-logo.png" style="width:20px;height:20px;" alt="G" />
            使用 Google 登入
          </button>
          <div style="margin-top:16px;"><a href="home.html" style="color:#e96a1e;font-size:0.85rem;">← 返回首頁</a></div>
        </div>
      </div>
    `;
    return false;
  }
  return true;
}
