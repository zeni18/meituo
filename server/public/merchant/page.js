/* Native Vue page adapter for the supplied 1.0.399 build. */
import {g as defineComponent,D as useAppStore,j as computed,G as useProfile,J as useCredits,H as onMounted,b as vnode,r as ref,S as WorkspaceChrome} from '/_nuxt/entry.ef871ac3.js?v=mw20261023d';
import {I as MerchantShell,u as useTools} from '/_nuxt/useAiPcHomeDecorate.d01e3f4e.js?v=mw20261023d';

export default defineComponent({
  name:'MerchantWorkspacePage',
  setup(){
    const store=useAppStore(),website=computed(()=>store.getWebsiteConfig),{displayNickname}=useProfile();
    const {remainingCredits,membershipEnabled,refreshCredits}=useCredits(),tools=useTools(),chrome=ref(null);
    onMounted(()=>tools.loadAvailableApps());
    return ()=>vnode('div',{class:'merchant-native-page'},[
      vnode(WorkspaceChrome,{ref:chrome,headless:true,activeSidebar:'merchant',remainingCredits:remainingCredits.value,membershipEnabled:membershipEnabled.value,onIncrementCredits:refreshCredits,onToggleMembership:refreshCredits}),
      vnode(MerchantShell,{activePage:'merchant',website:website.value,credits:remainingCredits.value,nickname:displayNickname.value,membershipEnabled:membershipEnabled.value,tools:tools.displayToolCards.value,banners:[],availableAppCodes:tools.availableAppCodes.value,availableLoading:tools.availableLoading.value,onAction:action=>chrome.value?.handleSidebarAction(action)},{page:()=>vnode('div',{class:'merchant-page-placeholder'})})
    ]);
  }
});
