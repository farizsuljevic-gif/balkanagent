BALKAN AGENT — ENGLISH-ONLY WEBSITE — SIMPLIFIED STRUCTURE
Prepared: 17 October 2026

CONTENT PRESERVED
- Premium black/gold design, images, animations, and page copy.
- Homepage, About, Contact, Industries, Resources, Privacy, Terms, Cookies and Legal.
- 8 English solution categories in /solutions/, each a single HTML file.
- 32 English detailed services in /services/, each a single HTML file.
- Payment preparation page and original payment scripts/config.
- Contact form with Cloudflare Pages server function.

IMPORTANT: PAYMENTS ARE NOT LIVE. The checkout remains disabled until a
verified provider is linked and payment configuration is explicitly enabled.
See PAYMENT_SETUP_BEFORE_LAUNCH.txt before activating anything.

UPLOAD TO CLOUDFLARE PAGES
Upload this ZIP through Cloudflare Pages Direct Upload. All files are at ZIP
root; do not upload the enclosing folder if unpacking manually. The assets,
services, solutions, and functions folders must remain in place. For dynamic
form submission, deploy with Cloudflare Pages Functions support and configure
RESEND_API_KEY, VERIFIED_SENDER and CONTACT_RECIPIENT as secrets/env vars.
Without them, the form offers email-app fallback.

NAVIGATION / LINK PRESERVATION
Old /services/name/ and /solutions/name/ paths and previous DE/FR/NL paths
redirect to English URLs via the _redirects file. New internal links point
to /services/name.html and /solutions/name.html.

PERSONAL DETAILS
Personal name, surname and private telephone number are omitted from the
site code and visible pages. Generic visitor form fields are retained.

BEFORE GOING LIVE
- Review the legal notice, privacy policy and business identity details.
- Replace clearly marked sample/demo metrics with verified figures.
- Verify payments and contact form, and test deployed links.
