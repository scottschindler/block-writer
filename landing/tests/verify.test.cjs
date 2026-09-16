const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../api/verify.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const paid = { livemode: true, mode: 'payment', status: 'complete', payment_status: 'paid', payment_link: 'plink_1TL60GRmuMPkEzpHKpbIRzbB' };
async function verify({ session = paid, id = 'cs_live_example', method = 'GET', key = 'test-fixture', error } = {}) {
  class InvalidRequestError extends Error { constructor() { super(); this.code = 'resource_missing'; } }
  let calls = 0;
  class Stripe {
    static errors = { StripeInvalidRequestError: InvalidRequestError };
    checkout = { sessions: { retrieve: async () => { calls++; if (error) throw error === 'missing' ? new InvalidRequestError() : new Error('unavailable'); return session; } } };
  }
  const context = { exports: {}, require: () => Stripe, process: { env: { STRIPE_SECRET_KEY: key } } };
  vm.runInNewContext(code, context);
  const response = { statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(s) { this.statusCode=s; return this; }, json(body) { this.body=body; return this; } };
  await context.exports.default({ method, query: { session_id:id } },response);
  return { ...response, calls };
}
test('paid live Block Writer checkout activates and is not cached',async()=>{const r=await verify();assert.equal(r.body.valid,true);assert.equal(r.headers['Cache-Control'],'no-store');});
for (const [name, change] of Object.entries({unpaid:{payment_status:'unpaid'},incomplete:{status:'open'},testMode:{livemode:false},subscription:{mode:'subscription'},otherProduct:{payment_link:'plink_other'}})) {
  test(`rejects ${name}`,async()=>assert.equal((await verify({session:{...paid,...change}})).body.valid,false));
}
for(const id of [undefined,'', ['cs_live_example'], 'cs_test_example','bogus']) test(`rejects malformed code ${JSON.stringify(id)}`,async()=>{const r=await verify({id:id===undefined?null:id});assert.equal(r.body.valid,false);assert.equal(r.calls,0);});
test('missing checkout returns invalid',async()=>assert.equal((await verify({error:'missing'})).body.valid,false));
test('Stripe outage returns retryable status',async()=>assert.equal((await verify({error:'outage'})).statusCode,503));
test('missing configuration returns retryable status',async()=>assert.equal((await verify({key:''})).statusCode,503));
test('rejects unsupported HTTP methods',async()=>{const r=await verify({method:'POST'});assert.equal(r.statusCode,405);assert.equal(r.calls,0);});

test("accepts the new $29 payment link",async()=>assert.equal((await verify({session:{...paid,payment_link:"plink_1UGLbmRmuMPkEzpHS1hhKxeP"}})).body.valid,true));
