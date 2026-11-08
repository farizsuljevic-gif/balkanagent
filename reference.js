(() => {
  'use strict';
  const button = document.querySelector('.mobile-menu-button');
  const nav = document.querySelector('.mobile-nav');
  button?.addEventListener('click', () => {
    if (!nav) return;
    const open = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      nav?.classList.remove('open');
      button?.setAttribute('aria-expanded', 'false');
    }
  });
})();
