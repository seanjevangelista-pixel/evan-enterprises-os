// Shared behaviour for the public pages.
(function(){
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Entrances are CSS only now (.rv in site.css), so nothing is ever hidden waiting on script.
  // Kept as a function because pages call it after they inject content.
  window.siteReveal=function(){};

  // sequence: inside a [data-seq] block, the [data-step] items appear in order, once, the first
  // time the block is on screen. Used where the order is the point (the lead's path).
  if(!reduce&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
    },{threshold:.35});
    document.querySelectorAll('[data-seq]').forEach(function(el){el.classList.add('seq-ready');io.observe(el);});
  }
})();

// ── tap-to-enlarge screenshots: any <button class="shot" data-lightbox> opens its image full size ──
(function(){
  var lb=document.createElement('div'); lb.className='lb'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.setAttribute('aria-label','Enlarged screenshot');
  lb.innerHTML='<button class="lb-x" type="button" aria-label="Close">×</button><img alt="">';
  document.body.appendChild(lb);
  var img=lb.querySelector('img'), last=null;
  function close(){lb.classList.remove('open'); if(last) last.focus();}
  document.addEventListener('click',function(e){
    var t=e.target.closest&&e.target.closest('[data-lightbox]');
    if(t){var i=t.querySelector('img'); img.src=t.getAttribute('data-full')||i.src; img.alt=i.alt; last=t; lb.classList.add('open'); lb.querySelector('.lb-x').focus(); return;}
    if(lb.classList.contains('open')&&(e.target===lb||e.target.classList.contains('lb-x'))) close();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open')) close();});
})();

// ── reels, live in place: with a mouse, hovering a reel (.reel > a[data-reel]) swaps its cover for Instagram's
// own player, cropped to the video, so one click plays it right there with sound. Instagram's player cannot
// be started from this page (it is their frame and it has no autoplay), so the click has to be the visitor's.
// Touch and keyboard never get this layer: the link opens the popup below instead. ──
(function(){
  if(!window.matchMedia||!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  // Instagram's embed at 400px wide: a 54px header, then a 400x500 box with the 9:16 video centred in it.
  // If they change that layout the crop will be off; these three numbers are the only thing to adjust.
  var W=400, HEAD=54, BOX=500, VID=BOX*9/16;
  var reels=[];
  function fit(r){ var s=r.box.clientWidth/VID; r.frame.style.transform='translate('+(-(W-VID)/2*s)+'px,'+(-HEAD*s)+'px) scale('+s+')'; }
  function sync(r){ if(r.box) r.box.classList.toggle('is-ready',r.loaded&&(r.over||r.engaged)); }
  function build(r){
    r.box=document.createElement('div'); r.box.className='reel-live';
    r.frame=document.createElement('iframe');
    r.frame.title='Instagram reel'; r.frame.setAttribute('scrolling','no'); r.frame.allow='autoplay; encrypted-media; fullscreen';
    r.frame.style.width=W+'px'; r.frame.style.height=(HEAD+BOX)+'px';
    r.frame.addEventListener('load',function(){ r.loaded=true; sync(r); });
    r.frame.src='https://www.instagram.com/reel/'+r.id+'/embed/';
    r.box.appendChild(r.frame); r.el.appendChild(r.box); fit(r);
  }
  function drop(r){ r.engaged=false; r.loaded=false; if(r.box){ r.box.remove(); r.box=r.frame=null; } }   // removing the frame stops the sound
  [].forEach.call(document.querySelectorAll('.reel'),function(el){
    var link=el.querySelector('a[data-reel]'); if(!link) return;
    var m=/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/.exec(link.href); if(!m) return;
    var r={el:el,id:m[1],over:false,engaged:false,loaded:false,box:null,frame:null,t:0}; reels.push(r);
    el.addEventListener('pointerenter',function(e){
      if(e.pointerType!=='mouse') return;
      r.over=true; clearTimeout(r.t);
      r.t=setTimeout(function(){ if(!r.over) return; if(!r.box) build(r); else fit(r); sync(r); },120);   // skip pointers just passing through
    });
    el.addEventListener('pointerleave',function(){ r.over=false; clearTimeout(r.t); sync(r); });
  });
  if(!reels.length) return;
  // A click inside the player moves focus into its frame. That reel then stays live after the pointer leaves,
  // until the visitor clicks somewhere else on the page, plays another reel, or scrolls it off screen.
  window.addEventListener('blur',function(){
    setTimeout(function(){
      reels.forEach(function(r){
        if(r.frame&&document.activeElement===r.frame){ r.engaged=true; reels.forEach(function(o){ if(o!==r&&o.engaged) drop(o); }); sync(r); }
      });
    },0);
  });
  document.addEventListener('pointerdown',function(e){ reels.forEach(function(r){ if(r.engaged&&!r.el.contains(e.target)) drop(r); }); },true);
  window.addEventListener('resize',function(){ reels.forEach(function(r){ if(r.box) fit(r); }); });
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(!e.isIntersecting) reels.forEach(function(r){ if(r.el===e.target&&r.engaged) drop(r); }); }); });
    reels.forEach(function(r){ io.observe(r.el); });
  }
})();

// ── reel popup: <a data-reel href="https://www.instagram.com/reel/ID/"> plays in a dialog on the page.
// The link still works on its own (new tab) without script, or with ctrl/cmd/shift/middle click. ──
(function(){
  if(!window.HTMLDialogElement) return;
  var dlg,frame;
  function build(){
    dlg=document.createElement('dialog'); dlg.className='reel-pop'; dlg.setAttribute('aria-label','Instagram reel');
    dlg.innerHTML='<button class="lb-x" type="button" aria-label="Close">×</button><iframe title="Instagram reel" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" scrolling="no"></iframe>';
    document.body.appendChild(dlg); frame=dlg.querySelector('iframe');
    dlg.addEventListener('click',function(e){ if(e.target===dlg||e.target.classList.contains('lb-x')) dlg.close(); });
    dlg.addEventListener('close',function(){ frame.removeAttribute('src'); });   // stops playback
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[data-reel]'); if(!a) return;
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.button) return;
    var m=/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/.exec(a.href); if(!m) return;
    e.preventDefault(); if(!dlg) build();
    frame.src='https://www.instagram.com/reel/'+m[1]+'/embed/'; dlg.showModal();
  });
})();

// ── testimonials: fills a grid from /data/testimonials.json and unhides its section when there are entries ──
window.siteTestimonials=function(gridId,sectionId){
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  fetch('/data/testimonials.json').then(function(r){return r.json();}).then(function(d){
    var items=(d.items||[]).filter(function(t){return t&&t.quote&&t.name;});
    var grid=document.getElementById(gridId); if(!grid) return;
    if(items.length){
      grid.insertAdjacentHTML('beforeend',items.map(function(t){
        var n=Math.max(0,Math.min(5,parseInt(t.rating,10)||0));
        return '<figure class="tq card rv">'+(n?'<div class="stars" aria-label="'+n+' out of 5">'+'★'.repeat(n)+'</div>':'')+
          '<p>“'+esc(t.quote)+'”</p><figcaption class="who">'+esc(t.name)+(t.business?' <span>· '+esc(t.business)+'</span>':'')+'</figcaption></figure>';
      }).join(''));
      window.siteReveal(grid);
    }
    if(sectionId&&(items.length||document.querySelector('#'+gridId+' .tq--lead'))){var sec=document.getElementById(sectionId); if(sec) sec.hidden=false;}
  }).catch(function(){});
};

// ── lightweight first-party analytics (no cookies, no IP stored) ──────────────────────
// Logs page views and clicks to /api/client-lookup?action=hit. /go/ links are logged server-side.
// Add #notrack to any URL once to exclude this browser from the counts.
window.siteAnalytics=function(env){
  if(!/^(www\.)?evanenterprise\.com$/i.test(env.hostname)) return;   // only the real site: not previews, localhost or other domains
  try{
    if(/[?&#]notrack\b/.test(env.search+env.hash)) localStorage.setItem('ee_notrack','1');
    if(localStorage.getItem('ee_notrack')==='1') return;
  }catch(e){}
  if(navigator.doNotTrack==='1'||window.doNotTrack==='1') return;
  var path=(env.pathname.replace(/\/+$/,'')||'/').replace(/\/index\.html$/,'')||'/';
  function send(t,k,extra){
    var u='/api/client-lookup?action=hit&t='+t+'&p='+encodeURIComponent(path)+(k?'&k='+encodeURIComponent(k):'')+(extra||'');
    try{ fetch(u,{keepalive:true,credentials:'omit'}).catch(function(){}); }catch(e){}
  }
  // Where this visitor came from (instagram, tiktok, linkedin ...), remembered for the tab session so
  // later clicks can be tied back to it. No cookies: sessionStorage only, cleared when the tab closes.
  function norm(h){
    h=String(h||'').toLowerCase().replace(/^www\./,'').trim(); if(!h) return '';
    var rules=[[/instagram|^ig$/,'instagram'],[/tiktok/,'tiktok'],[/linkedin|lnkd\.in/,'linkedin'],[/youtube|youtu\.be/,'youtube'],[/facebook|^fb\./,'facebook'],[/discord/,'discord'],[/^t\.co$|twitter|^x\.com$/,'x'],[/google/,'google'],[/bing|duckduckgo|yahoo|ecosia/,'search'],[/evanenterprise/,'']];
    for(var i=0;i<rules.length;i++) if(rules[i][0].test(h)) return rules[i][1];
    return h.slice(0,30);
  }
  var ref=''; try{ ref=env.referrer?new URL(env.referrer).hostname:''; }catch(e){}
  var qs=new URLSearchParams(env.search), utm=qs.get('utm_source')||qs.get('s')||'';
  var src=norm(utm)||norm(ref), first=true;
  try{
    if(src) sessionStorage.setItem('ee_src',src); else src=sessionStorage.getItem('ee_src')||'';
    first=!sessionStorage.getItem('ee_seen'); sessionStorage.setItem('ee_seen','1');
  }catch(e){}
  // The link this visit started on (first page of the session), e.g. "/links" or "/#contact".
  var hash=(/^#[a-z0-9_-]{1,30}$/i.test(env.hash||'')?env.hash.toLowerCase():''), landing=path+hash;
  try{
    if(first) sessionStorage.setItem('ee_land',landing); else landing=sessionStorage.getItem('ee_land')||landing;
  }catch(e){}
  window.siteSource=function(){ return src; };
  window.siteLanding=function(){ return landing; };
  window.siteTrack=function(k){ send('click',String(k).slice(0,60),'&r='+encodeURIComponent(src)+'&l='+encodeURIComponent(landing)); };
  send('pv','','&r='+encodeURIComponent(src)+'&s='+encodeURIComponent(utm.toLowerCase())+(first?'&e=1&h='+encodeURIComponent(hash.slice(1)):''));
  function slug(t){ return String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30); }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]'); if(!a) return;
    var h=a.getAttribute('href')||''; if(h.indexOf('/go/')===0) return;
    var label='';
    if(/^mailto:/i.test(h)) label='email';
    else if(/^tel:/i.test(h)) label='call';
    else if(/^sms:/i.test(h)) label='text';
    else if(/ig\.me\//i.test(h)) label='ig-dm';
    else if(a.classList.contains('btn')) label='btn:'+slug(a.textContent);
    else if(/^https?:/i.test(h)){ try{ var u=new URL(h,env.hostname?'https://'+env.hostname:undefined); if(u.hostname!==env.hostname) label='out:'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/+$/,'').slice(0,26); }catch(x){} }
    else if(h.charAt(0)==='#') label='jump:'+slug(h.slice(1));
    else if(h.charAt(0)==='/') label='nav:'+h.replace(/[?#].*$/,'').slice(0,40);
    if(label) send('click',label.slice(0,60),'&r='+encodeURIComponent(src)+'&l='+encodeURIComponent(landing));
  });
};
window.siteAnalytics({hostname:location.hostname,pathname:location.pathname,search:location.search,hash:location.hash,referrer:document.referrer});
