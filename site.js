(()=>{'use strict';
 const header=document.querySelector('#site-header');
 const setHeader=()=>header?.classList.toggle('scrolled',window.scrollY>40);
 window.addEventListener('scroll',setHeader,{passive:true});setHeader();
 const toggle=document.querySelector('.menu-toggle');const mobile=document.querySelector('.mobile-menu');
 function closeMenu(){toggle?.setAttribute('aria-expanded','false');mobile?.classList.remove('open')}
 toggle?.addEventListener('click',()=>{const next=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(next));mobile?.classList.toggle('open',next)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});mobile?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
 document.querySelectorAll('[data-search-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const params=new URLSearchParams(new FormData(form));const filtered=new URLSearchParams();params.forEach((v,k)=>{if(v)filtered.set(k,v)});window.location.href=form.dataset.url+(filtered.toString()?'?'+filtered.toString():'')}));
 // Live filters work on the illustrated collection, not on invented real listings.
 const filterCity=document.querySelector('#filter-city'),filterType=document.querySelector('#filter-type');
 const cards=Array.from(document.querySelectorAll('#listing-grid .collection-card'));
 if(cards.length && filterCity && filterType){const params=new URLSearchParams(location.search);if(params.get('city'))filterCity.value=params.get('city');if(params.get('type'))filterType.value=params.get('type');
  if(params.get('budget')){const notes={"sr-ME":"Budžet je zabilježen kao kriterijum za vaš upit. Prikazane vizualizacije nemaju potvrđene cijene.","de":"Ihr Budget wurde als Suchwunsch übernommen. Die gezeigten Konzepte haben keine bestätigten Preise.","en":"Your budget preference is noted for an individual enquiry. The concepts shown have no verified prices.","ru":"Ваш бюджет сохранён как пожелание для личного запроса. У представленных концепций нет подтверждённых цен."}; const notice=document.createElement('p');notice.className='budget-notice';notice.textContent=notes[document.documentElement.lang]||notes.en;document.querySelector('.listing-controls')?.after(notice);}

  function applyFilter(){let count=0;cards.forEach(card=>{const matchCity=!filterCity.value||card.dataset.cardCity===filterCity.value;const matchType=!filterType.value||card.dataset.cardType===filterType.value;const visible=matchCity&&matchType;card.hidden=!visible;if(visible)count++});const num=document.querySelector('#result-count'),empty=document.querySelector('#empty-state');if(num)num.textContent=String(count);if(empty)empty.hidden=count!==0;const current=new URL(location.href);if(filterCity.value)current.searchParams.set('city',filterCity.value);else current.searchParams.delete('city');if(filterType.value)current.searchParams.set('type',filterType.value);else current.searchParams.delete('type');if(location.origin!=='null')history.replaceState(null,'',current.pathname+current.search);}
  filterCity?.addEventListener('change',applyFilter);filterType?.addEventListener('change',applyFilter);applyFilter();}
 const form=document.querySelector('[data-mail-form]');
 if(form){const par=new URLSearchParams(location.search);const interest=form.querySelector('[name=interest]');if(interest){const budgets={'250k-plus':'€250,000+','250k-500k':'€250,000–€500,000','500k-1m':'€500,000–€1,000,000','1m-3m':'€1,000,000–€3,000,000','over-3m':'€3,000,000+'};const budget=par.get('budget');const val=[par.get('interest')==='construction'?'Custom construction / Izgradnja po želji':'',par.get('city'),par.get('type'),budget?(budgets[budget]||budget):''].filter(Boolean).join(' / ');if(val)interest.value=val;}}

 form?.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);const body=['Name / Ime: '+data.get('name'),'Email: '+data.get('email'),'Interest / Lokacija: '+data.get('interest'),'','Message / Poruka:','',''+data.get('message')].join('\n');const subj=(form.dataset.subject||'Balkan Agent Enquiry')+' — '+(data.get('interest')||'Private enquiry');window.location.href='mailto:info@balkanagent.com?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);});
})();
