const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../api/recover.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const old='plink_1TL60GRmuMPkEzpHKpbIRzbB', current='plink_1UGLbmRmuMPkEzpHS1hhKxeP';
const paid={id:'cs_live_privatecode',livemode:true,mode:'payment',status:'complete',payment_status:'paid',payment_link:old,created:1,customer_details:{email:'Buyer@example.com'},payment_intent:'pi_example'};
function setup({sessions=[paid],missingConfig=false,providerOk=true,refunded=false,stripeFails=false,paginate=false}={}) {
  const sends=[],queries=[];
  class Stripe {
    checkout={sessions:{list:async query=>{queries.push(query);if(stripeFails)throw Error();return {data:paginate&&!query.starting_after?[{...paid,id:'cs_other',customer_details:{email:'other@example.com'},payment_link:query.payment_link}]:sessions.filter(s=>s.payment_link===query.payment_link),has_more:paginate&&!query.starting_after};}}};
    paymentIntents={retrieve:async()=>({latest_charge:{refunded,amount_refunded:refunded?1500:0,disputed:false}})};
  }
  const context={exports:{},require:name=>name==='stripe'?Stripe:require(name),process:{env:{STRIPE_SECRET_KEY:'fake-key',RESEND_API_KEY:missingConfig?'':'fake-resend',LICENSE_EMAIL_FROM:'Block Writer <licenses@example.com>'}},fetch:async(url,options)=>{sends.push({url,...options,body:JSON.parse(options.body)});return {ok:providerOk};},AbortSignal};
  vm.runInNewContext(code,context);
  async function request({email='buyer@example.com',method='POST',origin='https://blockwriter.sh'}={}){
    const response={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
    await context.exports.default({method,headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'127.0.0.1'},body:{email}},response);return response;
  }
  return {request,sends,queries};
}
test('guest purchase sends only to recorded email and never returns code',async()=>{const s=setup();const r=await s.request({email:' BUYER@example.com '});assert.equal(r.code,200);assert.equal(s.sends.length,1);assert.deepEqual(Array.from(s.sends[0].body.to),['Buyer@example.com']);assert.match(s.sends[0].body.text,/cs_live_privatecode/);assert.ok(!JSON.stringify(r.body).includes('cs_live_'));assert.equal(r.headers['Cache-Control'],'no-store');});
test('unknown email receives same generic response without an email',async()=>{const yes=setup(),no=setup({sessions:[]});assert.equal(JSON.stringify((await yes.request()).body),JSON.stringify((await no.request()).body));assert.equal(no.sends.length,0);});
for(const [name,change] of Object.entries({unpaid:{payment_status:'unpaid'},incomplete:{status:'open'},test:{livemode:false},subscription:{mode:'subscription'},wrongProduct:{payment_link:'plink_other'}}))test(`does not email ${name} checkout`,async()=>{const s=setup({sessions:[{...paid,...change}]});await s.request();assert.equal(s.sends.length,0);});
test('new $29 purchases are recoverable',async()=>{const s=setup({sessions:[{...paid,payment_link:current}]});await s.request();assert.equal(s.sends.length,1);});
test('paginates to find older purchases',async()=>{const s=setup({paginate:true});await s.request();assert.equal(s.sends.length,1);assert.ok(s.queries.some(q=>q.starting_after));});
test('refunded purchases do not send codes',async()=>{const s=setup({refunded:true});await s.request();assert.equal(s.sends.length,0);});
test('duplicates use identical provider idempotency keys',async()=>{const s=setup();await s.request();await s.request();assert.equal(s.sends[0].headers['Idempotency-Key'],s.sends[1].headers['Idempotency-Key']);});
test('throttles repeated requests',async()=>{const s=setup({sessions:[]});for(let i=0;i<5;i++)assert.equal((await s.request()).code,200);assert.equal((await s.request()).code,429);});
test('invalid input fails before Stripe lookup',async()=>{const s=setup();assert.equal((await s.request({email:'bad'})).code,400);assert.equal(s.queries.length,0);});
test('rejects cross-origin requests',async()=>assert.equal((await setup().request({origin:'https://evil.example'})).code,403));
test('rejects GET requests',async()=>assert.equal((await setup().request({method:'GET'})).code,405));
for(const [name,options] of Object.entries({missingConfig:{missingConfig:true},stripeFailure:{stripeFails:true},resendFailure:{providerOk:false}}))test(`${name} gives an honest service error`,async()=>assert.equal((await setup(options).request()).code,503));
