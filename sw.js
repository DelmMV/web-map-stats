if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,r)=>{const l=e||("document"in self?document.currentScript.src:"")||location.href;if(s[l])return;let o={};const t=e=>i(e,l),u={module:{uri:l},exports:o,require:t};s[l]=Promise.all(n.map((e=>u[e]||t(e)))).then((e=>(r(...e),o)))}}define(["./workbox-3e911b1d"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/AddStationModal-YyATAEM-.js",revision:null},{url:"assets/chunk-3ASUQ6PA-BDYvKFUx.js",revision:null},{url:"assets/chunk-4IH3O7BJ-TOE2q0K3.js",revision:null},{url:"assets/chunk-6CVSDS6C-hsWb2wW9.js",revision:null},{url:"assets/chunk-RAWN7VJ3-DUTKW15K.js",revision:null},{url:"assets/chunk-W7WUSNWJ-DTPLwIKd.js",revision:null},{url:"assets/DrawerMenu-BoytM51a.js",revision:null},{url:"assets/EditStationModal-Dj0uRvmw.js",revision:null},{url:"assets/index-Dape29UY.js",revision:null},{url:"assets/index-G0TBfKmt.css",revision:null},{url:"assets/StationModal-_4M_69-O.js",revision:null},{url:"index.html",revision:"96c30b9df3705d4e1c6904c59e371c24"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"apple-touch-icon.png",revision:"9ec4dfc2d02f26c016851c701d72a077"},{url:"favicon.ico",revision:"c6a287fe1641102208066dbc953fa7c1"},{url:"masked-icon.svg",revision:"8a988b9614f20d57d44800ef8cb128fc"},{url:"pwa-192.png",revision:"007ed8b709f343b21c66d02f2a25fd39"},{url:"pwa-512.png",revision:"b53d390b809349d2c5024abc67080ad3"},{url:"manifest.webmanifest",revision:"1a7a26ef6eb7a631480390da41ce7bbd"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
