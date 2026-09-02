# Balkan Agent — kompletno uputstvo za objavu i aktivaciju

Ovaj vodič je namijenjen za **stvarni source paket Balkan Agent**. Ne odnosi se na Growth & Monetization Review projekat. Uvijek uploaduj kompletan sadržaj foldera `balkanagent-source-package`, uključujući `functions/`, `schema.sql`, sve HTML stranice, `robots.txt`, `sitemap.xml` i BA logo/map assete.

> **Važna poreska napomena:** račun je tehnički podešen sa tekstom „VAT / PDV: Not charged“ prema tvom zahtjevu. To nije pravna potvrda da VAT/PDV nije primjenjiv. Prije prvog računa potvrdi status sa knjigovođom ili poreskim savjetnikom.

## 1. Šta je u paketu

| Dio | Fajl ili postavka | Namjena |
|---|---|---|
| Javni sajt | `index.html` | Homepage, premium BA dizajn, chat, cijene, SEO |
| Prijava i korisnici | `login.html`, `register.html`, `customer.html` | Admin/customer login, registracija i portal |
| Admin | `admin.html` | Aktivacija kupaca, paketi, monthly/annual izbor, popust, invoice i rezervacije |
| Backend | `functions/[[path]].js` | Auth, D1, bot, reservations, invoice, email i webhook endpointi |
| Baza | `schema.sql` | users, invoices, pricing, reservations i potrebna polja |
| SEO | `robots.txt`, `sitemap.xml` | Crawl pravila i javni URL-ovi |
| Brand | BA PNG asseti | BA logo i mapa |

## 2. Cloudflare Pages projekat

U Cloudflare dashboardu otvori **Workers & Pages → Create application → Pages → Connect to Git** ili uploaduj gotov source paket ako koristiš Direct Upload. Ako koristiš Git, poveži repository koji sadrži source paket.

Za ovaj paket je najvažnije da se `functions/` ne preimenuje i ne izostavi. Ako koristiš framework preset, izaberi opciju bez nepotrebnog build koraka za statički HTML paket. Ako dashboard traži build command, koristi prazan build command ili command koji ne briše HTML i `functions` direktorij. Output directory treba da bude root source paketa.

Nakon prvog deploya otvori testni `pages.dev` URL i provjeri da `index.html`, `login.html`, `register.html` i `functions/[[path]].js` nisu dobili 404.

Cloudflare Pages Functions resurse kao što je D1 dobija preko bindinga. Cloudflare navodi da binding može biti postavljen u Pages dashboardu i da je dostupan kroz `context.env` [1].

## 3. D1 baza i schema

U Cloudflare dashboardu idi na **Workers & Pages → D1 SQL database → Create database**. Preporučeni naziv je `balkan-agent-production-db`.

Zatim u Pages projektu otvori **Settings → Functions → Bindings** ili **Settings → Bindings**, izaberi **D1 database**, a kao binding/variable name unesi tačno:

```text
DB
```

Izvrši sadržaj `schema.sql` nad produkcijskom D1 bazom. Ako koristiš Wrangler, tipičan redoslijed je:

```bash
npx wrangler d1 execute balkan-agent-production-db --remote --file=./schema.sql
npx wrangler d1 execute balkan-agent-production-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Ne pokreći `DROP TABLE` nad produkcijom. Schema koristi `CREATE TABLE IF NOT EXISTS`, a backend ima i legacy-safe provjeru invoice kolona. Nakon migracije treba da postoje najmanje tabele `users`, `invoices`, `pricing_config`, `pricing_plans` i `reservations`.

Cloudflareov D1 vodič potvrđuje da se baza kreira odvojeno i zatim veže za aplikaciju kroz binding; binding name je ime koje kod koristi preko `env` objekta [2].

## 4. Cloudflare secrets i variables

Otvori **Pages project → Settings → Variables and Secrets → Production**. Za svaku vrijednost označenu kao secret koristi **Encrypt**, a zatim uradi novi deploy. Iste vrijednosti postavi i u Preview samo ako želiš testirati preview deployment.

### Obavezne server secrets

| Varijabla | Vrijednost | Napomena |
|---|---|---|
| `SESSION_SECRET` | duga slučajna vrijednost, najmanje 32 bajta | koristi password manager ili generator; ne stavljaj u HTML |
| `ADMIN_PASSWORD` | jaka privatna administratorska lozinka | nije `ceo@balkanagent.com`; email je login, lozinka je secret |
| `INVOICE_ACCOUNT_HOLDER` | `Suljevic Fariz` | vlasnik računa za bank transfer |
| `INVOICE_IBAN` | `DE40 1001 1001 2345 8334 17` | potvrdi prije prvog live računa |
| `INVOICE_SWIFT` | `NTSBDEB1XXX` | potvrdi da je BIC prepisan tačno |
| `INVOICE_FROM_EMAIL` | `info@balkanagent.com` ili ranija vrijednost `Balkan Agent <info@balkanagent.com>` | sender za invoice i registration email; backend iz obje varijante koristi čistu verifikovanu adresu |

### Invoice variables

| Varijabla | Preporučena vrijednost |
|---|---|
| `INVOICE_COMPANY_NAME` | `BALKAN AGENT` |
| `INVOICE_CONTACT_EMAIL` | `info@balkanagent.com` | invoice kontakt i podrazumijevani recipient za owner obavijest o novoj registraciji |
| `INVOICE_PHONE` | `+382 68 400 509` ako je i dalje tačan |
| `INVOICE_DUE_DAYS` | `7` |
| `INVOICE_COMPANY_ADDRESS` | unesi samo potvrđenu pravnu adresu iz starog računa |
| `INVOICE_TAX_ID` | ostavi prazno dok ne potvrdiš stvarni poreski broj |
| `INVOICE_BANK_NAME` | unesi tačan naziv banke ako želiš da bude na računu |

Na računu je podešeno da nema obračunatog VAT/PDV-a. Nemoj upisivati poreski broj ili pravni status koji nije potvrđen.

### Jednokratna aktivacija

Aktivaciona naknada se naplaćuje jednom pri prvoj aktivaciji i ne umanjuje se godišnjim popustom. Početni cjenik ima četiri javna paketa: Starter `89 EUR/mjesečno + 149 EUR aktivacija`, Business `199 EUR/mjesečno + 349 EUR aktivacija`, Pro `399 EUR/mjesečno + 699 EUR aktivacija` i Premium `699 EUR/mjesečno + 990 EUR aktivacija`. Premium je prikazan kao posljednji paket sa najširim stvarnim obimom: do 20 AI agenata, svi podržani kanali i prioritetna podrška. Prvi invoice prikazuje aktivaciju zajedno sa izabranom mjesečnom ili godišnjom pretplatom; kod godišnjeg paketa 25% popusta važi samo za pretplatu. Premium godišnja pretplata iznosi `6.291 EUR`, a aktivacija ostaje `990 EUR`. Ove cijene su početni cjenik i vlasnik ih treba potvrditi prije objave u skladu sa svojim troškovima i poreskim statusom.

## 5. Email slanje invoice računa

Paket koristi Resend-kompatibilan server-side email tok. Otvori Resend dashboard, dodaj `balkanagent.com` ili namjenski subdomen za transakcijske poruke i unesi DNS zapise koje Resend prikaže. Resend zahtijeva verifikovan domen za slanje i navodi da se nakon verifikacije mogu koristiti adrese na tom domenu [3].

U Cloudflare Production secrets dodaj:

```text
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

Ne kopiraj ključ u `index.html`, `admin.html`, GitHub ili javni chat. Backend je kompatibilan sa starim display-name podešavanjem `Balkan Agent <info@balkanagent.com>` i automatski ga normalizuje. Za Cloudflare Production ipak preporučujem čistu vrijednost, jer provider validacija tako ostaje najstabilnija:

```text
info@balkanagent.com
```

Prije prvog klijenta pošalji test na vlastiti email. Provjeri inbox i spam folder. Nova customer registracija sada pravi pending nalog i automatski šalje owner obavijest na `INVOICE_CONTACT_EMAIL` (ili na opcioni `OWNER_NOTIFICATION_EMAIL`). Aktivacija kupca zatim pravi invoice i šalje ga kupcu. Ako provider nije podešen ili domen nije verifikovan, nalog i invoice zapis mogu uspjeti, ali odgovor jasno sadrži `owner_notification_sent:false` ili `email_sent:false`; invoice se može ponovo poslati iz admina nakon popravke. Nakon izmjene secrets obavezno uradi novi Production deploy.

## 6. AI bot

Bez AI providera javni chat koristi sigurni lokalni FAQ fallback. Za stvarne AI odgovore dodaj server-side secrets:

```text
BOT_AI_API_URL=https://tvoj-openai-kompatibilni-provider.example/v1/chat/completions
BOT_AI_API_KEY=stvarni-server-api-kljuc
BOT_AI_MODEL=ime-modela
```

Provider mora prihvatati OpenAI-kompatibilan JSON request. Ključ se nikada ne stavlja u browser. Nakon deploya testiraj najmanje ova pitanja:

| Pitanje | Očekivanje |
|---|---|
| „Koje usluge nudite za turizam?“ | turistička automatizacija i poziv na upit |
| „Koliko košta Business paket?“ | aktuelna cijena/paket i kontakt |
| „Da li radite za medicinu?“ | administrativna podrška, bez medicinske dijagnoze |
| „Kako se rezerviše termin?“ | prikupljanje osnovnih podataka i handover |
| „Mogu li platiti bankovnim transferom?“ | invoice, IBAN/BIC i status aktivacije |
| „Želim razgovarati sa čovjekom.“ | handover timu |
| „Da li imate WhatsApp/Viber/Instagram?“ | channel konfiguracija i upozorenje da provider nalog mora biti povezan |

## 7. Floating AI support widget

Homepage sada ima premium floating launcher u donjem desnom uglu. Widget koristi postojeći server-side `/api/bot/chat` endpoint i lokalni FAQ fallback, pa radi i bez eksternog AI ključa u demo režimu. U panelu su quick pitanja, loading/error tok, pristupačan chat log i direktan link `Podrška → Kontakt` za predaju razgovora timu. Widget ne smije biti opisan kao stalno prisutan ljudski operater ako takva služba nije stvarno organizovana.

Ako želiš da podrška bude stvarno uživo sa agentom, potrebno je naknadno povezati eksterni inbox/chat servis ili organizovati email/WhatsApp dežurstvo. Bez toga widget ostaje AI demo + handover ka kontakt formi, što je jasno prikazano korisniku.

## 8. WhatsApp, Instagram i Viber webhooks

Dodaj server secrets:

```text
CHANNEL_WEBHOOK_SECRET=duga-slucajna-vrijednost
CHANNEL_VERIFY_TOKEN=druga-slucajna-vrijednost
```

U odgovarajućem provider dashboardu koristi HTTPS URL tvoje produkcije:

```text
https://balkanagent.com/api/channels/verify
https://balkanagent.com/api/channels/inbound
```

Provider nalozi moraju biti poslovni i odobreni. Za svaki kanal posebno potvrdi outbound token, payload mapping, webhook subscription i verification challenge. Shared backend obrađuje inbound poruku i može proslijediti tekst botu, ali ne može sam otvoriti ili odobriti Meta/Viber poslovni nalog.

## 8. Invoice i ručni bank transfer

Kada admin aktivira kupca iz `INACTIVE` u `ACTIVE`, backend kreira invoice. Admin prije aktivacije bira `Monthly` ili `Annual - 25%`. Godišnji ciklus stvarno upisuje `billing_cycle=annual`, a invoice čuva `discount_percent=25`.

Invoice treba da sadrži:

| Polje | Izvor |
|---|---|
| Izdavalac | `BALKAN AGENT` |
| Vlasnik računa | `Suljevic Fariz` |
| IBAN | `DE40 1001 1001 2345 8334 17` |
| BIC/SWIFT | `NTSBDEB1XXX` |
| VAT/PDV | `VAT / PDV: Not charged` prema potvrđenom zahtjevu |
| Kupac | ime, firma, email i telefon kupca |
| Usluga | paket i monthly/annual period |
| Iznos | cijena iz centralne pricing konfiguracije |
| Popust | 25% samo za annual ako je uključen u admin pricingu |
| Status | `ISSUED`, a plaćanje se ručno potvrđuje u adminu |
| Referenca | `BA-GODINA-000001` format |
| Rok | `INVOICE_DUE_DAYS`, podrazumijevano 7 dana |

Nakon što kupac uplati, admin ručno promijeni status plaćanja u customer detaljima. Ne označavaj račun kao plaćen prije stvarne provjere banke.

## 9. Domen

U Cloudflare DNS-u usmjeri domen na Pages projekat prema zapisima koje Cloudflare prikaže u **Custom domains**. Dodaj `balkanagent.com` i po želji `www.balkanagent.com`, zatim izaberi canonical varijantu. Canonical URL u `index.html` i sitemapu mora odgovarati varijanti koju želiš da Google indeksira.

Provjeri:

```text
https://balkanagent.com/
https://balkanagent.com/robots.txt
https://balkanagent.com/sitemap.xml
https://balkanagent.com/login.html
https://balkanagent.com/register.html
```

## 10. SEO i Google Search Console

U paketu su dodati title, meta description, keywords, canonical, Open Graph i Organization/Service JSON-LD. `robots.txt` ne indeksira admin i auth rute, a `sitemap.xml` navodi samo javne stranice.

U Google Search Console:

1. Dodaj `https://balkanagent.com/` kao Domain ili URL-prefix property.
2. Potvrdi vlasništvo DNS zapisom ili metodom koju Google prikaže.
3. Otvori **Sitemaps** i pošalji `https://balkanagent.com/sitemap.xml`.
4. Otvori URL Inspection za homepage i zatraži indeksiranje.
5. Nakon nekoliko dana pregledaj Coverage/Pages, Core Web Vitals i Search queries.

Google navodi da sitemap treba koristiti apsolutne URL-ove, da sitemap submission predstavlja signal a ne garanciju indeksiranja i da sitemap sam po sebi ne garantuje prvo mjesto u rezultatima [4]. Ključne riječi pomažu razumljivosti stranice, ali prvo mjesto za opštu riječ „Balkan“ ne može biti garantovano.

## 11. Završni test prije javnog rada

Testiraj u privatnom/incognito prozoru i na telefonu. Redoslijed je:

1. Homepage se učitava sa BA logom, mapom i cjenovnikom; video prezentacija je namjerno uklonjena.
2. Promjena jezika ne ostavlja prazne etikete niti miješane ključne elemente.
3. Chat vraća različite relevantne odgovore na najmanje sedam pitanja.
4. Registracija stvara `PENDING` korisnika.
5. Admin login radi sa `ceo@balkanagent.com` i `ADMIN_PASSWORD` secretom.
6. Registruj testnog customer korisnika i provjeri da owner prima obavijest na `info@balkanagent.com`.
7. Customer login mora ostati aktivan nakon otvaranja `customer.html` i osvježavanja stranice; ako backend privremeno nije dostupan, portal više ne radi nepotreban redirect na login.
8. Aktiviraj korisnika tek nakon provjere bank transfera i provjeri da kupac prima invoice.
9. Provjeri PDF i email; sender treba biti `info@balkanagent.com`, a invoice total mora sadržati pretplatu plus jednokratnu aktivaciju.
10. Admin aktivira testnog kupca i bira monthly ili annual.
11. Za annual račun provjeri 25% popust, `ISSUED` status, due date i referencu.
12. Customer portal prikazuje samo autentifikovane bank-transfer instrukcije.
13. Neautorizovan poziv admin ili billing rute dobija odbijanje.
14. Rezervacija validira obavezna polja i stiže u admin pregled.
15. Nakon testa obriši testnog korisnika ili ga jasno označi kao testnog.

## 12. Šta je obavezno prije prvog pravog kupca

| Obavezno od vlasnika | Zašto |
|---|---|
| Potvrditi BIC `NTSBDEB1XXX` | trenutno je preuzet iz dostavljenog podatka |
| Potvrditi pravni naziv i adresu | stari račun može sadržati zastarjele ili nepotvrđene podatke |
| Potvrditi VAT/PDV status | tehnički tekst nije poresko mišljenje |
| Verifikovati `balkanagent.com` u email provideru | bez toga račun može ostati nesačuvan za slanje |
| Unijeti `RESEND_API_KEY` | aktivira automatsko slanje |
| Unijeti AI provider vars ako želiš pravi AI | fallback radi i bez njih |
| Povezati poslovne channel naloge | webhook adapter sam ne kreira provider naloge |
| Uraditi stvarnu probnu uplatu | potvrđuje invoice i bankovni tok |

## Reference

[1]: https://developers.cloudflare.com/pages/functions/bindings/ "Cloudflare Pages Functions bindings"
[2]: https://developers.cloudflare.com/d1/get-started/ "Cloudflare D1 getting started"
[3]: https://resend.com/docs/dashboard/domains/introduction "Resend verified domains"
[4]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central: Build and submit a sitemap"
