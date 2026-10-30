/* ============================================================
   STUDIO 27 — behaviour
   Vanilla ES, no dependencies. Reads everything from content.js.
   ============================================================ */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Tonal pairs for projects with no image yet. Kept inside the
     graphite family so a half-filled grid still looks deliberate. */
  var TONES = [
    ['#2A2F38', '#0B0C10'],
    ['#1E232B', '#0D0E12'],
    ['#333844', '#101217'],
    ['#242A34', '#0A0B0E'],
    ['#2C313B', '#14161C'],
    ['#1A1E25', '#0C0D11']
  ];

  function toneVars(i) {
    var t = TONES[i % TONES.length];
    return '--t1:' + t[0] + ';--t2:' + t[1] + ';';
  }

  function mediaStyle(project, i) {
    var s = toneVars(i);
    if (project.image) s += "background-image:url('" + project.image + "');";
    return s;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function slugify(str) {
    return String(str == null ? '' : str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function catLabel(key) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].key === key) return CATEGORIES[i].label;
    }
    return key;
  }

  /* ---------------------------------------------------------- */
  /* Page load                                                   */
  /* ---------------------------------------------------------- */
  function ready() {
    /* The nav-link wave-in should only play once per visit — replaying
       it on every page navigation within the same session looks like
       a glitch, not an intro. */
    var repeat = !!sessionStorage.getItem('s27-nav-played');
    sessionStorage.setItem('s27-nav-played', '1');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (repeat) document.body.classList.add('is-ready--repeat');
        document.body.classList.add('is-ready');
      });
    });
  }

  /* ---------------------------------------------------------- */
  /* Navigation                                                  */
  /* ---------------------------------------------------------- */
  function initNav() {
    var nav = $('.nav');
    var toggle = $('.nav__toggle');
    var menu = $('.menu');

    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('is-stuck', window.scrollY > 12);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (toggle && menu) {
      var setOpen = function (open) {
        toggle.classList.toggle('is-open', open);
        menu.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      };
      toggle.addEventListener('click', function () {
        setOpen(!menu.classList.contains('is-open'));
      });
      $$('.menu__item', menu).forEach(function (a, i) {
        a.style.setProperty('--i', i);
        a.addEventListener('click', function () { setOpen(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
      });
    }

    /* Mark the current page in the nav */
    var path = window.location.pathname.replace(/\/$/, '');
    $$('.nav__link').forEach(function (a) {
      var href = a.getAttribute('href').replace(/\/$/, '');
      if (href && href === path) a.classList.add('is-current');
    });
  }

  /* ---------------------------------------------------------- */
  /* Homepage logo intro — starts big & centered, settles into    */
  /* the nav on load ([data-logo-intro] marks the real nav logo). */
  /* ---------------------------------------------------------- */
  /* Returns true when it will call ready() itself once the intro
     finishes (via runLogoIntro's finish()) — false means the caller
     (boot()) must call ready() right away instead, because there is
     no intro to wait for on this load. */
  function initLogoIntro() {
    var target = $('[data-logo-intro]');
    var cover = $('.logo-intro-cover');

    function skipCover() {
      if (cover && cover.parentNode) cover.parentNode.removeChild(cover);
    }

    /* Only run once per visit — replaying it every time someone
       navigates back to "/" or re-clicks the logo mid-session looks
       broken, not intentional. Same session flag also gates the nav
       link wave-in below. */
    if (!target || reduced || sessionStorage.getItem('s27-intro-played')) {
      skipCover();
      return false;
    }
    sessionStorage.setItem('s27-intro-played', '1');

    /* Wait for webfonts so the clone's text measures and paints with
       the real typeface — starting before the font swaps in was the
       cause of the "S" clipping/disappearing and of the backdrop
       sometimes not fully covering the page behind it. */
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(runLogoIntro);
    } else {
      runLogoIntro();
    }
    return true;
  }

  function runLogoIntro() {
    var target = $('[data-logo-intro]');
    if (!target) return;

    var rect = target.getBoundingClientRect();
    if (!rect.width) return;

    /* The real logo is hidden (opacity, not display/visibility — it
       still occupies its layout space) only for the ~2.6s the intro
       runs, and finish() always restores it: on the clone's
       animationend, and unconditionally via a hard timeout as a
       fallback, so it can never get stuck invisible even if the
       animation event fails to fire for some reason. */
    target.style.opacity = '0';

    var overlay = document.createElement('div');
    overlay.className = 'logo-intro-overlay';

    var clone = target.cloneNode(true);
    clone.removeAttribute('data-logo-intro');
    clone.className += ' logo-intro-clone';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';

    var scale = Math.min(3, (window.innerWidth * 0.78) / rect.width);
    var finalCenterX = rect.left + rect.width / 2;
    var finalCenterY = rect.top + rect.height / 2;
    var startCenterX = window.innerWidth / 2;
    var startCenterY = window.innerHeight / 2;
    var dx = startCenterX - finalCenterX;
    var dy = startCenterY - finalCenterY;

    clone.style.setProperty('--logo-intro-dx', dx.toFixed(2) + 'px');
    clone.style.setProperty('--logo-intro-dy', dy.toFixed(2) + 'px');
    clone.style.setProperty('--logo-intro-scale', String(scale));

    document.body.appendChild(overlay);
    document.body.appendChild(clone);

    /* The metallic clone starts fading out at 76% of its 2s animation
       (see logoIntroFade) — cross-fade the real flat-colored logo in
       over that same window so the shine visibly dissolves into the
       normal logo instead of an abrupt swap. */
    setTimeout(function () {
      target.style.transition = 'opacity 0.5s linear';
      target.style.opacity = '1';
    }, 1500);

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      target.style.opacity = '';
      target.style.transition = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (clone.parentNode) clone.parentNode.removeChild(clone);

      /* The page itself only reveals once the intro is done — fade the
         cover out, then bring in the nav-link wave right after, so the
         two animations play in sequence instead of overlapping. */
      var cover = $('.logo-intro-cover');
      if (cover) {
        cover.classList.add('is-hidden');
        setTimeout(function () {
          if (cover.parentNode) cover.parentNode.removeChild(cover);
        }, 650);
      }
      ready();
    }
    clone.addEventListener('animationend', finish);
    setTimeout(finish, 2600);
  }

  /* ---------------------------------------------------------- */
  /* Scroll reveals                                              */
  /* ---------------------------------------------------------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------- */
  /* The aperture                                                */
  /* ---------------------------------------------------------- */
  function initIris() {
    var iris = $('.iris');
    if (!iris) return;

    /* Blade seams — one line per nonagon vertex, out to the rim */
    var seams = $('.iris__seams', iris);
    if (seams) {
      var lines = '';
      for (var k = 0; k < 9; k++) {
        var a = (-90 + k * 40) * Math.PI / 180;
        lines += '<line x1="' + (50 + 40 * Math.cos(a)).toFixed(2) +
                 '" y1="' + (50 + 40 * Math.sin(a)).toFixed(2) +
                 '" x2="' + (50 + 50 * Math.cos(a)).toFixed(2) +
                 '" y2="' + (50 + 50 * Math.sin(a)).toFixed(2) +
                 '" stroke="rgba(255,255,255,0.32)" stroke-width="0.35"/>';
      }
      seams.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' + lines + '</svg>';
    }

    /* Lens barrel scale */
    var ticks = $('.iris__ticks', iris);
    if (ticks) {
      var marks = '';
      for (var t = 0; t < 72; t++) {
        var major = t % 6 === 0;
        var ang = t * 5;
        marks += '<line x1="50" y1="' + (major ? 1.4 : 2.6) + '" x2="50" y2="4.6" ' +
                 'stroke="' + (major ? '#3D4149' : '#CDD0D5') + '" stroke-width="' + (major ? 0.45 : 0.3) + '" ' +
                 'transform="rotate(' + ang + ' 50 50)"/>';
      }
      ticks.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' + marks + '</svg>';
    }

    /* Chrome reacts to the pointer — the one thing an image can't do */
    if (!reduced && window.matchMedia('(hover: hover)').matches) {
      var frame = null;
      var host = iris.closest('.hero') || iris;
      host.addEventListener('pointermove', function (e) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = null;
          var r = host.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          iris.style.setProperty('--chrome-spin', (x * 46 + y * 22).toFixed(1) + 'deg');
        });
      });
    }
  }

  /* ---------------------------------------------------------- */
  /* Services list                                               */
  /* ---------------------------------------------------------- */
  function initServices() {
    var host = $('[data-services]');
    if (!host || typeof SERVICES === 'undefined') return;
    var limit = parseInt(host.getAttribute('data-services'), 10);
    var list = isNaN(limit) ? SERVICES : SERVICES.slice(0, limit);

    host.innerHTML = list.map(function (s, i) {
      return '<a class="svc__row reveal" style="--d:' + i + '" href="' + esc(s.href) + '">' +
               '<h3 class="display-s svc__name">' + esc(s.name) + '</h3>' +
               '<p class="svc__desc">' + esc(s.desc) + '</p>' +
               '<span class="svc__tag">' + esc(s.tag) + '</span>' +
             '</a>';
    }).join('');
  }

  /* ---------------------------------------------------------- */
  /* Photo booth packages                                        */
  /* ---------------------------------------------------------- */
  function initBooth() {
    var host = $('[data-booth]');
    if (!host || typeof BOOTH_PACKAGES === 'undefined') return;

    host.innerHTML = BOOTH_PACKAGES.map(function (p, i) {
      return '<article class="card reveal' + (p.feature ? ' card--feature' : '') + '" style="--d:' + i + '">' +
               (p.badge ? '<span class="card__badge">' + esc(p.badge) + '</span>' : '') +
               '<h3 class="display-s">' + esc(p.name) + '</h3>' +
               '<p class="card__price">' + esc(p.price) + '<small>' + esc(p.unit) + '</small></p>' +
               '<ul class="card__list">' +
                 p.items.map(function (it) { return '<li><span>' + esc(it) + '</span></li>'; }).join('') +
               '</ul>' +
               '<a class="btn' + (p.feature ? ' btn--chrome' : '') + '" style="margin-top:auto" href="/contact?package=' +
                 encodeURIComponent(p.name) + '">Book ' + esc(p.name) + '</a>' +
             '</article>';
    }).join('');
  }

  /* ---------------------------------------------------------- */
  /* Work grid + filters + lightbox                              */
  /* ---------------------------------------------------------- */
  function initWork() {
    var grid = $('[data-work]');
    if (!grid || typeof PROJECTS === 'undefined') return;

    var limit = parseInt(grid.getAttribute('data-work'), 10);
    var pool = isNaN(limit) ? PROJECTS : PROJECTS.slice(0, limit);

    /* Filter to one creator's work when arriving from their
       Creatives page profile, e.g. /portfolio?creator=levi-thompson */
    var creatorSlug = new URLSearchParams(window.location.search).get('creator');
    var scopeHost = $('[data-work-scope]');
    if (creatorSlug) {
      var scoped = pool.filter(function (p) {
        return (p.creator && slugify(p.creator) === creatorSlug) || (p.director && slugify(p.director) === creatorSlug);
      });
      if (scoped.length) {
        pool = scoped;
        var creatorName = (scoped[0].director && slugify(scoped[0].director) === creatorSlug) ? scoped[0].director : scoped[0].creator;
        if (scopeHost) {
          scopeHost.hidden = false;
          scopeHost.innerHTML =
            '<span>Showing work by <strong>' + esc(creatorName) + '</strong></span>' +
            '<a href="/portfolio">View all work →</a>';
        }
      }
    }

    function tile(p, i) {
      var span = p.size === 'wide' ? ' work__item--wide' : '';
      var media = p.video
        ? '<span class="work__media" style="' + toneVars(i) + '">' +
            '<video class="work__video" src="' + esc(p.video) + '" muted loop playsinline preload="metadata"' +
              (p.image ? ' poster="' + esc(p.image) + '"' : '') + '></video>' +
          '</span>'
        : '<span class="work__media" style="' + mediaStyle(p, i) + '">' +
            (p.image ? '' : apertureMark()) +
          '</span>';
      var credit = p.creator
        ? '<span class="work__credit">Shot by ' + esc(p.creator) + (p.director ? ' · Dir. ' + esc(p.director) : '') + '</span>'
        : (p.director ? '<span class="work__credit">Directed by ' + esc(p.director) + '</span>' : '');
      var count = (p.images && p.images.length > 1) ? '<span class="work__count">1 / ' + p.images.length + '</span>' : '';
      return '<button type="button" class="work__item' + span + ' reveal" style="--d:' + (i % 6) + '" ' +
               'data-index="' + PROJECTS.indexOf(p) + '" data-cat="' + esc(p.category) + '">' +
               media +
               count +
               credit +
             '</button>';
    }

    function apertureMark() {
      return '<svg class="work__mark" viewBox="0 0 40 40" aria-hidden="true">' +
               '<circle cx="20" cy="20" r="18.5" fill="none" stroke="#C7CEDA" stroke-width="0.8"/>' +
               '<polygon points="20,6 32,13 32,27 20,34 8,27 8,13" fill="none" stroke="#C7CEDA" stroke-width="0.8"/>' +
             '</svg>';
    }

    /* Grid videos only decode/play while their tile is actually on
       screen — with 11 videography items, autoplaying all of them at
       once (even off-screen) was a real jank/battery/memory hazard. */
    var videoIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) v.play().catch(function () {});
        else v.pause();
      });
    }, { rootMargin: '200px 0px' }) : null;

    function render(items) {
      grid.innerHTML = items.length
        ? items.map(tile).join('')
        : '<p class="work__empty">No projects in this category yet.</p>';
      initReveal();
      if (videoIO) {
        $$('.work__video', grid).forEach(function (v) { videoIO.observe(v); });
      } else if (!reduced) {
        $$('.work__video', grid).forEach(function (v) { v.play().catch(function () {}); });
      }
    }

    render(pool);

    /* Filters */
    var filterHost = $('[data-filters]');
    if (filterHost && typeof CATEGORIES !== 'undefined') {
      filterHost.innerHTML = CATEGORIES.map(function (c) {
        var n = c.key === 'all' ? pool.length : pool.filter(function (p) { return p.category === c.key; }).length;
        if (!n) return '';
        return '<button type="button" class="filter' + (c.key === 'all' ? ' is-active' : '') + '" data-filter="' + esc(c.key) + '">' +
                 esc(c.label) + '<span class="filter__count">' + n + '</span></button>';
      }).join('');

      filterHost.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter');
        if (!btn) return;
        $$('.filter', filterHost).forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var key = btn.getAttribute('data-filter');
        render(key === 'all' ? pool : pool.filter(function (p) { return p.category === key; }));
      });
    }

    /* Lightbox */
    var lb = $('.lb');
    if (!lb) return;
    var lastFocus = null;

    function renderCarousel(media, images) {
      var idx = 0;
      media.removeAttribute('style');
      media.innerHTML =
        '<div class="lb__carousel">' +
          '<div class="lb__track">' +
            images.map(function (src) {
              return '<div class="lb__slide" style="background-image:url(\'' + esc(src) + '\')"></div>';
            }).join('') +
          '</div>' +
          '<button type="button" class="lb__arrow lb__arrow--prev" aria-label="Previous photo">‹</button>' +
          '<button type="button" class="lb__arrow lb__arrow--next" aria-label="Next photo">›</button>' +
          '<div class="lb__dots">' +
            images.map(function (_, i) { return '<button type="button" class="lb__dot' + (i === 0 ? ' is-active' : '') + '" aria-label="Photo ' + (i + 1) + '"></button>'; }).join('') +
          '</div>' +
        '</div>';

      var track = $('.lb__track', media);
      var dots = $$('.lb__dot', media);

      function go(i) {
        idx = ((i % images.length) + images.length) % images.length;
        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        dots.forEach(function (d, j) { d.classList.toggle('is-active', j === idx); });
      }

      $('.lb__arrow--prev', media).addEventListener('click', function () { go(idx - 1); });
      $('.lb__arrow--next', media).addEventListener('click', function () { go(idx + 1); });
      dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

      var startX = null;
      track.addEventListener('pointerdown', function (e) { startX = e.clientX; });
      track.addEventListener('pointerup', function (e) {
        if (startX == null) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
        startX = null;
      });

      lb.__carouselNav = function (dir) { go(idx + dir); };
    }

    function open(p) {
      var media = $('.lb__media', lb);
      lb.__carouselNav = null;
      if (p.images && p.images.length > 1) {
        renderCarousel(media, p.images);
      } else if (p.video) {
        media.removeAttribute('style');
        media.innerHTML = '<video src="' + esc(p.video) + '" controls autoplay playsinline' +
          (p.image ? ' poster="' + esc(p.image) + '"' : '') + '></video>';
      } else {
        media.innerHTML = '';
        media.setAttribute('style', "background-image:url('" + esc(p.image) + "');");
      }

      var caption = $('.lb__caption', lb);
      if (caption) {
        var hasCreator = p.creator && typeof TEAM !== 'undefined' &&
          TEAM.some(function (m) { return m.name === p.creator; });
        if (hasCreator) {
          var nameText = 'Shot by ' + esc(p.creator) + (p.director ? ' · Directed by ' + esc(p.director) : '');
          caption.classList.add('is-visible');
          caption.innerHTML =
            '<span class="lb__caption-name">' + nameText + '</span>' +
            '<a href="/creatives#' + slugify(p.creator) + '">View their profile →</a>';
        } else {
          caption.classList.remove('is-visible');
          caption.innerHTML = '';
        }
      }

      lastFocus = document.activeElement;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      $('.lb__close', lb).focus();
    }

    function close() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      var vid = $('.lb__media video', lb);
      if (vid) vid.pause();
      if (lastFocus) lastFocus.focus();
    }

    grid.addEventListener('click', function (e) {
      var item = e.target.closest('.work__item');
      if (!item) return;
      open(PROJECTS[parseInt(item.getAttribute('data-index'), 10)]);
    });

    $('.lb__close', lb).addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && lb.__carouselNav) lb.__carouselNav(-1);
      else if (e.key === 'ArrowRight' && lb.__carouselNav) lb.__carouselNav(1);
    });
  }

  /* ---------------------------------------------------------- */
  /* Creatives directory (Creatives page)                        */
  /* ---------------------------------------------------------- */
  function initCreatives() {
    var host = $('[data-creatives]');
    if (!host || typeof TEAM === 'undefined') return;

    if (!TEAM.length) {
      host.innerHTML = '<p class="work__empty">The creatives directory is being built out — check back soon, or see the <a href="/portfolio">Work page</a> for recent shoots.</p>';
      return;
    }

    var order = (typeof ROLE_ORDER !== 'undefined') ? ROLE_ORDER : [];
    var roles = order.slice();
    TEAM.forEach(function (p) {
      if (roles.indexOf(p.role) === -1) roles.push(p.role);
    });

    function contactRow(icon, value, href) {
      if (!value) return '';
      return '<a class="roster-row__contact-item" href="' + esc(href) + '"' +
             (href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' +
             esc(value) + '</a>';
    }

    host.innerHTML = roles.map(function (role) {
      var members = TEAM.filter(function (p) { return p.role === role; });
      if (!members.length) return '';

      var rows = members.map(function (p, i) {
        var slug = slugify(p.name);
        var hasWork = typeof PROJECTS !== 'undefined' &&
          PROJECTS.some(function (proj) { return proj.creator === p.name || proj.director === p.name; });
        return '<article class="roster-row reveal" style="--d:' + (i % 6) + '" id="' + slug + '">' +
                 '<span class="roster-row__photo' + (p.photoTall ? ' roster-row__photo--tall' : '') + '" style="' + toneVars(i) + (p.photo ? "background-image:url('" + p.photo + "');background-position:" + (p.photoPosition || 'center top') + ';' : '') + '">' +
                   (p.photo ? '' : apertureMarkSmall()) +
                 '</span>' +
                 '<span class="roster-row__info">' +
                   '<span class="roster-row__name">' + esc(p.name) + '</span>' +
                   (p.bio ? '<p class="roster-row__bio">' + esc(p.bio) + '</p>' : '') +
                   (hasWork ? '<a class="roster-row__work-link" href="/portfolio?creator=' + slug + '">See their work →</a>' : '') +
                 '</span>' +
                 '<span class="roster-row__contact">' +
                   contactRow('email', p.email, 'mailto:' + p.email) +
                   contactRow('phone', p.phone, 'tel:' + String(p.phone).replace(/[^\d+]/g, '')) +
                   contactRow('instagram', p.instagram, p.instagram ? 'https://instagram.com/' + p.instagram.replace('@', '') : '') +
                   contactRow('instagram', p.instagram2, p.instagram2 ? 'https://instagram.com/' + p.instagram2.replace('@', '') : '') +
                   contactRow('tiktok', p.tiktok, p.tiktok ? 'https://www.tiktok.com/@' + p.tiktok.replace('@', '') : '') +
                   contactRow('website', p.website, p.website || '') +
                 '</span>' +
               '</article>';
      }).join('');

      return '<div class="roster-group">' +
               '<p class="roster-group__title reveal">' + esc(role) + '</p>' +
               rows +
             '</div>';
    }).join('');

    initReveal();
  }

  function apertureMarkSmall() {
    return '<svg class="work__mark" viewBox="0 0 40 40" aria-hidden="true">' +
             '<circle cx="20" cy="20" r="18.5" fill="none" stroke="#C7CEDA" stroke-width="0.8"/>' +
             '<polygon points="20,6 32,13 32,27 20,34 8,27 8,13" fill="none" stroke="#C7CEDA" stroke-width="0.8"/>' +
           '</svg>';
  }

  /* ---------------------------------------------------------- */
  /* Studio details written into the page                        */
  /* ---------------------------------------------------------- */
  function initDetails() {
    if (typeof STUDIO === 'undefined') return;
    $$('[data-studio]').forEach(function (el) {
      var key = el.getAttribute('data-studio');
      var val = STUDIO[key];
      if (val == null) return;
      if (el.tagName === 'A') {
        if (key === 'email')     { el.href = 'mailto:' + val; el.textContent = val; }
        else if (key === 'phone'){ el.href = 'tel:' + STUDIO.phoneHref; el.textContent = val; }
        else if (key === 'instagram') { el.href = val; el.textContent = STUDIO.igHandle; }
        else if (key === 'facebook')  { el.href = val; el.textContent = STUDIO.fbName || 'Facebook'; }
        else if (key === 'tiktok')    { el.href = val; el.textContent = STUDIO.ttHandle || 'TikTok'; }
        else el.textContent = val;
      } else {
        el.textContent = val;
      }
    });
  }

  /* ---------------------------------------------------------- */
  /* Founder section (About page)                                */
  /* ---------------------------------------------------------- */
  function initFounder() {
    var host = $('[data-founder]');
    if (!host || typeof FOUNDER === 'undefined') return;

    var photo = FOUNDER.photo
      ? '<div class="founder__photo" style="background-image:url(\'' + FOUNDER.photo + '\')"></div>'
      : '<div class="founder__photo founder__photo--placeholder"><span class="meta">Photo coming soon</span></div>';

    host.innerHTML =
      '<div class="founder__media reveal">' + photo + '</div>' +
      '<div class="founder__body">' +
        '<p class="eyebrow reveal">' + esc(FOUNDER.role) + '</p>' +
        '<h2 class="display-m reveal" style="--d:1">' + esc(FOUNDER.name) + '</h2>' +
        '<div class="founder__story mt-md">' +
          FOUNDER.story.map(function (s, i) {
            return '<div class="founder__chapter reveal" style="--d:' + (i + 2) + '">' +
                     '<p class="meta">' + esc(s.title) + '</p>' +
                     '<p class="body-copy">' + esc(s.text) + '</p>' +
                   '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------- */
  /* Photo booth add-ons (Photo Booth page)                      */
  /* ---------------------------------------------------------- */
  function initAddons() {
    var host = $('[data-addons]');
    if (!host || typeof BOOTH_ADDONS === 'undefined') return;

    var rows = BOOTH_ADDONS.map(function (a) {
      return '<div class="plate__row"><span class="meta">' + esc(a.name) + '</span><span class="plate__val">' + esc(a.price) + '</span></div>';
    }).join('');

    host.innerHTML = rows;

    var bizHost = $('[data-business-addons]');
    if (bizHost && typeof BUSINESS_ADDONS !== 'undefined') {
      bizHost.innerHTML = BUSINESS_ADDONS.map(function (a) {
        return '<div class="plate__row"><span class="meta">' + esc(a.name) + '</span><span class="plate__val">' + esc(a.price) + '</span></div>';
      }).join('');
    }
  }

  /* ---------------------------------------------------------- */
  /* Contact form                                                */
  /* ---------------------------------------------------------- */
  function initForm() {
    var form = $('.form');
    if (!form) return;
    var status = $('.form__status', form);
    var submit = $('[type="submit"]', form);

    /* Pre-select "Photo Booth" when arriving from the booth page */
    var pkg = new URLSearchParams(window.location.search).get('package');
    var project = form.elements.project;
    if (pkg && project) {
      for (var i = 0; i < project.options.length; i++) {
        if (project.options[i].value === 'Photo Booth') { project.selectedIndex = i; break; }
      }
      var note = $('.form__note');
      if (note) note.insertAdjacentHTML('beforebegin',
        '<p class="meta" style="margin:-8px 0 4px">Package selected: <strong style="color:var(--ink)">' + esc(pkg) + '</strong></p>');
    }

    /* /book?service=Photography pre-selects that service (ad deep links) */
    var svc = new URLSearchParams(window.location.search).get('service');
    if (svc && project) {
      for (var j = 0; j < project.options.length; j++) {
        if (project.options[j].value === svc) { project.selectedIndex = j; break; }
      }
    }

    var checkSvg = '<span class="form__status-check"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

    function showOk(text) {
      status.className = 'form__status is-ok';
      status.innerHTML = checkSvg + '<span>' + esc(text) + '</span>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });

      if (!STUDIO.formEndpoint) {
        /* No backend wired up yet — hand the message to the visitor's
           email app rather than silently dropping it. */
        var body = Object.keys(data).map(function (k) {
          return k.charAt(0).toUpperCase() + k.slice(1) + ': ' + data[k];
        }).join('\n');
        window.location.href = 'mailto:' + STUDIO.email +
          '?subject=' + encodeURIComponent('Project enquiry — ' + (data.name || 'Website')) +
          '&body=' + encodeURIComponent(body);
        showOk('Opening your email app with the details filled in.');
        return;
      }

      submit.disabled = true;
      status.className = 'form__status';
      status.textContent = 'Sending…';

      fetch(STUDIO.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        showOk(data.source ? 'Request received. We will reply within 24 hours to confirm your date.' : 'Thanks — we read every enquiry and reply within 3 days.');
        if (typeof gtag === 'function') gtag('event', 'ads_conversion_Contact_Us_1', {});
      }).catch(function () {
        status.className = 'form__status is-err';
        status.textContent = 'That did not send. Email ' + STUDIO.email + ' and we will pick it up there.';
      }).then(function () {
        submit.disabled = false;
      });
    });
  }

  /* ---------------------------------------------------------- */
  /* 360 photo booth viewer                                       */
  /* ---------------------------------------------------------- */
  function initBooth360() {
    var hosts = document.querySelectorAll('[data-booth360]');
    hosts.forEach(function (host) { initBooth360One(host); });
  }

  function initBooth360One(host) {
    var FRAMES = 8;
    var urls = [];
    for (var i = 0; i < FRAMES; i++) {
      urls.push('/img/booth-360/booth-' + (i < 10 ? '0' + i : i) + '.png');
    }
    urls.forEach(function (u) { var img = new Image(); img.src = u; });

    var stage = document.createElement('div');
    stage.className = 'booth360__stage';
    host.appendChild(stage);

    var frame = 0;
    function render() { stage.style.backgroundImage = "url('" + urls[frame] + "')"; }
    render();

    var STEP_PX = 26;
    var dragging = false;
    var startX = 0;
    var startFrame = 0;
    var idleTimer = null;
    var idleDir = 1;

    function stopIdle() { if (idleTimer) { clearInterval(idleTimer); idleTimer = null; } }
    function startIdle() {
      if (reduced) return;
      stopIdle();
      idleTimer = setInterval(function () {
        frame = (frame + idleDir + FRAMES) % FRAMES;
        render();
      }, 700);
    }

    function onDown(e) {
      dragging = true;
      stopIdle();
      host.classList.add('is-dragging');
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startFrame = frame;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      /* touch-action: pan-y hands vertical swipes to the browser, which fires
         pointercancel instead of pointerup. Without this the viewer stayed
         "dragging" after a phone visitor scrolled past it: the hint vanished,
         auto-rotate never resumed, and later touches elsewhere spun it. */
      window.addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      var delta = x - startX;
      var steps = Math.round(delta / STEP_PX);
      frame = ((startFrame - steps) % FRAMES + FRAMES) % FRAMES;
      render();
    }
    function onUp() {
      dragging = false;
      host.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    host.addEventListener('pointerdown', onDown);
    host.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* A quiet auto-rotate hint until the visitor takes over */
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !dragging) startIdle();
        else stopIdle();
      });
    }, { threshold: 0.4 }) : null;
    if (io) io.observe(host); else startIdle();
  }

  /* ---------------------------------------------------------- */
  /* Chat widget                                                  */
  /* ---------------------------------------------------------- */
  function initChat() {
    var CHAT_ENDPOINT = 'https://www.evanenterprise.com/api/agent?action=chat';
    var BOT_SLUG = 'studio27';

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button class="chat-launcher" type="button" aria-label="Chat with Studio 27">' +
        '<span class="chat-launcher__dot" aria-hidden="true"></span>' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M4 12c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8-3.8 8-8.5 8c-.9 0-1.8-.13-2.6-.38-.8.6-1.9 1.15-3.2 1.4-.3.06-.5-.24-.4-.5.35-.85.55-1.7.6-2.4C5.2 16.7 4 14.5 4 12z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
        '</svg>' +
      '</button>' +
      '<div class="chat-panel" role="dialog" aria-modal="false" aria-label="Studio 27 chat">' +
        '<div class="chat-panel__head">' +
          '<div class="chat-panel__who">' +
            '<div class="chat-panel__avatar">S27</div>' +
            '<div><span class="chat-panel__name">Studio 27</span><span class="chat-panel__status">● Online</span></div>' +
          '</div>' +
          '<button class="chat-panel__close" type="button" aria-label="Close chat">✕</button>' +
        '</div>' +
        '<div class="chat-panel__body"></div>' +
        '<form class="chat-panel__input">' +
          '<input type="text" placeholder="Ask about booking, pricing, the space…" autocomplete="off">' +
          '<button type="submit">Send</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);

    var launcher = $('.chat-launcher');
    var panel = $('.chat-panel');
    var closeBtn = $('.chat-panel__close');
    var body = $('.chat-panel__body');
    var form = $('.chat-panel__input');
    var input = $('.chat-panel__input input');
    var sendBtn = $('.chat-panel__input button');

    var messages = [];
    var opened = false;

    function addMsg(kind, text) {
      var el = document.createElement('div');
      el.className = 'chat-msg chat-msg--' + kind;
      el.textContent = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return el;
    }

    function open() {
      panel.classList.add('is-open');
      launcher.classList.add('is-hidden');
      if (!opened) {
        opened = true;
        addMsg('bot', "Hey! Ask me about booking, pricing, or any of our services — photography, video, barbering, and the iPad photo booth.");
      }
      input.focus();
    }

    function close() {
      panel.classList.remove('is-open');
      launcher.classList.remove('is-hidden');
    }

    launcher.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendBtn.disabled = true;
      addMsg('user', text);
      messages.push({ role: 'user', content: text });

      var typing = addMsg('typing', 'Typing…');

      fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, botSlug: BOT_SLUG })
      }).then(function (r) { return r.json(); }).then(function (data) {
        typing.remove();
        if (data.configured === false) {
          addMsg('bot', 'Chat isn\'t fully set up yet — send a message through the contact page and we\'ll get back to you within 3 days.');
        } else if (data.reply) {
          addMsg('bot', data.reply);
          messages.push({ role: 'assistant', content: data.reply });
        } else {
          addMsg('bot', 'Sorry, something went wrong. Try again in a moment, or reach us through the contact page.');
        }
      }).catch(function () {
        typing.remove();
        addMsg('bot', 'Sorry, something went wrong. Try again in a moment, or reach us through the contact page.');
      }).then(function () {
        sendBtn.disabled = false;
        input.focus();
      });
    });
  }

  /* ---------------------------------------------------------- */
  function boot() {
    initDetails();
    initNav();
    initIris();
    initServices();
    initBooth();
    initWork();
    initCreatives();
    initFounder();
    initAddons();
    initBooth360();
    initForm();
    initChat();
    initReveal();
    /* initLogoIntro() returns true when it will call ready() itself
       once the intro finishes — the page (and the nav-link wave) is
       meant to reveal after the intro, not underneath/before it. */
    if (!initLogoIntro()) ready();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
