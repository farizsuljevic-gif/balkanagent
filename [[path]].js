
const enc = new TextEncoder();

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function bad(message, status=400) {
  return json({ok:false, error:message}, status);
}

function base64url(bytes) {
  let s = "";
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function fromBase64url(s) {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign","verify"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

async function makeSession(env, payload) {
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const sig = base64url(await hmac(env.SESSION_SECRET, body));
  return body + "." + sig;
}

async function readSession(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)ba_session=([^;]+)/);
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return null;
  const expected = base64url(await hmac(env.SESSION_SECRET, body));
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieSecurity(request) {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : '';
}
function sessionCookie(token, request) {
  return `ba_session=${token}; Path=/; HttpOnly${cookieSecurity(request)}; SameSite=Lax; Max-Age=604800`;
}
function clearCookie(request) {
  return `ba_session=; Path=/; HttpOnly${cookieSecurity(request)}; SameSite=Lax; Max-Age=0`;
}

function randomHex(n=16) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map(h=>parseInt(h,16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2", hash:"SHA-256", salt, iterations:210000},
    key,
    256
  );
  return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    company: row.company || "",
    phone: row.phone || "",
    plan: row.plan || "Starter",
    active: !!row.active,
    role: row.role || "customer",
    payment_method: row.payment_method || "Bank transfer / IBAN",
    iban: row.iban || "",
    bank_name: row.bank_name || "",
    payment_status: row.payment_status || "UNPAID",
    created_at: row.created_at
  };
}

async function requireSession(request, env) {
  const s = await readSession(request, env);
  if (!s) return {error: bad("Not authenticated",401)};
  return {session:s};
}
async function requireAdmin(request, env) {
  const r = await requireSession(request, env);
  if (r.error) return r;
  if (r.session.role !== "admin") return {error: bad("Admin required",403)};
  return r;
}

async function parseBody(request) {
  try { return await request.json(); } catch { return {}; }
}

function cleanBotText(value, max=1200){
  return String(value||'').replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g,'').trim().slice(0,max);
}

const FAQ_KNOWLEDGE=[
  {keys:['cijen','price','paket'],answer:'Naši planovi su Starter 89 EUR, Business 199 EUR i Pro 399 EUR mjesečno. Godišnji paket trenutno ima 25% popusta. Enterprise je po dogovoru. Pošaljite djelatnost i broj kanala pa možemo preporučiti paket.'},
  {keys:['rezerv','termin','book'],answer:'Mogu pomoći oko rezervacije ili termina. Napišite djelatnost, željeni datum, vrijeme, broj osoba i kontakt. Konačnu dostupnost potvrđuje vaš tim.'},
  {keys:['whatsapp','instagram','viber'],answer:'Balkan Agent može povezati web-chat i poslovne kanale. Za stvarno povezivanje potreban je odobreni poslovni nalog i sigurna konfiguracija; privatne API ključeve ne unosite u javni sajt.'},
  {keys:['medicin','doktor','patient'],answer:'Za medicinu agent može dati potvrđene administrativne informacije, pomoći oko termina i predati razgovor osoblju. Ne daje dijagnoze niti medicinske savjete.'}
];
function knowledgeReply(message){const text=String(message||'').toLowerCase();return FAQ_KNOWLEDGE.find(item=>item.keys.some(key=>text.includes(key)))?.answer||null;}
function localBotReply(message){
  const text=message.toLowerCase();
  const known=knowledgeReply(message); if(known)return known;
  if(text.includes('cijen')||text.includes('price')||text.includes('paket')) return 'Zdravo! Mogu pomoći oko usluga, cijena, rezervacija i povezivanja kanala. Ako želite razgovor s timom, napišite „kontakt“.';
  if(text.includes('rezerv')||text.includes('termin')||text.includes('book')) return 'Mogu pomoći oko rezervacije ili termina. Napišite djelatnost, željeni datum, vrijeme, broj osoba i kontakt. Konačnu dostupnost potvrđuje vaš tim.';
  if(text.includes('whatsapp')||text.includes('instagram')||text.includes('viber')) return 'Balkan Agent može povezati web-chat i poslovne kanale. Za stvarno povezivanje potreban je odobreni poslovni nalog i sigurna konfiguracija; privatne API ključeve ne unosite u javni sajt.';
  if(text.includes('medicin')||text.includes('doktor')||text.includes('patient')) return 'Za medicinu agent može dati potvrđene informacije, pomoći oko termina i predati razgovor osoblju. Ne daje dijagnoze niti medicinske savjete.';
  return 'Zdravo! Mogu pomoći oko usluga, cijena, rezervacija i povezivanja kanala. Ako želite razgovor s timom, napišite „kontakt“.';
}

async function serverBotReply(env, messages){
  if(!env.BOT_AI_API_URL || !env.BOT_AI_API_KEY) return localBotReply(messages[messages.length-1]?.content||'');
  const response=await fetch(env.BOT_AI_API_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.BOT_AI_API_KEY}`},body:JSON.stringify({model:env.BOT_AI_MODEL||'gpt-4o-mini',messages,temperature:0.2,max_tokens:300})});
  if(!response.ok) throw new Error(`Bot provider error ${response.status}`);
  const data=await response.json();
  const reply=cleanBotText(data?.choices?.[0]?.message?.content||data?.output_text||'');
  return reply||localBotReply(messages[messages.length-1]?.content||'');
}

// ---------- INVOICES ----------
const PLAN_PRICES = {Starter:8900, Business:19900, Pro:39900};
const DEFAULT_PRICING = {annual_enabled:1, annual_discount_percent:25};

async function ensurePricingSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pricing_config (
    id INTEGER PRIMARY KEY CHECK (id=1),
    annual_enabled INTEGER NOT NULL DEFAULT 1,
    annual_discount_percent INTEGER NOT NULL DEFAULT 25,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pricing_plans (
    plan TEXT PRIMARY KEY,
    monthly_cents INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO pricing_config(id,annual_enabled,annual_discount_percent) VALUES(1,1,25)`).run();
  for(const [plan,cents] of Object.entries(PLAN_PRICES)) await env.DB.prepare('INSERT OR IGNORE INTO pricing_plans(plan,monthly_cents) VALUES(?,?)').bind(plan,cents).run();
}
async function getPricing(env){
  await ensurePricingSchema(env);
  const row=await env.DB.prepare('SELECT * FROM pricing_config WHERE id=1').first();
  const rows=await env.DB.prepare('SELECT plan,monthly_cents FROM pricing_plans').all();
  const plans=Object.fromEntries((rows.results||[]).map(x=>[x.plan,{monthly_cents:Number(x.monthly_cents),annual_cents:annualAmountCents(Number(x.monthly_cents),Number(row?.annual_discount_percent??25))}]));
  return {annual_enabled:!!(row?.annual_enabled ?? DEFAULT_PRICING.annual_enabled),annual_discount_percent:Number(row?.annual_discount_percent ?? 25),plans};
}

async function ensureReservationSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    service TEXT NOT NULL,
    reservation_date TEXT NOT NULL,
    reservation_time TEXT DEFAULT '',
    guests INTEGER NOT NULL DEFAULT 1,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

async function ensureInvoiceSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS invoices (
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
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)`).run();
}

async function planAmountCents(plan, env) {
  await ensurePricingSchema(env);
  const row=await env.DB.prepare('SELECT monthly_cents FROM pricing_plans WHERE plan=?').bind(plan).first();
  if(row?.monthly_cents!==undefined) return Number(row.monthly_cents);
  const custom = Number(env.INVOICE_ENTERPRISE_PRICE_CENTS || 0);
  return Number.isFinite(custom) && custom > 0 ? Math.round(custom) : 0;
}
function annualAmountCents(monthly, discountPercent=25){
  const pct=Math.max(0,Math.min(100,Number(discountPercent)||0));
  return Math.round(monthly*12*(1-pct/100));
}

function ascii(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
}
function pdfEsc(s='') { return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)'); }
function money(cents,currency='EUR'){ return `${(Number(cents||0)/100).toFixed(2)} ${currency}`; }
function dueDate(days=7){ const d=new Date(); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }

function makeInvoicePdf(invoice, customer, env) {
  const company = env.INVOICE_COMPANY_NAME || 'Balkan Agent';
  const address = env.INVOICE_COMPANY_ADDRESS || '';
  const tax = env.INVOICE_TAX_ID || '';
  const iban = env.INVOICE_IBAN || '';
  const bank = env.INVOICE_BANK_NAME || '';
  const swift = env.INVOICE_SWIFT || '';
  const phone = env.INVOICE_PHONE || '+382 68 400 509';
  const email = env.INVOICE_CONTACT_EMAIL || 'info@balkanagent.com';
  const lines = [
    ['B','BALKAN AGENT',48,795,18], ['R','AI Automation & Digital Solutions',48,778,9],
    ['B','INVOICE',430,795,22], ['R',`Invoice No: ${invoice.invoice_number}`,430,773,9],
    ['R',`Issue date: ${invoice.issue_date}`,430,760,9], ['R',`Due date: ${invoice.due_date}`,430,747,9],
    ['B','FROM',48,714,9], ['R',company,48,697,10], ['R',address,48,683,8], ['R',tax?`Tax ID: ${tax}`:'',48,670,8],
    ['R',`Phone: ${phone}`,48,657,8], ['R',`Email: ${email}`,48,644,8],
    ['B','BILL TO',315,714,9], ['R',customer.company||customer.name,315,697,10], ['R',customer.name,315,683,8],
    ['R',customer.email,315,670,8], ['R',customer.phone||'',315,657,8],
    ['B','DESCRIPTION / SERVICE',48,604,8], ['B','AMOUNT',455,604,8],
    ['R',invoice.description,48,578,10], ['R',money(invoice.amount_cents,invoice.currency),455,578,10],
    ['B','TOTAL',390,520,11], ['B',money(invoice.amount_cents,invoice.currency),455,520,11],
    ['B','PAYMENT DETAILS',48,465,9], ['R',`Account holder: ${company}`,48,447,8], ['R',`Bank: ${bank}`,48,433,8],
    ['R',`IBAN: ${iban}`,48,419,8], ['R',`SWIFT / BIC: ${swift}`,48,405,8],
    ['R',`Payment reference: ${invoice.invoice_number}`,48,391,8],
    ['R','Thank you for choosing Balkan Agent - intelligent automation for modern business.',48,92,8]
  ].filter(x=>x[1]);
  let stream='';
  stream += '0.04 0.09 0.20 rg 0 812 595 30 re f\n';
  stream += '0.78 0.63 0.29 rg 0 0 595 8 re f\n';
  stream += '0.78 0.63 0.29 RG 1.5 w 48 728 m 547 728 l S\n';
  stream += '0.88 0.90 0.94 RG 0.6 w 48 592 m 547 592 l S 48 550 m 547 550 l S\n';
  for(const [font,text,x,y,size] of lines){
    stream += `BT /F${font==='B'?2:1} ${size} Tf ${font==='B'?'0.04 0.09 0.20':'0.20 0.25 0.33'} rg ${x} ${y} Td (${pdfEsc(text)}) Tj ET\n`;
  }
  const objs=[];
  objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objs[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
  objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objs[5]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objs[6]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  let pdf='%PDF-1.4\n'; const offs=[0];
  for(let i=1;i<=6;i++){ offs[i]=pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref=pdf.length; pdf += 'xref\n0 7\n0000000000 65535 f \n';
  for(let i=1;i<=6;i++) pdf += String(offs[i]).padStart(10,'0')+' 00000 n \n';
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc.encode(pdf);
}
function bytesToBase64(bytes){
  let out=''; const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) out += String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(out);
}

async function sendInvoiceEmail(env, invoice, customer) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const from = env.INVOICE_FROM_EMAIL || 'Balkan Agent <invoices@balkanagent.com>';
  const pdf = makeInvoicePdf(invoice, customer, env);
  const total = money(invoice.amount_cents, invoice.currency);
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0a1733;max-width:640px;margin:auto">
      <div style="border-top:8px solid #0a1733;padding:24px 0 10px;border-bottom:2px solid #c7a24a">
        <h1 style="margin:0">BALKAN AGENT</h1><div style="color:#667085">AI Automation & Digital Solutions</div>
      </div>
      <h2>Your invoice ${invoice.invoice_number}</h2>
      <p>Hello ${String(customer.name||'').replace(/[<>]/g,'')}, your Balkan Agent account has been activated.</p>
      <p><b>Plan:</b> ${invoice.plan}<br><b>Total:</b> ${total}<br><b>Due date:</b> ${invoice.due_date}</p>
      <p>Your PDF invoice is attached to this email.</p>
      <p style="color:#667085;font-size:13px">Balkan Agent · +382 68 400 509 · info@balkanagent.com · balkanagent.com</p>
    </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{'authorization':`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({from,to:[customer.email],subject:`Balkan Agent invoice ${invoice.invoice_number}`,html,
      attachments:[{filename:`${invoice.invoice_number}.pdf`,content:bytesToBase64(pdf)}]})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.message||j.error||`Email provider error ${r.status}`);
  return j.id || '';
}

async function createActivationInvoice(env, customer) {
  await ensureInvoiceSchema(env);
  const amount=await planAmountCents(customer.plan,env);
  const tmp='TMP-'+crypto.randomUUID();
  const description = customer.plan==='Enterprise' ? 'Balkan Agent Enterprise - agreed monthly service' : `Balkan Agent ${customer.plan} plan - monthly service`;
  const result=await env.DB.prepare(`INSERT INTO invoices(customer_id,invoice_number,plan,description,amount_cents,currency,status,issue_date,due_date)
    VALUES(?,?,?,?,?,'EUR','ISSUED',date('now'),?)`).bind(customer.id,tmp,customer.plan,description,amount,dueDate(Number(env.INVOICE_DUE_DAYS||7))).run();
  const id=Number(result.meta && result.meta.last_row_id);
  const year=new Date().getUTCFullYear();
  const number=`BA-${year}-${String(id).padStart(6,'0')}`;
  await env.DB.prepare('UPDATE invoices SET invoice_number=? WHERE id=?').bind(number,id).run();
  let invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();
  try {
    const providerId=await sendInvoiceEmail(env,invoice,customer);
    await env.DB.prepare("UPDATE invoices SET email_sent_at=datetime('now'), email_provider_id=? WHERE id=?").bind(providerId,id).run();
    invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();
    return {invoice,email_sent:true};
  } catch(e) {
    return {invoice,email_sent:false,email_error:e.message};
  }
}

export async function onRequest(context) {
  const {request, env} = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/,"");
  const method = request.method.toUpperCase();

  if (path === 'bot/chat' && method === 'POST') {
    const b=await parseBody(request);
    const message=cleanBotText(b.message,1200);
    if(!message) return bad('Message is required.');
    const rawHistory=Array.isArray(b.history)?b.history.slice(-8):[];
    const history=rawHistory.map(item=>({role:item?.role==='assistant'?'assistant':'user',content:cleanBotText(item?.content,600)})).filter(item=>item.content);
    const system='You are Balkan Agent customer assistant. Answer in the user language. Explain web chat, channels, lead qualification, bookings and support. Never invent prices, availability, clients, results or integrations. Never diagnose or give medical advice. For medical topics, provide general administrative information only and hand over to staff. If a request needs a person, say that the team will take over and return handoff=true. Keep answers concise and practical.';
    let reply;
    try { reply=await serverBotReply(env,[{role:'system',content:system},...history,{role:'user',content:message}]); }
    catch { reply=localBotReply(message); }
    const handoff=/kontakt|čovjek|tim|osobl|dijagnoz|medicin/i.test(reply+' '+message);
    return json({ok:true,reply,handoff,mode:env.BOT_AI_API_URL?'ai':'fallback'});
  }

  if (!env.DB) return bad("D1 binding DB is not configured",500);
  if (!env.SESSION_SECRET) return bad("SESSION_SECRET is not configured",500);
  if (!env.ADMIN_PASSWORD) return bad("ADMIN_PASSWORD is not configured",500);

  if (path === 'pricing' && method === 'GET') {
    const pricing=await getPricing(env);
    return json({ok:true,pricing,plans:pricing.plans});
  }
  if (path === 'reservations' && method === 'POST') {
    await ensureReservationSchema(env);
    const b=await parseBody(request); const name=String(b.name||'').trim().slice(0,120); const email=String(b.email||'').trim().toLowerCase().slice(0,320); const phone=String(b.phone||'').trim().slice(0,40); const service=String(b.service||'').trim().slice(0,120); const date=String(b.reservation_date||'').trim().slice(0,20); const time=String(b.reservation_time||'').trim().slice(0,20); const guests=Math.max(1,Math.min(100,Number(b.guests||1))); const notes=String(b.notes||'').trim().slice(0,1000);
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!service||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Name, valid email, service and date are required.');
    const result=await env.DB.prepare('INSERT INTO reservations(name,email,phone,service,reservation_date,reservation_time,guests,notes) VALUES(?,?,?,?,?,?,?,?)').bind(name,email,phone,service,date,time,guests,notes).run();
    return json({ok:true,reservation_id:result.meta?.last_row_id,status:'NEW',message:'Request received. Our team will confirm availability.'},201);
  }
  if (path === 'admin/reservations' && method === 'GET') {
    const r=await requireAdmin(request,env); if(r.error)return r.error; await ensureReservationSchema(env); const rows=await env.DB.prepare('SELECT * FROM reservations ORDER BY id DESC LIMIT 200').all(); return json({ok:true,reservations:rows.results||[]});
  }
  if (path === 'admin/pricing' && method === 'GET') {
    const r=await requireAdmin(request,env); if(r.error)return r.error;
    const pricing=await getPricing(env);
    return json({ok:true,pricing,plans:pricing.plans});
  }
  if (path === 'admin/pricing' && method === 'PATCH') {
    const r=await requireAdmin(request,env); if(r.error)return r.error;
    const b=await parseBody(request); const enabled=b.annual_enabled===undefined?1:(b.annual_enabled?1:0);
    const discount=Math.max(0,Math.min(50,Math.round(Number(b.annual_discount_percent ?? 25))));
    await ensurePricingSchema(env);
    await env.DB.prepare("UPDATE pricing_config SET annual_enabled=?, annual_discount_percent=?, updated_at=datetime('now') WHERE id=1").bind(enabled,discount).run();
    return json({ok:true,pricing:await getPricing(env)});
  }

  // REGISTER CUSTOMER
  if (path === "auth/register" && method === "POST") {
    const b = await parseBody(request);
    const name = String(b.name||"").trim();
    const company = String(b.company||"").trim();
    const email = String(b.email||"").trim().toLowerCase();
    const phone = String(b.phone||"").trim();
    const password = String(b.password||"");
    if (!name || !email || password.length < 8) return bad("Name, email and password of at least 8 characters are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Invalid email.");

    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (exists) return bad("Account already exists.",409);

    const salt = randomHex(16);
    const password_hash = await hashPassword(password, salt);
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO users
      (id,email,password_hash,password_salt,name,company,phone,plan,active,role,payment_method,payment_status,created_at)
      VALUES (?,?,?,?,?,?,?,?,0,'customer','Bank transfer / IBAN','UNPAID',datetime('now'))
    `).bind(id,email,password_hash,salt,name,company,phone,"Starter").run();

    return json({ok:true, status:"pending", message:"Account created. Admin activation is required."},201);
  }

  // LOGIN: one endpoint for admin + customer
  if (path === "auth/login" && method === "POST") {
    const b = await parseBody(request);
    const email = String(b.email||"").trim().toLowerCase();
    const password = String(b.password||"");

    if (email === "ceo@balkanagent.com") {
      if (password !== env.ADMIN_PASSWORD) return bad("Wrong email or password.",401);
      const token = await makeSession(env, {
        sub:"admin", role:"admin", email,
        exp:Date.now()+7*24*60*60*1000
      });
      return json({ok:true, role:"admin"},200,{"set-cookie":sessionCookie(token, request)});
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE email=? AND role='customer'").bind(email).first();
    if (!user) return bad("Wrong email or password.",401);
    const test = await hashPassword(password, user.password_salt);
    if (test !== user.password_hash) return bad("Wrong email or password.",401);
    if (!user.active) return bad("Account is waiting for admin activation.",403);

    const token = await makeSession(env,{
      sub:user.id, role:"customer", email:user.email,
      exp:Date.now()+7*24*60*60*1000
    });
    return json({ok:true, role:"customer", user:safeUser(user)},200,{"set-cookie":sessionCookie(token, request)});
  }

  if (path === "auth/logout" && method === "POST") {
    return json({ok:true},200,{"set-cookie":clearCookie(request)});
  }

  if (path === "auth/me" && method === "GET") {
    const r = await requireSession(request,env);
    if (r.error) return r.error;
    if (r.session.role === "admin") return json({ok:true,role:"admin",email:r.session.email});
    const user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(r.session.sub).first();
    if (!user || !user.active) return bad("Account inactive",403);
    return json({ok:true,role:"customer",user:safeUser(user)});
  }

  // CUSTOMER PROFILE
  if (path === "profile" && method === "GET") {
    const r=await requireSession(request,env);
    if (r.error) return r.error;
    if (r.session.role!=="customer") return bad("Customer required",403);
    const user=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(r.session.sub).first();
    return json({ok:true,user:safeUser(user)});
  }

  if (path === "profile" && method === "PATCH") {
    const r=await requireSession(request,env);
    if (r.error) return r.error;
    if (r.session.role!=="customer") return bad("Customer required",403);
    const b=await parseBody(request);
    const name=String(b.name||"").trim();
    const company=String(b.company||"").trim();
    const phone=String(b.phone||"").trim();
    const iban=String(b.iban||"").trim();
    const bank=String(b.bank_name||"").trim();
    if (!name) return bad("Name is required");
    await env.DB.prepare(`
      UPDATE users SET name=?, company=?, phone=?, iban=?, bank_name=?, payment_method='Bank transfer / IBAN'
      WHERE id=?
    `).bind(name,company,phone,iban,bank,r.session.sub).run();
    const user=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(r.session.sub).first();
    return json({ok:true,user:safeUser(user)});
  }

  // ADMIN CUSTOMERS
  if (path === "admin/customers" && method === "GET") {
    const r=await requireAdmin(request,env);
    if (r.error) return r.error;
    const rows=await env.DB.prepare("SELECT * FROM users WHERE role='customer' ORDER BY created_at DESC").all();
    return json({ok:true,customers:(rows.results||[]).map(safeUser)});
  }

  const match = path.match(/^admin\/customers\/([^/]+)$/);
  if (match && method === "PATCH") {
    const r=await requireAdmin(request,env);
    if (r.error) return r.error;
    const id=match[1];
    const b=await parseBody(request);
    const current=await env.DB.prepare("SELECT * FROM users WHERE id=? AND role='customer'").bind(id).first();
    if (!current) return bad("Customer not found",404);

    const active = b.active === undefined ? current.active : (b.active ? 1 : 0);
    const plan = b.plan === undefined ? current.plan : String(b.plan);
    const phone = b.phone === undefined ? current.phone : String(b.phone||"");
    const iban = b.iban === undefined ? current.iban : String(b.iban||"");
    const bank = b.bank_name === undefined ? current.bank_name : String(b.bank_name||"");
    const paymentStatus = b.payment_status === undefined ? current.payment_status : String(b.payment_status);

    await env.DB.prepare(`
      UPDATE users SET active=?, plan=?, phone=?, iban=?, bank_name=?, payment_status=?, payment_method='Bank transfer / IBAN'
      WHERE id=? AND role='customer'
    `).bind(active,plan,phone,iban,bank,paymentStatus,id).run();

    const updated=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
    let invoiceResult=null;
    if (!current.active && active) invoiceResult=await createActivationInvoice(env, updated);
    return json({ok:true,customer:safeUser(updated),invoice:invoiceResult});
  }


  const customerInvoicesMatch = path.match(/^admin\/customers\/([^/]+)\/invoices$/);
  if (customerInvoicesMatch && method === "GET") {
    const r=await requireAdmin(request,env); if(r.error)return r.error;
    await ensureInvoiceSchema(env);
    const rows=await env.DB.prepare('SELECT * FROM invoices WHERE customer_id=? ORDER BY id DESC').bind(customerInvoicesMatch[1]).all();
    return json({ok:true,invoices:rows.results||[]});
  }

  const resendMatch = path.match(/^admin\/customers\/([^/]+)\/invoices\/resend$/);
  if (resendMatch && method === "POST") {
    const r=await requireAdmin(request,env); if(r.error)return r.error;
    await ensureInvoiceSchema(env);
    const customer=await env.DB.prepare("SELECT * FROM users WHERE id=? AND role='customer'").bind(resendMatch[1]).first();
    if(!customer)return bad('Customer not found',404);
    const invoice=await env.DB.prepare('SELECT * FROM invoices WHERE customer_id=? ORDER BY id DESC LIMIT 1').bind(customer.id).first();
    if(!invoice)return bad('No invoice exists for this customer yet.',404);
    try{
      const providerId=await sendInvoiceEmail(env,invoice,customer);
      await env.DB.prepare("UPDATE invoices SET email_sent_at=datetime('now'), email_provider_id=? WHERE id=?").bind(providerId,invoice.id).run();
      return json({ok:true,message:'Invoice sent',invoice_number:invoice.invoice_number});
    }catch(e){ return bad(e.message,502); }
  }

  const adminPdfMatch = path.match(/^admin\/invoices\/(\d+)\/pdf$/);
  if (adminPdfMatch && method === "GET") {
    const r=await requireAdmin(request,env); if(r.error)return r.error;
    await ensureInvoiceSchema(env);
    const invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(Number(adminPdfMatch[1])).first();
    if(!invoice)return bad('Invoice not found',404);
    const customer=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(invoice.customer_id).first();
    const pdf=makeInvoicePdf(invoice,customer,env);
    return new Response(pdf,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${invoice.invoice_number}.pdf"`,'cache-control':'no-store'}});
  }

  if (path === 'invoices' && method === 'GET') {
    const r=await requireSession(request,env); if(r.error)return r.error;
    if(r.session.role!=='customer')return bad('Customer required',403);
    await ensureInvoiceSchema(env);
    const rows=await env.DB.prepare('SELECT id,invoice_number,plan,amount_cents,currency,status,issue_date,due_date,email_sent_at FROM invoices WHERE customer_id=? ORDER BY id DESC').bind(r.session.sub).all();
    return json({ok:true,invoices:rows.results||[]});
  }

  const customerPdfMatch = path.match(/^invoices\/(\d+)\/pdf$/);
  if (customerPdfMatch && method === 'GET') {
    const r=await requireSession(request,env); if(r.error)return r.error;
    if(r.session.role!=='customer')return bad('Customer required',403);
    await ensureInvoiceSchema(env);
    const invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=? AND customer_id=?').bind(Number(customerPdfMatch[1]),r.session.sub).first();
    if(!invoice)return bad('Invoice not found',404);
    const customer=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(r.session.sub).first();
    const pdf=makeInvoicePdf(invoice,customer,env);
    return new Response(pdf,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${invoice.invoice_number}.pdf"`,'cache-control':'no-store'}});
  }

  if (match && method === "DELETE") {
    const r=await requireAdmin(request,env);
    if (r.error) return r.error;
    await env.DB.prepare("DELETE FROM users WHERE id=? AND role='customer'").bind(match[1]).run();
    return json({ok:true});
  }

  return bad("Not found",404);
}
