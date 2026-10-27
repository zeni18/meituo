/* Shot groups and their one-based sticker references move as one unit. */
(() => {
  'use strict';
  function move(config,from,to,activeGroup){
    const groups=config.groups;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=groups.length||to>=groups.length||from===to)return {moved:false};
    const order=groups.map((_,i)=>i),[source]=order.splice(from,1);order.splice(to,0,source);
    return {moved:true,groups:order.map(i=>groups[i]),stickers:config.stickers.map(s=>({...s,group:s.group===0?0:order.indexOf(s.group-1)+1})),activeGroup:activeGroup===-1?-1:order.indexOf(activeGroup)};
  }
  function bind(strip,{root,disabled,commit}){
    let drag=null,suppressClick=false;
    const cards=()=>Array.from(strip.querySelectorAll('[data-group-index]'));
    const clear=()=>cards().forEach(e=>e.classList.remove('is-drop-before','is-drop-after'));
    const stop=apply=>{
      if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(d.frame);d.ghost?.remove();d.card.classList.remove('is-dragging');clear();
      document.removeEventListener('keydown',escape,true);
      if(d.active)suppressClick=true;
      if(apply&&d.active&&d.to!==null)commit(d.index,d.to,false);
    };
    const escape=e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();stop(false);}};
    function tick(){
      if(!drag?.active)return;
      const d=drag,area=strip.getBoundingClientRect();clear();d.to=null;
      if(d.y>=area.top&&d.y<=area.bottom){
        if(d.x<area.left+36)strip.scrollLeft-=12;else if(d.x>area.right-36)strip.scrollLeft+=12;
        const visible=cards().filter(c=>{const r=c.getBoundingClientRect();return r.right>area.left&&r.left<area.right;});
        const target=visible.reduce((best,card)=>{const r=card.getBoundingClientRect(),distance=Math.abs(d.x-(r.left+r.width/2));return !best||distance<best.distance?{card,r,distance}:best;},null);
        if(target&&d.x>=area.left-24&&d.x<=area.right+24){
          const index=Number(target.card.dataset.groupIndex),after=d.x>target.r.left+target.r.width/2;
          const to=index+(after?1:0)-(d.index<index+(after?1:0)?1:0);
          if(to!==d.index){d.to=to;target.card.classList.add(after?'is-drop-after':'is-drop-before');}
        }
      }
      d.ghost.style.left=(d.x-d.offsetX)+'px';d.ghost.style.top=(d.y-d.offsetY)+'px';d.frame=requestAnimationFrame(tick);
    }
    const down=e=>{
      const card=e.target.closest('[data-group-index]');
      if(drag||!card||!strip.contains(card)||e.target.closest('[data-sort-ignore]')||e.isPrimary===false||e.button!==0||disabled())return;suppressClick=false;
      const rect=card.getBoundingClientRect();drag={card,index:Number(card.dataset.groupIndex),pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,rect,frame:0,active:false,to:null};
      (e.target.closest('button')||card).setPointerCapture(e.pointerId);document.addEventListener('keydown',escape,true);
    };
    const moving=e=>{
      if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;d.x=e.clientX;d.y=e.clientY;
      if(!d.active&&Math.hypot(d.x-d.startX,d.y-d.startY)>5){
        d.active=true;d.card.classList.add('is-dragging');d.ghost=d.card.cloneNode(true);d.ghost.classList.remove('is-dragging');d.ghost.classList.add('mc-group-drag-ghost');d.ghost.removeAttribute('data-group-index');d.ghost.setAttribute('aria-hidden','true');d.ghost.tabIndex=-1;d.ghost.style.width=d.rect.width+'px';d.ghost.style.height=d.rect.height+'px';root.append(d.ghost);tick();
      }
      if(d.active)e.preventDefault();
    };
    const up=e=>{if(drag&&e.pointerId===drag.pointerId){if(drag.active)e.preventDefault();stop(true);}};
    const cancel=e=>{if(drag&&e.pointerId===drag.pointerId)stop(false);};
    const click=e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}};
    const key=e=>{
      if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('[data-sort-ignore]')||disabled())return;
      const card=e.target.closest('[data-group-index]');if(!card)return;e.preventDefault();e.stopPropagation();
      const from=Number(card.dataset.groupIndex),to=from+(e.key==='ArrowRight'?1:-1);if(to>=0&&to<cards().length)commit(from,to,true);
    };
    strip.addEventListener('pointerdown',down);strip.addEventListener('pointermove',moving);strip.addEventListener('pointerup',up);strip.addEventListener('pointercancel',cancel);strip.addEventListener('lostpointercapture',cancel);strip.addEventListener('click',click,true);strip.addEventListener('keydown',key);
    return ()=>{stop(false);strip.removeEventListener('pointerdown',down);strip.removeEventListener('pointermove',moving);strip.removeEventListener('pointerup',up);strip.removeEventListener('pointercancel',cancel);strip.removeEventListener('lostpointercapture',cancel);strip.removeEventListener('click',click,true);strip.removeEventListener('keydown',key);};
  }
  window.MerchantClipGroupSort={move,bind};
})();
