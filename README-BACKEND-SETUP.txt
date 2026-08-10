BALKAN AGENT — BACKEND READY

This package keeps the approved public design and adds real account infrastructure.

WHAT IS NEW
- One Login for Admin and Customers.
- Admin login uses ceo@balkanagent.com + a Cloudflare Secret password.
- Customer registration page: register.html.
- New customer accounts start PENDING / inactive.
- Admin can activate/deactivate, change plan and delete customers.
- Customer can log in only after activation.
- Customer profile is stored in D1: name, company, email, phone, plan, IBAN, bank, payment status.
- Customer password is PBKDF2 hashed before it is stored.
- Login uses an HttpOnly signed session cookie.
- Phone +38268400509 remains on the website/profile.

IMPORTANT SECURITY
The admin password is NOT stored inside this ZIP.
Set it in Cloudflare as the secret ADMIN_PASSWORD.
Also create a long random secret SESSION_SECRET.

CLOUDFLARE SETUP
1. Create a D1 database, e.g. balkan-agent-db.
2. Run schema.sql against that D1 database.
3. In the Pages project, bind the D1 database with binding name:
   DB
4. Add Pages secrets:
   ADMIN_PASSWORD
   SESSION_SECRET
5. Deploy this complete repository including the functions/ directory.

After deploy:
- /login.html = one login for everyone
- /register.html = customer registration
- ceo@balkanagent.com = Admin account
- customer registration => pending
- Admin activates customer => customer can login

Do not put the Admin password directly in index.html/login.html or GitHub.

AUTOMATIC INVOICES (ADDED)
- When an admin changes a customer from INACTIVE to ACTIVE, the backend creates exactly one new activation invoice for that activation event and attempts to email it automatically as a PDF.
- Standard monthly prices follow the public website: Starter EUR 49, Business EUR 79, Pro EUR 199.
- Enterprise uses INVOICE_ENTERPRISE_PRICE_CENTS (for example 25900 = EUR 259) if configured.
- Admin has "Račun" (download latest PDF) and "Pošalji račun" (resend latest invoice) buttons.
- Customers see "Moji računi" in Plaćanje i profil and can download their own PDFs.
- Invoice numbers use BA-YEAR-000001 style and are stored in D1.

EMAIL SETUP (RESEND)
1. Create/verify your sending domain in Resend.
2. In Cloudflare Pages > Settings > Variables and Secrets, add secret:
   RESEND_API_KEY
3. Add variable or secret:
   INVOICE_FROM_EMAIL=Balkan Agent <invoices@balkanagent.com>
4. Recommended company/payment variables (fill these after company/bank setup):
   INVOICE_COMPANY_NAME=Balkan Agent
   INVOICE_COMPANY_ADDRESS=
   INVOICE_TAX_ID=
   INVOICE_IBAN=
   INVOICE_BANK_NAME=
   INVOICE_SWIFT=
   INVOICE_CONTACT_EMAIL=info@balkanagent.com
   INVOICE_PHONE=+382 68 400 509
   INVOICE_DUE_DAYS=7
   INVOICE_ENTERPRISE_PRICE_CENTS=0

DATABASE
- Run schema.sql again against the same D1 database. CREATE TABLE IF NOT EXISTS preserves existing users and adds the invoices table.
- The backend also self-checks/creates the invoices table before invoice operations.

IMPORTANT
- If RESEND_API_KEY is missing or the sending domain is not verified, customer activation still succeeds and the invoice is stored, but admin receives a warning that email sending failed. Use "Pošalji račun" after fixing email settings.
- No email API key is stored in this ZIP.
