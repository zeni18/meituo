/* One themed calendar for the added merchant, agent, OEM and platform pages.
   Preserve the original named control, local ISO values, validation and form events. */
(() => {
  'use strict';
  const formats={date:'Y-m-d','datetime-local':'Y-m-d\\TH:i',time:'H:i'};
  function parseLocal(value,kind='date'){
    if(value instanceof Date)return Number.isNaN(value.getTime())?undefined:new Date(value.getTime());
    if(typeof value!=='string'||!value.trim())return undefined;
    const match=kind==='time'?value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/):value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!match)return undefined;
    const [year,month,day,hour,minute,second]=kind==='time'?[2000,1,1,+match[1],+match[2],+(match[3]||0)]:[+match[1],+match[2],+match[3],+(match[4]||0),+(match[5]||0),+(match[6]||0)];
    if(year<1||year>9999||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)return undefined;
    const date=new Date(0);date.setFullYear(year,month-1,day);date.setHours(hour,minute,second,0);
    return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day&&date.getHours()===hour&&date.getMinutes()===minute?date:undefined;
  }
  window.AddedPageDates={parseLocal,formats};
  if(!window.flatpickr||!('showPopover' in HTMLElement.prototype))return;
  const scope='.mw-workspace,.mc-studio,.hp-page,.oem-directory';
  const selector='input[type="date"],input[type="datetime-local"],input[type="time"]';
  const controls=new Map();let active=null,serial=0,frame=0;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function place(fp){
    if(!fp.isOpen)return;
    const r=fp.altInput.getBoundingClientRect(),panel=fp.calendarContainer;
    if(!r.width||r.bottom<0||r.top>innerHeight){fp.close();return;}
    const box=panel.getBoundingClientRect(),below=innerHeight-r.bottom-12,above=r.top-12;
    const up=below<box.height&&above>below;
    panel.style.left=Math.max(8,Math.min(r.left,innerWidth-box.width-8))+'px';
    panel.style.top=Math.max(8,Math.min(up?r.top-box.height-8:r.bottom+8,innerHeight-box.height-8))+'px';
  }
  function enhance(input){
    if(controls.has(input)||input._flatpickr||!input.closest(scope)||input.hasAttribute('data-native-date'))return;
    const kind=input.type,resetValue=input.defaultValue,owner={input,kind,instance:null,wrap:null,label:null,oldFor:null,bounds:{}};
    const caption=input.getAttribute('aria-label')||input.closest('label')?.querySelector(':scope > span')?.textContent?.trim()||(kind==='date'?'选择日期':kind==='time'?'选择时间':'选择日期时间');
    const withSeconds=kind!=='date'&&Number(input.step)>0&&Number(input.step)<60;
    const format=formats[kind]+(withSeconds?':S':'');
    const instance=window.flatpickr(input,{
      locale:{...window.flatpickr.l10ns.zh,firstDayOfWeek:1},dateFormat:format,
      altInput:true,altFormat:kind==='datetime-local'?'Y-m-d H:i'+(withSeconds?':S':''):format,altInputClass:'dp-input',
      allowInput:true,disableMobile:true,enableTime:kind!=='date',enableSeconds:withSeconds,noCalendar:kind==='time',time_24hr:true,minuteIncrement:1,
      monthSelectorType:'static',ariaDateFormat:'Y年n月j日',
      minDate:input.min||undefined,maxDate:input.max||undefined,
      defaultDate:input.value||undefined,parseDate:value=>parseLocal(value,kind),
      appendTo:input.closest('dialog')||document.body,position:place,
      prevArrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
      nextArrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>',
      errorHandler:()=>owner.instance?.altInput.setCustomValidity('请输入有效的日期或时间'),
      onReady:(_,__,fp)=>{
        owner.instance=fp;const display=fp.altInput,panel=fp.calendarContainer;
        const admin=!document.documentElement.matches('[data-pc-design=imagine]');
        owner.wrap=node('span','dp-control'+(admin?' dp-admin-control':''));display.before(owner.wrap);owner.wrap.append(display);
        display.size=kind==='date'?10:kind==='time'?6:16;
        display.placeholder=input.placeholder||(kind==='date'?'选择日期':kind==='time'?'选择时间':'选择日期时间');
        display.setAttribute('aria-label',caption);display.setAttribute('aria-haspopup','dialog');display.setAttribute('aria-expanded','false');
        if(input.getAttribute('aria-describedby'))display.setAttribute('aria-describedby',input.getAttribute('aria-describedby'));
        panel.id='dp-calendar-'+(++serial);display.setAttribute('aria-controls',panel.id);panel.classList.add('dp-calendar');if(admin)panel.classList.add('dp-admin');
        panel.setAttribute('popover','manual');panel.setAttribute('role','dialog');panel.setAttribute('aria-label',caption+'日历');
        fp.prevMonthNav.setAttribute('role','button');fp.prevMonthNav.setAttribute('aria-label','上个月');fp.prevMonthNav.tabIndex=0;
        fp.nextMonthNav.setAttribute('role','button');fp.nextMonthNav.setAttribute('aria-label','下个月');fp.nextMonthNav.tabIndex=0;
        for(const arrow of [fp.prevMonthNav,fp.nextMonthNav])arrow.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();arrow.click();}});
        if(fp.currentYearElement)fp.currentYearElement.setAttribute('aria-label','年份');
        for(const [selector,name]of [['.flatpickr-hour','小时'],['.flatpickr-minute','分钟'],['.flatpickr-second','秒']])panel.querySelector(selector)?.setAttribute('aria-label',name);
        const foot=node('div','dp-footer'),clear=node('button','dp-action','清除'),today=node('button','dp-action','今天');
        clear.type=today.type='button';clear.addEventListener('click',()=>{fp.clear();display.setCustomValidity('');fp.close();display.focus();});
        today.addEventListener('click',()=>{const now=new Date();if(kind==='date')now.setHours(0,0,0,0);else if(!withSeconds)now.setSeconds(0,0);if((fp.config.minDate&&now<fp.config.minDate)||(fp.config.maxDate&&now>fp.config.maxDate))return;fp.setDate(now,true);if(kind==='date')fp.close();});
        foot.append(clear);if(kind!=='time')foot.append(today);
        if(kind!=='date'){const done=node('button','dp-action dp-confirm','确定');done.type='button';done.addEventListener('click',()=>{fp.close();display.focus();});foot.append(done);}
        panel.append(foot);
        display.addEventListener('input',()=>display.setCustomValidity(display.value&&!parseLocal(display.value,kind)?'请输入有效的日期或时间':''));
        if(input.id){const label=document.querySelector('label[for="'+CSS.escape(input.id)+'"]');if(label){owner.label=label;owner.oldFor=label.htmlFor;display.id=panel.id+'-input';label.htmlFor=display.id;}}
      },
      onDayCreate:(_,__,fp,day)=>{day.setAttribute('role','button');day.setAttribute('aria-disabled',String(day.classList.contains('flatpickr-disabled')));day.setAttribute('aria-pressed',String(day.classList.contains('selected')));if(day.classList.contains('today'))day.setAttribute('aria-current','date');},
      onChange:(_,__,fp)=>{fp.altInput.setCustomValidity('');},
      onOpen:(_,__,fp)=>{
        active?.instance.close();active=owner;fp.altInput.setAttribute('aria-expanded','true');
        fp.calendarContainer.showPopover();place(fp);
        cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>place(fp));
      },
      onClose:(_,__,fp)=>{
        fp.altInput.setAttribute('aria-expanded','false');if(fp.calendarContainer.matches(':popover-open'))fp.calendarContainer.hidePopover();
        if(active===owner)active=null;
      }
    });
    if(!instance?.altInput)return;
    owner.instance=instance;owner.resetValue=resetValue;
    owner.sync=()=>{
      const fp=owner.instance;if(input.disabled)fp.close();fp.altInput.disabled=input.disabled;fp.altInput.required=input.required;
      for(const name of ['min','max'])if(owner.bounds[name]!==input[name]){owner.bounds[name]=input[name];fp.set(name==='min'?'minDate':'maxDate',input[name]||undefined);}
      const formatted=fp.selectedDates[0]?fp.formatDate(fp.selectedDates[0],format):'';
      if(input.value!==formatted)fp.setDate(input.value,false);
    };
    owner.observer=new MutationObserver(owner.sync);owner.observer.observe(input,{attributes:true,attributeFilter:['min','max','disabled','required','value']});
    owner.destroy=()=>{owner.observer.disconnect();instance.destroy();if(owner.label)owner.label.htmlFor=owner.oldFor;owner.wrap.remove();controls.delete(input);};
    controls.set(input,owner);owner.sync();
  }
  function scan(target=document){
    if(target!==document&&target.nodeType!==Node.ELEMENT_NODE)return;
    if(target.matches?.(selector))enhance(target);
    for(const input of target.querySelectorAll(selector))enhance(input);
    for(const [input,owner]of controls)if(!input.isConnected)owner.destroy();
  }
  const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===Node.ELEMENT_NODE)scan(n);for(const [input,owner]of controls)if(!input.isConnected)owner.destroy();});
  observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopPropagation();const display=active.instance.altInput;active.instance.close();display.focus();}},true);
  document.addEventListener('close',event=>{if(active&&event.target.contains(active.input))active.instance.close();},true);
  document.addEventListener('reset',event=>{
    const affected=[];
    for(const [input,owner]of controls)if(input.form===event.target){affected.push({input,owner,value:input.value});input.defaultValue=owner.resetValue;}
    // Hidden named controls reflect value into defaultValue. Restore their baseline before
    // native reset finishes so a synchronous search immediately afterwards sees cleared dates.
    setTimeout(()=>{for(const {input,owner,value}of affected)if(controls.get(input)===owner){owner.instance.setDate(event.defaultPrevented?value:owner.resetValue||'',false);if(!event.defaultPrevented)owner.instance.altInput.setCustomValidity('');}},0);
  },true);
  const reposition=event=>{if(!active||(event.type==='scroll'&&active.instance.calendarContainer.contains(event.target)))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>active&&place(active.instance));};
  document.addEventListener('scroll',reposition,true);window.addEventListener('resize',reposition);
  window.AddedPageDates.refresh=scan;scan();
})();
