/* ── STATE ── */
const S={user:null,scr:'auth',veh:'Bike',offers:[],timers:{},active:null,log:{booked:[],current:null,completed:[]},logTab:'booked',pendingReview:null,stars:0,prog:0,rideInt:null,cxReason:null,cxMode:'ride'};

const NAMES=['Ali Hassan','Umar Farooq','Bilal Ahmed','Kashif Raza','Zain Abideen','Asad Mehmood','Hamza Butt','Saad Malik','Faisal Khan','Waseem Aktar','Tariq Nawaz','Imran Shah','Shoaib Iqbal','Nawaz Ahmed'];
const VEHS={Bike:['Honda CD 70 (2023)','Yamaha YBR 125','Honda CG 125'],Rickshaw:['Sazgar Electric','Qingqi 200cc','CNG Rickshaw'],Mini:['Suzuki Alto (2023)','KIA Picanto','Toyota Aqua'],Sedan:['Toyota Corolla (2024)','Honda City (2023)','Hyundai Sonata'],Business:['Toyota Fortuner (2024)','Honda CR-V','Hyundai Tucson'],Carpool:['Toyota Corolla (2024)','Honda BR-V','KIA Sportage']};
const PLATS=['yango','bykea','indrive'];
const PL={yango:'Yango',bykea:'Bykea',indrive:'InDrive',carpool:'Carpool'};
const BASE={Bike:130,Rickshaw:180,Mini:280,Sedan:380,Business:620,Carpool:120};
const INF=1.25;
const LOCS=[
  {m:'DHA Phase 6, Karachi',s:'Defence Housing Authority'},
  {m:'Dolmen Mall, Clifton',s:'Block 4, Clifton'},
  {m:'Saddar, Karachi',s:'Central Business District'},
  {m:'Gulshan-e-Iqbal, Karachi',s:'Block 13-B'},
  {m:'Karachi Airport (JIAP)',s:'PAF Base Faisal'},
  {m:'Tariq Road, Karachi',s:'PECHS'},
  {m:'Clifton Beach',s:'Block 5, Clifton'},
  {m:'Hyderi Market',s:'North Nazimabad, Karachi'},
  {m:'Bahadurabad, Karachi',s:'Gulshan-e-Iqbal'},
  {m:'Malir Cantt, Karachi',s:'Malir'},
  {m:'Shahrah-e-Faisal',s:'PECHS, Karachi'},
  {m:'University Road',s:'Gulshan, Karachi'},
  {m:'Scheme 33, Karachi',s:'Gulzar-e-Hijri'},
  {m:'Johar Chowrangi',s:'Gulshan-e-Iqbal'},
  {m:'Kemari Port',s:'West Wharf, Karachi'},
  {m:'Landhi Industrial Area',s:'Karachi'},
  {m:'North Karachi Sector 11',s:'North Karachi'},
  {m:'Boat Basin, Clifton',s:'Block 9, Clifton'},
  {m:'Korangi Industrial Area',s:'Karachi'},
  {m:'Askari Park',s:'Malir Cantt, Karachi'},
];

const $=id=>document.getElementById(id);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const rndF=(a,b)=>+(Math.random()*(b-a)+a).toFixed(1);
const pkr=n=>'Rs '+Math.round(n).toLocaleString('en-PK');
const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

const DB={client:null,enabled:false};
const EMPTY_LOG=()=>({booked:[],current:null,completed:[]});
let saveInFlight=false;
let saveQueued=false;

function normPhone(v){return (v||'').replace(/\D/g,'');}
function normName(v){return (v||'').trim().toLowerCase();}
function safeJson(v,fallback){
  if(v&&typeof v==='object')return v;
  return fallback;
}
function setCookie(name,value,days=365){
  const exp=new Date(Date.now()+days*24*60*60*1000).toUTCString();
  document.cookie=`${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}
function getCookie(name){
  const m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'=([^;]*)'));
  return m?decodeURIComponent(m[1]):null;
}
function delCookie(name){
  document.cookie=`${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}
function setTheme(theme,persist=true){
  document.documentElement.setAttribute('data-theme',theme);
  if(persist)setCookie('sw_theme',theme,365);
}

function getSupabaseConfig(){
  const url=window.SUPABASE_URL||'https://rtzirnesxgpeegvanoeq.supabase.co';
  const key=window.SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0emlybmVzeGdwZWVndmFub2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM4MzAsImV4cCI6MjA4OTQ4OTgzMH0.0ReAt-9Ai0qV7x5AG3gWoGGD5y5ysisp9CpFeWBogOc';
  return {url,key};
}

async function initSupabase(){
  const {url,key}=getSupabaseConfig();
  console.log('Supabase config:',{url:url?.substring(0,40)+'...',keyPresent:!!key,supabaseLibAvailable:!!window.supabase});
  if(!url||!key||!window.supabase||typeof window.supabase.createClient!=='function'){
    DB.enabled=false;
    console.error('Supabase initialization failed: missing credentials or library');
    return;
  }
  DB.client=window.supabase.createClient(url,key);
  DB.enabled=true;
  console.log('Supabase client initialized successfully');
}

function applyUserRow(row){
  S.user={id:row.id,name:row.name,phone:row.phone,joined:row.joined_at};
  S.log=safeJson(row.log,EMPTY_LOG());
  S.active=safeJson(row.active,null);
}

async function dbGetUserByPhone(phone){
  if(!DB.enabled)return null;
  const {data,error}=await DB.client.from('sw_users').select('*').eq('phone',phone).maybeSingle();
  if(error){
    console.error('Supabase dbGetUserByPhone error:',error);
    return null;
  }
  return data;
}

async function dbCreateUser({name,phone}){
  if(!DB.enabled)return null;
  const {data,error}=await DB.client.from('sw_users').insert({
    name,
    phone,
    joined_at:new Date().toISOString(),
    log:EMPTY_LOG(),
    active:null,
    theme:document.documentElement.getAttribute('data-theme')||'dark',
    updated_at:new Date().toISOString(),
  }).select('*').single();
  if(error){
    console.error('Supabase dbCreateUser error:',error);
    console.error('Error details:',error.message,error.code,error.details);
    return null;
  }
  return data;
}

async function flushSave(){
  if(!DB.enabled||!S.user?.id)return;
  const payload={
    name:S.user.name,
    phone:S.user.phone,
    log:S.log,
    active:S.active,
    theme:document.documentElement.getAttribute('data-theme')||'dark',
    updated_at:new Date().toISOString(),
  };
  const {error}=await DB.client.from('sw_users').update(payload).eq('id',S.user.id);
  if(error)console.error('Supabase flushSave error:',error);
}

function save(){
  if(!DB.enabled||!S.user?.id)return;
  if(saveInFlight){saveQueued=true;return;}
  saveInFlight=true;
  (async()=>{
    try{
      do{
        saveQueued=false;
        await flushSave();
      }while(saveQueued);
    }finally{
      saveInFlight=false;
    }
  })();
}
async function load(){
  const theme=getCookie('sw_theme');
  if(theme)setTheme(theme,false);
  const phone=getCookie('sw_session_phone');
  if(!phone||!DB.enabled)return;
  const row=await dbGetUserByPhone(phone);
  if(row)applyUserRow(row);
}
function toast(msg,t='ok'){const d=$('tdk'),el=document.createElement('div');el.className=`tst ${t}`;el.innerHTML=`<div class="tdot"></div><span>${msg}</span>`;d.appendChild(el);setTimeout(()=>el.remove(),3000);}
function toggleTheme(){
  const h=document.documentElement;
  const nxt=h.getAttribute('data-theme')==='dark'?'light':'dark';
  setTheme(nxt,true);
  save();
  rdm();
}
function rdm(){if(S.scr==='book')drawMap('mapC');else if(S.scr==='offers')drawMap('ofMapC');else if(S.scr==='current')drawMap('aMapC',S.prog);}
function openSb(){$('sidebar').classList.add('open');$('sbovl').classList.add('on');}
function closeSb(){$('sidebar').classList.remove('open');$('sbovl').classList.remove('on');}

/* ── LOCATION DROPDOWN ── */
let ddT={};
function showDD(f,v){
  const id=f==='P'?'ddP':'ddD';const dd=$(id);
  if(ddT[id])clearTimeout(ddT[id]);
  const q=(v||'').toLowerCase();
  let res=LOCS.filter(l=>!q||l.m.toLowerCase().includes(q)||l.s.toLowerCase().includes(q));
  if(!res.length)res=LOCS.slice(0,6);else res=res.slice(0,6);
  dd.innerHTML=res.map(r=>`<div class="locsg" onclick="pickLoc('${f}','${r.m}','${id}')"><div class="locsg-ico">📍</div><div><div class="lmain">${r.m}</div><div class="lsub">${r.s}</div></div></div>`).join('');
  dd.classList.add('open');
}
function pickLoc(f,v,id){$(f==='P'?'pickup':'dropoff').value=v;$(id).classList.remove('open');updFare();}
function hideDD(id,d){ddT[id]=setTimeout(()=>$(id).classList.remove('open'),d);}
function swapLocs(){
  const pu=$('pickup'),do_=$('dropoff');
  const tmp=pu.value;pu.value=do_.value;do_.value=tmp;
  updFare();toast('Locations swapped','ok');
}

/* ── AUTH ── */
function authTab(t,btn){
  document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  $('aLogin').classList.toggle('hidden',t!=='login');
  $('aSignup').classList.toggle('hidden',t!=='signup');
  $('authErr').textContent='';
}

async function doLogin(){
  const phone=$('lPhone').value.trim();
  const name=$('lName').value.trim();
  if(!phone||phone.replace(/\D/g,'').length<7){showAuthErr('Enter a valid phone number.');return;}
  if(!name){showAuthErr('Enter your registered name.');return;}
  if(!DB.enabled){showAuthErr('Supabase is not configured. Add URL and anon key first.');return;}
  const phoneNorm=normPhone(phone);
  const row=await dbGetUserByPhone(phoneNorm);
  if(!row){showAuthErr('No account found. Please register first.');return;}
  if(normName(row.name)!==normName(name)){showAuthErr('Name does not match. Check your details.');return;}
  applyUserRow(row);
  S.active=null; // don't restore in-progress ride across sessions
  setCookie('sw_session_phone',phoneNorm,14);
  save();
  boot();
  toast('Welcome back, '+row.name+'! 👋','ok');
}

async function doSignup(){
  const name=$('sName').value.trim();
  const phone=$('sPhone').value.trim();
  if(!name||name.length<2){showAuthErr('Enter your full name.');return;}
  if(!phone||phone.replace(/\D/g,'').length<7){showAuthErr('Enter a valid phone number.');return;}
  if(!DB.enabled){showAuthErr('Supabase is not configured. Add URL and anon key first.');return;}
  console.log('Signing up:',{name,phone,dbEnabled:DB.enabled});
  const phoneNorm=normPhone(phone);
  const existing=await dbGetUserByPhone(phoneNorm);
  if(existing){showAuthErr('This number is already registered. Please sign in.');return;}
  const created=await dbCreateUser({name,phone:phoneNorm});
  console.log('Create user result:',created);
  if(!created){showAuthErr('Could not create account. Check Supabase setup.');return;}
  applyUserRow(created);
  setCookie('sw_session_phone',phoneNorm,14);
  save();
  boot();
  toast('Account created! Welcome, '+name+' 🎉','ok');
}

function showAuthErr(msg){
  const el=$('authErr');el.textContent=msg;
  el.style.animation='none';el.offsetHeight;el.style.animation='';
}
function doLogout(){
  // Stop all timers
  Object.values(S.timers).forEach(clearInterval);S.timers={};
  clearInterval(rideInt);rideInt=null;
  delCookie('sw_session_phone');
  // Reset state
  S.user=null;S.active=null;S.offers=[];S.prog=0;
  S.log=EMPTY_LOG();
  S.pendingReview=null;S.cxReason=null;
  // Hide modals
  $('revModal').classList.add('hidden');
  $('cxModal').classList.add('hidden');
  // Switch UI
  $('appShell').classList.add('hidden');$('appShell').style.display='none';
  $('bnav').style.display='none';
  // Reset auth form
  $('lName').value='';$('lPhone').value='';$('sName').value='';$('sPhone').value='';$('authErr').textContent='';
  $('scr-auth').style.display='';$('scr-auth').classList.add('active');
  toast('Signed out successfully','ok');
}
function boot(){
  $('scr-auth').classList.remove('active');
  $('scr-auth').style.display='none';
  const sh=$('appShell');sh.classList.remove('hidden');sh.style.display='flex';
  // Remove inline style on bnav so CSS media query controls it
  $('bnav').style.display='';
  const u=S.user,av=ini(u.name);
  $('sbAv').textContent=$('pAv').textContent=av;
  $('sbName').textContent=$('pName').textContent=u.name;
  $('sbPhone').textContent=$('pPhone').textContent=u.phone;
  go('book');refreshStats();renderLog();
  if(S.active){updateCR();$('navL').classList.remove('hidden');}
}

/* ── SCREEN NAV ── */
function go(name){
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('active'));
  const sc=$(`scr-${name}`);if(sc)sc.classList.add('active');
  S.scr=name;
  document.querySelectorAll('[data-s]').forEach(n=>n.classList.toggle('active',n.dataset.s===name));
  closeSb();
  if(name==='book')setTimeout(()=>drawMap('mapC'),40);
  if(name==='offers'){setTimeout(()=>drawMap('ofMapC'),40);syncOffers();}
  if(name==='current'){updateCR();setTimeout(()=>drawMap('aMapC',S.prog),40);}
  if(name==='profile'){refreshStats();renderLog();}
}

/* ── VEHICLE ── */
function selVeh(el,t){document.querySelectorAll('.vtab').forEach(v=>v.classList.remove('active'));el.classList.add('active');S.veh=t;updFare();}
function updFare(){
  const base=BASE[S.veh]*INF;const dist=rndF(5,15);const time=Math.round(dist*3+rnd(5,10));
  $('fdist').textContent=dist+' km';$('ftime').textContent=time+' min';
  $('fbase').textContent=pkr(base*.6);
  $('frange').innerHTML=pkr(base)+'&nbsp;&ndash;&nbsp;'+pkr(base*1.35);
  $('mDist').textContent=dist+' km';$('mTime').textContent=time+' min';$('mFrom').textContent=pkr(base);
}

/* ── GEN OFFER ── */
function genOffer(){
  const isCP=(S.veh==='Carpool');
  const plat=isCP?'carpool':PLATS[rnd(0,2)];
  const vt=isCP?'Carpool':S.veh;
  const name=NAMES[rnd(0,NAMES.length-1)];
  const veh=VEHS[vt][rnd(0,VEHS[vt].length-1)];
  const baseF=BASE[vt]*INF;
  const fare=Math.round(baseF*rndF(.88,1.38));
  const dist=rndF(0.3,3.0); // driver proximity — max 3 km from pickup
  const eta=Math.max(1,Math.round(dist*4+rnd(1,3))); // realistic ETA based on proximity
  const rating=rndF(3.5,5.0);
  const cond=rnd(58,99);
  const seats=isCP?rnd(1,3):null;
  const smart=Math.round(Math.max(0,100-dist*15)*.3+((rating-1)/4)*100*.3+Math.max(0,(1-(fare-baseF*.88)/(baseF*.5)))*100*.2+cond*.2);
  return{id:`o_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,plat,name,veh,fare,dist,eta,rating,cond,smart,timer:10,pickup:$('pickup')?.value||'DHA Phase 6',dropoff:$('dropoff')?.value||'Dolmen Mall',vehType:vt,seats};
}

/* ── SEARCH ── */
function searchRides(){
  if(!$('pickup').value.trim()||!$('dropoff').value.trim()){toast('Please enter pickup and drop-off locations','warn');return;}
  Object.values(S.timers).forEach(clearInterval);S.timers={};S.offers=[];
  for(let i=0;i<5;i++)S.offers.push(genOffer());
  S.offers.sort((a,b)=>b.smart-a.smart);
  S.offers[0].rec=true;
  $('navOL').classList.remove('hidden');
  toast('Found '+S.offers.length+' offers','ok');
  go('offers');
}

function syncOffers(){
  const base=BASE[S.veh]*INF;
  const dist=$('fdist')?.textContent||'-';const time=$('ftime')?.textContent||'-';
  $('omDist').textContent=dist;$('omTime').textContent=time;$('omFrom').textContent=pkr(base);
  $('omPU').textContent=$('pickup')?.value||'-';
  $('omDO').textContent=$('dropoff')?.value||'-';
  $('rdPU').textContent=$('pickup')?.value||'-';
  $('rdDO').textContent=$('dropoff')?.value||'-';
  $('rdVeh').textContent=S.veh;
  $('rdDist').textContent=dist;$('rdTime').textContent=time;$('rdFrom').textContent=pkr(base);
  if(S.offers.length){
    $('ofPgSub').textContent=S.offers.length+' offers live — best ranked on top';
    $('ofCount').textContent=S.offers.length+' offers found';
    $('rdCard').classList.remove('hidden');
    renderOffers();
  }else{
    $('ofPgSub').textContent='No active offers — book a ride first';
    $('ofCount').textContent='No offers';
    $('rdCard').classList.add('hidden');
  }
}

function cancelOffers(reason=null){
  Object.values(S.timers).forEach(clearInterval);S.timers={};
  S.offers=[];
  $('navOL').classList.add('hidden');
  $('newbar').classList.remove('show');
  $('ofList').innerHTML=`<div class="nooffer"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h5l3 3v5h-8V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><p>Offers cancelled</p><small>You can search again from Book Ride</small></div>`;
  $('ofPgSub').textContent='No active offers';
  $('ofCount').textContent='No offers';
  $('rdCard').classList.add('hidden');
  toast(reason?('Ride offers cancelled — '+reason):'Ride offers cancelled','warn');
  go('book');
}

/* ── RENDER OFFERS ── */
function renderOffers(){
  const list=$('ofList');
  if(!S.offers.length){list.innerHTML=`<div class="nooffer"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h5l3 3v5h-8V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><p>No offers yet</p><small>Go to Book Ride and tap Find Ride Offers</small></div>`;return;}
  rerenderOffers();
}

function mkCard(o,isNew=false){
  const circ=2*Math.PI*11,off=circ*(1-o.timer/10);
  const el=document.createElement('div');
  el.className=`ocard ${o.plat}`+(o.rec?' rec':'')+(isNew?' nin':'');
  el.id=`c_${o.id}`;
  const cpExtra=o.seats?`<span class="seatbdg">👥 ${o.seats} seat${o.seats>1?'s':''}</span>`:'';
  el.innerHTML=`
    <div class="ocard-stripe"></div>
    <div class="ocard-body">
      <div class="och">
        <div class="platbadge ${o.plat}"><div class="platbadge-dot"></div>${PL[o.plat]}</div>
        ${o.rec?'<div class="recbadge">★ Best Match</div>':''}
        <div class="och-right">
          <div class="tcirc">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle class="tc-trk" cx="14" cy="14" r="11"/>
              <circle class="tc-prg ${o.plat}" id="tp_${o.id}" cx="14" cy="14" r="11" stroke-dasharray="${circ}" stroke-dashoffset="${off}"/>
            </svg>
            <span class="tcn" id="tn_${o.id}">${o.timer}</span>
          </div>
          <span class="tclbl">sec</span>
        </div>
      </div>
      <div class="drow">
        <div class="dav ${o.plat}">${ini(o.name)}</div>
        <div>
          <div class="dname">${o.name} ${cpExtra}</div>
          <div class="dmeta">
            <span class="dstar ${o.plat}">★ ${o.rating.toFixed(1)}</span>
            <span>·</span>
            <span>${o.veh}</span>
          </div>
        </div>
      </div>
      <div class="ostats">
        <div class="ostat"><div class="osv" style="color:var(--gold)">${pkr(o.fare)}</div><div class="osl">Fare</div></div>
        <div class="ostat"><div class="osv">${o.eta} min</div><div class="osl">ETA</div></div>
        <div class="ostat"><div class="osv">${o.dist} km</div><div class="osl">Away</div></div>
      </div>
      <div class="scrow">
        <span class="sclbl">Smart Score</span>
        <div class="scbg"><div class="scfill ${o.plat}" style="width:${o.smart}%"></div></div>
        <span class="scnum ${o.plat}">${o.smart}/100</span>
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <button class="btn-acc ${o.plat}" onclick="accept('${o.id}')">Accept Ride →</button>
      </div>
    </div>`;
  return el;
}

/* ── TIMER ── */
function startTimer(id){
  const circ=2*Math.PI*11;
  S.timers[id]=setInterval(()=>{
    const o=S.offers.find(x=>x.id===id);
    if(!o){clearInterval(S.timers[id]);return;}
    o.timer--;
    const tn=$(`tn_${id}`),tp=$(`tp_${id}`);
    if(tn)tn.textContent=o.timer;
    if(tp)tp.style.strokeDashoffset=circ*(1-o.timer/10);
    if(o.timer<=0){
      clearInterval(S.timers[id]);
      const card=$(`c_${id}`);
      if(card){
        card.style.transition='opacity .2s,transform .2s';
        card.style.opacity='0';card.style.transform='translateX(10px)';
        setTimeout(()=>{
          // Remove expired, add fresh, resort, re-render all
          S.offers=S.offers.filter(x=>x.id!==id);
          const fresh=genOffer();
          fresh.isNew=true;
          S.offers.push(fresh);
          // Always sort: highest smart score first — rec stays pinned at top
          S.offers.sort((a,b)=>b.smart-a.smart);
          S.offers.forEach((x,i)=>x.rec=(i===0));
          rerenderOffers();
          $('ofCount').textContent=S.offers.length+' offers found';
          const bar=$('newbar');$('newbarName').textContent='— '+fresh.name+' ('+PL[fresh.plat]+')';
          bar.classList.add('show');setTimeout(()=>bar.classList.remove('show'),2600);
        },220);
      }
    }
  },1000);
}

/* Re-render full offer list preserving sort order; mark new cards */
function rerenderOffers(){
  // Stop all existing timers first
  Object.keys(S.timers).forEach(k=>{clearInterval(S.timers[k]);delete S.timers[k];});
  const list=$('ofList');list.innerHTML='';
  S.offers.forEach(o=>{
    const card=mkCard(o,!!o.isNew);
    list.appendChild(card);
    o.isNew=false;
    startTimer(o.id);
  });
}

/* ── ACCEPT ── */
function accept(id){
  const o=S.offers.find(x=>x.id===id);if(!o)return;
  const rideId=`r_${Date.now()}`;
  Object.values(S.timers).forEach(clearInterval);S.timers={};
  $('newbar').classList.remove('show');$('navOL').classList.add('hidden');
  S.active={...o,rideId,status:'booked',step:1,bookedAt:new Date().toISOString()};
  S.log.booked.push({...S.active});S.log.current=S.active;
  S.offers=[];
  $('ofList').innerHTML=`<div class="nooffer"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h5l3 3v5h-8V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><p>Ride accepted ✓</p><small>Track on the Current Ride screen</small></div>`;
  $('ofPgSub').textContent='Ride accepted — no active offers';$('rdCard').classList.add('hidden');
  save();$('navL').classList.remove('hidden');
  toast('Ride booked! '+o.name+' is heading to your pickup','ok');
  go('current');updateCR();setTimeout(()=>drawMap('aMapC',0),60);

  // ── RIDER (driver) arrives at pickup automatically based on ETA ──
  const arrivalMs = o.eta * 60 * 1000;
  setTimeout(()=>{
    if(!S.active||S.active.rideId!==rideId)return;
    S.active.status='arriving';S.active.step=2;
    save();updateCR();
    toast('📍 '+o.name+' has arrived at your pickup!','ok');

    // ── RIDER starts the trip ~10s after arriving at pickup ──
    setTimeout(()=>{
      if(!S.active||S.active.status!=='arriving')return;
      startRide();
    }, 10000);

  }, arrivalMs);
}

/* ── CANCEL FLOW ── */
function setCxReasons(reasons){
  $('cxReasons').innerHTML=reasons.map(r=>`<div class="cx-reason" onclick="selReason(this,'${r}')">${r}</div>`).join('');
}

function openCxModal(mode='ride'){
  const r=S.active;
  if(mode!=='offers'&&!r)return;
  S.cxMode=mode;
  S.cxReason=null;
  setCxReasons(mode==='offers'
    ? ['Changed my mind','Found a better offer','Wrong pickup/drop-off','Will book later']
    : ['Changed my mind','Driver is taking too long','Booked by mistake','Found another ride']);
  $('cxConfirmBtn').disabled=true;$('cxConfirmBtn').style.opacity='.4';$('cxConfirmBtn').style.cursor='not-allowed';
  if(mode==='offers'){
    $('cxTitle').textContent='Cancel Ride Offers?';
    $('cxSub').textContent='Are you sure you want to cancel these offers? You can search again anytime.';
    $('cxWarn').textContent='Your current offers list will be cleared.';
    $('cxConfirmBtn').textContent='Cancel Offers';
  }else if(r.status==='in-transit'){
    $('cxTitle').textContent='End Ride Early?';
    $('cxSub').textContent='You are currently in transit. Cancelling may result in a penalty fee.';
    $('cxWarn').textContent='⚠️ You are mid-journey. A cancellation fee may apply based on distance already covered.';
    $('cxConfirmBtn').textContent='Cancel Ride';
  }else{
    $('cxTitle').textContent='Cancel Ride?';
    $('cxSub').textContent='Are you sure you want to cancel? Your driver may already be on the way.';
    $('cxWarn').textContent='Repeated cancellations may affect your account standing.';
    $('cxConfirmBtn').textContent='Cancel Ride';
  }
  $('cxModal').classList.remove('hidden');
}
function closeCxModal(){$('cxModal').classList.add('hidden');S.cxReason=null;S.cxMode='ride';}
function selReason(el,r){
  document.querySelectorAll('.cx-reason').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');S.cxReason=r;
  $('cxConfirmBtn').disabled=false;$('cxConfirmBtn').style.opacity='1';$('cxConfirmBtn').style.cursor='pointer';
}
function confirmCancel(){
  const reason=S.cxReason;
  if(!reason){toast('Please select a reason','warn');return;}
  if(S.cxMode==='offers'){
    closeCxModal();
    cancelOffers(reason);
    return;
  }
  clearInterval(rideInt);rideInt=null;S.prog=0;
  const r=S.active;
  if(r){
    const cancelled={...r,status:'cancelled',cancelReason:reason,cancelledAt:new Date().toISOString(),review:null};
    S.log.booked=S.log.booked.filter(x=>x.rideId!==r.rideId);
    S.log.completed.unshift(cancelled);
    S.log.current=null;
  }
  S.active=null;
  $('navL').classList.add('hidden');
  save();closeCxModal();updateCR();refreshStats();renderLog();
  toast('Ride cancelled — '+reason,'warn');
  go('profile');
  setTimeout(()=>logTab('completed',document.querySelector('.ltab:nth-child(3)')),80);
}

/* ── CURRENT RIDE UI ── */
function updateCR(){
  const r=S.active;
  if(!r){$('noRide').classList.remove('hidden');$('actPanel').classList.add('hidden');$('crSub').textContent='No active ride';return;}
  $('noRide').classList.add('hidden');$('actPanel').classList.remove('hidden');
  $('aAv').textContent=ini(r.name);$('aDName').textContent=r.name;
  $('aVInfo').innerHTML=r.veh+' · '+PL[r.plat];
  $('aPU').textContent=r.pickup;$('aDO').textContent=r.dropoff;
  $('amFare').textContent=pkr(r.fare);$('amDist').textContent=r.dist+' km';$('amTime').textContent=r.eta+' min';
  for(let i=1;i<=4;i++){const el=$(`st${i}`);el.classList.remove('ac','dn');if(i<r.step)el.classList.add('dn');else if(i===r.step)el.classList.add('ac');}
  const btn=$('actRow');
  if(r.status==='booked'){
    $('sText').textContent='Driver On The Way';$('sBadge').className='sbadge aw';
    $('aEta').textContent='Arriving in ~'+r.eta+' min';$('crSub').textContent='Driver confirmed — heading to pickup';
    btn.innerHTML=`
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:600;color:var(--txtm);margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px;">🚗 Driver en route to your pickup</div>
        <div style="background:var(--bg-surf);border-radius:20px;height:6px;overflow:hidden;">
          <div id="drvProgressBar" style="height:100%;background:linear-gradient(90deg,var(--green),var(--green-glow));border-radius:20px;width:0%;transition:width 1s linear;"></div>
        </div>
        <div style="font-size:10px;color:var(--txtm);margin-top:5px;">Rider will start the ride upon arrival at pickup point</div>
      </div>
      <button class="bact bcx" onclick="openCxModal()" style="flex:0 0 auto;max-width:100px;">✕ Cancel</button>`;
    animateDriverProgress(r);
  }else if(r.status==='arriving'){
    $('sText').textContent='Driver Arrived';$('sBadge').className='sbadge ar';
    $('aEta').textContent='Driver is at your pickup point';$('crSub').textContent='Rider starting your ride...';
    btn.innerHTML=`
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:700;color:#4de8a0;margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px;">✅ Driver at pickup — ride starting shortly</div>
        <div style="font-size:11px;color:var(--txtm);">The rider has confirmed arrival and will start your ride momentarily</div>
      </div>`;
  }else if(r.status==='in-transit'){
    $('sText').textContent='In Transit';$('sBadge').className='sbadge tr';
    $('aEta').textContent='En route to destination';$('crSub').textContent='Ride in progress';
    btn.innerHTML=`
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:600;color:var(--txtm);margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px;">🏁 En route to drop-off</div>
        <div style="background:var(--bg-surf);border-radius:20px;height:6px;overflow:hidden;">
          <div id="tripProgressBar" style="height:100%;background:linear-gradient(90deg,var(--bykea-bd),var(--bykea-acc));border-radius:20px;width:${Math.round(S.prog*100)}%;transition:width 1s linear;"></div>
        </div>
        <div style="font-size:10px;color:var(--txtm);margin-top:5px;">Rider will end the ride upon reaching drop-off point</div>
      </div>`;
  }
}

/* Animate the driver-approaching progress bar while status=booked */
function animateDriverProgress(r){
  const bar=$('drvProgressBar');
  if(!bar||!S.active||S.active.status!=='booked')return;
  const etaMs=r.eta*60*1000;
  const start=Date.now();
  const tick=()=>{
    if(!S.active||S.active.status!=='booked')return;
    const b=$('drvProgressBar');if(!b)return;
    const pct=Math.min(99,((Date.now()-start)/etaMs)*100);
    b.style.width=pct+'%';
    if(pct<99)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

let rideInt=null;
function startRide(){
  if(!S.active||S.active.status!=='arriving')return; // rider-side only, no user toast
  S.active.status='in-transit';S.active.step=3;S.prog=0;save();updateCR();
  toast('🚗 Ride started — enjoy your trip!','ok');
  if(rideInt)clearInterval(rideInt);
  // trip duration: eta minutes (capped 1-20min for demo, scaled to real time / 6 for speed)
  const tripDurationMs = Math.min(S.active.eta, 20) * 60 * 1000 / 6;
  const startT = Date.now();
  rideInt=setInterval(()=>{
    const elapsed = Date.now() - startT;
    S.prog = Math.min(elapsed / tripDurationMs, 1);
    drawMap('aMapC', S.prog);
    const rem = Math.max(0, Math.round(S.active.eta * (1 - S.prog)));
    const remD = (S.active.dist * (1 - S.prog)).toFixed(1);
    const tbar = $('tripProgressBar');
    if(tbar) tbar.style.width = Math.round(S.prog*100)+'%';
    if($('amTime')) $('amTime').textContent = rem+' min';
    if($('amDist')) $('amDist').textContent = remD+' km';
    if(S.prog >= 1){
      clearInterval(rideInt);rideInt=null;
      // ── RIDER ends trip automatically upon reaching drop-off ──
      setTimeout(()=>riderEndsRide(), 2000);
    }
  },500);
}

/* Called automatically by rider upon reaching drop-off — user cannot trigger this */
function riderEndsRide(){
  if(!S.active||S.active.status!=='in-transit')return;
  clearInterval(rideInt);rideInt=null;S.prog=0;
  const done={...S.active,status:'completed',completedAt:new Date().toISOString(),step:4};
  S.log.booked=S.log.booked.filter(r=>r.rideId!==done.rideId);
  S.log.current=null;S.active=null;
  $('navL').classList.add('hidden');
  S.pendingReview=done;
  save();updateCR();
  toast('🏁 You have arrived! Rate your ride.','ok');
  openReview(done);
}

/* ── REVIEW ── */
function openReview(r){
  if(!r)return;
  $('revSub').textContent='Rate your ride with '+r.name;
  S.stars=0;
  document.querySelectorAll('.starb').forEach(b=>b.classList.remove('on'));
  $('revTxt').value='';
  $('revModal').classList.remove('hidden');
}
function setStar(n){S.stars=n;document.querySelectorAll('.starb').forEach(b=>b.classList.toggle('on',parseInt(b.dataset.s)<=n));}
function submitReview(){
  if(!S.stars){toast('Please select a star rating','warn');return;}
  const r=S.pendingReview;
  if(!r){$('revModal').classList.add('hidden');return;}
  r.review={stars:S.stars,text:$('revTxt').value.trim(),date:new Date().toISOString()};
  // Only add if not already in completed
  if(!S.log.completed.find(x=>x.rideId===r.rideId)){
    S.log.completed.unshift(r);
  } else {
    const idx=S.log.completed.findIndex(x=>x.rideId===r.rideId);
    if(idx>=0)S.log.completed[idx]=r;
  }
  S.pendingReview=null;
  save();
  $('revModal').classList.add('hidden');
  refreshStats();renderLog();
  toast('⭐ Review submitted — thank you!','ok');
  go('profile');
  setTimeout(()=>logTab('completed',document.querySelector('.ltab:nth-child(3)')),80);
}

/* ── PROFILE ── */
function refreshStats(){
  const c=S.log.completed.filter(r=>r.status!=='cancelled');
  $('sTR').textContent=c.length;
  const total=c.reduce((s,r)=>s+(r.fare||0),0);$('sTS').textContent=pkr(total);
  const avgF=c.length?c.reduce((s,r)=>s+(BASE[r.vehType||'Sedan']*INF*1.1),0)/c.length:0;
  const saved=c.reduce((s,r)=>s+Math.max(0,(avgF-(r.fare||0))),0);
  $('sTSv').textContent=saved>0?pkr(saved):'Rs 0';
  setB('bB',S.log.booked.length);setB('bC',S.log.current?1:0);setB('bD',S.log.completed.length);
}
function setB(id,n){const el=$(id);el.textContent=n;el.className='lbdg'+(n>0?' show':'');}
function logTab(t,btn){document.querySelectorAll('.ltab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');S.logTab=t;renderLog();}
function renderLog(){
  const c=$('logC');
  const rides=S.logTab==='booked'?S.log.booked:S.logTab==='current'?(S.log.current?[S.log.current]:[]):S.log.completed;
  if(!rides.length){c.innerHTML=`<div class="estat"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><p>No ${S.logTab} rides</p></div>`;return;}
  c.innerHTML=rides.map(r=>`
    <div class="ritem">
      <div class="ritop"><div class="ridate">${new Date(r.bookedAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</div><div class="riamt">${r.status==='cancelled'?'<span style="font-size:10px;color:#e07070;font-weight:700;">CANCELLED</span>':pkr(r.fare)}</div></div>
      <div class="rirte"><div class="rp"><div class="rpdot p"></div><span>${r.pickup}</span></div><div class="rp"><div class="rpdot d"></div><span>${r.dropoff}</span></div></div>
      <div class="rift"><span class="riplat ${r.plat}">${PL[r.plat]}</span>${r.review?`<div class="ristt">${[1,2,3,4,5].map(s=>`<span class="st${s>r.review.stars?' e':''}">&starf;</span>`).join('')}</div>`:`<span style="font-size:10px;color:var(--txtm);">${r.vehType||r.plat} · ${r.name}</span>`}</div>
    </div>`).join('');
}

/* ── MAP ── */
function drawMap(id,progress=0){
  const cv=$(id);if(!cv)return;
  const W=cv.parentElement.offsetWidth||300,H=cv.parentElement.offsetHeight||215;
  cv.width=W;cv.height=H;
  const ctx=cv.getContext('2d');
  const dark=document.documentElement.getAttribute('data-theme')!=='light';
  ctx.fillStyle=dark?'#081810':'#e4f0e9';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=dark?'rgba(10,122,82,.06)':'rgba(4,57,39,.04)';ctx.lineWidth=1;
  for(let x=0;x<W;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle=dark?'rgba(212,175,55,.07)':'rgba(4,57,39,.07)';ctx.lineWidth=7;
  [[0,H*.32,W,H*.32],[0,H*.64,W,H*.64],[W*.22,0,W*.22,H],[W*.68,0,W*.68,H],[0,H*.5,W*.38,H*.5],[W*.52,H*.18,W,H*.78]].forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  const fx=W*.13,fy=H*.78,tx=W*.84,ty=H*.2,c1x=W*.22,c1y=H*.32,c2x=W*.63,c2y=H*.62;
  ctx.strokeStyle=dark?'rgba(212,175,55,.2)':'rgba(4,57,39,.15)';ctx.lineWidth=4;ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.moveTo(fx,fy);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,tx,ty);ctx.stroke();ctx.setLineDash([]);
  if(progress>0){
    const pts=[];
    for(let i=0;i<=60;i++){const t=i/60;pts.push({x:Math.pow(1-t,3)*fx+3*Math.pow(1-t,2)*t*c1x+3*(1-t)*t*t*c2x+t*t*t*tx,y:Math.pow(1-t,3)*fy+3*Math.pow(1-t,2)*t*c1y+3*(1-t)*t*t*c2y+t*t*t*ty});}
    const end=Math.floor(progress*60);
    ctx.strokeStyle='#0a7a52';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<=end;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();
    const t=progress;const cx=Math.pow(1-t,3)*fx+3*Math.pow(1-t,2)*t*c1x+3*(1-t)*t*t*c2x+t*t*t*tx;const cy=Math.pow(1-t,3)*fy+3*Math.pow(1-t,2)*t*c1y+3*(1-t)*t*t*c2y+t*t*t*ty;
    ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.fillStyle='#D4AF37';ctx.fill();ctx.strokeStyle='#0a7a52';ctx.lineWidth=2;ctx.stroke();
  }
  pin(ctx,fx,fy,'#D4AF37','P');pin(ctx,tx,ty,'#0a7a52','D');
}
function pin(ctx,x,y,c,l){ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 8px Poppins,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(l,x,y);}

/* ── INIT ── */
async function initApp(){
  await initSupabase();
  await load();
  if(S.user){
    $('scr-auth').style.display='none';
    $('scr-auth').classList.remove('active');
    boot();
  }
}
initApp();
window.addEventListener('resize',()=>rdm());
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  closeSb();
  if(!$('revModal').classList.contains('hidden'))$('revModal').classList.add('hidden');
  if(!$('cxModal').classList.contains('hidden'))closeCxModal();
});
document.addEventListener('click',e=>{if(!e.target.closest('.locwrap'))document.querySelectorAll('.locdd').forEach(d=>d.classList.remove('open'));});
