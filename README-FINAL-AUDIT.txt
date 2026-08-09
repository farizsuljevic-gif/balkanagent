BALKAN AGENT — FINAL FRONTEND AUDIT

NO VISUAL REDESIGN WAS MADE.
The approved reference layout and approved-map-1to1.jpg remain unchanged.

FIXED:
1. All 11 language options now translate the complete public interface instead of falling back to English for many labels.
2. Crnogorski remains the single regional option for Montenegro / Bosnia and Herzegovina / Croatia / Serbia.
3. Successful contact-form inquiries are copied into the local Admin applications table on the same browser, so the public form and Admin preview are actually connected for testing.
4. Customer panel now contains the same channel set as the public page: Website, WhatsApp, Instagram, Facebook, Viber, Telegram, Email, SMS.
5. Customer channel status synchronizes with public Connect configuration.
6. Public Connect test no longer stores private API/OAuth secrets in localStorage.
7. Admin search placeholder follows the selected admin language.
8. Existing Login, Admin, Customer, bot, video, pricing and Cloudflare-static structure are preserved.

LIMIT:
Real accounts, shared data between devices, real WhatsApp/Instagram/Viber APIs and secure authentication still require the backend phase (D1/Auth/OAuth). Static HTML cannot safely provide those production services alone.
