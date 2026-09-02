import assert from 'node:assert/strict';
import { onRequest } from './functions/[[path]].js';

function createDb() {
  const users = [];
  return {
    users,
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async run() {
          if (sql.includes('INSERT INTO users')) {
            const [id,email,password_hash,password_salt,name,company,phone,plan] = this.args;
            users.push({id,email,password_hash,password_salt,name,company,phone,plan,active:0,role:'customer',payment_method:'Bank transfer / IBAN',payment_status:'UNPAID',billing_cycle:'monthly',created_at:'2026-09-01 19:00:00'});
          }
          return {meta:{last_row_id:users.length || 1}};
        },
        async first() {
          if (sql.includes('SELECT id FROM users WHERE email=?')) return users.find(user => user.email === this.args[0]) || null;
          if (sql.includes("SELECT * FROM users WHERE email=? AND role='customer'")) return users.find(user => user.email === this.args[0] && user.role === 'customer') || null;
          if (sql.includes('SELECT * FROM users WHERE id=?')) return users.find(user => user.id === this.args[0]) || null;
          return null;
        },
        async all() { return {results:[]}; },
      };
      return statement;
    },
  };
}

const originalFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, options = {}) => {
  sent.push({url, options, body:JSON.parse(options.body || '{}')});
  return new Response(JSON.stringify({id:'resend-registration-test'}), {status:200, headers:{'content-type':'application/json'}});
};

const environment = {
  DB:createDb(),
  SESSION_SECRET:'regression-session-secret',
  ADMIN_PASSWORD:'regression-admin-password',
  RESEND_API_KEY:'re_test_key',
  INVOICE_FROM_EMAIL:'Balkan Agent <info@balkanagent.com>',
  INVOICE_CONTACT_EMAIL:'info@balkanagent.com',
};

async function call(path, method, body, headers = {}) {
  return onRequest({
    request:new Request(`https://balkanagent.example/api/${path}`, {
      method,
      headers:{'content-type':'application/json', ...headers},
      body:body === undefined ? undefined : JSON.stringify(body),
    }),
    env:environment,
  });
}

const registration = await call('auth/register','POST',{
  name:'Test Customer', company:'Test Balkan Co', email:'customer@example.com', phone:'+38268000000', password:'strong-password-123',
});
assert.equal(registration.status,201);
const registrationJson = await registration.json();
assert.equal(registrationJson.owner_notification_sent,true);
assert.equal(sent.length,1);
assert.equal(sent[0].url,'https://api.resend.com/emails');
assert.equal(sent[0].body.from,'info@balkanagent.com');
assert.deepEqual(sent[0].body.to,['info@balkanagent.com']);
assert.match(sent[0].body.subject,/Nova Balkan Agent registracija/);
assert.match(sent[0].body.html,/customer@example\.com/);

const login = await call('auth/login','POST',{email:'customer@example.com',password:'strong-password-123'});
assert.equal(login.status,403);

// The account is intentionally inactive until the admin confirms the bank transfer.
environment.DB.users[0].active = 1;
const activeLogin = await call('auth/login','POST',{email:'customer@example.com',password:'strong-password-123'});
assert.equal(activeLogin.status,200);
assert.equal(activeLogin.headers.get('set-cookie')?.startsWith('ba_session='),true);
assert.match(activeLogin.headers.get('set-cookie') || '',/HttpOnly/);
const cookie = activeLogin.headers.get('set-cookie').split(';')[0];
const authMe = await call('auth/me','GET',undefined,{cookie});
assert.equal(authMe.status,200);
const authMeJson = await authMe.json();
assert.equal(authMeJson.role,'customer');
assert.equal(authMeJson.user.email,'customer@example.com');

const customerHtml = await (await import('node:fs/promises')).readFile('./customer.html','utf8');
assert.match(customerHtml,/credentials:'include'/);
assert.match(customerHtml,/if\(e\?\.status===401\|\|e\?\.status===403\)/);
assert.match(customerHtml,/Customer portal je privremeno nedostupan/);

console.log('auth/email/session regression passed: registration owner notification, sender normalization, inactive gate, login cookie and auth/me refresh');
globalThis.fetch = originalFetch;
