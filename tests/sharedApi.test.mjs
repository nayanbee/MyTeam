import test from 'node:test';
import assert from 'node:assert/strict';
import authHandler from '../api/auth.mjs';
import coverHandler from '../api/cover.mjs';

function response(){return {headers:{},statusCode:200,status(code){this.statusCode=code;return this},setHeader(key,value){this.headers[key]=value;return this},json(data){this.body=data;return this}}}

test('unconfigured backend explicitly stays unavailable',async()=>{
  const priorUrl=process.env.SUPABASE_URL,priorKey=process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;
  try{const res=response();await coverHandler({method:'GET',headers:{}},res);assert.equal(res.statusCode,503);assert.match(res.body.error,/not configured/)}
  finally{if(priorUrl)process.env.SUPABASE_URL=priorUrl;if(priorKey)process.env.SUPABASE_ANON_KEY=priorKey}
});

test('login creates HttpOnly cookies only for a linked account',async()=>{
  const priorFetch=global.fetch,priorUrl=process.env.SUPABASE_URL,priorKey=process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL='https://db.example.test';process.env.SUPABASE_ANON_KEY='public-test';
  const requests=[];global.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('/token?')?{access_token:'access',refresh_token:'refresh',expires_in:3600}:{person:{id:'person-1',name:'Nayan',roles:['instructor']},requests:[],notifications:[]}}};
  try{const res=response();await authHandler({method:'POST',headers:{origin:'https://app.example.test',host:'app.example.test','content-type':'application/json'},body:{email:'nayan@example.test',password:'test-only'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.person.id,'person-1');assert.equal(requests.length,2);
    assert.match(res.headers['Set-Cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
    assert.match(requests[1].options.headers.Authorization,/Bearer access/);
  }finally{global.fetch=priorFetch;if(priorUrl)process.env.SUPABASE_URL=priorUrl;else delete process.env.SUPABASE_URL;if(priorKey)process.env.SUPABASE_ANON_KEY=priorKey;else delete process.env.SUPABASE_ANON_KEY}
});
