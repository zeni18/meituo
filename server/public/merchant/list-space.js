/* Reserve each paginated table's real page capacity without adding dummy records. */
(() => {
  'use strict';
  const pagerSelector='.ms-pagination,.fc-pagination,.mp-pager,.hp-pagination,.gs-pagination';
  let queued=false;
  const tracked=new Map();
  function targetFor(pager){
    let branch=pager,parent=pager.parentElement;
    for(let depth=0;parent&&depth<6;depth++,branch=parent,parent=parent.parentElement){
      if(parent.matches('body,main,aside,dialog'))break;
      const children=[...parent.children],at=children.indexOf(branch);
      for(let i=at-1;i>=0;i--){
        const candidate=children[i];
        if(candidate.matches('dialog,[hidden]'))continue;
        const tables=candidate.matches('table')?[candidate]:[...candidate.querySelectorAll('table')];
        const table=tables.find(t=>t.getBoundingClientRect().width>0);
        if(table)return {region:candidate,table};
      }
      if(parent.matches('.mw-workspace,.geo-semi,.hp-portal,.mp-page,.fc-page'))break;
    }
    return null;
  }
  function capacityFor(pager){
    const explicit=Number(pager.dataset.pageCapacity),choice=pager.querySelector('select[aria-label="每页数量"],.ms-page-size select');
    const value=choice?Number(choice.value):explicit||20;
    return Number.isInteger(value)&&value>0&&value<=500?value:20;
  }
  function release(region,entry){
    region.style.minHeight=entry.minHeight;
    region.style.boxSizing=entry.boxSizing;
    region.removeAttribute('data-list-page-capacity');
    region.removeAttribute('data-list-row-height');
    tracked.delete(region);
  }
  function refresh(){
    queued=false;
    const live=new Set();
    for(const pager of document.querySelectorAll(pagerSelector)){
      if(pager.closest('dialog,[data-list-space-managed]')||!pager.getBoundingClientRect().width)continue;
      const target=targetFor(pager);if(!target)continue;
      const {region,table}=target,size=capacityFor(pager);
      const store=table.classList.contains('ms-brand-store-table'),base=store?100:52;
      const rows=[...region.querySelectorAll('tbody>tr')].filter(row=>row.children.length>1&&!row.querySelector('td[colspan]'));
      const rowHeight=Math.max(base,...rows.map(row=>Math.ceil(row.getBoundingClientRect().height)));
      // Semi may split the header and body into separate tables within the same wrapper.
      const header=[...region.querySelectorAll('thead')].find(head=>head.getBoundingClientRect().height>0);
      const headHeight=header?Math.ceil(header.getBoundingClientRect().height):44;
      const height=headHeight+size*rowHeight;
      if(!tracked.has(region))tracked.set(region,{minHeight:region.style.minHeight,boxSizing:region.style.boxSizing});
      live.add(region);
      if(region.style.minHeight!==height+'px')region.style.minHeight=height+'px';
      if(region.style.boxSizing!=='border-box')region.style.boxSizing='border-box';
      if(region.dataset.listPageCapacity!==String(size))region.dataset.listPageCapacity=String(size);
      if(region.dataset.listRowHeight!==String(rowHeight))region.dataset.listRowHeight=String(rowHeight);
    }
    for(const [region,entry]of tracked)if(!region.isConnected){tracked.delete(region);}else if(!live.has(region))release(region,entry);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-page-capacity','open','hidden']});
  document.addEventListener('change',schedule,true);
  document.addEventListener('DOMContentLoaded',schedule);
  addEventListener('resize',schedule);
  window.MerchantListSpace={refresh:schedule};
  schedule();
})();
