(function () {
  // ── 導覽項目定義 ──
  const NAV_ITEMS = [
    { label: '首頁',     href: 'home.html',           icon: '🏠', match: ['home.html'] },
    { label: '花卉圖鑑', href: 'index.html',           icon: '🌸', match: ['index.html'] },
    { label: '競賽攻略', href: 'guide.html',           icon: '📖', match: ['guide.html'] },
    { label: '公會成員', href: 'index.html#id-page',   icon: '👥', match: [] },
    {
      label: '個人', icon: '👤', dropdown: true,
      match: ['member-editor.html', 'flower-showcase.html'],
      children: [
        { label: '✅ 花卉擁有', href: 'member-editor.html' },
        { label: '🖼️ 個人花展', href: 'flower-showcase.html' },
      ]
    },
    { label: '管理', href: 'editor.html', icon: '⚙️', match: ['editor.html'] },
  ];

  // ── CSS ──
  const CSS = `
    #site-header header {
      background: linear-gradient(135deg,#c2510b 0%,#e96a1e 60%,#f4a46a 100%);
      color: #fff; padding: 0 20px; display: flex; align-items: center;
      justify-content: space-between; height: 60px; position: fixed;
      top: 0; left: 0; right: 0; z-index: 100; box-shadow: 0 2px 8px rgba(194,81,11,.3);
    }
    #site-header { height: 60px; /* 佔位，避免內容被 fixed header 蓋住 */ }
    #site-header .sh-guild {
      font-size: 1.25rem; font-weight: 700; letter-spacing: 2px;
      white-space: nowrap; text-decoration: none; color: inherit;
    }
    #site-header .sh-guild small { font-weight: 400; opacity: .8; font-size: .7rem; }
    #site-header nav { display: flex; gap: 8px; align-items: center; }
    #site-header nav a {
      color: #fff; text-decoration: none; padding: 6px 14px;
      border-radius: 20px; font-size: .9rem; font-weight: 600;
      transition: background .2s; border: 1.5px solid rgba(255,255,255,.5);
      white-space: nowrap;
    }
    #site-header nav a:hover,
    #site-header nav a.sh-active { background: rgba(255,255,255,.25); }
    /* 下拉選單 */
    #site-header .sh-dropdown { position: relative; }
    #site-header .sh-drop-btn {
      color: #fff; padding: 6px 14px; border-radius: 20px; font-size: .9rem;
      font-weight: 600; border: 1.5px solid rgba(255,255,255,.5); background: none;
      cursor: pointer; display: flex; align-items: center; gap: 5px;
      transition: background .2s; white-space: nowrap;
    }
    #site-header .sh-drop-btn:hover,
    #site-header .sh-drop-btn.sh-active { background: rgba(255,255,255,.25); }
    #site-header .sh-drop-btn .sh-arrow { font-size: .6rem; transition: transform .2s; }
    #site-header .sh-dropdown:hover .sh-arrow { transform: rotate(180deg); }
    #site-header .sh-drop-menu {
      display: none; position: absolute; top: 100%; left: 50%;
      transform: translateX(-50%); padding-top: 8px;
      background: transparent; min-width: 140px; z-index: 200;
    }
    #site-header .sh-dropdown:hover .sh-drop-menu { display: block; }
    #site-header .sh-drop-inner {
      background: #fff; border-radius: 12px; border: 1px solid #f8d5b0;
      box-shadow: 0 8px 24px rgba(194,81,11,.18); overflow: hidden;
    }
    #site-header .sh-drop-inner a {
      display: block; padding: 10px 18px; color: #c2510b !important;
      font-size: .88rem; font-weight: 600; text-decoration: none;
      border: none !important; border-radius: 0 !important;
      background: none !important; transition: background .15s;
    }
    #site-header .sh-drop-inner a:hover { background: #fef0e7 !important; }
    #site-header .sh-drop-inner a + a { border-top: 1px solid #f8d5b0 !important; }
    /* 漢堡 */
    #site-header .sh-hamburger {
      display: none; flex-direction: column; gap: 5px;
      cursor: pointer; padding: 6px; background: none; border: none;
    }
    #site-header .sh-hamburger span {
      display: block; width: 22px; height: 2px;
      background: #fff; border-radius: 2px; transition: all .3s;
    }
    #site-header .sh-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    #site-header .sh-hamburger.open span:nth-child(2) { opacity: 0; }
    #site-header .sh-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    /* mobile-nav */
    #sh-nav-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.4); z-index: 150;
    }
    #sh-nav-overlay.open { display: block; }
    #sh-mobile-nav {
      position: fixed; top: 0; right: -260px; width: 240px; height: 100vh;
      background: linear-gradient(160deg,#c2510b,#e96a1e); z-index: 200;
      padding: 70px 20px 30px; display: flex; flex-direction: column; gap: 8px;
      transition: right .3s cubic-bezier(.4,0,.2,1);
      box-shadow: -4px 0 20px rgba(0,0,0,.2); overflow-y: auto;
    }
    #sh-mobile-nav.open { right: 0; }
    #sh-mobile-nav a {
      color: #fff; text-decoration: none; padding: 12px 16px;
      border-radius: 12px; font-size: 1rem; font-weight: 600;
      border: 1.5px solid rgba(255,255,255,.3); transition: background .2s;
      display: flex; align-items: center; gap: 10px;
    }
    #sh-mobile-nav a:hover,
    #sh-mobile-nav a.sh-active { background: rgba(255,255,255,.2); }
    #sh-mobile-nav .sh-nav-close {
      position: absolute; top: 16px; right: 16px;
      background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer;
    }
    /* mobile 子選單 */
    #sh-mobile-nav .sh-mnav-group { display: flex; flex-direction: column; gap: 0; }
    #sh-mobile-nav .sh-mnav-parent {
      color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 1rem;
      font-weight: 600; border: 1.5px solid rgba(255,255,255,.3); background: none;
      cursor: pointer; display: flex; align-items: center;
      justify-content: space-between; transition: background .2s; width: 100%;
    }
    #sh-mobile-nav .sh-mnav-parent:hover { background: rgba(255,255,255,.2); }
    #sh-mobile-nav .sh-mnav-parent .sh-arrow { font-size: .7rem; transition: transform .25s; }
    #sh-mobile-nav .sh-mnav-parent.open .sh-arrow { transform: rotate(180deg); }
    #sh-mobile-nav .sh-mnav-children {
      display: none; flex-direction: column; gap: 4px; padding: 6px 0 2px 16px;
    }
    #sh-mobile-nav .sh-mnav-children.open { display: flex; }
    #sh-mobile-nav .sh-mnav-children a {
      color: rgba(255,255,255,.9) !important; padding: 9px 14px !important;
      border-radius: 10px !important; font-size: .92rem !important;
      border: 1px solid rgba(255,255,255,.2) !important;
    }
    @media(max-width:600px) {
      #site-header .sh-guild { font-size: 1rem; }
      #site-header nav { display: none; }
      #site-header .sh-hamburger { display: flex; }
    }
    /* mobile-nav 底部 Line 群按鈕 */
    #sh-mobile-nav .sh-mnav-line-btn {
      margin-top: auto; padding: 12px 16px; border-radius: 12px;
      background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.3);
      color: #fff; font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
      text-align: center; width: 100%;
    }
    #sh-mobile-nav .sh-mnav-line-btn:hover { background: rgba(255,255,255,0.25); }
    /* Line QR Lightbox */
    #sh-line-lightbox {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.85); z-index: 999;
      align-items: center; justify-content: center; flex-direction: column; gap: 16px;
    }
    #sh-line-lightbox.open { display: flex; }
    #sh-line-lightbox img {
      width: 260px; max-width: 80vw; height: auto;
      border-radius: 16px; background: #fff; padding: 8px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    }
    #sh-line-lightbox .sh-line-label {
      color: #fff; font-size: 1rem; font-weight: 700;
      text-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    #sh-line-lightbox .sh-line-close {
      position: absolute; top: 18px; right: 22px;
      background: none; border: none; color: #fff; font-size: 2rem;
      cursor: pointer; opacity: 0.8; line-height: 1;
    }
    #sh-line-lightbox .sh-line-open-btn {
      padding: 10px 24px; border-radius: 20px; font-size: 0.9rem; font-weight: 700;
      background: #06c755; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 3px 12px rgba(6,199,85,0.4); transition: transform 0.15s;
      text-decoration: none; display: inline-block;
    }
    #sh-line-lightbox .sh-line-open-btn:hover { transform: translateY(-2px); }
  `;

  // ── 判斷目前頁面 ──
  const page = location.pathname.split('/').pop() || 'index.html';
  const hash = location.hash; // e.g. '#id-page'

  function isActive(item) {
    // 公會成員：href 帶 hash，需同時比對 page + hash
    if (item.href && item.href.includes('#')) {
      const [hPage, hHash] = item.href.split('#');
      return page === hPage && hash === '#' + hHash;
    }
    // 花卉圖鑑（index.html）：有 hash 時不亮（hash 頁面由公會成員處理）
    if (item.match && item.match.includes('index.html') && hash) {
      return false;
    }
    return item.match && item.match.includes(page);
  }

  // ── 建立桌面 nav ──
  function buildNav() {
    return NAV_ITEMS.map(item => {
      if (item.dropdown) {
        const active = isActive(item) ? 'sh-active' : '';
        const children = item.children.map(c =>
          `<a href="${c.href}">${c.label}</a>`
        ).join('');
        return `
          <div class="sh-dropdown">
            <button class="sh-drop-btn ${active}">
              ${item.icon} ${item.label} <span class="sh-arrow">▼</span>
            </button>
            <div class="sh-drop-menu">
              <div class="sh-drop-inner">${children}</div>
            </div>
          </div>`;
      }
      const active = isActive(item) ? 'sh-active' : '';
      return `<a href="${item.href}" class="${active}">${item.label}</a>`;
    }).join('');
  }

  // ── 建立 mobile-nav ──
  function buildMobileNav() {
    return NAV_ITEMS.map(item => {
      if (item.dropdown) {
        const active = isActive(item) ? 'open' : '';
        const children = item.children.map(c =>
          `<a href="${c.href}">${c.label}</a>`
        ).join('');
        return `
          <div class="sh-mnav-group">
            <button class="sh-mnav-parent ${active}" onclick="shToggleMnav(this)">
              ${item.icon} ${item.label} <span class="sh-arrow">▼</span>
            </button>
            <div class="sh-mnav-children ${active}">${children}</div>
          </div>`;
      }
      const active = isActive(item) ? 'sh-active' : '';
      return `<a href="${item.href}" class="${active}">${item.icon} ${item.label}</a>`;
    }).join('');
  }

  // ── 注入 HTML ──
  const container = document.getElementById('site-header');
  if (!container) return;

  // 注入 CSS
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  container.innerHTML = `
    <header>
      <a href="home.html" class="sh-guild">璀璨 <small>[400117]</small></a>
      <nav>${buildNav()}</nav>
      <button class="sh-hamburger" id="sh-hamburger" onclick="shToggleNav()" aria-label="選單">
        <span></span><span></span><span></span>
      </button>
    </header>
    <div id="sh-nav-overlay" onclick="shCloseNav()"></div>
    <div id="sh-mobile-nav">
      <button class="sh-nav-close" onclick="shCloseNav()">✕</button>
      ${buildMobileNav()}
      <button class="sh-mnav-line-btn" onclick="shShowLineQR(event)">📱 社群 Line</button>
    </div>
    <div id="sh-line-lightbox" onclick="shCloseLineQR()">
      <button class="sh-line-close" onclick="shCloseLineQR()">✕</button>
      <img src="Context/line.jpg" alt="Line QR Code" onclick="event.stopPropagation()" />
      <div class="sh-line-label">掃描 QR 或點下方加入</div>
      <a href="https://line.me/ti/g2/xf0Od6Moys9dfgxL4hN-AkKZMIFvRxeJLQIrjA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
         target="_blank" rel="noopener" class="sh-line-open-btn" onclick="event.stopPropagation()">加入 Line 群</a>
    </div>
  `;

  // ── 暴露 active 更新函式供外部呼叫 ──
  window.shSetActive = function(pageFile, pageHash) {
    const allNavLinks = document.querySelectorAll('#site-header nav a, #sh-mobile-nav a');
    allNavLinks.forEach(a => a.classList.remove('sh-active'));
    allNavLinks.forEach(a => {
      try {
        const url = new URL(a.href, location.href);
        const aFile = url.pathname.split('/').pop();
        const aHash = url.hash; // e.g. '#id-page'
        if (pageHash) {
          // 有 hash：精確比對 file + hash
          if (aFile === pageFile && aHash === pageHash) a.classList.add('sh-active');
        } else {
          // 無 hash：比對 file，且連結本身不帶 hash
          if (aFile === pageFile && !aHash) a.classList.add('sh-active');
        }
      } catch(e) {}
    });
  };

  // ── 攔截同頁連結，避免重新載入 ──
  // 注入後綁定點擊事件：若目前頁面與連結目標是同一個 html 檔，改用 JS 切換
  container.addEventListener('click', function(e) {
    const a = e.target.closest('a');
    if (!a || !a.href) return;
    try {
      const url = new URL(a.href, location.href);
      const targetFile = url.pathname.split('/').pop();
      // 只攔截「同一個 html 檔」的連結
      if (targetFile !== page) return;
      // 有外部定義的 shNavClick hook 就交給它處理
      if (typeof window.shNavClick === 'function') {
        e.preventDefault();
        window.shNavClick(url.hash || '');
      }
    } catch(e) {}
  });

  // ── 函式 ──
  window.shToggleNav = function () {
    document.getElementById('sh-mobile-nav').classList.toggle('open');
    document.getElementById('sh-nav-overlay').classList.toggle('open');
    document.getElementById('sh-hamburger').classList.toggle('open');
  };
  window.shCloseNav = function () {
    document.getElementById('sh-mobile-nav').classList.remove('open');
    document.getElementById('sh-nav-overlay').classList.remove('open');
    document.getElementById('sh-hamburger').classList.remove('open');
  };
  window.shToggleMnav = function (btn) {
    btn.classList.toggle('open');
    btn.nextElementSibling.classList.toggle('open');
  };
  window.shShowLineQR = function (e) {
    e.preventDefault();
    e.stopPropagation();
    shCloseNav();
    document.getElementById('sh-line-lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.shCloseLineQR = function () {
    document.getElementById('sh-line-lightbox').classList.remove('open');
    document.body.style.overflow = '';
  };
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') shCloseLineQR();
  });
})();
