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
