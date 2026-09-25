import {authFetch,authToken,clearSession,configured,json,requireSameOrigin,rpc,setSession} from '../lib/shared-api.mjs';

export default async function handler(req,res) {
  if (!configured()) return json(res,503,{error:'Shared workspace is not configured yet'});
  try {
    if (req.method==='POST') {
      requireSameOrigin(req);
      const {email,password} = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length>254 || !email.includes('@'))
        return json(res,400,{error:'Enter your email and password'});
      const signedIn = await authFetch('token?grant_type=password',{email,password});
      if (!signedIn.ok) return json(res,401,{error:'Email or password is incorrect'});
      const account = await rpc('myteam_cover_snapshot',signedIn.data.access_token);
      if (!account.ok) return json(res,403,{error:'This account is not linked to a MyTeam team'});
      setSession(res,signedIn.data);
      return json(res,200,account.data);
    }
    if (req.method==='DELETE') { const origin=req.headers.origin;if(origin && new URL(origin).host!==req.headers.host) return json(res,403,{error:'Invalid request origin'});clearSession(res); return json(res,200,{ok:true}); }
    if (req.method==='GET') {
      const token = await authToken(req,res);
      if (!token) return json(res,401,{error:'Sign in to continue'});
      const account = await rpc('myteam_cover_snapshot',token);
      if (!account.ok) return json(res,401,{error:'Session expired or access revoked'});
      return json(res,200,account.data);
    }
    return json(res,405,{error:'Method not allowed'});
  } catch (error) { return json(res,400,{error:error.message || 'Request failed'}); }
}
