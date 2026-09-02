import assert from 'node:assert/strict';
import { createActivationInvoice, getPricing } from './functions/[[path]].js';

const state = {
  pricingConfig:{annual_enabled:1,annual_discount_percent:25},
  plans:[
    {plan:'Starter',monthly_cents:8900,activation_cents:14900},
    {plan:'Business',monthly_cents:19900,activation_cents:34900},
    {plan:'Pro',monthly_cents:39900,activation_cents:69900},
    {plan:'Premium',monthly_cents:69900,activation_cents:99000},
  ],
  invoices:[],
};
const db = {
  prepare(sql){
    const statement={args:[],bind(...args){this.args=args;return this;},async run(){
      if(sql.includes('INSERT INTO invoices')){
        const [customer_id,invoice_number,plan,description,amount_cents,discount_percent,,status,,due_date]=this.args;
        state.invoices.push({id:state.invoices.length+1,customer_id,invoice_number,plan,description,amount_cents,discount_percent,currency:'EUR',status,issue_date:'2026-09-01',due_date,email_sent_at:null,email_provider_id:null});
      } else if(sql.includes('UPDATE invoices SET invoice_number')) {
        const invoice=state.invoices.find(x=>x.id===Number(this.args[1])); if(invoice) invoice.invoice_number=this.args[0];
      } else if(sql.includes('UPDATE invoices SET email_sent_at')) {
        const invoice=state.invoices.find(x=>x.id===Number(this.args[1])); if(invoice){invoice.email_sent_at='2026-09-01';invoice.email_provider_id=this.args[0];}
      }
      return {meta:{last_row_id:state.invoices.length||1}};
    },async first(){
      if(sql.includes('FROM pricing_config')) return state.pricingConfig;
      if(sql.includes('SELECT monthly_cents FROM pricing_plans')) return state.plans.find(x=>x.plan===this.args[0])||null;
      if(sql.includes('SELECT activation_cents FROM pricing_plans')) return state.plans.find(x=>x.plan===this.args[0])||null;
      if(sql.includes('FROM invoices WHERE id=?')) return state.invoices.find(x=>x.id===Number(this.args[0]))||null;
      return null;
    },async all(){
      if(sql.includes('FROM pricing_plans')) return {results:state.plans};
      return {results:[]};
    }}; return statement;
  },
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(JSON.stringify({id:'resend-activation-test'}),{status:200,headers:{'content-type':'application/json'}});
const env={DB:db,SESSION_SECRET:'activation-test',RESEND_API_KEY:'re_test_key',INVOICE_FROM_EMAIL:'info@balkanagent.com',INVOICE_ACCOUNT_HOLDER:'Suljevic Fariz',INVOICE_IBAN:'DE40 1001 1001 2345 8334 17',INVOICE_SWIFT:'NTSBDEB1XXX'};

const pricing=await getPricing(env);
assert.equal(pricing.plans.Starter.activation_cents,14900);
assert.equal(pricing.plans.Business.activation_cents,34900);
assert.equal(pricing.plans.Pro.activation_cents,69900);
assert.equal(pricing.plans.Enterprise,undefined);
assert.equal(Object.keys(pricing.plans).length,4);
assert.equal(pricing.plans.Premium.activation_cents,99000);
assert.equal(pricing.plans.Premium.annual_cents,629100);

const annualBusiness=await createActivationInvoice(env,{id:'customer-business',email:'business@example.com',name:'Business Customer',company:'Business Co',plan:'Business',billing_cycle:'annual'});
assert.equal(annualBusiness.email_sent,true);
assert.equal(annualBusiness.invoice.amount_cents,214000); // EUR 1,791 annual subscription + EUR 349 activation.
assert.equal(annualBusiness.invoice.discount_percent,25);
assert.match(annualBusiness.invoice.description,/one-time activation/);
assert.match(annualBusiness.invoice.description,/349\.00 EUR/);

const monthlyStarter=await createActivationInvoice(env,{id:'customer-starter',email:'starter@example.com',name:'Starter Customer',company:'Starter Co',plan:'Starter',billing_cycle:'monthly'});
assert.equal(monthlyStarter.invoice.amount_cents,23800); // EUR 89 monthly subscription + EUR 149 activation.
assert.equal(monthlyStarter.invoice.discount_percent,0);

const premium=await createActivationInvoice(env,{id:'customer-premium',email:'premium@example.com',name:'Premium Customer',company:'Premium Co',plan:'Premium',billing_cycle:'annual'});
assert.equal(premium.invoice.amount_cents,728100); // EUR 6,291 annual subscription + EUR 990 activation.
assert.equal(premium.invoice.discount_percent,25);
assert.match(premium.invoice.description,/one-time activation 990\.00 EUR/);

console.log('activation pricing regression passed: four public packages, annual discount excludes activation, invoice totals and activation description');
globalThis.fetch=originalFetch;
