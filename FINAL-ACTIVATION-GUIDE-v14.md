# Balkan Agent — završni vodič za aktivaciju

> **Važna poreska napomena:** račun je podešen da prikazuje „VAT / PDV: Not charged“. To je tehnička postavka prema korisničkom zahtjevu, a ne pravna potvrda poreskog statusa. Prije prvog naplaćenog računa potvrdi sa knjigovođom ili poreskim savjetnikom da li je takav obračun dozvoljen za tvoj pravni status i zemlju poreske rezidentnosti.

## 1. Postavi source paket

Uploaduj sadržaj foldera u Cloudflare Pages projekat. `index.html`, svih sedam HTML stranica, `functions/[[path]].js`, `schema.sql`, `robots.txt`, `sitemap.xml`, BA logo i novu MP4 prezentaciju moraju ostati u istim relativnim putanjama. Nemoj brisati folder `functions`.

## 2. Poveži Cloudflare D1

U Cloudflare Pages/Workers projektu kreiraj ili izaberi D1 bazu, dodaj binding pod imenom `DB`, zatim izvrši `schema.sql`. Provjeri da registracija, invoice tabela, pricing konfiguracija i reservations tabela postoje prije live testa.

## 3. Dodaj server-side varijable

Postavi `SESSION_SECRET` i jaku `ADMIN_PASSWORD`. Za fakturu postavi `INVOICE_COMPANY_NAME=BALKAN AGENT`, `INVOICE_ACCOUNT_HOLDER=Suljevic Fariz`, `INVOICE_IBAN=DE40 1001 1001 2345 8334 17`, `INVOICE_SWIFT=NTSBDEB1XXX`, `INVOICE_CONTACT_EMAIL=info@balkanagent.com` i `INVOICE_FROM_EMAIL=info@balkanagent.com`. Ako je adresa, poreski broj ili naziv pravnog subjekta drugačiji od starog računa, dopuni `INVOICE_COMPANY_ADDRESS` i `INVOICE_TAX_ID` samo potvrđenim vrijednostima.

## 4. Aktiviraj email račune

Otvori Resend ili drugi podržani email provider, verifikuj domen `balkanagent.com`, dodaj SPF/DKIM zapise koje provider prikaže i postavi `RESEND_API_KEY` kao server secret. Kod automatske aktivacije naloga sistem pravi invoice, generiše PDF sa bankovnim instrukcijama i pokušava ga poslati na email kupca sa `info@balkanagent.com`. Prije prve mušterije uradi test sa vlastitom adresom i provjeri i inbox i spam folder.

## 5. Aktiviraj AI bota

Za sigurni fallback ne treba AI ključ. Za prave AI odgovore postavi `BOT_AI_API_URL`, `BOT_AI_API_KEY` i `BOT_AI_MODEL` kao server secrets. API ključ nikada ne stavljaj u HTML. Zatim testiraj pitanja o cijenama, turizmu, medicinskoj administraciji, rezervaciji, kanalima, bank transferu i kontaktu. Medicinski bot daje samo administrativne informacije i predaje osjetljive slučajeve timu.

## 6. Poveži poslovne kanale

Postavi `CHANNEL_WEBHOOK_SECRET` i, ako provider traži verifikacioni izazov, `CHANNEL_VERIFY_TOKEN`. U Meta/Viber dashboardu koristi HTTPS endpoint `/api/channels/verify` za provjeru i `/api/channels/inbound` za ulazne poruke. Svaki provider i dalje zahtijeva vlastiti odobreni poslovni nalog, outbound token, payload mapping i webhook approval. Ne kopiraj privatne ključeve u browser.

## 7. Provjeri invoice tok

Registruj testnog korisnika, prijavi se kao admin, odaberi paket, provjeri 25% godišnji popust, aktiviraj kupca i potvrdi da je invoice broj kreiran. Provjeri da PDF sadrži BALKAN AGENT, kupca, paket, iznos, EUR valutu, „VAT / PDV: Not charged“, rok, account holder, IBAN, BIC i payment reference. Nakon provjere obriši testne zapise prije prvog pravog kupca.

## 8. SEO aktivacija

U Google Search Console dodaj `https://balkanagent.com/`, potvrdi domen, pošalji `https://balkanagent.com/sitemap.xml` i zatraži indeksiranje početne stranice. `robots.txt`, canonical, Open Graph, JSON-LD i lokalizovane ključne fraze su već dodati. SEO može poboljšati vidljivost, ali nije moguće garantovati prvo mjesto za opštu riječ „Balkan“.

## 9. Konačna provjera

Provjeri desktop i mobilni homepage, promjenu jezika, novi video, logo bez pozadine, login, registraciju, customer portal, admin pricing, invoice email, chat sa najmanje sedam različitih pitanja i rezervacijski tok. Tek nakon uspješnog testa uključi javnu naplatu.
