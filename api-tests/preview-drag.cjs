// Funkcja samodzielna: Playwright wykonuje ją w dokumencie strony.
function enablePreviewDragging() {
  const host=document.getElementById('qa-test-preview');
  if(!host||host.dataset.movable==='true')return;
  host.dataset.movable='true';
  const storageKey='qa-test-preview-position';let position,drag,suppressClick=false;
  const place=(left,top)=>{
    const rect=host.getBoundingClientRect(),gap=8;
    position={left:Math.max(gap,Math.min(left,Math.max(gap,innerWidth-rect.width-gap))),top:Math.max(gap,Math.min(top,Math.max(gap,innerHeight-rect.height-gap)))};
    Object.assign(host.style,{left:position.left+'px',top:position.top+'px',right:'auto',bottom:'auto'});
  };
  try{const stored=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(stored&&Number.isFinite(stored.left)&&Number.isFinite(stored.top))place(stored.left,stored.top);}catch{}
  const insideHandle=event=>{const rect=host.getBoundingClientRect();return event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=Math.min(rect.bottom,rect.top+42);};
  // Nakładka pozostaje przezroczysta dla kliknięć automatu. Przechwytujemy
  // dopiero rzeczywiste przeciągnięcie za górny pasek, a nie samo kliknięcie.
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||!insideHandle(event))return;
    const rect=host.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moving:false};
  },true);
  document.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moving&&Math.hypot(dx,dy)<5)return;
    drag.moving=true;place(drag.left+dx,drag.top+dy);
    event.preventDefault();event.stopImmediatePropagation();
  },{capture:true,passive:false});
  const finish=event=>{
    if(drag?.id!==event.pointerId)return;
    const moved=drag.moving;drag=null;
    if(!moved)return;
    try{sessionStorage.setItem(storageKey,JSON.stringify(position));}catch{}
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    event.preventDefault();event.stopImmediatePropagation();
  };
  document.addEventListener('pointerup',finish,true);
  document.addEventListener('pointercancel',finish,true);
  document.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  const clamp=()=>{if(position)place(position.left,position.top);};
  window.addEventListener('resize',clamp);new ResizeObserver(clamp).observe(host);
}
module.exports={enablePreviewDragging};
