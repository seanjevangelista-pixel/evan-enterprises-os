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
