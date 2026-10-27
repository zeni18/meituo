import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// The shipped Nuxt shell loads a global button reset after lazy assets. Scope Semi
// at build time so its controls keep their own states without affecting other apps.
const scopeSemi={postcssPlugin:'geo-scope-semi',Rule(rule:any){if(!/[\\/]@douyinfe[\\/]/.test(rule.source?.input?.file||''))return;if(rule.parent?.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;rule.selectors=rule.selectors.map((selector:string)=>selector.includes('.semi-always-')?selector.replace(/\.semi-always-(dark|light)/g,'.geo-semi.semi-always-$1'):selector.includes('.semi-')?'.geo-semi '+selector:selector);}};
export default defineConfig({plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},css:{postcss:{plugins:[scopeSemi]}},build:{outDir:'../../public/merchant/geo-semi',emptyOutDir:true,lib:{entry:'src/main.tsx',name:'MerchantGeoSemi',formats:['iife'],fileName:()=> 'workspace.js'},rollupOptions:{output:{assetFileNames:'[name][extname]'}}}});
