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
