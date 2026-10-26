/* Radio Gali motion layer: page transitions, gentle reveals, safe back/forward handling */
(()=>{'use strict';
const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const path=location.pathname;
const homePath=/\/index\.html$/.test(path)||path==='/'||path.endsWith('/');
const overlay=document.createElement('div');
overlay.id='rg-page-transition';
overlay.setAttribute('aria-hidden','true');
document.body.appendChild(overlay);
requestAnimationFrame(()=>{document.documentElement.classList.add('rg-motion-ready');overlay.classList.add('rg-transition-out');setTimeout(()=>overlay.remove(),reduce?0:520)});
const internal=(a)=>{if(!a||!a.href||a.target==='_blank'||a.hasAttribute('download'))return false;try{const u=new URL(a.href,location.href);return u.origin===location.origin&&u.pathname!==location.pathname&&/^https?:$/.test(u.protocol)}catch(e){return false}};
document.addEventListener('click',e=>{const a=e.target.closest('a');if(!internal(a)||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0||reduce)return;e.preventDefault();overlay.classList.remove('rg-transition-out');overlay.classList.add('rg-transition-in');setTimeout(()=>{location.href=a.href},210)});
window.addEventListener('pageshow',()=>{overlay.classList.remove('rg-transition-in');overlay.classList.add('rg-transition-out');document.documentElement.classList.add('rg-motion-ready');setTimeout(()=>{if(overlay.isConnected)overlay.remove()},reduce?0:450)});
if('IntersectionObserver'in window&&!reduce){const targets=document.querySelectorAll('.station,.panel,.section-head,.journey-visual,.journey-player,.map-panel,.quote blockquote');targets.forEach(el=>el.classList.add('rg-reveal'));const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('rg-visible');io.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -25px 0px'});targets.forEach(el=>io.observe(el))}
})();