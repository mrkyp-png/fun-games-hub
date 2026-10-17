(function(root){
  'use strict';
  var MG=root.MoleGame,NS='http://www.w3.org/2000/svg',BASE='assets/rhythm/status-perfect-v1237/';
  function create(screen){
    var nodes=[],frame=0,start=0,elapsed=0,paused=false,active=false;
    var reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    (MG.RhythmStatusArt||[]).forEach(function(a,index){
      var host=screen.querySelector('.rp-a-status-'+a.status);if(!host)return;
      var old=host.querySelector('.rp-status-art');if(old)old.remove();
      var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 1774 887');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('rp-status-art');
      var pad=a.pad,w=a.w+pad*2,h=a.h+pad*2,id='rp-status-warp-'+index;
      var img='<image href="'+BASE+a.name+'.png" width="'+w+'" height="'+h+'"/>';
      var body;
      if(a.name==='shell'){
        body='<g transform="translate('+(pad+a.w*.14)+' '+(pad+a.h*.28)+') scale(.72)"><image href="'+BASE+'shell.png" x="'+(-pad)+'" y="'+(-pad)+'" width="'+w+'" height="'+h+'"/></g><ellipse data-mouth cx="'+(pad+a.w/2)+'" cy="'+(pad+a.h*.92)+'" rx="'+a.w*.28+'" ry="'+a.h*.045+'" fill="#4d1744" opacity="0"/><g data-shell-top>'+img+'</g>';
      }else{
        body='<defs><filter id="'+id+'" filterUnits="userSpaceOnUse" x="0" y="0" width="'+w+'" height="'+h+'" color-interpolation-filters="sRGB"><feImage href="'+BASE+a.name+'-map.png" x="0" y="0" width="'+w+'" height="'+h+'" result="map"/><feDisplacementMap data-warp in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#'+id+')">'+img+'</g>';
      }
      svg.innerHTML='<svg x="'+a.x+'" y="'+a.y+'" width="'+a.width+'" height="'+a.height+'" viewBox="0 0 '+w+' '+h+'" overflow="visible">'+body+'</svg>';
      host.appendChild(svg);host.classList.add('has-perfect-art');nodes.push({warp:svg.querySelector('[data-warp]'),top:svg.querySelector('[data-shell-top]'),mouth:svg.querySelector('[data-mouth]'),art:a});
    });
    function draw(q){
      nodes.forEach(function(n){
        if(n.warp)n.warp.setAttribute('scale',String(n.art.mapScale*q));
        if(n.top){var a=n.art,pivot=a.pad+a.h,gain=a.gain;n.top.setAttribute('transform','translate(0 '+(pivot*.12*gain*q-18*gain*q)+') scale(1 '+(1-.12*gain*q)+')');n.mouth.setAttribute('opacity',String(Math.min(1,.45*gain*q)));}
      });
    }
    function tick(now){frame=0;if(!active||paused)return;elapsed=now-start;var t=Math.min(1,elapsed/360);draw(Math.pow(Math.sin(Math.PI*t),1.35));if(t<1)frame=requestAnimationFrame(tick);else{active=false;draw(0);}}
    function hit(){if(reduced.matches)return;if(frame)cancelAnimationFrame(frame);elapsed=0;start=performance.now();active=true;paused=false;draw(0);frame=requestAnimationFrame(tick);}
    function stop(){if(frame)cancelAnimationFrame(frame);frame=0;active=false;paused=false;elapsed=0;draw(0);}
    function pause(on){if(!active)return;paused=on;if(on){elapsed=performance.now()-start;if(frame)cancelAnimationFrame(frame);frame=0;}else{start=performance.now()-elapsed;frame=requestAnimationFrame(tick);}}
    return {hit:hit,stop:stop,pause:pause};
  }
  MG.RhythmStatusFx={create:create};
})(window);
