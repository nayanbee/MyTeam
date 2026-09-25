import React,{useEffect,useState} from 'react';
import './sharedApp.css';
import {sydneyTimeToIso} from './sydneyTime.mjs';

type Person={id:string,name:string,roles:string[]};
type Candidate={id:string,name:string};
type CoverClass={id:string,time:string,label:string,status:string,sourceStatus:string,assignedId?:string,assigned?:string};
type Entry={id:string,classId:string,instructorId:string,instructor:string,status:string};
type Cover={id:string,status:string,ownerId:string,owner:string,managerId:string,studio:string,classType:string,note:string,urgent:boolean,classes:CoverClass[],invitations:Entry[],applications:Entry[]};
type Notice={id:string,title:string,body:string,createdAt:string,readAt?:string};
type Snapshot={person:Person,people:Candidate[],requests:Cover[],notifications:Notice[]};

async function endpoint(url:string,options?:RequestInit){const response=await fetch(url,{credentials:'same-origin',...options});const data=await response.json().catch(()=>({error:'Service did not respond'}));if(!response.ok)throw new Error(data.error||'Request failed');return data}
const post=(url:string,body:object)=>endpoint(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const when=(time:string)=>new Date(time).toLocaleString('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});

export default function SharedGate({demo}:{demo:React.ReactNode}){
  const[mode,setMode]=useState<'loading'|'demo'|'login'|'invite'|'shared'|'unavailable'>('loading');
  const[invite,setInvite]=useState<{accessToken:string,refreshToken:string}|null>(null);
  const[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const[error,setError]=useState('');
  useEffect(()=>{const fragment=new URLSearchParams(window.location.hash.slice(1));if(fragment.get('type')==='invite'&&fragment.get('access_token')&&fragment.get('refresh_token')){setInvite({accessToken:fragment.get('access_token')!,refreshToken:fragment.get('refresh_token')!});window.history.replaceState(null,'',window.location.pathname+window.location.search);setMode('invite');return}let active=true;fetch('/api/auth',{credentials:'same-origin'}).then(async r=>{
    if(!active)return;
    if(r.status===503 && (await r.clone().json().catch(()=>({}))).error==='Shared workspace is not configured yet'){setMode('demo');return}
    if(!r.headers.get('content-type')?.includes('application/json')){setMode('demo');return}
    if(r.status===503){setMode('unavailable');return}
    if(!r.ok){setMode('login');return}
    const data=await r.json();if(active){setSnapshot(data);setMode('shared')}
  }).catch(()=>{if(active)setMode('unavailable')});return()=>{active=false}},[]);
  const refresh=async()=>{const data=await endpoint('/api/cover');setSnapshot(data)};
  useEffect(()=>{if(mode!=='shared')return;const timer=setInterval(()=>refresh().catch(()=>setError('Connection lost. Refresh to check for new cover actions.')),8000);return()=>clearInterval(timer)},[mode]);
  if(mode==='loading')return <div className="sharedShell"><p>Loading MyTeam…</p></div>;
  if(mode==='demo')return <>{demo}</>;
  if(mode==='unavailable')return <main className="sharedShell"><h1>Shared covers are temporarily unavailable</h1><p>We could not reach the cover service. Try reloading in a moment.</p><button onClick={()=>window.location.reload()}>Retry</button></main>;
  if(mode==='invite'&&invite)return <InviteSetup invite={invite} onComplete={data=>{setSnapshot(data);setInvite(null);setMode('shared')}}/>;
  if(mode==='login')return <SharedLogin onLogin={data=>{setSnapshot(data);setMode('shared');setError('')}}/>;
  if(!snapshot)return null;
  return <SharedCovers data={snapshot} error={error} run={async payload=>{try{setError('');await post('/api/cover',payload);await refresh();return true}catch(e:any){setError(e.message);return false}}} logout={async()=>{await endpoint('/api/auth',{method:'DELETE'});setSnapshot(null);setMode('login')}}/>;
}

function InviteSetup({invite,onComplete}:{invite:{accessToken:string,refreshToken:string},onComplete:(data:Snapshot)=>void}){
  const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  return <main className="sharedShell sharedLogin"><div className="sharedBrand">MY<span>/TEAM</span></div><div className="sharedCard"><span className="sharedEyebrow">WELCOME TO MYTEAM</span><h1>Set your password.</h1><p>Use at least 12 characters to activate your invited account.</p><form onSubmit={async e=>{e.preventDefault();if(password!==confirm){setError('Passwords do not match');return}setBusy(true);setError('');try{onComplete(await post('/api/auth',{action:'complete_invite',...invite,password}))}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><label>Password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" className="sharedError">{error}</p>}<button disabled={busy}>{busy?'Activating…':'Activate account'}</button></form></div></main>;
}

function SharedLogin({onLogin}:{onLogin:(data:Snapshot)=>void}){
  const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  return <main className="sharedShell sharedLogin"><div className="sharedBrand">MY<span>/TEAM</span></div><div className="sharedCard"><span className="sharedEyebrow">SHARED WORKSPACE</span><h1>Welcome back.</h1><p>Sign in to see live cover requests and manager actions.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{onLogin(await post('/api/auth',{email,password}))}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="sharedError">{error}</p>}<button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></div></main>
}

function SharedCovers({data,error,run,logout}:{data:Snapshot,error:string,run:(payload:object)=>Promise<boolean>,logout:()=>Promise<void>}){
  const manager=data.person.roles.includes('manager');const[view,setView]=useState<'open'|'tasks'|'notices'>('open');
  const tasks=data.requests.filter(r=>manager?r.classes.some(c=>c.status==='open'||c.status==='reopened'||c.sourceStatus==='pending'||c.sourceStatus==='verify_pending'||c.sourceStatus==='mismatch'):r.ownerId===data.person.id||r.invitations.some(i=>i.instructorId===data.person.id&&i.status==='requested'));
  return <main className="sharedShell"><header className="sharedHeader"><div><span className="sharedEyebrow">MYTEAM · {manager?'MANAGER':'INSTRUCTOR'}</span><h1>Covers</h1><p>{data.person.name} · shared workspace</p></div><button className="sharedGhost" onClick={logout}>Log out</button></header>
    <nav className="sharedTabs"><button className={view==='open'?'active':''} onClick={()=>setView('open')}>Open shifts</button><button className={view==='tasks'?'active':''} onClick={()=>setView('tasks')}>{manager?'Tasks':'My covers'} <b>{tasks.length}</b></button><button className={view==='notices'?'active':''} onClick={()=>setView('notices')}>Inbox <b>{data.notifications.filter(n=>!n.readAt).length}</b></button></nav>
    {error&&<p role="alert" className="sharedError">{error}</p>}
    {view==='notices'?<section className="sharedStack"><h2>Notifications</h2>{data.notifications.map(n=><article className="sharedCard" key={n.id}><b>{n.title}</b><p>{n.body}</p><small>{when(n.createdAt)}</small>{!n.readAt&&<button className="sharedGhost" onClick={()=>run({action:'read_notification',notificationId:n.id})}>Mark read</button>}</article>)}{!data.notifications.length&&<p>No notifications yet.</p>}</section>:<>
      {!manager&&view==='open'&&<PostCover run={run}/>}
      <section className="sharedStack"><h2>{view==='tasks'?(manager?'Needs your attention':'Your covers'):'Available cover'}</h2>{data.requests.filter(r=>view==='tasks'?manager?tasks.some(t=>t.id===r.id):r.ownerId===data.person.id||r.invitations.some(i=>i.instructorId===data.person.id):r.status==='open').map(r=><CoverCard key={r.id} cover={r} person={data.person} people={data.people} manager={manager} run={run}/>)}{!(view==='tasks'?manager?tasks.length:data.requests.filter(r=>r.ownerId===data.person.id||r.invitations.some(i=>i.instructorId===data.person.id)).length:data.requests.filter(r=>r.status==='open').length)&&<p className="sharedEmpty">Nothing here right now.</p>}</section>
    </>}
  </main>;
}

function PostCover({run}:{run:(payload:object)=>Promise<boolean>}){
  const[date,setDate]=useState('');const[time,setTime]=useState('');const[studio,setStudio]=useState('Kings Cross');const[classType,setClassType]=useState('Total Body');const[note,setNote]=useState('');const[show,setShow]=useState(false);
  return <section className="sharedPost"><button onClick={()=>setShow(!show)}>{show?'Close':'Post a cover request'}</button>{show&&<form onSubmit={async e=>{e.preventDefault();const start=new Date(sydneyTimeToIso(date,time));const saved=await run({action:'post',classes:[{time:start.toISOString(),label:time}],studio,classType,note,urgent:start.getTime()-Date.now()<7*86400000});if(saved)setShow(false)}}><label>Studio<select value={studio} onChange={e=>setStudio(e.target.value)}><option>Kings Cross</option><option>Martin Place</option><option>Surry Hills</option></select></label><label>Class type<input required value={classType} onChange={e=>setClassType(e.target.value)}/></label><label>Class date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Class time (Sydney)<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label><label>Note<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><button>Post request</button></form>}</section>;
}

function CoverCard({cover,person,people,manager,run}:{cover:Cover,person:Person,people:Candidate[],manager:boolean,run:(payload:object)=>Promise<boolean>}){
  const[choice,setChoice]=useState<Record<string,string>>({});const own=cover.ownerId===person.id;
  return <article className="sharedCard"><div className="sharedCardTop"><div><span className="sharedEyebrow">{cover.urgent?'URGENT · ':''}{cover.owner||'Open'} · {cover.status}</span><h3>{cover.classes.map(c=>when(c.time)).join(' + ')}</h3><p>{cover.studio} · {cover.classType}</p></div>{own&&cover.status!=='withdrawn'&&<button className="sharedGhost" onClick={()=>run({action:'withdraw',classId:cover.classes[0].id})}>Withdraw request</button>}</div>{cover.note&&<p>{cover.note}</p>}
    {cover.classes.map(c=>{const invitations=cover.invitations.filter(i=>i.classId===c.id),apps=cover.applications.filter(a=>a.classId===c.id),mine=invitations.find(i=>i.instructorId===person.id),myApp=apps.find(a=>a.instructorId===person.id),active=invitations.filter(i=>i.status==='requested').length;
      return <div className="sharedClass" key={c.id}><strong>{c.label||when(c.time)}</strong><span>{c.assigned?`Covered by ${c.assigned} · ${c.sourceStatus==='pending'?'Mariana Tek update needed':c.sourceStatus}`:c.status==='reopened'?'Reopened':'Open for cover'}</span>
        {manager&&<><p>Applications: {apps.length?apps.map(a=>`${a.instructor} (${a.status})`).join(' · '):'None'}</p><p>Requested: {invitations.length?invitations.map(i=>`${i.instructor} (${i.status})`).join(' · '):'None'} · {active}/2 active</p>{cover.status==='open'&&(c.status==='open'||c.status==='reopened')&&<div className="sharedActions"><select aria-label={`Instructor for ${c.label}`} value={choice[c.id]||''} onChange={e=>setChoice({...choice,[c.id]:e.target.value})}><option value="">Choose instructor</option>{people.filter(p=>p.id!==cover.ownerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!choice[c.id]||active>=2} onClick={()=>run({action:'invite',classId:c.id,instructorId:choice[c.id]})}>Request cover</button>{apps.filter(a=>a.status==='pending').map(a=><button key={a.id} onClick={()=>run({action:'approve',classId:c.id,instructorId:a.instructorId})}>Approve {a.instructor}</button>)}</div>}{c.sourceStatus==='mismatch'&&<p className="sharedFlag">Mariana Tek assignment needs manager reconciliation.</p>}{cover.status==='withdrawn'&&c.sourceStatus==='mismatch'&&<button onClick={()=>run({action:'reconcile_withdrawal',classId:c.id})}>I reconciled Mariana Tek</button>}{c.sourceStatus==='verify_pending'&&<p className="sharedFlag">Marked updated. Automatic source verification needs the Mariana Tek sandbox connection.</p>}{c.status==='filled'&&c.sourceStatus==='pending'&&<button onClick={()=>run({action:'mark_source',classId:c.id})}>I updated Mariana Tek</button>}</>}
        {!manager&&!own&&cover.status==='open'&&c.status==='open'&&<div className="sharedActions">{mine?.status==='requested'?<><button onClick={()=>run({action:'respond',classId:c.id,accept:true})}>Accept request</button><button className="sharedGhost" onClick={()=>run({action:'respond',classId:c.id,accept:false})}>Decline</button></>:!myApp&&<button onClick={()=>run({action:'apply',classId:c.id})}>Apply for cover</button>}{myApp?.status==='pending'&&<button className="sharedGhost" onClick={()=>run({action:'withdraw',classId:c.id})}>Withdraw application</button>}</div>}
      </div>})}
  </article>;
}
