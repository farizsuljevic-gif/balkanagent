/** Cloudflare Pages Function.
 * Requires RESEND_API_KEY secret, VERIFIED_SENDER (verified domain) and CONTACT_RECIPIENT.
 * Never publicly embeds credentials; all mail recipients are fixed on the server.
 */
export async function onRequestPost({request, env}) {
  const headers = {'Content-Type': 'application/json; charset=utf-8','Cache-Control':'no-store'};
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status,headers});
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== new URL(request.url).host) return reply({ok:false,error:'Request origin not accepted.'},403);
    } catch {return reply({ok:false,error:'Invalid origin.'},403);}
  }
  if (Number(request.headers.get('content-length') || 0) > 12000) return reply({ok:false,error:'Request is too large.'},413);
  let payload;
  try {payload = await request.json();} catch {return reply({ok:false,error:'Invalid form data.'},400);}
  if (payload.contact_time) return reply({ok:true}); // bot honeypot
  const clean = (value,max) => String(value||'').trim().slice(0,max);
  const data = {
    name:clean(payload.name,100),email:clean(payload.email,180),company:clean(payload.company,120),
    country:clean(payload.country,90),website:clean(payload.website,240),service:clean(payload.service,140),
    message:clean(payload.message,5000),consent:payload.consent==='yes'
  };
  if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.service || data.message.length < 12 || !data.consent)
    return reply({ok:false,error:'Please complete all required fields.'},400);
  if (data.website) {try {const url=new URL(data.website);if(!['http:','https:'].includes(url.protocol))throw new Error();}catch{return reply({ok:false,error:'Please use a valid website URL.'},400);}}
  if (!env.RESEND_API_KEY || !env.VERIFIED_SENDER || !env.CONTACT_RECIPIENT)
    return reply({ok:false,fallback:true,error:'Email delivery has not been configured.'},503);
  // Important: email is sent ONLY to configured business inbox, not an address supplied by the visitor.
  const esc = v => v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rows = Object.entries(data).filter(([key]) => key !== 'consent').map(([key,val]) => `<tr><th style="text-align:left;padding:8px;border:1px solid #ddd">${esc(key)}</th><td style="padding:8px;border:1px solid #ddd;white-space:pre-wrap">${esc(String(val))}</td></tr>`).join('');
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.VERIFIED_SENDER,to:[env.CONTACT_RECIPIENT],reply_to:data.email,
        subject:'Balkan Agent enquiry: '+data.service.replace(/[\r\n]/g,' '),
        html:`<h2>New Balkan Agent enquiry</h2><table style="border-collapse:collapse">${rows}</table><p>Submitted with contact consent.</p>`})
    });
    if (!resp.ok) return reply({ok:false,error:'Email service could not accept the message. Please try the direct email link.'},502);
    return reply({ok:true});
  } catch {return reply({ok:false,error:'Email service unavailable. Please try the direct email link.'},502);}
}
export async function onRequestGet() {
  return new Response('Method not allowed', {status:405, headers:{'Allow':'POST'}});
}
