/* Editor-only motion. Swiping selects a shot; it never reorders or deletes it. */
(() => {
  'use strict';
  const wrapIndex=(index,count)=>count>0?((index%count)+count)%count:0;
  const swipeStep=(dx,dy,width)=>Math.abs(dx)>=Math.max(38,Math.min(72,width*.3))&&Math.abs(dx)>Math.abs(dy)*1.2?(dx<0?1:-1):0;
  function create(root){
    let dead=false;
    const animations=new Set(),cleanups=new Set(),materialCleanups=new Set();
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const play=(node,frames,options)=>{
      const animation=node.animate(frames,options);animations.add(animation);
      animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));return animation;
    };
    function bindDeck(deck,{index,count,onSelect,disabled=()=>false}){
      let disposed=false,flight=null,lift=null,drag=null,pending=null,suppressClick=false;
      const front=deck.querySelector('[data-depth="0"]');
      const goTo=(target,{direction=1,focus=false}={})=>{
        target=wrapIndex(target,count);if(disposed||dead||disabled())return;
        if(flight){pending={target,direction,focus};return;}
        if(target===index)return;
        if(reduced()||!front?.animate||count<2||index<0){onSelect(target,focus);return;}
        const from=front.style.transform||'translateX(0) rotate(0deg)',distance=Math.max(240,front.offsetWidth*1.8);
        front.style.transform='';front.style.zIndex='5';front.classList.add('is-flying');
        flight=play(front,[{transform:from,opacity:1,filter:'blur(0px)'},{transform:`translate(${direction*distance}px,-32px) rotate(${direction*24}deg) scale(.92)`,opacity:0,filter:'blur(5px)'}],{duration:320,easing:'cubic-bezier(.4,0,.8,.4)',fill:'forwards'});
        const next=deck.querySelector('[data-shot-index="'+target+'"]');
        if(next&&next!==front){next.style.zIndex='4';lift=play(next,[{transform:getComputedStyle(next).transform},{transform:'translate(0,0) rotate(0deg) scale(1)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});}
        flight.finished.then(()=>{if(disposed||dead)return;flight=null;const choice=pending||{target,focus};pending=null;onSelect(choice.target,choice.focus);}).catch(()=>{});
      };
      const reset=()=>{if(!front)return;const from=front.style.transform;front.style.transform='';front.classList.remove('is-swiping');if(from&&!reduced()&&front.animate)play(front,[{transform:from},{transform:'none'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});};
      const down=e=>{if(e.button!==0||e.isPrimary===false||disabled()||flight||count<2)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,horizontal:false};};
      const move=e=>{if(!drag||e.pointerId!==drag.id)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
        if(!drag.horizontal&&Math.abs(drag.dy)>10&&Math.abs(drag.dy)>Math.abs(drag.dx)){drag=null;return;}
        if(!drag.horizontal&&Math.abs(drag.dx)>7&&Math.abs(drag.dx)>Math.abs(drag.dy)*1.2){drag.horizontal=true;front.setPointerCapture(e.pointerId);front.classList.add('is-swiping');}
        if(drag.horizontal){e.preventDefault();front.style.transform=`translate(${drag.dx}px,${drag.dy*.16}px) rotate(${Math.max(-18,Math.min(18,drag.dx*.08))}deg)`;}
      };
      const up=e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;
        if(d.horizontal){suppressClick=true;const step=swipeStep(d.dx,d.dy,front.offsetWidth);front.classList.remove('is-swiping');if(step)goTo(index+step,{direction:d.dx<0?-1:1});else reset();}
        if(front.hasPointerCapture(e.pointerId))front.releasePointerCapture(e.pointerId);
      };
      const cancel=()=>{if(!drag)return;drag=null;reset();};
      const click=e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}else if(e.target.closest('[data-depth="0"]'))goTo(index+1,{direction:-1,focus:e.detail===0});};
      const key=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||e.altKey)return;e.preventDefault();e.stopPropagation();const step=e.key==='ArrowRight'?1:-1;goTo(index+step,{direction:-step,focus:true});};
      front?.addEventListener('pointerdown',down);front?.addEventListener('pointermove',move);front?.addEventListener('pointerup',up);front?.addEventListener('pointercancel',cancel);front?.addEventListener('lostpointercapture',cancel);deck.addEventListener('click',click,true);deck.addEventListener('keydown',key);
      const destroy=()=>{disposed=true;flight?.cancel();lift?.cancel();front?.removeEventListener('pointerdown',down);front?.removeEventListener('pointermove',move);front?.removeEventListener('pointerup',up);front?.removeEventListener('pointercancel',cancel);front?.removeEventListener('lostpointercapture',cancel);deck.removeEventListener('click',click,true);deck.removeEventListener('keydown',key);cleanups.delete(destroy);};
      cleanups.add(destroy);return {goTo,destroy};
    }
    function enterMaterials(cards){
      if(dead||reduced()||!Element.prototype.animate)return;
      requestAnimationFrame(()=>{
        if(dead)return;
        const editor=root.querySelector('.mc-editor'),bounds=editor?.getBoundingClientRect(),targets=cards.filter(card=>{const r=card.getBoundingClientRect();return card.isConnected&&r.width>0&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight&&(!bounds||(r.right>bounds.left&&r.left<bounds.right&&r.bottom>bounds.top&&r.top<bounds.bottom));}).slice(0,12);
        if(!targets.length)return;
        const layer=document.createElement('div');layer.className='mc-studio mc-motion-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);
        let remaining=targets.length;
        const finishLayer=()=>{if(--remaining===0){layer.remove();cleanups.delete(cleanup);materialCleanups.delete(cleanup);}};
        const local=[];
        const cleanup=()=>{for(const {animation,card,visibility}of local){animation.cancel();card.style.visibility=visibility;}layer.remove();cleanups.delete(cleanup);materialCleanups.delete(cleanup);};cleanups.add(cleanup);materialCleanups.add(cleanup);
        targets.forEach((card,index)=>{
          const rect=card.getBoundingClientRect(),ghost=card.cloneNode(true),visibility=card.style.visibility;
          ghost.classList.add('mc-material-flight');ghost.removeAttribute('data-asset-id');ghost.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;`;
          layer.append(ghost);card.style.visibility='hidden';
          const dx=innerWidth*.5-(rect.left+rect.width*.5),dy=innerHeight*.46-(rect.top+rect.height*.5);
          const animation=play(ghost,[{transform:`translate(${dx}px,${dy}px) scale(.58) rotate(${index%2?7:-7}deg)`,opacity:0,filter:'blur(14px)'},{offset:.3,opacity:1,filter:'blur(5px)'},{transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1,filter:'blur(0px)'}],{duration:520,delay:Math.min(index*55,330),easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
          local.push({animation,card,visibility});animation.finished.catch(()=>{}).finally(()=>{card.style.visibility=visibility;ghost.remove();finishLayer();});
        });
      });
    }
    return {bindDeck,enterMaterials,cancelMaterials(){for(const cleanup of [...materialCleanups])cleanup();},destroy(){dead=true;for(const cleanup of [...cleanups])cleanup();for(const animation of animations)animation.cancel();animations.clear();}};
  }
  window.MerchantClipMotion={create,wrapIndex,swipeStep};
})();
