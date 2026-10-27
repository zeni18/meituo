/* Sibling ordering is independent of nesting. Pointer and keyboard input share
   the same move operation; the caller persists the whole list atomically. */
(() => {
  'use strict';
  function normalize(folders, draft=[]) {
    const valid=new Set(folders.map(f=>Number(f.id))),seen=new Set(),result=[];
    for(const id of [...draft,...[...folders].sort((a,b)=>Number(b.sort)-Number(a.sort)||Number(a.id)-Number(b.id)).map(f=>Number(f.id))]) {
      if(valid.has(Number(id))&&!seen.has(Number(id))){seen.add(Number(id));result.push(Number(id));}
    }
    return result;
  }
  function move(folders, ids, source, target, after) {
    const order=normalize(folders,ids),from=folders.find(f=>Number(f.id)===Number(source)),to=folders.find(f=>Number(f.id)===Number(target));
    if(!from||!to||Number(from.id)===Number(to.id)||Number(from.parent_id)!==Number(to.parent_id))return order;
    const result=order.filter(id=>id!==Number(source));result.splice(result.indexOf(Number(target))+(after?1:0),0,Number(source));return result;
  }
  function bind(handle, options) {
    let drag=null;
    const stop=commit=>{
      if(!drag)return;const current=drag;drag=null;cancelAnimationFrame(current.frame);current.ghost?.remove();
      current.row.classList.remove('is-dragging');options.tree.querySelectorAll('.is-drop-before,.is-drop-after').forEach(e=>e.classList.remove('is-drop-before','is-drop-after'));
      document.removeEventListener('keydown',escape,true);options.onEnd();
      if(commit&&current.active&&current.target)options.commit(options.id,current.target,current.after);
    };
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();stop(false);}};
    function tick(){
      if(!drag?.active)return;
      const area=options.scroll.getBoundingClientRect();
      if(drag.y<area.top+32)options.scroll.scrollTop-=10;
      else if(drag.y>area.bottom-32)options.scroll.scrollTop+=10;
      const folders=options.folders(),source=folders.find(f=>Number(f.id)===options.id),map=new Map(folders.map(f=>[Number(f.id),f]));
      let target=map.get(Number(document.elementFromPoint(drag.x,drag.y)?.closest('[data-folder-id]')?.dataset.folderId));
      while(target&&Number(target.parent_id)!==Number(source?.parent_id))target=map.get(Number(target.parent_id));
      options.tree.querySelectorAll('.is-drop-before,.is-drop-after').forEach(e=>e.classList.remove('is-drop-before','is-drop-after'));
      drag.target=0;
      if(target&&Number(target.id)!==options.id&&drag.x>=area.left&&drag.x<=area.right&&drag.y>=area.top&&drag.y<=area.bottom){
        const row=options.tree.querySelector('[data-folder-id="'+Number(target.id)+'"]'),rect=row.getBoundingClientRect();
        drag.target=Number(target.id);drag.after=drag.y>rect.top+rect.height/2;
        let indicator=row;
        if(drag.after){let next=row.nextElementSibling;while(next&&Number(next.dataset.folderDepth)>Number(row.dataset.folderDepth)){indicator=next;next=next.nextElementSibling;}}
        indicator.classList.add(drag.after?'is-drop-after':'is-drop-before');
      }
      drag.ghost.style.top=(drag.y-drag.offset)+'px';drag.frame=requestAnimationFrame(tick);
    }
    handle.addEventListener('pointerdown',e=>{
      if(e.isPrimary===false||e.button!==0||drag||options.disabled())return;e.preventDefault();e.stopPropagation();
      const row=handle.closest('[data-folder-id]'),rect=row.getBoundingClientRect();
      drag={row,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offset:e.clientY-rect.top,rect,active:false,target:0,frame:0};
      handle.setPointerCapture(e.pointerId);document.addEventListener('keydown',escape,true);options.onStart(()=>stop(false));
    });
    handle.addEventListener('pointermove',e=>{
      if(!drag)return;drag.x=e.clientX;drag.y=e.clientY;
      if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>4){
        drag.active=true;drag.row.classList.add('is-dragging');drag.ghost=drag.row.cloneNode(true);
        drag.ghost.className='ml-folder-row ml-folder-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');
        drag.ghost.removeAttribute('data-folder-id');drag.ghost.style.left=drag.rect.left+'px';drag.ghost.style.width=drag.rect.width+'px';
        options.root.append(drag.ghost);tick();
      }
    });
    handle.addEventListener('pointerup',()=>stop(true));
    handle.addEventListener('pointercancel',()=>stop(false));handle.addEventListener('lostpointercapture',()=>stop(false));
    handle.addEventListener('keydown',e=>{
      if(!['ArrowUp','ArrowDown'].includes(e.key)||options.disabled())return;e.preventDefault();e.stopPropagation();
      const folders=options.folders(),source=folders.find(f=>Number(f.id)===options.id);
      const siblings=normalize(folders,options.order()).filter(id=>Number(folders.find(f=>Number(f.id)===id).parent_id)===Number(source.parent_id));
      const index=siblings.indexOf(options.id),target=siblings[index+(e.key==='ArrowUp'?-1:1)];
      if(target)options.commit(options.id,target,e.key==='ArrowDown');
    });
  }
  window.MerchantFolderSort={normalize,move,bind};
})();
