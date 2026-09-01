import assert from 'node:assert/strict';
import { onRequest } from './functions/[[path]].js';

function createDb() {
  const state = {
    reservations: [],
    pricing: { annual_enabled: 1, annual_discount_percent: 25 },
    plans: { Starter: 8900, Business: 19900, Pro: 39900 },
  };
  return {
    state,
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async run() {
          if (sql.includes('INSERT INTO reservations')) {
            state.reservations.push({
              id: state.reservations.length + 1,
              name: this.args[0], email: this.args[1], phone: this.args[2],
              service: this.args[3], reservation_date: this.args[4],
              reservation_time: this.args[5], guests: this.args[6],
              notes: this.args[7], status: 'NEW',
            });
          }
          return { meta: { last_row_id: state.reservations.length || 1 } };
        },
        async first() {
          if (sql.includes('FROM pricing_config')) return state.pricing;
          return null;
        },
        async all() {
          if (sql.includes('FROM pricing_plans')) {
            return { results: Object.entries(state.plans).map(([plan, monthly_cents]) => ({ plan, monthly_cents })) };
          }
          if (sql.includes('FROM reservations')) return { results: state.reservations };
          return { results: [] };
        },
      };
      return statement;
    },
  };
}

function env() {
  return { DB: createDb(), SESSION_SECRET: 'test-session', ADMIN_PASSWORD: 'test-admin' };
}

async function call(path, method, body, environment = env()) {
  return onRequest({
    request: new Request(`https://example.test/api/${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: environment,
  });
}

const bot = await call('bot/chat', 'POST', { message: 'Koje su cijene i da li postoji godišnji popust?' });
assert.equal(bot.status, 200);
const botJson = await bot.json();
assert.match(botJson.reply, /25%/);
assert.equal(botJson.mode, 'fallback');

const invalid = await call('reservations', 'POST', { name: 'A', email: 'bad', service: 'hotel', reservation_date: '2026/09/01' });
assert.equal(invalid.status, 400);

const reservation = await call('reservations', 'POST', {
  name: 'Test Guest', email: 'guest@example.com', phone: '+38268000000',
  service: 'hotel reservation', reservation_date: '2026-09-15',
  reservation_time: '14:00', guests: 2, notes: 'Window seat',
});
assert.equal(reservation.status, 201);
const reservationJson = await reservation.json();
assert.equal(reservationJson.status, 'NEW');

const pricing = await call('pricing', 'GET');
assert.equal(pricing.status, 200);
const pricingJson = await pricing.json();
assert.equal(pricingJson.pricing.annual_discount_percent, 25);
assert.equal(pricingJson.plans.Business.annual_cents, 179100);

console.log('functional tests: bot fallback, FAQ knowledge, reservation validation/persistence and pricing passed');
