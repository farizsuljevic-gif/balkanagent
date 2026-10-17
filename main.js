/* Balkan Agent: no tracking scripts, no analytics, no dependencies. */
(() => {
  const toggle = document.querySelector('.mobile-toggle');
  const menu = document.getElementById('mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      menu.hidden = isOpen;
      toggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    }));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }
  const form = document.getElementById('inquiry-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type=submit]');
  const formTranslations = {"de": {"Checking the secure contact form…": "Sichere Kontaktanfrage wird geprüft …", "Thank you — your message was accepted by the email service. We will respond by email.": "Vielen Dank. Der E-Mail-Dienst hat Ihre Nachricht angenommen. Wir antworten per E-Mail.", "Email sending is not yet configured on this site. Click the link below to send your enquiry directly from your email app.": "Der E-Mail-Versand ist noch nicht eingerichtet. Bitte senden Sie Ihre Anfrage über den folgenden Link mit Ihrem E-Mail-Programm.", "The form was not sent. Please write to info@balkanagent.com directly.": "Das Formular wurde nicht versendet. Schreiben Sie bitte direkt an info@balkanagent.com.", "The form service is unavailable. Use the email link below to contact us.": "Der Formulardienst ist nicht erreichbar. Nutzen Sie den E-Mail-Link unten.", "Open a prepared email to Balkan Agent →": "Vorbereitete E-Mail an Balkan Agent öffnen →", "Open prepared email →": "Vorbereitete E-Mail öffnen →", "Open menu": "Menü öffnen", "Close menu": "Menü schließen"}, "fr": {"Checking the secure contact form…": "Vérification du formulaire sécurisé…", "Thank you — your message was accepted by the email service. We will respond by email.": "Merci, votre message a été accepté par le service de messagerie. Nous répondrons par e-mail.", "Email sending is not yet configured on this site. Click the link below to send your enquiry directly from your email app.": "L’envoi d’e-mails n’est pas encore configuré. Utilisez le lien ci-dessous pour envoyer votre demande depuis votre messagerie.", "The form was not sent. Please write to info@balkanagent.com directly.": "Le formulaire n’a pas été envoyé. Écrivez directement à info@balkanagent.com.", "The form service is unavailable. Use the email link below to contact us.": "Le service de formulaire est indisponible. Utilisez le lien e-mail ci-dessous.", "Open a prepared email to Balkan Agent →": "Ouvrir un e-mail préparé pour Balkan Agent →", "Open prepared email →": "Ouvrir un e-mail préparé →", "Open menu": "Ouvrir le menu", "Close menu": "Fermer le menu"}, "nl": {"Checking the secure contact form…": "Beveiligd contactformulier wordt gecontroleerd…", "Thank you — your message was accepted by the email service. We will respond by email.": "Bedankt. Uw bericht is door de e-maildienst geaccepteerd. We antwoorden per e-mail.", "Email sending is not yet configured on this site. Click the link below to send your enquiry directly from your email app.": "E-mailverzending is nog niet ingesteld. Gebruik de link hieronder om uw aanvraag via uw e-mailprogramma te versturen.", "The form was not sent. Please write to info@balkanagent.com directly.": "Het formulier is niet verzonden. Mail rechtstreeks naar info@balkanagent.com.", "The form service is unavailable. Use the email link below to contact us.": "De formulierdienst is niet bereikbaar. Gebruik de e-maillink hieronder.", "Open a prepared email to Balkan Agent →": "Voorbereide e-mail aan Balkan Agent openen →", "Open prepared email →": "Voorbereide e-mail openen →", "Open menu": "Menu openen", "Close menu": "Menu sluiten"}};
  const localize = (message) => formTranslations[document.documentElement.lang]?.[message] || message;
  const show = (message) => {
    status.textContent = localize(message);
    status.hidden = false;
  };
  const mailtoLink = (data) => {
    const subject = 'Balkan Agent project enquiry — ' + (data.service || 'Other');
    const body = [
      'Name: ' + data.name,
      'Company: ' + (data.company || '-'),
      'Country: ' + (data.country || '-'),
      'Website: ' + (data.website || '-'),
      'Email: ' + data.email,
      'Requested service: ' + data.service,
      '',
      data.message
    ].join('\n');
    return 'mailto:info@balkanagent.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const values = Object.fromEntries(fields.entries());
    if (values.contact_time) return; // basic bot honeypot
    button.disabled = true;
    show('Checking the secure contact form…');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify(values),
        credentials: 'same-origin'
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        show('Thank you — your message was accepted by the email service. We will respond by email.');
        form.reset();
        return;
      }
      if (response.status === 503 || result.fallback) {
        show('Email sending is not yet configured on this site. Click the link below to send your enquiry directly from your email app.');
        const a = document.createElement('a');
        a.href = mailtoLink(values);
        a.textContent = localize('Open a prepared email to Balkan Agent →');
        a.className = 'text-link';
        a.style.display = 'block';
        a.style.marginTop = '8px';
        status.appendChild(a);
        return;
      }
      show(result.error || 'The form was not sent. Please write to info@balkanagent.com directly.');
    } catch {
      show('The form service is unavailable. Use the email link below to contact us.');
      const a = document.createElement('a');
      a.href = mailtoLink(values);
      a.textContent = localize('Open prepared email →');
      a.className = 'text-link';
      a.style.display = 'block';
      a.style.marginTop = '8px';
      status.appendChild(a);
    } finally {
      button.disabled = false;
    }
  });
})();
