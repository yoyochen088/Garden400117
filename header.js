(function () {
  // ?? 撠汗?摰儔 ??
  const NAV_ITEMS = [
    { label: '擐?',     href: 'home.html',           icon: '??', match: ['home.html'] },
    { label: '?勗???', href: 'index.html',           icon: '?', match: ['index.html'] },
    { label: '蝡嗉魚?餌', href: 'guide.html',           icon: '??', match: ['guide.html'] },
    { label: '?祆??', href: 'index.html#id-page',   icon: '?', match: [] },
    {
      label: '?犖', icon: '?', dropdown: true,
      match: ['member-editor.html', 'flower-showcase.html'],
      children: [
        { label: '???勗???', href: 'member-editor.html' },
        { label: '?儭??犖?勗?', href: 'flower-showcase.html' },
      ]
    },
    {
      label: '??撠?', icon: '??', dropdown: true, authOnly: true,
      match: ['contest.html', 'contest-dashboard.html', 'contest-history.html', 'contest-opponents.html', 'contest-ai.html'],
      children: [
        { label: '?妙 蝡嗉魚閮?璈?, href: 'contest.html' },
        { label: '?? 蝡嗉魚?勗', href: 'contest-dashboard.html' },
        { label: '?? 甇瑕?蜀', href: 'contest-history.html' },
        { label: '?? 撠?銝剖?', href: 'contest-opponents.html' },
        { label: '?? AI ?拇?', href: 'contest-ai.html' },
      ]
    },
    { label: '蝷曄黎 Line', href: '#line-qr', icon: '?', match: [], mobileOnly: true },
    { label: '蝞∠?', href: 'editor.html', icon: '??', match: ['editor.html'] },
  ];

  // ?? CSS ??
  const CSS = `
    #site-header header {
      background: linear-gradient(135deg,#c2510b 0%,#e96a1e 60%,#f4a46a 100%);
      color: #fff; padding: 0 20px; display: flex; align-items: center;
      justify-content: space-between; height: 60px; position: fixed;
      top: 0; left: 0; right: 0; z-index: 100; box-shadow: 0 2px 8px rgba(194,81,11,.3);
    }
    #site-header { height: 60px; /* 雿?嚗?摰寡◤ fixed header ?? */ }
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
    /* 銝??詨 */
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
    /* 瞍Ｗ */
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
    /* mobile 摮??*/
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
    #sh-mobile-nav .sh-mnav-line-btn {
      padding: 12px 16px; border-radius: 12px;
      background: none; border: 1.5px solid rgba(255,255,255,0.3);
      color: #fff; font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
      text-align: left; width: 100%;
      display: flex; align-items: center; gap: 10px;
    }
    #sh-mobile-nav .sh-mnav-line-btn:hover { background: rgba(255,255,255,0.2); }
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

  // ?? ?斗?桀?? ??
  const page = location.pathname.split('/').pop() || 'index.html';
  const hash = location.hash; // e.g. '#id-page'

  function isActive(item) {
    // ?祆??嚗ref 撣?hash嚗???瘥? page + hash
    if (item.href && item.href.includes('#')) {
      const [hPage, hHash] = item.href.split('#');
      return page === hPage && hash === '#' + hHash;
    }
    // ?勗???嚗ndex.html嚗???hash ??鈭殷?hash ??勗???∟???
    if (item.match && item.match.includes('index.html') && hash) {
      return false;
    }
    return item.match && item.match.includes(page);
  }

  // ?? 撱箇?獢 nav ??
  function buildNav() {
    const items = NAV_ITEMS.filter(item => !item.mobileOnly).filter(item => {
      if (item.authOnly) return typeof isBound === 'function' && isBound();
      return true;
    });
    // ?恣??箔??暹?敺?auth ???蝞∠???
    const mgmtIdx = items.findIndex(i => i.href === 'editor.html');
    const beforeMgmt = mgmtIdx >= 0 ? items.slice(0, mgmtIdx) : items;
    const mgmtItem = mgmtIdx >= 0 ? items[mgmtIdx] : null;

    let html = beforeMgmt.map(item => renderNavItem(item)).join('');
    // Desktop auth ??
    let authHtml = '';
    if (typeof getAuthUser === 'function') {
      const user = getAuthUser();
      if (!user) {
        authHtml = '<button class="sh-desk-login" onclick="doLogin()">?餃</button>';
      } else if (!user.gameId) {
        authHtml = `<div class="sh-desk-user"><span class="sh-desk-name">?? ${user.fbName}</span><span class="sh-desk-bind" onclick="showBindDialog('${user.fbId}')">蝬?</span><button class="sh-desk-logout" onclick="doLogout()">?餃</button></div>`;
      } else {
        authHtml = `<div class="sh-desk-user"><span class="sh-desk-name">? ${user.nickname}</span><button class="sh-desk-logout" onclick="doLogout()">?餃</button></div>`;
      }
    } else {
      authHtml = '<button class="sh-desk-login" onclick="doLogin()">?餃</button>';
    }
    html += '<span id="sh-auth-desktop" class="sh-auth-desktop">' + authHtml + '</span>';
    if (mgmtItem) html += renderNavItem(mgmtItem);
    return html;
  }

  function renderNavItem(item) {
    if (item.dropdown) {
      const active = isActive(item) ? 'sh-active' : '';
      const children = item.children.map(c =>
        `<a href="${c.href}">${c.label}</a>`
      ).join('');
      return `
        <div class="sh-dropdown">
          <button class="sh-drop-btn ${active}">
            ${item.icon} ${item.label} <span class="sh-arrow">??/span>
          </button>
          <div class="sh-drop-menu">
            <div class="sh-drop-inner">${children}</div>
          </div>
        </div>`;
    }
    const active = isActive(item) ? 'sh-active' : '';
    return `<a href="${item.href}" class="${active}">${item.label}</a>`;
  }

  // ?? 撱箇? mobile-nav ??
  function buildMobileNav() {
    return NAV_ITEMS.filter(item => {
      if (item.authOnly) return typeof isBound === 'function' && isBound();
      return true;
    }).map(item => {
      if (item.dropdown) {
        const active = isActive(item) ? 'open' : '';
        const children = item.children.map(c =>
          `<a href="${c.href}">${c.label}</a>`
        ).join('');
        return `
          <div class="sh-mnav-group">
            <button class="sh-mnav-parent ${active}" onclick="shToggleMnav(this)">
              ${item.icon} ${item.label} <span class="sh-arrow">??/span>
            </button>
            <div class="sh-mnav-children ${active}">${children}</div>
          </div>`;
      }
      // 蝷曄黎 Line ?冽??孛??lightbox
      if (item.href === '#line-qr') {
        return `<button class="sh-mnav-line-btn" onclick="shShowLineQR(event)">${item.icon} ${item.label}</button>`;
      }
      const active = isActive(item) ? 'sh-active' : '';
      return `<a href="${item.href}" class="${active}">${item.icon} ${item.label}</a>`;
    }).join('');
  }

  // ?? 瘜典 HTML ??
  const container = document.getElementById('site-header');
  if (!container) return;

  // 瘜典 CSS
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  container.innerHTML = `
    <header>
      <a href="home.html" class="sh-guild">???<small>[400117]</small></a>
      <nav>${buildNav()}</nav>
      <button class="sh-hamburger" id="sh-hamburger" onclick="shToggleNav()" aria-label="?詨">
        <span></span><span></span><span></span>
      </button>
    </header>
    <div id="sh-nav-overlay" onclick="shCloseNav()"></div>
    <div id="sh-mobile-nav">
      <button class="sh-nav-close" onclick="shCloseNav()">??/button>
      ${buildMobileNav()}
      <div id="sh-auth-mobile" class="sh-auth-area"></div>
    </div>
    <div id="sh-line-lightbox" onclick="shCloseLineQR()">
      <button class="sh-line-close" onclick="shCloseLineQR()">??/button>
      <img src="Context/line.jpg" alt="Line QR Code" onclick="event.stopPropagation()" />
      <div class="sh-line-label">?? QR ??銝?</div>
      <a href="https://line.me/ti/g2/xf0Od6Moys9dfgxL4hN-AkKZMIFvRxeJLQIrjA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
         target="_blank" rel="noopener" class="sh-line-open-btn" onclick="event.stopPropagation()">? Line 蝢?/a>
    </div>
  `;

  // ?? ?湧 active ?湔?賢?靘??典????
  window.shSetActive = function(pageFile, pageHash) {
    const allNavLinks = document.querySelectorAll('#site-header nav a, #sh-mobile-nav a');
    allNavLinks.forEach(a => a.classList.remove('sh-active'));
    allNavLinks.forEach(a => {
      try {
        const url = new URL(a.href, location.href);
        const aFile = url.pathname.split('/').pop();
        const aHash = url.hash; // e.g. '#id-page'
        if (pageHash) {
          // ??hash嚗移蝣箸?撠?file + hash
          if (aFile === pageFile && aHash === pageHash) a.classList.add('sh-active');
        } else {
          // ??hash嚗?撠?file嚗?????祈澈銝葆 hash
          if (aFile === pageFile && !aHash) a.classList.add('sh-active');
        }
      } catch(e) {}
    });
  };

  // ?? ??????嚗???啗?????
  // 瘜典敺?摰???隞塚??亦???Ｚ?????格??臬?銝??html 瑼??寧 JS ??
  container.addEventListener('click', function(e) {
    const a = e.target.closest('a');
    if (!a || !a.href) return;
    try {
      const url = new URL(a.href, location.href);
      const targetFile = url.pathname.split('/').pop();
      // ?芣??芥?銝??html 瑼????
      if (targetFile !== page) return;
      // ???典?蝢拍? shNavClick hook 撠曹漱蝯血???
      if (typeof window.shNavClick === 'function') {
        e.preventDefault();
        window.shNavClick(url.hash || '');
      }
    } catch(e) {}
  });

  // ?? ?賢? ??
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

  // ?? Auth UI ??
  const authCSS = `
    .sh-auth-area{margin-top:auto;padding-top:12px;padding-bottom:60px;border-top:1px solid rgba(255,255,255,0.2);}
    .sh-auth-btn{width:100%;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background 0.2s;}
    .sh-fb-login{background:#1877f2;border:none;color:#fff;border-radius:10px;}
    .sh-fb-login:hover{background:#166bdb;}
    .sh-auth-info{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.12);border-radius:12px;border:1px solid rgba(255,255,255,0.2);}
    .sh-auth-name{color:#fff;font-size:0.88rem;font-weight:700;flex:1;}
    .sh-auth-role{color:rgba(255,255,255,0.7);font-size:0.75rem;}
    .sh-auth-logout{background:none;border:none;color:rgba(255,255,255,0.6);font-size:0.75rem;cursor:pointer;padding:4px 8px;}
    .sh-auth-logout:hover{color:#fff;}
    .sh-auth-bind-hint{color:#ffcc80;font-size:0.8rem;font-weight:600;margin-top:8px;text-align:center;cursor:pointer;}
    .sh-auth-bind-hint:hover{color:#fff;}
    /* Desktop auth */
    .sh-auth-desktop{display:flex;align-items:center;margin-left:8px;}
    .sh-auth-desktop .sh-desk-login{width:32px;height:32px;border-radius:50%;font-size:0.9rem;font-weight:900;background:#1877f2;color:#fff;border:none;cursor:pointer;transition:transform 0.15s;display:flex;align-items:center;justify-content:center;}
    .sh-auth-desktop .sh-desk-login:hover{transform:scale(1.1);}
    .sh-auth-desktop .sh-desk-user{display:flex;align-items:center;gap:8px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.4);}
    .sh-auth-desktop .sh-desk-name{color:#fff;font-size:0.82rem;font-weight:700;white-space:nowrap;}
    .sh-auth-desktop .sh-desk-logout{background:none;border:none;color:rgba(255,255,255,0.7);font-size:0.7rem;cursor:pointer;white-space:nowrap;}
    .sh-auth-desktop .sh-desk-logout:hover{color:#fff;}
    .sh-auth-desktop .sh-desk-bind{color:#ffcc80;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;}
    @media(max-width:600px){.sh-auth-desktop{display:none;}}
  `;
  const authStyle = document.createElement('style');
  authStyle.textContent = authCSS;
  document.head.appendChild(authStyle);

  function updateAuthUI() {
    const el = document.getElementById('sh-auth-mobile');
    const desk = document.getElementById('sh-auth-desktop');
    if (typeof getAuthUser !== 'function') {
      if (el) el.innerHTML = '';
      if (desk) desk.innerHTML = '';
      return;
    }
    const user = getAuthUser();

    // Mobile
    if (el) {
      if (!user) {
        el.innerHTML = '<button class="sh-auth-btn sh-fb-login" onclick="doLogin()">? Facebook ?餃</button>';
      } else if (!user.gameId) {
        el.innerHTML = `
          <div class="sh-auth-info">
            <span class="sh-auth-name">?? ${user.fbName}</span>
            <button class="sh-auth-logout" onclick="doLogout()">?餃</button>
          </div>
          <div class="sh-auth-bind-hint" onclick="showBindDialog('${user.fbId}')">?? 撠蝬?閫嚗?甇斤?摰?/div>`;
      } else {
        el.innerHTML = `
          <div class="sh-auth-info">
            <span class="sh-auth-name">? ${user.nickname}</span>
            <span class="sh-auth-role">${user.role || ''}</span>
            <button class="sh-auth-logout" onclick="doLogout()">?餃</button>
          </div>`;
      }
    }

    // Desktop
    if (desk) {
      if (!user) {
        desk.innerHTML = '<button class="sh-desk-login" onclick="doLogin()">?餃</button>';
      } else if (!user.gameId) {
        desk.innerHTML = `
          <div class="sh-desk-user">
            <span class="sh-desk-name">?? ${user.fbName}</span>
            <span class="sh-desk-bind" onclick="showBindDialog('${user.fbId}')">蝬?</span>
            <button class="sh-desk-logout" onclick="doLogout()">?餃</button>
          </div>`;
      } else {
        desk.innerHTML = `
          <div class="sh-desk-user">
            <span class="sh-desk-name">? ${user.nickname}</span>
            <button class="sh-desk-logout" onclick="doLogout()">?餃</button>
          </div>`;
      }
    }
  }

  window._onAuthChanged = function() {
    updateAuthUI();
    // ?皜脫? nav嚗＊蝷??梯???撠?嚗?
    const navEl = container.querySelector('nav');
    if (navEl) {
      navEl.innerHTML = buildNav();
    }
    const mobileNav = document.getElementById('sh-mobile-nav');
    if (mobileNav) {
      const closeBtn = '<button class="sh-nav-close" onclick="shCloseNav()">??/button>';
      const authArea = '<div id="sh-auth-mobile" class="sh-auth-area"></div>';
      mobileNav.innerHTML = closeBtn + buildMobileNav() + authArea;
    }
    updateAuthUI();
  };
  // ??皜脫?
  setTimeout(updateAuthUI, 100);

})();
