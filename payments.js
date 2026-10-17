/* Payment UI only — financial transactions occur at the provider's checkout. */
(() => {
  const c = window.BA_PAYMENT_CONFIG || {};
  const whopValid = c.provider === 'whop' && /^plan_[A-Za-z0-9_]+$/.test(c.whopPlanId || '');
  let contraValid = false;
  try { const u = new URL(c.contraPaymentUrl || ''); contraValid = c.provider === 'contra' && u.protocol === 'https:' && (u.hostname === 'contra.com' || u.hostname.endsWith('.contra.com')); } catch (_) {}
  const enabled = c.approved === true && (whopValid || contraValid);
  document.querySelectorAll('[data-ba-pay-entry]').forEach(a => { a.hidden = !enabled; });
  const mount = document.querySelector('[data-ba-pay-mount]');
  if (!mount) return;
  const lang = document.documentElement.lang || 'en';
  const strings = {
    en: { off: 'Online payment is not available yet. To arrange payment for an agreed project, request an invoice.', link:'Request an invoice', pay:'Continue to secure payment', note:'You will pay securely on Contra. No account is required for the customer.' },
    de: { off: 'Online-Zahlung ist noch nicht verfügbar. Bitte fordern Sie für ein vereinbartes Projekt eine Rechnung an.', link:'Rechnung anfordern', pay:'Zur sicheren Zahlung', note:'Die sichere Zahlung erfolgt bei Contra. Kein Kundenkonto nötig.' },
    fr: { off: 'Le paiement en ligne n’est pas encore disponible. Demandez une facture pour un projet convenu.', link:'Demander une facture', pay:'Continuer vers le paiement sécurisé', note:'Paiement sécurisé sur Contra. Aucun compte client nécessaire.' },
    nl: { off: 'Online betalen is nog niet beschikbaar. Vraag een factuur aan voor een overeengekomen project.', link:'Factuur aanvragen', pay:'Verder naar veilig betalen', note:'Veilig betalen via Contra. De klant heeft geen account nodig.' }
  };
  const t = strings[lang] || strings.en;
  const contact = lang === 'en' ? '/contact.html' : `/${lang}/contact.html`;
  if (!enabled) {
    const p = document.createElement('p'); p.textContent=t.off; mount.appendChild(p);
    const a=document.createElement('a'); a.href=contact; a.className='pay-btn'; a.textContent=t.link; mount.appendChild(a);
    return;
  }
  if (whopValid) {
    const checkout = document.createElement('div');
    checkout.setAttribute('data-whop-checkout-plan-id', c.whopPlanId);
    checkout.setAttribute('data-whop-checkout-theme', 'dark');
    checkout.className='ba-whop-checkout';
    mount.appendChild(checkout);
    const sdk=document.createElement('script');
    sdk.src='https://js.whop.com/static/checkout/loader.js'; sdk.async=true;
    sdk.onerror=()=> { const p=document.createElement('p');p.textContent='Checkout could not load. Please contact us directly.';mount.appendChild(p); };
    document.head.appendChild(sdk);
  } else if (contraValid) {
    const a=document.createElement('a');a.className='pay-btn';a.textContent=t.pay;a.href=c.contraPaymentUrl;a.rel='noopener noreferrer';mount.appendChild(a);
    const p=document.createElement('p');p.className='pay-hint';p.textContent=t.note;mount.appendChild(p);
  }
})();
