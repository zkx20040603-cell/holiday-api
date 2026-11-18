import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../api/suggest.js';
const data=new Map(['a','b','c'].map(id=>[id,{id,name:`공원 ${id}`,parkType:'소공원',facilities:'벤치',lat:37,lon:127}]));
const env={HASA_API_KEY:'test-secret'},body={ids:['a','b','c'],goal:'gentle'};
const request=(b=body)=>new Request('http://localhost/api/suggest',{method:'POST',body:JSON.stringify(b)});
const result={suggestions:body.ids.map(id=>({id,reason:'벤치에서 잠시 쉬어 보세요.'}))};
const output=(value=result)=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]});
test('AI: trusted data, minimized disclosure, bounded tokens, cache',async()=>{
 let calls=0;const handler=createHandler({env,data,fetchImpl:async(url,init)=>{calls++;assert.equal(url,'https://open.hasa.re.kr/v1/chat/completions');const b=JSON.parse(init.body);assert.equal(init.headers.Authorization,'Bearer test-secret');assert.equal(b.model,'gemma-4-31b');assert.ok(init.signal);assert.ok(b.max_tokens<=600);const p=JSON.parse(b.messages[1].content);assert.equal(p.parks[0].name,'공원 a');assert.ok(!('lat' in p.parks[0]));return output();}});
 assert.equal((await handler(request())).status,200);assert.equal((await (await handler(request())).json()).cached,true);assert.equal(calls,1);
});
test('AI: invalid input never reaches provider',async()=>{
 const h=createHandler({env,data,fetchImpl:()=>{throw Error('must not call');}});
 for(const b of [null,{}, {ids:[],goal:'gentle'},{ids:['unknown'],goal:'gentle'},{ids:['a','a'],goal:'gentle'}, {...body,goal:'constructor'},{...body,goal:'__proto__'}])assert.equal((await h(request(b))).status,400);
 for(const raw of ['bad json','a'.repeat(4001)])assert.equal((await h(new Request('http://localhost',{method:'POST',body:raw}))).status,400);
 assert.equal((await h(new Request('http://localhost'))).status,405);
});
test('AI: missing key returns 500',async()=>assert.equal((await createHandler({env:{},data})(request())).status,500));
test('AI: upstream errors and keys are not exposed',async()=>{
 for(const [status,expected] of [[429,429],[401,503],[403,503],[500,502]]){const r=await createHandler({env,data,fetchImpl:async()=>new Response('test-secret',{status})})(request());assert.equal(r.status,expected);assert.ok(!(await r.text()).includes('test-secret'));}
});
test('AI: timeout even when provider ignores abort',async()=>assert.equal((await createHandler({env,data,timeoutMs:10,fetchImpl:()=>new Promise(()=>{})})(request())).status,504));
test('AI: timeout includes stalled response body',async()=>assert.equal((await createHandler({env,data,timeoutMs:10,fetchImpl:async()=>({ok:true,json:()=>new Promise(()=>{})})})(request())).status,504));
test('AI: reject invented IDs, duplicates, empty results and leaked keys',async()=>{
 for(const value of [{suggestions:[{id:'outside',reason:'x'}]},{suggestions:[{id:'a',reason:'x'},{id:'a',reason:'x'},{id:'b',reason:'x'}]},{suggestions:[]},{suggestions:body.ids.map(id=>({id,reason:'test-secret'}))},{suggestions:body.ids.map(id=>({id,reason:'sk-sample-private'}))}])assert.equal((await createHandler({env,data,fetchImpl:async()=>output(value)})(request())).status,502);
});
test('AI: fewer than three candidates works',async()=>assert.equal((await createHandler({env,data,fetchImpl:async()=>output({suggestions:[result.suggestions[0]]})})(request({ids:['a'],goal:'family'}))).status,200));
test('AI: throttle concurrent requests and refresh expired cache',async()=>{
 let resolve,clock=0,calls=0;const h=createHandler({env,data,now:()=>clock,fetchImpl:()=>{calls++;return new Promise(r=>{resolve=r;});}});
 const first=h(request());await new Promise(r=>setImmediate(r));assert.equal((await h(request())).status,429);resolve(output());assert.equal((await first).status,200);
 clock=300001;const third=h(request());await new Promise(r=>setImmediate(r));resolve(output());assert.equal((await third).status,200);assert.equal(calls,2);
});
