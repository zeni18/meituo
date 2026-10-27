import {useEffect,useRef} from 'react';

/** Reuse the authenticated merchant account menu, balance and native appearance controls. */
export default function NativeAccount(){
 const slot=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const moved=new Map<Element,{parent:Node;next:ChildNode|null}>();
  const attach=()=>{const control=document.querySelector('.ia-header .merchant-header-account');if(!control||!slot.current||!control.parentNode)return;moved.set(control,{parent:control.parentNode,next:control.nextSibling});slot.current.append(control);};
  attach();const observer=new MutationObserver(attach);observer.observe(document.documentElement,{childList:true,subtree:true});
  return()=>{observer.disconnect();for(const [control,origin]of moved){if(origin.parent.isConnected)origin.parent.insertBefore(control,origin.next?.parentNode===origin.parent?origin.next:null);}};
 },[]);
 return <div className="gs-native-account" ref={slot}/>;
}
