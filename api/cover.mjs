import {authToken,configured,json,requireSameOrigin,rpc} from '../lib/shared-api.mjs';

export default async function handler(req,res) {
  if (!configured()) return json(res,503,{error:'Shared workspace is not configured yet'});
  try {
    if (!['GET','POST'].includes(req.method)) return json(res,405,{error:'Method not allowed'});
    if (req.method==='POST') requireSameOrigin(req);
    const token = await authToken(req,res);
    if (!token) return json(res,401,{error:'Sign in to continue'});
    const result = await rpc(req.method==='GET'?'myteam_cover_snapshot':'myteam_cover_action',token,req.method==='GET'?{}:{p:req.body});
    return json(res,result.ok?200:400,result.ok?result.data:{error:result.error});
  } catch (error) { return json(res,400,{error:error.message || 'Request failed'}); }
}
