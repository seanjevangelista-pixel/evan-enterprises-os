# Homepage Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `index.html` to reposition Evan Enterprises around Marketing (Ad Management, Website Building, Content Creation, UGC Work) as a solo-operator offer, dropping the old AI Front Desk / Distribution pitch and the broken chatbot demo, on a new black/navy/white visual system.

**Architecture:** Single-file static HTML/CSS/JS edit (no build step, no framework, no test runner). "Testing" for each task means: make the change, preview `index.html` in the browser pane, visually verify the specific thing that task changed, check the browser console for JS errors, then commit.

**Tech Stack:** Vanilla HTML/CSS/JS, IBM Plex Sans + IBM Plex Mono (Google Fonts), no other dependencies.

## Global Constraints

- No new files, no build step — everything stays inline in `index.html`, matching the existing repo convention (per `CLAUDE.md`).
- Colors: ground `#0A0A0C`, panel/navy `#0F1B33`, white `#F7F7F5`, body gray `#9A9C9F`, accent blue `#3B5BDB`.
- Typography: IBM Plex Sans (400/500/600/700) for all headings and body text, IBM Plex Mono for small uppercase eyebrow/label text only. No serif, no italic accent, no Anton.
- Keep the existing `.rv` scroll-reveal pattern and its `prefers-reduced-motion` guard — do not remove or alter that mechanism.
- Do not touch `api/*.js`, `dashboard/index.html`, or `portal/index.html`.
- Every commit message must end with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` (per `CLAUDE.md`).
- Ad Management proof copy must NOT claim specific Mediterranean Spa metrics (that account's Google Ads suspension status was never confirmed resolved in this project) — use capability/process framing instead.

---

### Task 1: Visual system foundation (tokens, fonts, meta tags)

**Files:**
- Modify: `index.html:9` (theme-color meta)
- Modify: `index.html:10-12` (description/og meta tags)
- Modify: `index.html:16` (Google Fonts link)
- Modify: `index.html:19-37` (`:root` tokens)
- Modify: `index.html:6` (title)

**Interfaces:**
- Produces: new CSS custom properties `--ink`, `--panel`, `--white`, `--body`, `--dim`, `--accent` (replaces `--silver`/`--silver-dim`/`--chrome-grad`/`--on-silver`), `--fd` (now IBM Plex Sans 700, not Anton), `--fb`, `--fm` — all later tasks reference these names.
- Every later task that writes new markup uses `--accent` (not `--silver`) for link/label color, and never references `--fd` for large headline type (headings use `--fb` at weight 600/700 directly, matching the "single typeface, no serif" rule) — `--fd` is kept only so old not-yet-rewritten sections (removed in later tasks) don't throw a missing-variable render glitch mid-plan.

- [ ] **Step 1: Update the page title and meta tags**

Replace:
```html
<title>Evan Enterprises LLC — The operator behind local business</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0E0E0D">
<meta name="description" content="An AI front desk that answers every call, texts back the ones it misses, and books the job instantly. Try it live. Plus ad management and product leads. Evan Enterprises LLC, Austin TX.">
<meta property="og:title" content="Evan Enterprises LLC — An AI front desk that never misses a call">
<meta property="og:description" content="It picks up every call, texts back the ones it misses, and books the job — instantly, day or night. Try the AI live on the site.">
<meta property="og:type" content="website">
```
with:
```html
<title>Evan Enterprises LLC — Marketing built by one person who does the work</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0A0A0C">
<meta name="description" content="Ad management, website builds, content creation, and UGC — all done personally by Sean Evangelista. No account managers, no hand-offs. Evan Enterprises LLC, Austin TX.">
<meta property="og:title" content="Evan Enterprises LLC — Marketing built by one person who does the work">
<meta property="og:description" content="Ad management, website builds, content creation, and UGC — all done personally. No account managers, no hand-offs.">
<meta property="og:type" content="website">
```

- [ ] **Step 2: Swap the Google Fonts import (drop Anton)**

Replace:
```html
<link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
with:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Replace the `:root` token block**

Replace the whole block:
```css
/* ═══════════ TOKENS · "Dispatch" — chrome / white / black ═══════════ */
:root{
  --ink:#0E0E0D;         /* ground — cool near-black */
  --panel:#18181A;       /* panel */
  --raised:#212124;      /* raised */
  --white:#FBFBFA;       /* primary type — white */
  --body:#B5B6B2;        /* running text */
  --dim:#84857F;         /* muted, cool-neutral */
  --silver:#DADCE0;      /* accent — brushed chrome */
  --silver-dim:#8E9098;  /* secondary chrome, quieter */
  --on-silver:#0C0C0B;   /* text on silver fills */
  --chrome-grad:linear-gradient(120deg,#9A9CA2 0%,#F5F6F8 22%,#C6C8CE 45%,#F5F6F8 68%,#9A9CA2 100%);
  --miss:#E4553E;        /* semantic: missed */
  --book:#35C77A;        /* semantic: booked */
  --hair:rgba(251,251,250,.10);
  --fd:'Anton',Impact,sans-serif;
  --fb:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  --fm:'IBM Plex Mono',ui-monospace,monospace;
  --max:1180px;
}
.chrome{background:var(--chrome-grad);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 5s ease-in-out infinite}
@keyframes shimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@media(prefers-reduced-motion:reduce){.chrome{animation:none;background-position:35% 50%}}
```
with:
```css
/* ═══════════ TOKENS · black / navy / white ═══════════ */
:root{
  --ink:#0A0A0C;         /* ground — near-black */
  --panel:#0F1B33;       /* navy panel */
  --white:#F7F7F5;       /* primary type — white */
  --body:#9A9C9F;        /* running text */
  --dim:#7A7C80;         /* muted */
  --accent:#3B5BDB;      /* accent — blue */
  --on-accent:#F7F7F5;   /* text on accent fills */
  --hair:rgba(247,247,245,.10);
  --fd:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  --fb:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  --fm:'IBM Plex Mono',ui-monospace,monospace;
  --max:1180px;
}
```

Note: this step drops `--raised`/`--silver`/`--silver-dim`/`--on-silver`/`--chrome-grad`/`--miss`/`--book`/`.chrome`/`@keyframes shimmer` entirely (no later task needs a "raised navy" surface — every card in the new design uses flat `--panel`). Later tasks (2–10) remove every remaining usage of those old names as they rewrite or delete each section — do not search-and-replace them globally in this step, since sections not yet rewritten are deleted wholesale in later tasks anyway, not restyled in place.

- [ ] **Step 4: Preview and verify**

Run:
```bash
open /Users/seanevangelista/Desktop/evan-enterprises-os/index.html
```
Expected: the page still loads (later sections will look visually broken/unstyled in places referencing deleted variables like `--silver` — that's expected and fixed in Tasks 2–8, not this one). Check the browser console: there should be no *new* JS errors (CSS referencing a missing custom property never throws — it just falls back to `unset`, so this is safe by design).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Replace Dispatch chrome/black tokens with black/navy/white system" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Nav simplification

**Files:**
- Modify: `index.html` nav block (originally lines 245–264)

**Interfaces:**
- Consumes: `--fb`, `--white`, `--dim`, `--hair`, `--accent` from Task 1
- Produces: nav now links only to `#marketing`, `#about`, `#contact` — later tasks' section `id` attributes must match these exactly (`id="marketing"` on the new Marketing section from Task 4, `id="about"` unchanged, `id="contact"` unchanged).

- [ ] **Step 1: Replace the nav markup**

Replace:
```html
<nav>
  <div class="nav-in">
    <a href="/" class="logo"><img src="logo-mark.png" alt="">Evan<b>·</b>Enterprises</a>
    <div class="nav-links">
      <a href="#frontdesk">AI Front Desk</a>
      <a href="#marketing">Marketing</a>
      <a href="#distribution">Distribution</a>
      <a href="#about">About</a>
      <a href="#contact" class="nav-cta">Book a call</a>
    </div>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
  <div class="mobile-menu" id="mobileMenu">
    <a href="#frontdesk">AI Front Desk</a>
    <a href="#marketing">Marketing</a>
    <a href="#distribution">Distribution</a>
    <a href="#about">About</a>
    <a href="#contact">Book a call →</a>
  </div>
</nav>
```
with:
```html
<nav>
  <div class="nav-in">
    <a href="/" class="logo"><img src="logo-mark.png" alt="">Evan<b>·</b>Enterprises</a>
    <div class="nav-links">
      <a href="#marketing">Marketing</a>
      <a href="#about">About</a>
      <a href="#contact" class="nav-cta">Book a call</a>
    </div>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
  <div class="mobile-menu" id="mobileMenu">
    <a href="#marketing">Marketing</a>
    <a href="#about">About</a>
    <a href="#contact">Book a call →</a>
  </div>
</nav>
```

- [ ] **Step 2: Update the `.logo b` and `.nav-cta` CSS to use the new accent token**

Replace:
```css
.logo b{color:var(--silver);font-weight:400}
```
with:
```css
.logo b{color:var(--accent);font-weight:400}
```

Replace:
```css
.nav-cta{background:var(--silver);color:var(--on-silver);padding:9px 17px;font-weight:700;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;transition:.16s}
.nav-cta:hover{background:#EEEFF1;color:var(--on-silver)}
```
with:
```css
.nav-cta{background:var(--accent);color:var(--on-accent);padding:9px 17px;font-weight:700;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;transition:.16s}
.nav-cta:hover{background:#4A6BF0;color:var(--on-accent)}
```

- [ ] **Step 3: Preview and verify**

Open `index.html` in the browser pane, screenshot the nav bar. Confirm: only "Marketing / About / Book a call" show (no "AI Front Desk" / "Distribution"), the logo's middle dot and "Book a call" button render in blue, not silver/gray. Click the burger menu on a narrow viewport and confirm the mobile menu shows the same three links.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Simplify nav to Marketing/About/Contact" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Hero rewrite (remove "Today's Board" signature entirely)

**Files:**
- Modify: `index.html` hero block (originally lines 267–291)
- Modify: `index.html` — remove `.board*`, `.live`, `.brow`, `.st`, `@keyframes blip` CSS (originally lines 85–101)
- Modify: `index.html` — remove the hero grid/CTA CSS's chrome-gradient button style (originally lines 70–83, keep the layout rules, replace only the `--chrome-grad`-dependent bits)
- Modify: `index.html` — remove the "the board" JS IIFE (originally lines 618–650)

**Interfaces:**
- Consumes: `--ink`, `--panel`, `--white`, `--body`, `--accent`, `--fb`, `--hair` from Task 1
- Produces: hero section now has no `#rows`/`#counter` elements and no board-related JS — Task 4 onward must not assume those IDs exist.

- [ ] **Step 1: Replace the hero markup**

Replace:
```html
<!-- HERO -->
<header class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">AI Front Desk · Evan Enterprises LLC</div>
      <h1 class="disp">An AI that never<br>lets a <em class="chrome">call</em><br>go unanswered.</h1>
      <p class="hero-sub">It picks up every call, texts back the ones it misses, and books the job — instantly, day or night. Ask it something right now; the chat bubble in the corner is the real thing, not a mockup.</p>
      <div class="hero-cta">
        <a href="#bots" class="btn btn-p">Try the AI now →</a>
        <a href="#contact" class="btn btn-s">Book a free call</a>
      </div>
    </div>

    <div class="board" aria-hidden="true">
      <div class="board-top">
        <span class="board-t">Today's board</span>
        <span class="live"><i></i>Live</span>
      </div>
      <div id="rows"></div>
      <div class="board-foot">
        <span class="n tnum" id="counter">0</span>
        <span class="l">calls captured<br>that would've hit voicemail</span>
      </div>
    </div>
  </div>
</header>
```
with:
```html
<!-- HERO -->
<header class="hero">
  <div class="wrap">
    <div class="eyebrow">Evan Enterprises LLC — Sean Evangelista</div>
    <h1 class="hero-h1">Marketing built by <span class="accent-t">one person</span> who does the work.</h1>
    <p class="hero-sub">Ad management, website builds, content creation, and UGC. No account managers, no hand-offs — every video, every ad account, every site, I build it myself.</p>
    <div class="hero-cta">
      <a href="#marketing" class="btn btn-p">See my work →</a>
      <a href="#contact" class="btn btn-s">Book a call →</a>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Replace the hero CSS block**

Replace:
```css
/* ═══════════ HERO ═══════════ */
.hero{padding:148px 0 88px}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:54px;align-items:center}
.hero h1{font-size:clamp(42px,6.5vw,78px);margin:18px 0 0}
.hero h1 em{font-style:normal;color:var(--silver)}
.hero-sub{margin-top:22px;max-width:46ch;font-size:18px;color:var(--body)}
.hero-cta{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--fb);font-weight:600;font-size:15.5px;padding:14px 25px;border:0;cursor:pointer;transition:.16s}
.btn-p{background:var(--chrome-grad);background-size:220% 100%;background-position:30% 50%;color:var(--on-silver);font-weight:700;transition:.35s}
.btn-p:hover{background-position:70% 50%;transform:translateY(-2px)}
.btn-p:disabled{opacity:.6;cursor:default;transform:none}
.btn-s{border:1px solid var(--hair);color:var(--white);background:transparent}
.btn-s:hover{border-color:var(--dim);background:var(--panel)}
@media(max-width:940px){.hero-grid{grid-template-columns:1fr;gap:40px}.hero{padding:124px 0 72px}}

/* ── the board (signature) ── */
.board{background:var(--panel);border:1px solid var(--hair);box-shadow:0 24px 60px rgba(0,0,0,.5)}
.board-top{display:flex;align-items:center;justify-content:space-between;padding:13px 17px;border-bottom:1px solid var(--hair);background:#111112}
.board-t{font-family:var(--fm);font-size:11.5px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--dim)}
.live{display:flex;align-items:center;gap:7px;font-family:var(--fm);font-size:10.5px;letter-spacing:.14em;color:var(--book);text-transform:uppercase}
.live i{width:7px;height:7px;border-radius:50%;background:var(--book);animation:blip 1.7s infinite}
@keyframes blip{0%,100%{opacity:1}50%{opacity:.25}}
.brow{display:grid;grid-template-columns:60px 1fr 92px;gap:11px;align-items:center;padding:13px 17px;border-bottom:1px solid var(--hair);font-size:14px}
.brow .t{font-family:var(--fm);font-size:12px;color:var(--dim)}
.brow .who{font-weight:500;line-height:1.35}
.brow .who small{display:block;color:var(--dim);font-size:12px;font-weight:400;margin-top:2px}
.st{font-family:var(--fm);font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;padding:4px 7px;text-align:center;transition:.4s}
.st.m{background:rgba(228,85,62,.16);color:var(--miss)}
.st.b{background:rgba(61,209,127,.16);color:var(--book)}
.board-foot{display:flex;align-items:center;gap:13px;padding:15px 17px;background:#111112;border-top:1px solid var(--hair)}
.board-foot .n{font-family:var(--fd);font-size:34px;color:var(--silver);line-height:1}
.board-foot .l{font-family:var(--fm);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);line-height:1.5}
```
with:
```css
/* ═══════════ HERO ═══════════ */
.hero{padding:148px 0 88px}
.hero-h1{font-family:var(--fb);font-weight:700;font-size:clamp(38px,6vw,64px);line-height:1.15;margin:18px 0 0;letter-spacing:-.01em;max-width:16ch}
.accent-t{color:var(--accent)}
.hero-sub{margin-top:22px;max-width:52ch;font-size:18px;color:var(--body)}
.hero-cta{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--fb);font-weight:600;font-size:15.5px;padding:14px 25px;border:0;cursor:pointer;transition:.16s}
.btn-p{background:var(--white);color:var(--ink);font-weight:700}
.btn-p:hover{opacity:.85;transform:translateY(-2px)}
.btn-p:disabled{opacity:.6;cursor:default;transform:none}
.btn-s{border:1px solid var(--hair);color:var(--white);background:transparent}
.btn-s:hover{border-color:var(--dim);background:var(--panel)}
@media(max-width:940px){.hero{padding:124px 0 72px}}
```

- [ ] **Step 3: Remove the "the board" JS IIFE**

Delete this entire block from the `<script>` section:
```js
// ── the board ──
(function(){
  var calls=[
    {t:'7:42a',w:'Unknown — Cedar Park',s:'Water heater leaking'},
    {t:'11:08a',w:'Unknown — Round Rock',s:'Quote for a rebuild'},
    {t:'1:26p',w:'Unknown — South Austin',s:'AC not cooling'},
    {t:'6:03p',w:'Unknown — Pflugerville',s:'After-hours callback'},
    {t:'9:17p',w:'Unknown — Kyle',s:'Drain backing up'}
  ];
  var rows=document.getElementById('rows');
  if(!rows) return;
  calls.forEach(function(c){
    rows.insertAdjacentHTML('beforeend',
      '<div class="brow"><span class="t tnum">'+c.t+'</span>'+
      '<span class="who">'+c.w+'<small>'+c.s+'</small></span>'+
      '<span class="st m">Missed</span></div>');
  });
  var counter=document.getElementById('counter');
  var sts=Array.prototype.slice.call(document.querySelectorAll('.st'));
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ sts.forEach(function(s){s.className='st b';s.textContent='Booked';}); counter.textContent=sts.length; return; }
  var n=0,i=0;
  function flip(){
    if(i>=sts.length) return;
    sts[i].className='st b'; sts[i].textContent='Booked';
    n++; counter.textContent=n; i++;
    setTimeout(flip,900);
  }
  var start=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ setTimeout(flip,700); start.disconnect(); } });
  },{threshold:.3});
  start.observe(rows);
})();
```

- [ ] **Step 4: Preview and verify**

Open `index.html` in the browser pane, screenshot the hero. Confirm: no board/call-list panel renders, headline reads "Marketing built by one person who does the work." with "one person" in blue, two CTA buttons show ("See my work →" solid white, "Book a call →" outlined). Open the browser console — confirm no errors (the deleted IIFE referenced `#rows`/`#counter`, which no longer exist, but the block itself is fully removed so there's nothing left to error).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Rewrite hero, remove Today's Board animation" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Replace Services + Bots sections with the new Marketing section

**Files:**
- Modify: `index.html` — replace the `<section id="services">` block (originally lines 293–328) and the entire `<section id="bots">` block (originally lines 330–388) with one new `<section id="marketing">`
- Modify: `index.html` — remove `.svcs*`, `.svc*`, `.scn*`, `.nudge`, `.urgency` CSS (originally lines 109–172, keeping only rules still referenced elsewhere — none are)

**Interfaces:**
- Consumes: `--panel`, `--white`, `--body`, `--dim`, `--accent`, `--hair`, `--fb`, `--fm`, `.rv`/`.sec`/`.sec-head`/`.wrap`/`.eyebrow` from Task 1 and the existing base CSS (unchanged)
- Produces: a `<section id="marketing">` that Task 2's nav link `#marketing` and Task 3's hero "See my work →" link both jump to. New CSS class names: `.mkt-grid`, `.mkt-card`, `.mkt-stat` — no other task reuses these names, so no cross-task signature to preserve beyond this.

- [ ] **Step 1: Replace the SERVICES and BOTS sections**

Replace everything from `<!-- SERVICES -->` through the closing `</section>` of the BOTS section (i.e. replace both sections together — originally lines 293–388) with:
```html
<!-- MARKETING -->
<section class="sec" id="marketing">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="eyebrow">What I do</div>
      <h2 class="sec-h2">One person. Every part<br>of your marketing.</h2>
      <p class="lede">Ad management, website builds, content creation, and UGC — no account managers, no hand-offs. You work directly with me on every part of it.</p>
    </div>
    <div class="mkt-grid rv">
      <div class="mkt-card">
        <div class="svc-tag">Ad Management</div>
        <h3>Google Ads &amp; Instagram, run end to end</h3>
        <p>Strategy, creative, and daily optimization — managed personally, not handed off to a junior account rep. Real numbers, no fluff.</p>
      </div>
      <div class="mkt-card">
        <div class="svc-tag">Website Building</div>
        <h3>Custom sites, built and shipped by me</h3>
        <p>From design to launch — a real example of the work:</p>
        <a href="https://legacyhardscapeatx.com" target="_blank" rel="noopener" class="svc-go">See a live build → legacyhardscapeatx.com</a>
      </div>
      <div class="mkt-card">
        <div class="svc-tag">Content Creation</div>
        <h3>Brand and marketing content</h3>
        <p>Photo, video, and copy for your brand's own channels — planned and produced around what you're actually trying to sell.</p>
      </div>
      <div class="mkt-card">
        <div class="svc-tag">UGC Work</div>
        <h3>Video content, backed by my own numbers</h3>
        <p>I create UGC and personal content across Instagram, TikTok, and YouTube — this isn't theoretical:</p>
        <div class="mkt-stats">
          <div class="mkt-stat"><span class="n">5.9M+</span><span class="l">Organic views</span></div>
          <div class="mkt-stat"><span class="n">30.9K</span><span class="l">TikTok followers</span></div>
        </div>
        <a href="https://seanjevangelista-pixel.github.io/seanjayme/" target="_blank" rel="noopener" class="svc-go">See full media kit →</a>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Replace the services/bots CSS with the new Marketing grid CSS**

Replace the entire block from `/* ── services ── */` through the end of the `/* ── bot scenarios ── */` block's media query (originally lines 109–140) with:
```css
/* ── marketing grid ── */
.mkt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.mkt-card{background:var(--panel);border:1px solid var(--hair);padding:30px 26px;display:flex;flex-direction:column}
.svc-tag{font-family:var(--fm);font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent)}
.mkt-card h3{font-family:var(--fb);font-weight:600;font-size:22px;margin:12px 0 11px;letter-spacing:-.01em}
.mkt-card p{font-size:15px;color:var(--body);flex:1}
.mkt-stats{display:flex;gap:22px;margin:18px 0}
.mkt-stat{display:flex;flex-direction:column}
.mkt-stat .n{font-family:var(--fb);font-weight:700;font-size:26px;color:var(--white);line-height:1}
.mkt-stat .l{font-family:var(--fm);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin-top:6px}
.svc-go{font-size:14px;font-weight:600;color:var(--accent)}
.svc-go:hover{text-decoration:underline;text-underline-offset:4px}
@media(max-width:900px){.mkt-grid{grid-template-columns:1fr}}
```

- [ ] **Step 3: Add the `.sec-h2` class used by the new section (and reused by remaining `.disp` headings until they're replaced in later tasks — for now just add it, don't remove `.disp` yet)**

Add this rule directly after the existing `.sec-head .lede{margin-top:16px;max-width:58ch}` line:
```css
.sec-h2{font-family:var(--fb);font-weight:700;font-size:clamp(28px,4.2vw,42px);margin-top:13px;letter-spacing:-.01em;line-height:1.15}
```

- [ ] **Step 4: Preview and verify**

Open `index.html` in the browser pane, navigate to `#marketing` (or click the nav link). Screenshot the section. Confirm: four cards render in a 2×2 grid (Ad Management, Website Building, Content Creation, UGC Work), the UGC card shows "5.9M+ / Organic views" and "30.9K / TikTok followers" as two stat blocks, the Website Building card links to `legacyhardscapeatx.com`, the UGC card links to the media kit. Click both links (in a new tab) and confirm they resolve (200 OK, not 404). Resize to mobile width and confirm the grid collapses to one column.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Replace Services/Bots sections with Marketing section (4 sub-services)" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Remove "How it works" pipeline section

**Files:**
- Modify: `index.html` — remove the `<section class="sec" id="how">` block (originally lines 390–418)
- Modify: `index.html` — remove `.pipe*` CSS (originally lines 142–153)
- Modify: `index.html` — remove the pipeline JS IIFE (originally lines 587–602)

**Interfaces:**
- Consumes: none (pure removal)
- Produces: nothing new — later tasks must not reference `#pipe`, `.pipe-step`, or `.pipe-line`.

- [ ] **Step 1: Remove the "How it works" section**

Delete this entire block:
```html
<!-- HOW IT WORKS -->
<section class="sec" id="how">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="eyebrow">How it actually works</div>
      <h2 class="disp">From missed call<br>to booked job.</h2>
      <p class="lede">Same pipeline behind every bot — the only thing that changes per business is the details it's trained on.</p>
    </div>
    <div class="pipe rv" id="pipe">
      <div class="pipe-line"><i></i></div>
      <div class="pipe-step" data-n="1">
        <h3>Customer reaches out</h3>
        <p>By call, text, or your website chat — whichever door they walk through, the bot's already there.</p>
      </div>
      <div class="pipe-step" data-n="2">
        <h3>The bot answers instantly</h3>
        <p>Using real facts about your business — hours, pricing, service area — never a guess, never made up.</p>
      </div>
      <div class="pipe-step" data-n="3">
        <h3>The job lands on your calendar</h3>
        <p>Booked automatically, no back-and-forth. Emergencies get warm-transferred straight to your cell.</p>
      </div>
      <div class="pipe-step" data-n="4">
        <h3>You review, weekly</h3>
        <p>A short skim of real conversations. You approve every fix — the bot gets sharper because you make it sharper, not on its own.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Remove the pipeline CSS**

Delete this entire block:
```css
/* ── pipeline (how it works) ── */
.pipe{position:relative;margin-top:8px;padding-left:64px}
.pipe-line{position:absolute;left:19px;top:6px;bottom:6px;width:2px;background:var(--hair);overflow:hidden}
.pipe-line i{position:absolute;inset:0;background:linear-gradient(180deg,var(--silver),var(--book));transform:scaleY(0);transform-origin:top;transition:transform 1.6s cubic-bezier(.22,1,.36,1)}
.pipe.in .pipe-line i{transform:scaleY(1)}
.pipe-step{position:relative;padding:0 0 44px;opacity:0;transform:translateX(-14px);transition:.7s cubic-bezier(.22,1,.36,1)}
.pipe.in .pipe-step{opacity:1;transform:none}
.pipe-step:last-child{padding-bottom:0}
.pipe-step:before{content:attr(data-n);position:absolute;left:-64px;top:-2px;width:40px;height:40px;border-radius:50%;background:var(--panel);border:2px solid var(--silver);color:var(--silver);font-family:var(--fm);font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:center}
.pipe-step h3{font-family:var(--fd);font-size:24px;text-transform:uppercase;font-weight:400;letter-spacing:.01em}
.pipe-step p{margin-top:9px;font-size:15.5px;color:var(--body);max-width:62ch}
@media(max-width:700px){.pipe{padding-left:52px}.pipe-line{left:15px}.pipe-step:before{left:-52px;width:32px;height:32px;font-size:13px}}
```

- [ ] **Step 3: Remove the pipeline JS IIFE**

Delete this entire block:
```js
// ── pipeline draw + staggered steps ──
(function(){
  var pipe=document.getElementById('pipe');
  if(!pipe) return;
  var steps=pipe.querySelectorAll('.pipe-step');
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        pipe.classList.add('in');
        steps.forEach(function(s,i){ s.style.transitionDelay=(.15+i*.15)+'s'; });
        io.unobserve(e.target);
      }
    });
  },{threshold:.15});
  io.observe(pipe);
})();
```

- [ ] **Step 4: Preview and verify**

Open `index.html` in the browser pane. Scroll from Marketing straight to whatever section now follows it (FAQ, until Task 6 removes it too) and confirm there's no gap, broken layout, or leftover "How it works" heading. Check the browser console for errors — none expected.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Remove How It Works pipeline section (AI Front Desk-specific)" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Remove FAQ section

**Files:**
- Modify: `index.html` — remove the FAQ `<section class="sec">` block (originally lines 420–450)
- Modify: `index.html` — remove `.faq*` CSS (originally lines 159–168)
- Modify: `index.html` — remove the FAQ accordion JS IIFE (originally lines 604–616)

**Interfaces:**
- Consumes: none (pure removal)
- Produces: nothing — all FAQ content was AI Front Desk-specific (call answering, contracts, bot mistakes) and no longer applies; not replaced with new FAQ content since none was designed in the spec.

- [ ] **Step 1: Remove the FAQ section**

Delete this entire block:
```html
<!-- FAQ -->
<section class="sec">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="eyebrow">Before you ask</div>
      <h2 class="disp">Questions worth<br>answering upfront.</h2>
    </div>
    <div class="faq rv" id="faq">
      <div class="faq-item">
        <button class="faq-q" type="button">How fast can this go live?<span class="x">+</span></button>
        <div class="faq-a"><p>Most businesses are live within a week. The only real wait is carrier approval for text messaging — that's out of anyone's hands, mine included, and usually clears in a few business days.</p></div>
      </div>
      <div class="faq-item">
        <button class="faq-q" type="button">Do I need a new phone number?<span class="x">+</span></button>
        <div class="faq-a"><p>No. We connect to your existing business line. Your customers dial the same number they always have.</p></div>
      </div>
      <div class="faq-item">
        <button class="faq-q" type="button">Is there a contract?<span class="x">+</span></button>
        <div class="faq-a"><p>No long-term contract. Cancel anytime — I'd rather earn the renewal every month than lock you in.</p></div>
      </div>
      <div class="faq-item">
        <button class="faq-q" type="button">What if the bot doesn't know an answer?<span class="x">+</span></button>
        <div class="faq-a"><p>It never guesses. If it's unsure, it takes the customer's name and number and flags it for a human — you.</p></div>
      </div>
      <div class="faq-item">
        <button class="faq-q" type="button">Who's actually checking the bot's work?<span class="x">+</span></button>
        <div class="faq-a"><p>I am, weekly. I skim real conversations and tighten anything that needs it. The bot doesn't retrain itself behind your back — every change is one I've approved.</p></div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Remove the FAQ CSS**

Delete this entire block:
```css
/* ── faq ── */
.faq{border-top:1px solid var(--ink)}
.faq-item{border-bottom:1px solid var(--hair)}
.faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 0;background:none;border:0;cursor:pointer;color:var(--white);text-align:left;font-family:var(--fb);font-size:17px;font-weight:600}
.faq-q:hover{color:var(--silver)}
.faq-q .x{font-family:var(--fm);font-size:20px;color:var(--silver);transition:transform .3s;flex-shrink:0}
.faq-item.open .faq-q .x{transform:rotate(45deg)}
.faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease}
.faq-item.open .faq-a{max-height:240px}
.faq-a p{padding:0 0 24px;font-size:15.5px;color:var(--body);max-width:66ch}
```

- [ ] **Step 3: Remove the FAQ accordion JS**

Delete this entire block:
```js
// ── faq accordion ──
(function(){
  var faq=document.getElementById('faq');
  if(!faq) return;
  faq.querySelectorAll('.faq-q').forEach(function(btn){
    btn.addEventListener('click',function(){
      var item=btn.closest('.faq-item');
      var wasOpen=item.classList.contains('open');
      faq.querySelectorAll('.faq-item').forEach(function(i){ i.classList.remove('open'); });
      if(!wasOpen) item.classList.add('open');
    });
  });
})();
```

- [ ] **Step 4: Preview and verify**

Open `index.html`, scroll through the full page top to bottom, confirm no FAQ heading/accordion remains and the page flows directly from the section before it into whatever comes next. Check console for errors — none expected.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Remove FAQ section (all content was AI Front Desk-specific)" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Remove old global Proof section (stats/quotes)

**Files:**
- Modify: `index.html` — remove the `<!-- PROOF -->` section (originally lines 452–475)
- Modify: `index.html` — remove `.stats`, `.stat`, `.quotes`, `.quote*`, `.avatar` CSS and its media query (originally lines 174–186)
- Modify: `index.html` — remove the now-unused `.urgency` CSS if not already removed in Task 4 (double-check; it was included in Task 4's Step 2 removal range)

**Interfaces:**
- Consumes: none (pure removal)
- Produces: nothing — proof now lives per-sub-service inside the Marketing section from Task 4, not as a separate global section (per spec's approved page structure).

- [ ] **Step 1: Remove the Proof section**

Delete this entire block:
```html
<!-- PROOF -->
<section class="sec">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="eyebrow">Real businesses, real numbers</div>
      <h2 class="disp">Proof, not promises.</h2>
    </div>
    <div class="stats rv">
      <div class="stat"><div class="n tnum">2×</div><div class="l">Lead volume in the first 30 days</div></div>
      <div class="stat"><div class="n">24/7</div><div class="l">Calls answered — nights & weekends</div></div>
      <div class="stat"><div class="n tnum">1</div><div class="l">Operator — you always work with Sean</div></div>
    </div>
    <div class="quotes rv">
      <div class="quote">
        <div class="quote-t">"Sean took over our Google Ads and LSA in the first week. Within 30 days our lead volume doubled and our cost per lead dropped significantly."</div>
        <div class="quote-a"><div class="avatar">PL</div><div><div class="quote-name">Premier Landscaping ATX</div><div class="quote-biz">Austin, TX — Landscaping</div></div></div>
      </div>
      <div class="quote">
        <div class="quote-t">"The distribution leads are legitimate. The ROI data is accurate and the leads are exclusive — not the recycled stuff you see on other lists."</div>
        <div class="quote-a"><div class="avatar">MS</div><div><div class="quote-name">Mediterranean Spa</div><div class="quote-biz">Baltimore, MD — Wellness</div></div></div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Remove the proof CSS**

Delete this entire block:
```css
/* ── proof ── */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:44px}
.stat{background:var(--panel);border:1px solid var(--hair);padding:26px 24px}
.stat .n{font-family:var(--fd);font-size:46px;color:var(--silver);line-height:1;letter-spacing:.01em}
.stat .l{font-family:var(--fm);font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);margin-top:11px;line-height:1.5}
.quotes{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.quote{background:var(--panel);border:1px solid var(--hair);padding:28px 26px}
.quote-t{font-size:16px;color:var(--white);line-height:1.55}
.quote-a{display:flex;align-items:center;gap:12px;margin-top:20px;padding-top:18px;border-top:1px solid var(--hair)}
.avatar{width:38px;height:38px;background:var(--silver);color:var(--on-silver);font-family:var(--fd);font-size:15px;display:flex;align-items:center;justify-content:center;letter-spacing:.02em}
.quote-name{font-weight:600;font-size:14.5px}
.quote-biz{font-family:var(--fm);font-size:11.5px;color:var(--dim);margin-top:2px}
@media(max-width:860px){.stats,.quotes{grid-template-columns:1fr}}
```

- [ ] **Step 3: Preview and verify**

Open `index.html`, confirm the page now flows from Marketing straight into About (once Tasks 5 and 6 are also applied) with no stray "Proof, not promises" heading or client quote cards. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Remove old global Proof section (superseded by per-service proof in Marketing)" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Update About section copy and tags

**Files:**
- Modify: `index.html` About section (originally lines 478–497) — content only, structure unchanged

**Interfaces:**
- Consumes: `--panel`, `--white`, `--body`, `--dim`, `--accent`, `--hair`, `--fb`, `--fm` from Task 1
- Produces: nothing new — this is the last content section other tasks depend on; no later task references its internals beyond the existing `.about-ugc` link (untouched).

- [ ] **Step 1: Update the About tags**

Replace:
```html
      <div class="about-tags">
        <span class="tag">AI Front Desk</span><span class="tag">Google Ads</span><span class="tag">LSA</span><span class="tag">Meta</span><span class="tag">Amazon FBA</span>
      </div>
```
with:
```html
      <div class="about-tags">
        <span class="tag">Ad Management</span><span class="tag">Website Building</span><span class="tag">Content Creation</span><span class="tag">UGC</span>
      </div>
```

- [ ] **Step 2: Update the About quote and body copy**

Replace:
```html
      <p class="about-q">"I help local businesses <em>capture every dollar that walks in the door</em> — the call you missed, the ad you're wasting, the product you should be selling."</p>
      <div class="about-body">
        <p>I keep my roster small on purpose. Every client works directly with me — no account managers, no hand-offs, no junior reps learning on your budget.</p>
        <p>Whether it's an AI receptionist catching your after-hours calls, ad accounts that actually turn a profit, or product leads with the math already done, the standard is the same: full transparency, real numbers, no fluff. You can text me when something comes up.</p>
      </div>
```
with:
```html
      <p class="about-q">"I help brands <em>show up like a real person made it</em> — the ad that actually converts, the site that actually loads fast, the content that doesn't look like an ad."</p>
      <div class="about-body">
        <p>I keep my roster small on purpose. Every client works directly with me — no account managers, no hand-offs, no junior reps learning on your budget.</p>
        <p>Whether it's an ad account that actually turns a profit, a site built from scratch, or UGC that pulls real views, the standard is the same: full transparency, real numbers, no fluff. You can text me when something comes up.</p>
      </div>
```

- [ ] **Step 3: Update the `.about-q em` and `.about-ugc` CSS color references**

Replace:
```css
.about-q em{font-style:normal;color:var(--silver)}
```
with:
```css
.about-q em{font-style:normal;color:var(--accent)}
```

Replace:
```css
.about-ugc{display:inline-block;font-family:var(--fm);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--silver);margin-top:16px;text-decoration:none;border-bottom:1px solid var(--silver-dim);padding-bottom:2px;transition:opacity .15s}
```
with:
```css
.about-ugc{display:inline-block;font-family:var(--fm);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-top:16px;text-decoration:none;border-bottom:1px solid var(--accent);padding-bottom:2px;transition:opacity .15s}
```

- [ ] **Step 4: Preview and verify**

Open `index.html`, scroll to About. Confirm the four tags now read "Ad Management / Website Building / Content Creation / UGC", the quote text is the new copy with the accent-colored emphasized phrase, and "See my UGC work →" still links out correctly and renders in blue, not silver.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Update About section copy/tags to match new Marketing positioning" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Contact section — remove service picker, keep form working

**Files:**
- Modify: `index.html` Contact section (originally lines 500–528)
- Modify: `index.html` — remove `.svc-pick`/`.svc-btn` CSS (originally lines 206–211, keep `.frow` through the rest of the contact CSS block unchanged)
- Modify: `index.html` — remove the service-picker JS IIFE (originally lines 568–577)

**Interfaces:**
- Consumes: the contact form still POSTs to `/api/contact-site`, which requires a non-empty `service` field (confirmed in `api/contact-site.js:16`, returns 400 "Missing required fields: name, email, service" if absent) — this task must keep a hidden `#svcType` input with a non-empty value, just without the visible picker buttons.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Remove the service-picker buttons, keep the hidden field hardcoded**

Replace:
```html
    <div class="svc-pick rv" id="svcPick">
      <button type="button" class="svc-btn on" data-svc="frontdesk"><div class="sl">AI Front Desk</div><div class="sd">Answer calls & book jobs 24/7.</div></button>
      <button type="button" class="svc-btn" data-svc="marketing"><div class="sl">Marketing</div><div class="sd">Run & manage my ads.</div></button>
      <button type="button" class="svc-btn" data-svc="distribution"><div class="sl">Distribution</div><div class="sd">Product leads to flip.</div></button>
    </div>
    <form id="contactForm" class="rv" novalidate>
      <input type="hidden" id="svcType" name="service_type" value="frontdesk">
```
with:
```html
    <form id="contactForm" class="rv" novalidate>
      <input type="hidden" id="svcType" name="service_type" value="marketing">
```

- [ ] **Step 2: Update the contact form's JS submit handler to read the field name it actually sends**

Check: the fetch body in the submit handler sends `service:document.getElementById('svcType').value` — this still works unchanged since `#svcType`'s value is now hardcoded to `"marketing"` rather than toggled by button clicks. No JS change needed here beyond removing the picker IIFE in Step 4.

- [ ] **Step 3: Remove the now-orphaned reference to `#svcPick` in the success handler**

Replace:
```js
      form.style.display='none';
      document.getElementById('svcPick').style.display='none';
      ok.classList.add('show');
```
with:
```js
      form.style.display='none';
      ok.classList.add('show');
```

- [ ] **Step 4: Remove the service-picker JS IIFE**

Delete this entire block:
```js
// ── service picker ──
(function(){
  document.querySelectorAll('.svc-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.svc-btn').forEach(function(b){b.classList.remove('on');});
      btn.classList.add('on');
      document.getElementById('svcType').value = btn.getAttribute('data-svc');
    });
  });
})();
```

- [ ] **Step 5: Remove the `.svc-pick`/`.svc-btn` CSS**

Replace:
```css
.svc-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:34px 0 26px}
.svc-btn{background:var(--panel);border:1px solid var(--hair);padding:16px 15px;text-align:left;cursor:pointer;transition:.16s;color:var(--white);font-family:var(--fb)}
.svc-btn:hover{border-color:var(--dim)}
.svc-btn.on{border-color:var(--silver);background:var(--raised)}
.svc-btn .sl{font-weight:600;font-size:14.5px}
.svc-btn .sd{font-size:12.5px;color:var(--dim);margin-top:4px;line-height:1.45}
```
with nothing (delete the block). Also update the leftover media query that references `.svc-pick`:

Replace:
```css
@media(max-width:700px){.svc-pick,.frow{grid-template-columns:1fr}}
```
with:
```css
@media(max-width:700px){.frow{grid-template-columns:1fr}}
```

- [ ] **Step 6: Update remaining `--silver`/`--on-silver` references in the contact CSS**

Replace:
```css
.field input:focus,.field textarea:focus{border-color:var(--silver);outline:none}
```
with:
```css
.field input:focus,.field textarea:focus{border-color:var(--accent);outline:none}
```

- [ ] **Step 7: Preview and verify**

Open `index.html`, scroll to Contact. Confirm: no service-picker buttons render, the form (name/email/business/phone/message) still shows. Fill in a test name and email, open the browser's Network tab, submit, and confirm the POST body to `/api/contact-site` includes `"service":"marketing"` (check the request payload in `read_network_requests` — don't worry about whether the email actually sends in this local-file preview context, just confirm the payload shape is correct and no client-side error is thrown before the fetch call).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Remove contact form service picker, hardcode service=marketing" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Footer cleanup + remove the GoHighLevel chat widget

**Files:**
- Modify: `index.html` footer block (originally lines 531–553)
- Modify: `index.html` — remove the GoHighLevel widget `<script>` and its preceding comment (originally lines 689–690)

**Interfaces:**
- Consumes: none
- Produces: nothing — this is the last content change in the plan; Task 11 is a full-page QA pass only.

- [ ] **Step 1: Simplify the footer links**

Replace:
```html
    <div class="foot-links">
      <a href="#frontdesk">AI Front Desk</a>
      <a href="#marketing">Marketing</a>
      <a href="#distribution">Distribution</a>
      <a href="/leads">Leads Portal</a>
      <a href="/portal">Client Portal</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
    </div>
```
with:
```html
    <div class="foot-links">
      <a href="#marketing">Marketing</a>
      <a href="#about">About</a>
      <a href="/portal">Client Portal</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
    </div>
```

Note: `/portal` (Client Portal) is kept — existing clients still need it, and the scope boundary says the portal itself is untouched, only this link's grouping changes. `/leads` (Distribution's Leads Portal) is dropped from the footer per the spec's "remove Distribution... links" instruction, without touching the `/leads` page itself.

- [ ] **Step 2: Update the footer's `--dim`/`--silver` color references**

Replace:
```css
.foot-contact a:hover{color:var(--silver)}
```
with:
```css
.foot-contact a:hover{color:var(--accent)}
```

- [ ] **Step 3: Remove the GoHighLevel chat widget**

Delete this entire block (immediately before `</body>`):
```html
<!-- GoHighLevel Chat Widget — live AI Front Desk demo (Lone Star Plumbing sub-account) -->
<script src="https://widgets.leadconnectorhq.com/loader.js" data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="6a680fdbb0ee6ed3ac456763" data-source="WEB_USER"></script>
```

- [ ] **Step 4: Preview and verify**

Open `index.html`, scroll to the footer. Confirm: links read "Marketing / About / Client Portal / Privacy / Terms" (no "AI Front Desk" / "Distribution" / "Leads Portal"), Instagram/TikTok/YouTube social links are unchanged (already correct, matching the media kit handles — no edit needed there). Confirm no chat bubble appears anywhere on the page. Check the Network tab — confirm no request to `widgets.leadconnectorhq.com` fires.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "EVAN 2026-09-18: Simplify footer, remove GoHighLevel demo chat widget" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Full-page QA pass

**Files:**
- Modify: `index.html` (only if QA finds an issue — otherwise no changes, this task is verification-only)

**Interfaces:**
- Consumes: the fully assembled page from Tasks 1–10
- Produces: nothing — this is the final gate before the homepage revamp is considered done

- [ ] **Step 1: Full visual pass, desktop width**

Open `index.html` in the browser pane. Screenshot each section in order: Nav → Hero → Marketing → About → Contact → Footer. Confirm:
- No leftover reference to "AI Front Desk," "Distribution," "Front Desk," or the old $299/$500/$99 pricing anywhere in visible text (grep the rendered page text, not just skim visually)
- No visible use of the old silver/chrome look — everything should read black ground, navy panels (Marketing cards), white type, blue accent only on labels/links/CTA
- No leftover Anton-styled uppercase display type anywhere (everything should be IBM Plex Sans)

Run this to confirm no stale copy survived anywhere in the file:
```bash
grep -in "ai front desk\|distribution\|front desk\|\$299\|\$500 /mo\|\$99 /mo" /Users/seanevangelista/Desktop/evan-enterprises-os/index.html
```
Expected: no matches. If any match appears, fix it before proceeding.

- [ ] **Step 2: Confirm no dead CSS/JS references remain**

Run:
```bash
grep -n "silver\|chrome-grad\|on-silver\|--miss\|--book\b" /Users/seanevangelista/Desktop/evan-enterprises-os/index.html
```
Expected: no matches (all replaced with `--accent`/`--white`/`--panel` in Tasks 1–10). If any match appears, it's a token reference Task 1 introduced but a later task's CSS edit missed — fix it to use the new token names from Task 1.

- [ ] **Step 3: Confirm no orphaned element-ID references in JS**

Run:
```bash
grep -n "getElementById" /Users/seanevangelista/Desktop/evan-enterprises-os/index.html
```
Expected output should only reference IDs that still exist in the HTML: `burger`, `mobileMenu`, `contactForm`, `submitBtn`, `formOk`, `formErr`, `svcType`. Cross-check each one exists with:
```bash
grep -n 'id="burger"\|id="mobileMenu"\|id="contactForm"\|id="submitBtn"\|id="formOk"\|id="formErr"\|id="svcType"' /Users/seanevangelista/Desktop/evan-enterprises-os/index.html
```
Expected: one match per ID (7 total).

- [ ] **Step 4: Mobile-width visual pass**

In the browser pane, resize to the `mobile` preset. Screenshot the full page scroll. Confirm: nav collapses to burger menu and opens/closes correctly, hero text doesn't overflow, Marketing grid stacks to one column, About section stacks photo above text, Contact form fields stack to one column, footer content stays centered and readable.

- [ ] **Step 5: Console and network check**

Open the browser console (`read_console_messages`) — confirm zero errors. Open network requests (`read_network_requests`) — confirm no request to `widgets.leadconnectorhq.com` and no 404s for `logo-mark.png`, `sean.jpg`, `favicon.svg`, or the Google Fonts CSS.

- [ ] **Step 6: Final commit (only if Steps 1–5 required fixes)**

If any fixes were needed:
```bash
git add index.html
git commit -m "EVAN 2026-09-18: Fix QA findings from homepage revamp full-page pass" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
If no fixes were needed, no commit for this task — the plan is complete as of Task 10's commit.

- [ ] **Step 7: Report the live preview to Sean**

Once QA passes, tell Sean the revamp is ready to push to `main` (per his standing preference to push directly after each change) and remind him the live URL is `evanenterprise.com` — state it explicitly once pushed, per his saved preference to always include the site link on updates.
