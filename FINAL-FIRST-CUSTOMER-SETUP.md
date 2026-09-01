# Balkan Agent — Final Setup for First Customers

## Status

This package contains the production backend in `functions/[[path]].js` and the public pages in the package root. The obsolete duplicate backend entrypoint was removed so Cloudflare Pages uses one unambiguous Functions route.

The package includes the BA premium visual identity, the gold BA monogram asset, the new dark navy/gold Balkan map, public contact flow, customer registration and login, admin activation, customer portal, invoice PDF generation, invoice resend support, reservations, pricing configuration with annual discount, and server-side bot chat with a safe FAQ fallback.

## Customer flow

A visitor uses the public contact form or registers through `register.html`. A new account is stored as inactive. The administrator signs in through `login.html`, opens the admin panel, reviews the customer, chooses the plan, records the bank-transfer status, and activates the account. Activation creates the invoice record. If the email provider is configured, the invoice is also sent by email; if it is not configured, the invoice remains available for admin/customer PDF download and the error is shown instead of silently pretending that email was sent.

A customer can then sign in, open `customer.html`, update profile and bank-transfer details, view the payment status, and download available invoices. Payment is intentionally manual: activation and `PAID` status are controlled by the administrator after the transfer is checked in the private bank account.

## Bot coverage

The server-side bot handles prices and the 25% annual discount, reservations and appointment requests, tourism workflows, hotels, apartments, restaurants and guests, medical administrative requests, other service businesses, lead qualification, web chat, WhatsApp, Instagram, Facebook, Viber, Telegram, email and SMS integration questions, languages, manual bank transfer, contact requests and handover to a human team member.

When `BOT_AI_API_URL` and `BOT_AI_API_KEY` are not configured, the endpoint still works through the local FAQ fallback. When an OpenAI-compatible provider is configured, the key stays server-side and the model is instructed not to invent availability, customers, reviews, results, statistics, integrations or medical advice.

## Required production configuration

The following values must be entered as Cloudflare Pages Function environment variables or secrets. Values are deliberately not fabricated in this package.

| Variable | Purpose |
|---|---|
| `DB` | Cloudflare D1 binding named `DB`. Apply `schema.sql` to the production D1 database. |
| `SESSION_SECRET` | Long random secret used to sign login sessions. |
| `ADMIN_PASSWORD` | Strong password for `ceo@balkanagent.com`; change this from any temporary value before going live. |
| `BOT_AI_API_URL` | Optional OpenAI-compatible chat completion endpoint. Leave unset to use the safe FAQ fallback. |
| `BOT_AI_API_KEY` | Optional server-side AI provider key. Never place this in HTML or browser JavaScript. |
| `BOT_AI_MODEL` | Optional provider model name. |
| `CHANNEL_WEBHOOK_SECRET` | Secret header required by `POST /api/channels/inbound` for approved channel adapters. |
| `CHANNEL_VERIFY_TOKEN` | Verification token for `GET /api/channels/verify` when a provider requires a challenge response. |
| `RESEND_API_KEY` | Optional key for sending invoice emails through Resend. |
| `INVOICE_COMPANY_NAME` | Legal name shown on invoices. |
| `INVOICE_COMPANY_ADDRESS` | Business address shown on invoices. |
| `INVOICE_TAX_ID` | Tax/VAT number if applicable. |
| `INVOICE_IBAN` | The real private German bank IBAN used for customer transfers. |
| `INVOICE_BANK_NAME` | Bank name for transfer instructions. |
| `INVOICE_SWIFT` | SWIFT/BIC when required by the bank. |
| `INVOICE_CONTACT_EMAIL` | Invoice and support email. |
| `INVOICE_FROM_EMAIL` | Verified sender address if email sending is enabled. |
| `INVOICE_PHONE` | Business phone shown on invoices. |

## Cloudflare release checklist

Create the Pages project from this folder. Confirm that `functions/[[path]].js` is deployed as the Functions route and that `schema.sql` has been applied to the production D1 binding named `DB`. Add the required secrets, especially `SESSION_SECRET`, `ADMIN_PASSWORD`, the real invoice identity, and the real German IBAN. Use a verified sender domain before enabling invoice email delivery.

After deployment, test registration with a real test email, confirm that the admin can log in and activate the account, confirm that an invoice is created, verify that the customer can log in and download the invoice, submit one reservation, and ask the public bot about prices, tourism, medicine, channels and bank transfer. Delete test records before accepting the first paid customer.

## What is intentionally not automatic

The package cannot create a real WhatsApp, Instagram, Viber, email-provider, Cloudflare or German-bank account for the owner. Those services require the owner's identity, business permissions, webhook settings, provider approval and private credentials. The code provides a protected shared inbound adapter at `/api/channels/inbound` and a challenge endpoint at `/api/channels/verify`; each provider still needs its own payload mapping, outbound send permission and dashboard configuration. Channel credentials must be stored only as server-side secrets.
