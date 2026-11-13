// Shared behaviour for new-look pages: scroll reveal + magnetic buttons.
(function(){
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal: anything with .rv fades up once, staggered by --i
  window.siteReveal=function(root){
    var els=(root||document).querySelectorAll('.rv:not(.in)');
    if(reduce||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
    },{threshold:.12});
    els.forEach(function(e){io.observe(e);});
  };
  window.siteReveal();

  // magnetic: buttons lean toward the cursor
  if(!reduce&&!window.matchMedia('(hover: none)').matches){
    document.addEventListener('mousemove',function(e){
      var b=e.target.closest&&e.target.closest('.btn[data-magnet]');
      if(!b)return;
      var r=b.getBoundingClientRect();
      b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.2)+'px,'+((e.clientY-r.top-r.height/2)*.3)+'px)';
    });
    document.addEventListener('mouseout',function(e){
      var b=e.target.closest&&e.target.closest('.btn[data-magnet]');
      if(b)b.style.transform='';
    });
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
  window.siteSource=function(){ return src; };
  window.siteTrack=function(k){ send('click',String(k).slice(0,60),'&r='+encodeURIComponent(src)); };
  send('pv','','&r='+encodeURIComponent(src)+'&s='+encodeURIComponent(utm.toLowerCase())+(first?'&e=1':''));
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
    if(label) send('click',label.slice(0,60),'&r='+encodeURIComponent(src));
  });
};
window.siteAnalytics({hostname:location.hostname,pathname:location.pathname,search:location.search,hash:location.hash,referrer:document.referrer});
