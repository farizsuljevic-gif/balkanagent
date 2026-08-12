const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function bad(message, status = 400, headers = {}) {
  return json(
    {
      ok: false,
      error: message,
    },
    status,
    headers
  );
}

async function parseBody(request) {
  return request
    .json()
    .catch(() => ({}));
}

function b64url(bytes) {
  let s = "";

  for (const b of bytes) {
    s += String.fromCharCode(b);
  }

  return btoa(s)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s) {
  s = s
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (s.length % 4) {
    s += "=";
  }

  return Uint8Array.from(
    atob(s),
    c => c.charCodeAt(0)
  );
}

async function hmac(
  secret,
  message
) {
  const key =
    await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(message)
    )
  );
}

async function makeSession(
  env,
  payload
) {
  const body =
    b64url(
      enc.encode(
        JSON.stringify(payload)
      )
    );

  const sig =
    b64url(
      await hmac(
        env.SESSION_SECRET,
        body
      )
    );

  return `${body}.${sig}`;
}

async function readSession(
  request,
  env
) {
  const cookie =
    request.headers.get(
      "cookie"
    ) || "";

  const match =
    cookie.match(
      /(?:^|;\s*)ba_session=([^;]+)/
    );

  if (!match) {
    return null;
  }

  const [body, sig] =
    match[1].split(".");

  if (
    !body ||
    !sig
  ) {
    return null;
  }

  const expected =
    b64url(
      await hmac(
        env.SESSION_SECRET,
        body
      )
    );

  if (
    expected !== sig
  ) {
    return null;
  }

  try {

    const payload =
      JSON.parse(
        new TextDecoder()
          .decode(
            fromB64url(body)
          )
      );

    if (
      !payload.exp ||
      Date.now() >
      payload.exp
    ) {
      return null;
    }

    return payload;

  } catch {

    return null;
  }
}

function sessionCookie(token) {

  return (
    `ba_session=${token}; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Lax; ` +
    `Max-Age=604800`
  );
}

function clearCookie() {

  return (
    "ba_session=; " +
    "Path=/; " +
    "HttpOnly; " +
    "Secure; " +
    "SameSite=Lax; " +
    "Max-Age=0"
  );
}

async function requireSession(
  request,
  env
) {

  const session =
    await readSession(
      request,
      env
    );

  if (!session) {

    return {
      error:
        bad(
          "Not authenticated",
          401
        ),
    };
  }

  return {
    session,
  };
}

async function requireAdmin(
  request,
  env
) {

  const r =
    await requireSession(
      request,
      env
    );

  if (r.error) {
    return r;
  }

  if (
    r.session.role !==
    "admin"
  ) {

    return {
      error:
        bad(
          "Admin required",
          403
        ),
    };
  }

  return r;
}

function randomHex(
  n = 16
) {

  const bytes =
    new Uint8Array(n);

  crypto
    .getRandomValues(
      bytes
    );

  return [...bytes]
    .map(
      x =>
        x
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

async function hashPassword(
  password,
  saltHex
) {

  const pairs =
    saltHex.match(
      /../g
    );

  if (!pairs) {

    throw new Error(
      "Invalid password salt"
    );
  }

  const salt =
    Uint8Array.from(
      pairs.map(
        x =>
          parseInt(
            x,
            16
          )
      )
    );

  const key =
    await crypto.subtle
      .importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
      );

  const bits =
    await crypto.subtle
      .deriveBits(
        {
          name:
            "PBKDF2",

          hash:
            "SHA-256",

          salt,

          iterations:
            100000,
        },
        key,
        256
      );

  return [
    ...new Uint8Array(
      bits
    ),
  ]
    .map(
      x =>
        x
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

function safeUser(row) {

  if (!row) {
    return null;
  }

  return {

    id:
      row.id,

    email:
      row.email,

    name:
      row.name,

    company:
      row.company || "",

    phone:
      row.phone || "",

    plan:
      row.plan ||
      "Starter",

    active:
      !!row.active,

    role:
      row.role ||
      "customer",

    payment_method:
      row.payment_method ||
      "Bank transfer / IBAN",

    iban:
      row.iban || "",

    bank_name:
      row.bank_name || "",

    payment_status:
      row.payment_status ||
      "UNPAID",

    created_at:
      row.created_at,
  };
}

const PLAN_PRICES = {

  Starter:
    4900,

  Business:
    7900,

  Pro:
    19900,
};

const DEFAULT_AGENTS = [

  {
    agent_type:
      "receptionist",

    name:
      "AI Receptionist",
  },

  {
    agent_type:
      "sales",

    name:
      "AI Sales",
  },

  {
    agent_type:
      "support",

    name:
      "AI Support",
  },
];

const CHANNELS = [

  "Website",

  "WhatsApp",

  "Instagram",

  "Facebook",

  "Viber",

  "Telegram",

  "Email",

  "SMS",
];

async function ensureSchemas(env) {

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL DEFAULT 'ISSUED',
      issue_date TEXT NOT NULL DEFAULT (date('now')),
      due_date TEXT NOT NULL,
      email_sent_at TEXT DEFAULT NULL,
      email_provider_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_invoices_customer
    ON invoices(customer_id)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'INACTIVE',
      config_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, agent_type)
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_customer_agents_customer
    ON customer_agents(customer_id)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
      config_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, channel)
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_customer_integrations_customer
    ON customer_integrations(customer_id)
  `).run();
}

async function seedAgents(
  env,
  customerId
) {

  for (
    const agent
    of DEFAULT_AGENTS
  ) {

    await env.DB.prepare(`
      INSERT OR IGNORE
      INTO customer_agents (
        customer_id,
        agent_type,
        name,
        status,
        config_json
      )
      VALUES (
        ?,
        ?,
        ?,
        'INACTIVE',
        '{}'
      )
    `)
      .bind(
        customerId,
        agent.agent_type,
        agent.name
      )
      .run();
  }
}

async function seedIntegrations(
  env,
  customerId
) {

  for (
    const channel
    of CHANNELS
  ) {

    await env.DB.prepare(`
      INSERT OR IGNORE
      INTO customer_integrations (
        customer_id,
        channel,
        status,
        config_json
      )
      VALUES (
        ?,
        ?,
        'NOT_CONNECTED',
        '{}'
      )
    `)
      .bind(
        customerId,
        channel
      )
      .run();
  }
}

async function customerExists(
  env,
  id
) {

  const row =
    await env.DB.prepare(`
      SELECT id
      FROM users
      WHERE
        id=?
        AND role='customer'
    `)
      .bind(id)
      .first();

  return !!row;
}

function parseConfig(value) {

  try {

    const parsed =
      JSON.parse(
        value || "{}"
      );

    return (
      parsed &&
      typeof parsed ===
      "object"
    )
      ? parsed
      : {};

  } catch {

    return {};
  }
}

function integrationForApi(row) {

  if (!row) {
    return null;
  }

  return {

    ...row,

    config:
      parseConfig(
        row.config_json
      ),
  };
}

function normalizeDomain(value) {

  let raw =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (!raw) {
    return "";
  }

  if (
    !/^https?:\/\//
      .test(raw)
  ) {

    raw =
      `https://${raw}`;
  }

  try {

    const u =
      new URL(raw);

    return u.hostname
      .replace(
        /^www\./,
        ""
      );

  } catch {

    return "";
  }
}

function originAllowed(
  origin,
  domain
) {

  if (
    !origin ||
    !domain
  ) {
    return true;
  }

  try {

    const host =
      new URL(origin)
        .hostname
        .replace(
          /^www\./,
          ""
        )
        .toLowerCase();

    return (
      host ===
      domain.toLowerCase()
    );

  } catch {

    return false;
  }
}

function corsHeaders(origin) {

  return {

    "access-control-allow-origin":
      origin || "*",

    "access-control-allow-methods":
      "GET,POST,OPTIONS",

    "access-control-allow-headers":
      "content-type",

    "vary":
      "Origin",
  };
}

function planAmountCents(
  plan,
  env
) {

  if (
    PLAN_PRICES[plan] !==
    undefined
  ) {

    return PLAN_PRICES[
      plan
    ];
  }

  const enterprise =
    Number(
      env.INVOICE_ENTERPRISE_PRICE_CENTS ||
      0
    );

  return (
    Number.isFinite(
      enterprise
    ) &&
    enterprise > 0
  )
    ? Math.round(
        enterprise
      )
    : 0;
}

function money(
  cents,
  currency = "EUR"
) {

  return `${(
    Number(
      cents || 0
    ) / 100
  ).toFixed(2)} ${currency}`;
}

function dueDate(
  days = 7
) {

  const d =
    new Date();

  d.setUTCDate(
    d.getUTCDate() +
    days
  );

  return d
    .toISOString()
    .slice(
      0,
      10
    );
}

function ascii(
  value = ""
) {

  return String(value)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^\x20-\x7E]/g,
      "?"
    );
}

function pdfEsc(
  value = ""
) {

  return ascii(value)
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /\(/g,
      "\\("
    )
    .replace(
      /\)/g,
      "\\)"
    );
}

function makeInvoicePdf(
  invoice,
  customer,
  env
) {

  const company =
    env.INVOICE_COMPANY_NAME ||
    "Balkan Agent";

  const address =
    env.INVOICE_COMPANY_ADDRESS ||
    "Ulcinj, Montenegro";

  const tax =
    env.INVOICE_TAX_ID ||
    "";

  const iban =
    env.INVOICE_IBAN ||
    "DE40100110012345833417";

  const bank =
    env.INVOICE_BANK_NAME ||
    "";

  const swift =
    env.INVOICE_SWIFT ||
    "";

  const phone =
    env.INVOICE_PHONE ||
    "+382 68 400 509";

  const email =
    env.INVOICE_CONTACT_EMAIL ||
    "info@balkanagent.com";

  const accountHolder =
    env.INVOICE_ACCOUNT_HOLDER ||
    "Fariz Suljevic";

  const total =
    money(
      invoice.amount_cents,
      invoice.currency
    );

  const lines = [

    [
      "B",
      "BALKAN AGENT",
      48,
      794,
      19,
      "navy"
    ],

    [
      "R",
      "AI SOLUTIONS & AUTOMATION",
      48,
      777,
      8,
      "gold"
    ],

    [
      "R",
      "Made in Montenegro",
      48,
      763,
      7,
      "muted"
    ],

    [
      "B",
      "INVOICE",
      430,
      794,
      21,
      "navy"
    ],

    [
      "R",
      `Invoice No: ${invoice.invoice_number}`,
      430,
      771,
      8,
      "normal"
    ],

    [
      "R",
      `Issue date: ${invoice.issue_date}`,
      430,
      758,
      8,
      "normal"
    ],

    [
      "R",
      `Due date: ${invoice.due_date}`,
      430,
      745,
      8,
      "normal"
    ],

    [
      "B",
      "FROM",
      48,
      705,
      8,
      "gold"
    ],

    [
      "B",
      company,
      48,
      687,
      10,
      "navy"
    ],

    [
      "R",
      address,
      48,
      673,
      8,
      "normal"
    ],

    [
      "R",
      tax
        ? `Tax ID: ${tax}`
        : "",
      48,
      660,
      8,
      "normal"
    ],

    [
      "R",
      `Phone: ${phone}`,
      48,
      647,
      8,
      "normal"
    ],

    [
      "R",
      `Email: ${email}`,
      48,
      634,
      8,
      "normal"
    ],

    [
      "B",
      "BILL TO",
      315,
      705,
      8,
      "gold"
    ],

    [
      "B",
      customer.company ||
      customer.name ||
      "",
      315,
      687,
      10,
      "navy"
    ],

    [
      "R",
      customer.company
        ? customer.name ||
          ""
        : "",
      315,
      673,
      8,
      "normal"
    ],

    [
      "R",
      customer.email ||
      "",
      315,
      660,
      8,
      "normal"
    ],

    [
      "R",
      customer.phone ||
      "",
      315,
      647,
      8,
      "normal"
    ],

    [
      "B",
      "DESCRIPTION / SERVICE",
      48,
      586,
      8,
      "white"
    ],

    [
      "B",
      "AMOUNT",
      455,
      586,
      8,
      "white"
    ],

    [
      "R",
      invoice.description ||
      `Balkan Agent ${invoice.plan || ""} plan - monthly service`,
      48,
      552,
      9,
      "normal"
    ],

    [
      "B",
      total,
      455,
      552,
      9,
      "navy"
    ],

    [
      "B",
      "TOTAL",
      392,
      500,
      10,
      "navy"
    ],

    [
      "B",
      total,
      455,
      500,
      11,
      "gold"
    ],

    [
      "B",
      "PAYMENT DETAILS",
      48,
      451,
      9,
      "gold"
    ],

    [
      "R",
      `Account holder: ${accountHolder}`,
      48,
      431,
      8,
      "normal"
    ],

    [
      "R",
      bank
        ? `Bank: ${bank}`
        : "",
      48,
      416,
      8,
      "normal"
    ],

    [
      "R",
      `IBAN: ${iban}`,
      48,
      401,
      8,
      "normal"
    ],

    [
      "R",
      swift
        ? `SWIFT / BIC: ${swift}`
        : "",
      48,
      386,
      8,
      "normal"
    ],

    [
      "R",
      `Payment reference: ${invoice.invoice_number}`,
      48,
      371,
      8,
      "normal"
    ],

    [
      "R",
      `${email} | ${phone} | balkanagent.com`,
      48,
      83,
      7,
      "muted"
    ],

    [
      "B",
      "Thank you for your business.",
      380,
      104,
      9,
      "gold"
    ],

  ].filter(
    x =>
      x[1]
  );

  function color(type) {

    if (
      type ===
      "gold"
    ) {
      return "0.62 0.47 0.16";
    }

    if (
      type ===
      "navy"
    ) {
      return "0.04 0.09 0.20";
    }

    if (
      type ===
      "muted"
    ) {
      return "0.42 0.46 0.52";
    }

    if (
      type ===
      "white"
    ) {
      return "1 1 1";
    }

    return "0.20 0.24 0.30";
  }

  let stream = "";

  stream +=
    "1 1 1 rg 0 0 595 842 re f\n";

  stream +=
    "0.04 0.09 0.20 rg 0 832 595 10 re f\n";

  stream +=
    "0.78 0.63 0.29 rg 0 824 595 3 re f\n";

  stream +=
    "0.78 0.63 0.29 RG 1.2 w 48 730 m 547 730 l S\n";

  stream +=
    "0.04 0.09 0.20 rg 48 570 499 30 re f\n";

  stream +=
    "0.97 0.98 0.99 rg 48 530 499 40 re f\n";

  stream +=
    "0.87 0.89 0.92 RG 0.6 w 48 530 m 547 530 l S\n";

  stream +=
    "0.78 0.63 0.29 RG 1.1 w 390 486 m 547 486 l S\n";

  stream +=
    "0.97 0.98 0.99 rg 48 355 499 82 re f\n";

  stream +=
    "0.78 0.63 0.29 rg 48 355 4 82 re f\n";

  stream +=
    "0.87 0.89 0.92 RG 0.6 w 48 140 m 547 140 l S\n";

  stream +=
    "0.04 0.09 0.20 rg 0 0 595 16 re f\n";

  stream +=
    "0.78 0.63 0.29 rg 0 16 595 3 re f\n";

  for (
    const [
      font,
      text,
      x,
      y,
      size,
      type
    ]
    of lines
  ) {

    stream +=
      `BT /F${
        font === "B"
          ? 2
          : 1
      } ${size} Tf ` +
      `${color(type)} rg ` +
      `${x} ${y} Td ` +
      `(${pdfEsc(text)}) Tj ET\n`;
  }

  const objs = [];

  objs[1] =
    "<< /Type /Catalog /Pages 2 0 R >>";

  objs[2] =
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";

  objs[3] =
    "<< /Type /Page /Parent 2 0 R " +
    "/MediaBox [0 0 595 842] " +
    "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> " +
    "/Contents 6 0 R >>";

  objs[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  objs[5] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  objs[6] =
    `<< /Length ${stream.length} >>\n` +
    `stream\n${stream}endstream`;

  let pdf =
    "%PDF-1.4\n";

  const offs = [0];

  for (
    let i = 1;
    i <= 6;
    i++
  ) {

    offs[i] =
      pdf.length;

    pdf +=
      `${i} 0 obj\n` +
      `${objs[i]}\n` +
      `endobj\n`;
  }

  const xref =
    pdf.length;

  pdf +=
    "xref\n0 7\n" +
    "0000000000 65535 f \n";

  for (
    let i = 1;
    i <= 6;
    i++
  ) {

    pdf +=
      String(
        offs[i]
      )
        .padStart(
          10,
          "0"
        ) +
      " 00000 n \n";
  }

  pdf +=
    `trailer\n` +
    `<< /Size 7 /Root 1 0 R >>\n` +
    `startxref\n${xref}\n` +
    `%%EOF`;

  return enc.encode(
    pdf
  );
}

function bytesToBase64(bytes) {

  let out = "";

  for (
    let i = 0;
    i < bytes.length;
    i += 0x8000
  ) {

    out +=
      String
        .fromCharCode(
          ...bytes
            .subarray(
              i,
              i + 0x8000
            )
        );
  }

  return btoa(out);
}

async function sendInvoiceEmail(
  env,
  invoice,
  customer
) {

  if (
    !env.RESEND_API_KEY
  ) {

    throw new Error(
      "RESEND_API_KEY is not configured"
    );
  }

  const pdf =
    makeInvoicePdf(
      invoice,
      customer,
      env
    );

  const total =
    money(
      invoice.amount_cents,
      invoice.currency
    );

  const safeName =
    String(
      customer.name ||
      customer.company ||
      "Customer"
    )
      .replace(
        /[<>]/g,
        ""
      );

  const html = `
    <div style="
      font-family:Arial,sans-serif;
      color:#0a1733;
      max-width:640px;
      margin:auto
    ">

      <div style="
        border-top:7px solid #0a1733;
        padding:24px 0 12px;
        border-bottom:2px solid #c7a24a
      ">

        <h1 style="margin:0">
          BALKAN AGENT
        </h1>

        <div style="color:#a17c2c">
          AI SOLUTIONS & AUTOMATION
        </div>

      </div>

      <h2>
        Your Balkan Agent invoice
      </h2>

      <p>
        Hello ${safeName},
      </p>

      <p>
        Your Balkan Agent account has been activated.
        Your PDF invoice is attached.
      </p>

      <div style="
        padding:18px;
        background:#f7f8fa;
        border-left:4px solid #c7a24a
      ">

        <b>Plan:</b>
        ${invoice.plan || ""}

        <br>

        <b>Total:</b>
        ${total}

        <br>

        <b>Due date:</b>
        ${invoice.due_date}

      </div>

      <p>
        Please use
        <b>${invoice.invoice_number}</b>
        as the payment reference.
      </p>

      <p style="
        color:#667085;
        font-size:12px
      ">
        Balkan Agent ·
        +382 68 400 509 ·
        info@balkanagent.com ·
        balkanagent.com
      </p>

    </div>
  `;

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method:
          "POST",

        headers: {

          authorization:
            `Bearer ${env.RESEND_API_KEY}`,

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify({

            from:
              env.INVOICE_FROM_EMAIL ||
              "Balkan Agent <info@balkanagent.com>",

            to: [
              customer.email
            ],

            reply_to:
              "info@balkanagent.com",

            subject:
              `Balkan Agent invoice ${invoice.invoice_number}`,

            html,

            attachments: [

              {
                filename:
                  `${invoice.invoice_number}.pdf`,

                content:
                  bytesToBase64(
                    pdf
                  ),
              },
            ],
          }),
      }
    );

  const result =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {

    throw new Error(
      result.message ||
      result.error ||
      `Resend error ${response.status}`
    );
  }

  return result.id || "";
}

async function createActivationInvoice(
  env,
  customer
) {

  const amount =
    planAmountCents(
      customer.plan,
      env
    );

  const description =

    customer.plan ===
    "Enterprise"

      ? "Balkan Agent Enterprise - agreed monthly service"

      : `Balkan Agent ${customer.plan} plan - monthly service`;

  const temporary =
    `TMP-${crypto.randomUUID()}`;

  const result =
    await env.DB.prepare(`
      INSERT INTO invoices (
        customer_id,
        invoice_number,
        plan,
        description,
        amount_cents,
        currency,
        status,
        issue_date,
        due_date
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        'EUR',
        'ISSUED',
        date('now'),
        ?
      )
    `)
      .bind(
        customer.id,
        temporary,
        customer.plan,
        description,
        amount,
        dueDate(
          Number(
            env.INVOICE_DUE_DAYS ||
            7
          )
        )
      )
      .run();

  const id =
    Number(
      result.meta &&
      result.meta.last_row_id
    );

  if (!id) {

    throw new Error(
      "Could not create invoice id"
    );
  }

  const invoiceNumber =
    `BA-${
      new Date()
        .getUTCFullYear()
    }-${
      String(id)
        .padStart(
          6,
          "0"
        )
    }`;

  await env.DB.prepare(
    "UPDATE invoices SET invoice_number=? WHERE id=?"
  )
    .bind(
      invoiceNumber,
      id
    )
    .run();

  let invoice =
    await env.DB.prepare(
      "SELECT * FROM invoices WHERE id=?"
    )
      .bind(id)
      .first();

  try {

    const providerId =
      await sendInvoiceEmail(
        env,
        invoice,
        customer
      );

    await env.DB.prepare(`
      UPDATE invoices
      SET
        email_sent_at=datetime('now'),
        email_provider_id=?
      WHERE id=?
    `)
      .bind(
        providerId,
        id
      )
      .run();

    invoice =
      await env.DB.prepare(
        "SELECT * FROM invoices WHERE id=?"
      )
        .bind(id)
        .first();

    return {

      invoice,

      email_sent:
        true,
    };

  } catch (error) {

    return {

      invoice,

      email_sent:
        false,

      email_error:
        error?.message ||
        String(error),
    };
  }
}

function extractOpenAIText(data) {

  if (
    typeof data.output_text ===
    "string" &&
    data.output_text.trim()
  ) {

    return data.output_text
      .trim();
  }

  const parts = [];

  for (
    const item
    of data.output ||
    []
  ) {

    for (
      const content
      of item.content ||
      []
    ) {

      if (
        content.type ===
        "output_text" &&
        content.text
      ) {

        parts.push(
          content.text
        );
      }
    }
  }

  return parts
    .join("\n")
    .trim();
}

async function findWebsiteByKey(
  env,
  key
) {

  const rows =
    await env.DB.prepare(`
      SELECT
        ci.*,
        u.name,
        u.company,
        u.email
      FROM customer_integrations ci
      JOIN users u
        ON u.id = ci.customer_id
      WHERE
        ci.channel='Website'
        AND ci.status='CONNECTED'
    `)
      .all();

  for (
    const row
    of rows.results ||
    []
  ) {

    const config =
      parseConfig(
        row.config_json
      );

    if (
      config.widget_key ===
      key
    ) {

      return {
        row,
        config,
      };
    }
  }

  return null;
}

export async function onRequest(
  context
) {

  const {
    request,
    env
  } = context;

  const url =
    new URL(
      request.url
    );

  const path =
    url.pathname
      .replace(
        /^\/api\/?/,
        ""
      );

  const method =
    request.method
      .toUpperCase();

  if (!env.DB) {

    return bad(
      "D1 binding DB is not configured",
      500
    );
  }

  if (
    !env.SESSION_SECRET
  ) {

    return bad(
      "SESSION_SECRET is not configured",
      500
    );
  }

  if (
    !env.ADMIN_PASSWORD
  ) {

    return bad(
      "ADMIN_PASSWORD is not configured",
      500
    );
  }

  await ensureSchemas(
    env
  );


  /*
  ==========================================
  REGISTER
  ==========================================
  */

  if (
    path ===
    "auth/register" &&
    method ===
    "POST"
  ) {

    const body =
      await parseBody(
        request
      );

    const name =
      String(
        body.name ||
        ""
      )
        .trim();

    const company =
      String(
        body.company ||
        ""
      )
        .trim();

    const email =
      String(
        body.email ||
        ""
      )
        .trim()
        .toLowerCase();

    const phone =
      String(
        body.phone ||
        ""
      )
        .trim();

    const password =
      String(
        body.password ||
        ""
      );

    if (
      !name ||
      !email ||
      password.length < 8
    ) {

      return bad(
        "Name, email and password of at least 8 characters are required.",
        400
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email)
    ) {

      return bad(
        "Invalid email.",
        400
      );
    }

    const exists =
      await env.DB.prepare(
        "SELECT id FROM users WHERE email=?"
      )
        .bind(email)
        .first();

    if (exists) {

      return bad(
        "Account already exists.",
        409
      );
    }

    const salt =
      randomHex(16);

    const passwordHash =
      await hashPassword(
        password,
        salt
      );

    const id =
      crypto.randomUUID();

    try {

      await env.DB.prepare(`
        INSERT INTO users (
          id,
          email,
          password_hash,
          password_salt,
          name,
          company,
          phone,
          plan,
          active,
          role,
          payment_method,
          payment_status,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'Starter',
          0,
          'customer',
          'Bank transfer / IBAN',
          'UNPAID',
          datetime('now')
        )
      `)
        .bind(
          id,
          email,
          passwordHash,
          salt,
          name,
          company,
          phone
        )
        .run();

      return json(
        {
          ok:
            true,

          status:
            "pending",

          message:
            "Account created. Admin activation is required.",
        },
        201
      );

    } catch (error) {

      return bad(
        `Database error: ${
          error?.message ||
          String(error)
        }`,
        500
      );
    }
  }


  /*
  ==========================================
  LOGIN
  ==========================================
  */

  if (
    path ===
    "auth/login" &&
    method ===
    "POST"
  ) {

    const body =
      await parseBody(
        request
      );

    const email =
      String(
        body.email ||
        ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body.password ||
        ""
      );

    if (
      email ===
      "ceo@balkanagent.com"
    ) {

      if (
        password !==
        env.ADMIN_PASSWORD
      ) {

        return bad(
          "Wrong email or password.",
          401
        );
      }

      const token =
        await makeSession(
          env,
          {
            sub:
              "admin",

            role:
              "admin",

            email,

            exp:
              Date.now() +
              604800000,
          }
        );

      return json(
        {
          ok:
            true,

          role:
            "admin",
        },
        200,
        {
          "set-cookie":
            sessionCookie(
              token
            ),
        }
      );
    }

    const user =
      await env.DB.prepare(`
        SELECT *
        FROM users
        WHERE
          email=?
          AND role='customer'
      `)
        .bind(email)
        .first();

    if (!user) {

      return bad(
        "Wrong email or password.",
        401
      );
    }

    const check =
      await hashPassword(
        password,
        user.password_salt
      );

    if (
      check !==
      user.password_hash
    ) {

      return bad(
        "Wrong email or password.",
        401
      );
    }

    if (
      !user.active
    ) {

      return bad(
        "Account is waiting for admin activation.",
        403
      );
    }

    const token =
      await makeSession(
        env,
        {
          sub:
            user.id,

          role:
            "customer",

          email:
            user.email,

          exp:
            Date.now() +
            604800000,
        }
      );

    return json(
      {
        ok:
          true,

        role:
          "customer",

        user:
          safeUser(user),
      },
      200,
      {
        "set-cookie":
          sessionCookie(
            token
          ),
      }
    );
  }


  /*
  ==========================================
  LOGOUT
  ==========================================
  */

  if (
    path ===
    "auth/logout" &&
    method ===
    "POST"
  ) {

    return json(
      {
        ok:
          true,
      },
      200,
      {
        "set-cookie":
          clearCookie(),
      }
    );
  }


  /*
  ==========================================
  AUTH ME
  ==========================================
  */

  if (
    path ===
    "auth/me" &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role ===
      "admin"
    ) {

      return json({

        ok:
          true,

        role:
          "admin",

        email:
          r.session.email,
      });
    }

    const user =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(
          r.session.sub
        )
        .first();

    if (
      !user ||
      !user.active
    ) {

      return bad(
        "Account inactive",
        403
      );
    }

    return json({

      ok:
        true,

      role:
        "customer",

      user:
        safeUser(user),
    });
  }


  /*
  ==========================================
  PROFILE
  ==========================================
  */

  if (
    path ===
    "profile" &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const user =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(
          r.session.sub
        )
        .first();

    return json({

      ok:
        true,

      user:
        safeUser(user),
    });
  }

  if (
    path ===
    "profile" &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const body =
      await parseBody(
        request
      );

    const name =
      String(
        body.name ||
        ""
      )
        .trim();

    if (!name) {

      return bad(
        "Name is required",
        400
      );
    }

    await env.DB.prepare(`
      UPDATE users
      SET
        name=?,
        company=?,
        phone=?,
        iban=?,
        bank_name=?,
        payment_method='Bank transfer / IBAN'
      WHERE id=?
    `)
      .bind(
        name,
        String(
          body.company ||
          ""
        )
          .trim(),
        String(
          body.phone ||
          ""
        )
          .trim(),
        String(
          body.iban ||
          ""
        )
          .trim(),
        String(
          body.bank_name ||
          ""
        )
          .trim(),
        r.session.sub
      )
      .run();

    const user =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(
          r.session.sub
        )
        .first();

    return json({

      ok:
        true,

      user:
        safeUser(user),
    });
  }


  /*
  ==========================================
  ADMIN CUSTOMERS
  ==========================================
  */

  if (
    path ===
    "admin/customers" &&
    method ===
    "GET"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const rows =
      await env.DB.prepare(`
        SELECT *
        FROM users
        WHERE role='customer'
        ORDER BY created_at DESC
      `)
        .all();

    return json({

      ok:
        true,

      customers:
        (
          rows.results ||
          []
        )
          .map(
            safeUser
          ),
    });
  }

  const customerMatch =
    path.match(
      /^admin\/customers\/([^/]+)$/
    );

  if (
    customerMatch &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        customerMatch[1]
      );

    const body =
      await parseBody(
        request
      );

    const current =
      await env.DB.prepare(`
        SELECT *
        FROM users
        WHERE
          id=?
          AND role='customer'
      `)
        .bind(id)
        .first();

    if (!current) {

      return bad(
        "Customer not found",
        404
      );
    }

    const active =

      body.active ===
      undefined

        ? current.active

        : body.active
          ? 1
          : 0;

    const plan =

      body.plan ===
      undefined

        ? current.plan

        : String(
            body.plan
          );

    const phone =

      body.phone ===
      undefined

        ? current.phone

        : String(
            body.phone ||
            ""
          );

    const iban =

      body.iban ===
      undefined

        ? current.iban

        : String(
            body.iban ||
            ""
          );

    const bank =

      body.bank_name ===
      undefined

        ? current.bank_name

        : String(
            body.bank_name ||
            ""
          );

    const paymentStatus =

      body.payment_status ===
      undefined

        ? current.payment_status

        : String(
            body.payment_status
          );

    await env.DB.prepare(`
      UPDATE users
      SET
        active=?,
        plan=?,
        phone=?,
        iban=?,
        bank_name=?,
        payment_status=?,
        payment_method='Bank transfer / IBAN'
      WHERE
        id=?
        AND role='customer'
    `)
      .bind(
        active,
        plan,
        phone,
        iban,
        bank,
        paymentStatus,
        id
      )
      .run();

    const updated =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(id)
        .first();

    let invoice =
      null;

    if (
      !current.active &&
      active
    ) {

      invoice =
        await createActivationInvoice(
          env,
          updated
        );
    }

    return json({

      ok:
        true,

      customer:
        safeUser(
          updated
        ),

      invoice,
    });
  }

  if (
    customerMatch &&
    method ===
    "DELETE"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        customerMatch[1]
      );

    await env.DB.prepare(
      "DELETE FROM customer_agents WHERE customer_id=?"
    )
      .bind(id)
      .run();

    await env.DB.prepare(
      "DELETE FROM customer_integrations WHERE customer_id=?"
    )
      .bind(id)
      .run();

    await env.DB.prepare(
      "DELETE FROM invoices WHERE customer_id=?"
    )
      .bind(id)
      .run();

    await env.DB.prepare(`
      DELETE FROM users
      WHERE
        id=?
        AND role='customer'
    `)
      .bind(id)
      .run();

    return json({
      ok:
        true,
    });
  }


  /*
  ==========================================
  ADMIN AI AGENTS
  ==========================================
  */

  const adminAgents =
    path.match(
      /^admin\/customers\/([^/]+)\/agents$/
    );

  if (
    adminAgents &&
    method ===
    "GET"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        adminAgents[1]
      );

    if (
      !await customerExists(
        env,
        id
      )
    ) {

      return bad(
        "Customer not found",
        404
      );
    }

    await seedAgents(
      env,
      id
    );

    const rows =
      await env.DB.prepare(`
        SELECT
          id,
          agent_type,
          name,
          status,
          config_json,
          created_at,
          updated_at
        FROM customer_agents
        WHERE customer_id=?
        ORDER BY id ASC
      `)
        .bind(id)
        .all();

    return json({

      ok:
        true,

      agents:
        rows.results ||
        [],
    });
  }

  const adminAgent =
    path.match(
      /^admin\/customers\/([^/]+)\/agents\/([^/]+)$/
    );

  if (
    adminAgent &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        adminAgent[1]
      );

    const type =
      decodeURIComponent(
        adminAgent[2]
      );

    if (
      !await customerExists(
        env,
        id
      )
    ) {

      return bad(
        "Customer not found",
        404
      );
    }

    const definition =
      DEFAULT_AGENTS
        .find(
          item =>
            item.agent_type ===
            type
        );

    if (
      !definition
    ) {

      return bad(
        "Invalid agent type",
        400
      );
    }

    const body =
      await parseBody(
        request
      );

    const status =
      String(
        body.status ||
        ""
      )
        .toUpperCase();

    if (
      ![
        "ACTIVE",
        "INACTIVE",
      ]
        .includes(
          status
        )
    ) {

      return bad(
        "Invalid agent status",
        400
      );
    }

    await seedAgents(
      env,
      id
    );

    await env.DB.prepare(`
      UPDATE customer_agents
      SET
        status=?,
        updated_at=datetime('now')
      WHERE
        customer_id=?
        AND agent_type=?
    `)
      .bind(
        status,
        id,
        type
      )
      .run();

    const agent =
      await env.DB.prepare(`
        SELECT *
        FROM customer_agents
        WHERE
          customer_id=?
          AND agent_type=?
      `)
        .bind(
          id,
          type
        )
        .first();

    return json({

      ok:
        true,

      agent,
    });
  }


  /*
  ==========================================
  ADMIN INTEGRATIONS
  ==========================================
  */

  const adminIntegrations =
    path.match(
      /^admin\/customers\/([^/]+)\/integrations$/
    );

  if (
    adminIntegrations &&
    method ===
    "GET"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        adminIntegrations[1]
      );

    if (
      !await customerExists(
        env,
        id
      )
    ) {

      return bad(
        "Customer not found",
        404
      );
    }

    await seedIntegrations(
      env,
      id
    );

    const rows =
      await env.DB.prepare(`
        SELECT
          id,
          channel,
          status,
          config_json,
          created_at,
          updated_at
        FROM customer_integrations
        WHERE customer_id=?
        ORDER BY id ASC
      `)
        .bind(id)
        .all();

    return json({

      ok:
        true,

      integrations:
        (
          rows.results ||
          []
        )
          .map(
            integrationForApi
          ),
    });
  }

  const adminIntegration =
    path.match(
      /^admin\/customers\/([^/]+)\/integrations\/([^/]+)$/
    );

  if (
    adminIntegration &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        adminIntegration[1]
      );

    const channel =
      decodeURIComponent(
        adminIntegration[2]
      );

    if (
      !await customerExists(
        env,
        id
      )
    ) {

      return bad(
        "Customer not found",
        404
      );
    }

    if (
      !CHANNELS
        .includes(
          channel
        )
    ) {

      return bad(
        "Invalid integration channel",
        400
      );
    }

    const body =
      await parseBody(
        request
      );

    const status =
      String(
        body.status ||
        ""
      )
        .toUpperCase();

    if (
      ![
        "CONNECTED",
        "NOT_CONNECTED",
      ]
        .includes(
          status
        )
    ) {

      return bad(
        "Invalid integration status",
        400
      );
    }

    await seedIntegrations(
      env,
      id
    );

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM customer_integrations
        WHERE
          customer_id=?
          AND channel=?
      `)
        .bind(
          id,
          channel
        )
        .first();

    let config =
      parseConfig(
        existing?.config_json
      );


    /*
    WEBSITE SPECIAL CONFIGURATION
    */

    if (
      channel ===
      "Website"
    ) {

      if (
        status ===
        "CONNECTED"
      ) {

        const domain =
          normalizeDomain(
            body.domain ||
            config.domain
          );

        if (!domain) {

          return bad(
            "Valid website domain is required",
            400
          );
        }

        config = {

          ...config,

          domain,

          widget_key:
            config.widget_key ||
            randomHex(24),

          agent_type:
            "receptionist",

          connected_at:
            new Date()
              .toISOString(),

          business_context:
            String(
              body.business_context ||
              config.business_context ||
              ""
            )
              .trim(),

          welcome_message:
            String(
              body.welcome_message ||
              config.welcome_message ||
              "Zdravo! Kako vam mogu pomoći?"
            )
              .trim(),
        };

      } else {

        config = {

          ...config,

          disconnected_at:
            new Date()
              .toISOString(),
        };
      }
    }

    await env.DB.prepare(`
      UPDATE customer_integrations
      SET
        status=?,
        config_json=?,
        updated_at=datetime('now')
      WHERE
        customer_id=?
        AND channel=?
    `)
      .bind(
        status,
        JSON.stringify(
          config
        ),
        id,
        channel
      )
      .run();

    const integration =
      await env.DB.prepare(`
        SELECT *
        FROM customer_integrations
        WHERE
          customer_id=?
          AND channel=?
      `)
        .bind(
          id,
          channel
        )
        .first();

    return json({

      ok:
        true,

      integration:
        integrationForApi(
          integration
        ),
    });
  }


  /*
  ==========================================
  ADMIN INVOICES
  ==========================================
  */

  const adminInvoices =
    path.match(
      /^admin\/customers\/([^/]+)\/invoices$/
    );

  if (
    adminInvoices &&
    method ===
    "GET"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        adminInvoices[1]
      );

    const rows =
      await env.DB.prepare(`
        SELECT *
        FROM invoices
        WHERE customer_id=?
        ORDER BY id DESC
      `)
        .bind(id)
        .all();

    return json({

      ok:
        true,

      invoices:
        rows.results ||
        [],
    });
  }

  const resend =
    path.match(
      /^admin\/customers\/([^/]+)\/invoices\/resend$/
    );

  if (
    resend &&
    method ===
    "POST"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const id =
      decodeURIComponent(
        resend[1]
      );

    const customer =
      await env.DB.prepare(`
        SELECT *
        FROM users
        WHERE
          id=?
          AND role='customer'
      `)
        .bind(id)
        .first();

    if (
      !customer
    ) {

      return bad(
        "Customer not found",
        404
      );
    }

    const invoice =
      await env.DB.prepare(`
        SELECT *
        FROM invoices
        WHERE customer_id=?
        ORDER BY id DESC
        LIMIT 1
      `)
        .bind(id)
        .first();

    if (
      !invoice
    ) {

      return bad(
        "No invoice exists for this customer yet.",
        404
      );
    }

    try {

      const providerId =
        await sendInvoiceEmail(
          env,
          invoice,
          customer
        );

      await env.DB.prepare(`
        UPDATE invoices
        SET
          email_sent_at=datetime('now'),
          email_provider_id=?
        WHERE id=?
      `)
        .bind(
          providerId,
          invoice.id
        )
        .run();

      return json({

        ok:
          true,

        message:
          "Invoice sent",

        invoice_number:
          invoice.invoice_number,
      });

    } catch (error) {

      return bad(
        error?.message ||
        String(error),
        502
      );
    }
  }

  const adminPdf =
    path.match(
      /^admin\/invoices\/(\d+)\/pdf$/
    );

  if (
    adminPdf &&
    method ===
    "GET"
  ) {

    const r =
      await requireAdmin(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    const invoice =
      await env.DB.prepare(
        "SELECT * FROM invoices WHERE id=?"
      )
        .bind(
          Number(
            adminPdf[1]
          )
        )
        .first();

    if (
      !invoice
    ) {

      return bad(
        "Invoice not found",
        404
      );
    }

    const customer =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(
          invoice.customer_id
        )
        .first();

    const pdf =
      makeInvoicePdf(
        invoice,
        customer,
        env
      );

    return new Response(
      pdf,
      {
        headers: {

          "content-type":
            "application/pdf",

          "content-disposition":
            `attachment; filename="${invoice.invoice_number}.pdf"`,

          "cache-control":
            "no-store",
        },
      }
    );
  }


  /*
  ==========================================
  CUSTOMER INVOICES
  ==========================================
  */

  if (
    path ===
    "invoices" &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const rows =
      await env.DB.prepare(`
        SELECT
          id,
          invoice_number,
          plan,
          amount_cents,
          currency,
          status,
          issue_date,
          due_date,
          email_sent_at
        FROM invoices
        WHERE customer_id=?
        ORDER BY id DESC
      `)
        .bind(
          r.session.sub
        )
        .all();

    return json({

      ok:
        true,

      invoices:
        rows.results ||
        [],
    });
  }

  const customerPdf =
    path.match(
      /^invoices\/(\d+)\/pdf$/
    );

  if (
    customerPdf &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const invoice =
      await env.DB.prepare(`
        SELECT *
        FROM invoices
        WHERE
          id=?
          AND customer_id=?
      `)
        .bind(
          Number(
            customerPdf[1]
          ),
          r.session.sub
        )
        .first();

    if (
      !invoice
    ) {

      return bad(
        "Invoice not found",
        404
      );
    }

    const customer =
      await env.DB.prepare(
        "SELECT * FROM users WHERE id=?"
      )
        .bind(
          r.session.sub
        )
        .first();

    const pdf =
      makeInvoicePdf(
        invoice,
        customer,
        env
      );

    return new Response(
      pdf,
      {
        headers: {

          "content-type":
            "application/pdf",

          "content-disposition":
            `attachment; filename="${invoice.invoice_number}.pdf"`,

          "cache-control":
            "no-store",
        },
      }
    );
  }


  /*
  ==========================================
  CUSTOMER AGENTS
  ==========================================
  */

  if (
    path ===
    "agents" &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    await seedAgents(
      env,
      r.session.sub
    );

    const rows =
      await env.DB.prepare(`
        SELECT
          id,
          agent_type,
          name,
          status,
          config_json,
          created_at,
          updated_at
        FROM customer_agents
        WHERE customer_id=?
        ORDER BY id ASC
      `)
        .bind(
          r.session.sub
        )
        .all();

    return json({

      ok:
        true,

      agents:
        rows.results ||
        [],
    });
  }

  const agentMatch =
    path.match(
      /^agents\/([^/]+)$/
    );

  if (
    agentMatch &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const type =
      decodeURIComponent(
        agentMatch[1]
      );

    if (
      !DEFAULT_AGENTS
        .some(
          item =>
            item.agent_type ===
            type
        )
    ) {

      return bad(
        "Invalid agent type",
        400
      );
    }

    const body =
      await parseBody(
        request
      );

    const status =
      String(
        body.status ||
        ""
      )
        .toUpperCase();

    if (
      ![
        "ACTIVE",
        "INACTIVE",
      ]
        .includes(
          status
        )
    ) {

      return bad(
        "Invalid agent status",
        400
      );
    }

    await seedAgents(
      env,
      r.session.sub
    );

    await env.DB.prepare(`
      UPDATE customer_agents
      SET
        status=?,
        updated_at=datetime('now')
      WHERE
        customer_id=?
        AND agent_type=?
    `)
      .bind(
        status,
        r.session.sub,
        type
      )
      .run();

    const agent =
      await env.DB.prepare(`
        SELECT *
        FROM customer_agents
        WHERE
          customer_id=?
          AND agent_type=?
      `)
        .bind(
          r.session.sub,
          type
        )
        .first();

    return json({

      ok:
        true,

      agent,
    });
  }


  /*
  ==========================================
  CUSTOMER INTEGRATIONS
  ==========================================
  */

  if (
    path ===
    "integrations" &&
    method ===
    "GET"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    await seedIntegrations(
      env,
      r.session.sub
    );

    const rows =
      await env.DB.prepare(`
        SELECT
          id,
          channel,
          status,
          config_json,
          created_at,
          updated_at
        FROM customer_integrations
        WHERE customer_id=?
        ORDER BY id ASC
      `)
        .bind(
          r.session.sub
        )
        .all();

    return json({

      ok:
        true,

      integrations:
        (
          rows.results ||
          []
        )
          .map(
            integrationForApi
          ),
    });
  }

  const integrationMatch =
    path.match(
      /^integrations\/([^/]+)$/
    );

  if (
    integrationMatch &&
    method ===
    "PATCH"
  ) {

    const r =
      await requireSession(
        request,
        env
      );

    if (
      r.error
    ) {

      return r.error;
    }

    if (
      r.session.role !==
      "customer"
    ) {

      return bad(
        "Customer required",
        403
      );
    }

    const channel =
      decodeURIComponent(
        integrationMatch[1]
      );

    if (
      !CHANNELS
        .includes(
          channel
        )
    ) {

      return bad(
        "Invalid integration channel",
        400
      );
    }

    if (
      channel ===
      "Website"
    ) {

      return bad(
        "Website integration must be configured by Balkan Agent admin.",
        403
      );
    }

    const body =
      await parseBody(
        request
      );

    const status =
      String(
        body.status ||
        ""
      )
        .toUpperCase();

    if (
      ![
        "CONNECTED",
        "NOT_CONNECTED",
      ]
        .includes(
          status
        )
    ) {

      return bad(
        "Invalid integration status",
        400
      );
    }

    await seedIntegrations(
      env,
      r.session.sub
    );

    await env.DB.prepare(`
      UPDATE customer_integrations
      SET
        status=?,
        updated_at=datetime('now')
      WHERE
        customer_id=?
        AND channel=?
    `)
      .bind(
        status,
        r.session.sub,
        channel
      )
      .run();

    const integration =
      await env.DB.prepare(`
        SELECT *
        FROM customer_integrations
        WHERE
          customer_id=?
          AND channel=?
      `)
        .bind(
          r.session.sub,
          channel
        )
        .first();

    return json({

      ok:
        true,

      integration:
        integrationForApi(
          integration
        ),
    });
  }


  /*
  ==========================================
  PUBLIC WEBSITE WIDGET CONFIG
  ==========================================
  */

  if (
    path ===
    "widget/config" &&
    method ===
    "GET"
  ) {

    const key =
      String(
        url.searchParams
          .get(
            "key"
          ) ||
        ""
      )
        .trim();

    const origin =
      request.headers
        .get(
          "Origin"
        ) ||
      "";

    if (!key) {

      return bad(
        "Widget key required",
        400,
        corsHeaders(
          origin
        )
      );
    }

    const found =
      await findWebsiteByKey(
        env,
        key
      );

    if (!found) {

      return bad(
        "Widget not found",
        404,
        corsHeaders(
          origin
        )
      );
    }

    if (
      !originAllowed(
        origin,
        found.config.domain
      )
    ) {

      return bad(
        "Domain not allowed",
        403,
        corsHeaders(
          origin
        )
      );
    }

    return json(
      {

        ok:
          true,

        company:
          found.row.company ||
          found.row.name ||
          "Business",

        welcome_message:
          found.config
            .welcome_message ||
          "Zdravo! Kako vam mogu pomoći?",
      },
      200,
      corsHeaders(
        origin
      )
    );
  }


  /*
  ==========================================
  WEBSITE WIDGET CORS
  ==========================================
  */

  if (
    path ===
    "widget/chat" &&
    method ===
    "OPTIONS"
  ) {

    return new Response(
      null,
      {
        status:
          204,

        headers:
          corsHeaders(
            request.headers
              .get(
                "Origin"
              )
          ),
      }
    );
  }


  /*
  ==========================================
  WEBSITE AI CHAT
  ==========================================
  */

  if (
    path ===
    "widget/chat" &&
    method ===
    "POST"
  ) {

    const origin =
      request.headers
        .get(
          "Origin"
        ) ||
      "";

    const body =
      await parseBody(
        request
      );

    const key =
      String(
        body.key ||
        ""
      )
        .trim();

    const message =
      String(
        body.message ||
        ""
      )
        .trim();

    if (
      !key ||
      !message
    ) {

      return bad(
        "Widget key and message are required",
        400,
        corsHeaders(
          origin
        )
      );
    }

    if (
      message.length >
      4000
    ) {

      return bad(
        "Message too long",
        400,
        corsHeaders(
          origin
        )
      );
    }

    const found =
      await findWebsiteByKey(
        env,
        key
      );

    if (!found) {

      return bad(
        "Widget not found",
        404,
        corsHeaders(
          origin
        )
      );
    }

    if (
      !originAllowed(
        origin,
        found.config.domain
      )
    ) {

      return bad(
        "Domain not allowed",
        403,
        corsHeaders(
          origin
        )
      );
    }

    const agent =
      await env.DB.prepare(`
        SELECT *
        FROM customer_agents
        WHERE
          customer_id=?
          AND agent_type='receptionist'
      `)
        .bind(
          found.row.customer_id
        )
        .first();

    if (
      !agent ||
      agent.status !==
      "ACTIVE"
    ) {

      return bad(
        "AI Receptionist is not active for this customer",
        403,
        corsHeaders(
          origin
        )
      );
    }

    if (
      !env.OPENAI_API_KEY
    ) {

      return bad(
        "OPENAI_API_KEY is not configured",
        500,
        corsHeaders(
          origin
        )
      );
    }

    const company =
      found.row.company ||
      found.row.name ||
      "the business";

    const businessContext =
      String(
        found.config
          .business_context ||
        ""
      )
        .trim();

    const instructions =
      [

        `You are the AI Receptionist for ${company}.`,

        "Be professional, helpful, concise and friendly.",

        "Answer only as the business assistant, not as Balkan Agent.",

        "If you do not know a business-specific fact, say you can pass the question to the team instead of inventing information.",

        businessContext
          ? `Business information: ${businessContext}`
          : "",

      ]
        .filter(Boolean)
        .join("\n");

    const openai =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:
            "POST",

          headers: {

            authorization:
              `Bearer ${env.OPENAI_API_KEY}`,

            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({

              model:
                env.OPENAI_MODEL ||
                "gpt-5-mini",

              instructions,

              input:
                message,

              store:
                false,
            }),
        }
      );

    const data =
      await openai
        .json()
        .catch(
          () => ({})
        );

    if (
      !openai.ok
    ) {

      return bad(
        data?.error?.message ||
        `OpenAI error ${openai.status}`,
        502,
        corsHeaders(
          origin
        )
      );
    }

    const reply =
      extractOpenAIText(
        data
      );

    if (!reply) {

      return bad(
        "AI returned an empty response",
        502,
        corsHeaders(
          origin
        )
      );
    }

    return json(
      {

        ok:
          true,

        reply,
      },
      200,
      corsHeaders(
        origin
      )
    );
  }


  return bad(
    "Not found",
    404
  );
}
