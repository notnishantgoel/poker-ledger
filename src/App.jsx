import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, ArrowRightLeft, Landmark, Calculator, X,
  Coins, AlertTriangle, Check, ChevronDown, Play,
  RotateCcw, ArrowRight, Sparkles, Search, UserPlus,
  LogOut, Building2, Users
} from "lucide-react";

const GAME_KEY = "poker-ledger-game";
const NAMES_KEY = "poker-ledger-names";
const CURRENCY = "\u20B9";

const store = {
  async get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  async set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { console.error("Storage error:", e); }
  },
  async delete(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

function round2(n) { return Math.round(n * 100) / 100; }
let _pid = 100;
function pid() { return String(_pid++); }

function computeSettlements(netBalances) {
  const b = netBalances.map(x => ({ ...x, balance: round2(x.balance) }));
  const out = [];
  for (let i = 0; i < 200; i++) {
    const maxC = b.reduce((m, x) => x.balance > m.balance ? x : m, b[0]);
    const maxD = b.reduce((m, x) => x.balance < m.balance ? x : m, b[0]);
    if (maxC.balance < 0.5 && maxD.balance > -0.5) break;
    const amt = round2(Math.min(maxC.balance, Math.abs(maxD.balance)));
    if (amt < 0.5) break;
    out.push({ from: maxD.name, to: maxC.name, amount: amt });
    maxC.balance = round2(maxC.balance - amt);
    maxD.balance = round2(maxD.balance + amt);
  }
  return out;
}

const css = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideRow{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
@keyframes countUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.af{animation:fadeIn .3s ease}.as{animation:slideUp .35s ease}.ar{animation:slideRow .3s ease backwards}.ac{animation:countUp .25s ease}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
::selection{background:#34d39940;color:#f1f5f9}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#475569}`;

const C = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#334155",
  t1:"#f1f5f9",t2:"#e2e8f0",t3:"#94a3b8",t4:"#64748b",
  border:"#1e293b",borderLight:"#334155",
  green:"#34d399",greenDark:"#064e3b",
  amber:"#fbbf24",amberDark:"#854d0e",
  red:"#f87171",redDark:"#450a0a",redBorder:"#7f1d1d",
  purple:"#a78bfa",blue:"#60a5fa",orange:"#fb923c",
};
const mono = "'JetBrains Mono', monospace";

function TwoWayInput({ chipValue, chips, money, onChange, chipLabel, moneyLabel }) {
  const [focus, setFocus] = useState(null);
  const [cStr, setCStr] = useState(chips > 0 ? String(chips) : "");
  const [mStr, setMStr] = useState(money > 0 ? String(money) : "");
  useEffect(() => {
    if (focus !== "c") setCStr(chips > 0 ? String(round2(chips)) : "");
    if (focus !== "m") setMStr(money > 0 ? String(round2(money)) : "");
  }, [chips, money]);
  const onC = e => { const v=e.target.value; setCStr(v); setFocus("c"); const n=parseFloat(v)||0; const m=round2(n*chipValue); setMStr(m>0?String(m):""); onChange({chips:n,money:m}); };
  const onM = e => { const v=e.target.value; setMStr(v); setFocus("m"); const n=parseFloat(v)||0; const c=chipValue>0?round2(n/chipValue):0; setCStr(c>0?String(c):""); onChange({chips:c,money:n}); };
  const cls = "w-full rounded-xl px-3.5 py-3 text-sm focus:outline-none transition-all duration-200 border";
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>{chipLabel||"Chips"}</label>
        <input type="number" value={cStr} onChange={onC} onFocus={()=>setFocus("c")} onBlur={()=>setFocus(null)} placeholder="0" className={cls}
          style={{background:C.bg2,borderColor:focus==="c"?C.green:C.borderLight,color:C.t2,fontFamily:mono,boxShadow:focus==="c"?`0 0 0 3px ${C.green}20`:""}} />
      </div>
      <div className="pb-3 text-sm font-medium" style={{color:C.bg3}}>=</div>
      <div className="flex-1">
        <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>{moneyLabel||`Money (${CURRENCY})`}</label>
        <input type="number" value={mStr} onChange={onM} onFocus={()=>setFocus("m")} onBlur={()=>setFocus(null)} placeholder="0" className={cls}
          style={{background:C.bg2,borderColor:focus==="m"?C.amber:C.borderLight,color:C.amber,fontFamily:mono,boxShadow:focus==="m"?`0 0 0 3px ${C.amber}20`:""}} />
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{animation:"fadeIn .2s ease"}}>
      <div className="absolute inset-0" style={{background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)"}} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{background:`linear-gradient(to bottom, ${C.bg2}, ${C.bg1})`,border:`1px solid ${C.borderLight}`,animation:"slideUp .3s ease",boxShadow:"0 25px 50px -12px rgba(0,0,0,.5)"}}>
        <div className="flex items-center gap-3 px-6 py-5 sticky top-0 z-10" style={{borderBottom:`1px solid ${C.border}`,background:C.bg2}}>
          {icon}
          <h3 className="text-base font-semibold flex-1" style={{color:C.t1}}>{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors" style={{color:C.t4}}><X size={18}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function PSelect({ players, value, onChange, exclude, label }) {
  const exc = Array.isArray(exclude)?exclude:exclude?[exclude]:[];
  return (
    <div>
      <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full rounded-xl px-3.5 py-3 text-sm focus:outline-none border appearance-none"
        style={{background:C.bg2,borderColor:C.borderLight,color:C.t2}}>
        <option value="">Select player...</option>
        {players.filter(p=>!exc.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, onClick, variant="primary", disabled, full }) {
  const s = {
    primary:{background:"linear-gradient(135deg,#059669,#10b981)",color:"#fff",border:"none",boxShadow:"0 4px 14px 0 rgba(16,185,129,.35)"},
    secondary:{background:C.bg2,color:C.t2,border:`1px solid ${C.borderLight}`,boxShadow:"none"},
    danger:{background:"#7f1d1d",color:"#fca5a5",border:"1px solid #991b1b",boxShadow:"none"},
    amber:{background:"linear-gradient(135deg,#b45309,#d97706)",color:"#fff",border:"none",boxShadow:"0 4px 14px 0 rgba(217,119,6,.35)"},
    ghost:{background:"transparent",color:C.t3,border:`1px solid ${C.borderLight}`,boxShadow:"none"},
    blue:{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"#fff",border:"none",boxShadow:"0 4px 14px 0 rgba(59,130,246,.35)"},
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${full?"w-full":""}`}
      style={{...s[variant],opacity:disabled?.4:1,cursor:disabled?"not-allowed":"pointer"}}
      onMouseOver={e=>{if(!disabled){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.filter="brightness(1.1)";}}}
      onMouseOut={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.filter="brightness(1)";}}>
      {children}
    </button>
  );
}

function Err({ msg }) {
  if (!msg) return null;
  return (<div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-sm af" style={{background:C.redDark,color:"#fca5a5",border:`1px solid ${C.redBorder}`}}>
    <AlertTriangle size={16}/> {msg}</div>);
}

function Toggle({ options, value, onChange }) {
  return (
    <div className="flex gap-2.5">
      {options.map(([val,lbl,Icon,ac,abg])=>(
        <button key={val} onClick={()=>onChange(val)}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-medium transition-all border"
          style={{background:value===val?abg:C.bg2,borderColor:value===val?ac:C.borderLight,color:value===val?ac:C.t4}}>
          <Icon size={14}/> {lbl}
        </button>
      ))}
    </div>
  );
}

function hue(i) { return (i*67+120)%360; }
function avatar(name,i,size="w-10 h-10",text="text-sm") {
  return <div className={`${size} rounded-full flex items-center justify-center ${text} font-bold shrink-0`}
    style={{background:`hsl(${hue(i)},45%,22%)`,color:`hsl(${hue(i)},65%,68%)`,boxShadow:`0 0 0 2px hsl(${hue(i)},45%,15%)`}}>{name.charAt(0).toUpperCase()}</div>;
}

/* ─────────── SETUP ─────────── */
function SetupScreen({ onStart, savedNames }) {
  const [chipValue, setChipValue] = useState("");
  const [players, setPlayers] = useState([{id:"1",name:"",chips:0,money:0},{id:"2",name:"",chips:0,money:0}]);
  const [error, setError] = useState("");
  const [sug, setSug] = useState({id:null,list:[]});
  const nid = useRef(3);

  const addP = () => setPlayers(p=>[...p,{id:String(nid.current++),name:"",chips:0,money:0}]);
  const rmP = id => { if(players.length>2) setPlayers(p=>p.filter(x=>x.id!==id)); };
  const upd = (id,f,v) => setPlayers(p=>p.map(x=>x.id===id?{...x,[f]:v}:x));

  const showSug = (id,name) => {
    if(!name||!savedNames.length){setSug({id:null,list:[]});return;}
    const used=players.map(p=>p.name.toLowerCase());
    const list=savedNames.filter(n=>n.toLowerCase().includes(name.toLowerCase())&&!used.includes(n.toLowerCase()));
    setSug(list.length?{id,list:list.slice(0,5)}:{id:null,list:[]});
  };

  const cv = parseFloat(chipValue)||0;

  const handleStart = () => {
    setError("");
    if(cv<=0) return setError("Chip value must be > 0");
    const valid=players.filter(p=>p.name.trim());
    if(valid.length<2) return setError("Need at least 2 players");
    const names=valid.map(p=>p.name.trim().toLowerCase());
    if(new Set(names).size!==names.length) return setError("Duplicate names");
    if(valid.some(p=>p.chips<=0)) return setError("All players need a buy-in");
    onStart({
      chipValue:cv,
      players:valid.map(p=>({id:p.id,name:p.name.trim(),cashInvested:round2(p.chips*cv)})),
      totalBankChips:valid.reduce((s,p)=>s+p.chips,0),
      leftPlayers:[],
      transactions:valid.map(p=>({type:"initial",player:p.name.trim(),chips:p.chips,money:round2(p.chips*cv),time:Date.now()})),
    });
  };

  return (
    <div className="af" style={{maxWidth:520,margin:"0 auto",padding:"1.5rem 1.25rem 2rem"}}>
      <div className="text-center" style={{marginBottom:"2.5rem"}}>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5" style={{background:"linear-gradient(135deg,#059669,#10b981)",boxShadow:"0 8px 24px rgba(16,185,129,.3)"}}><Coins size={34} color="#fff"/></div>
        <h1 className="text-3xl font-bold mb-2" style={{color:C.t1,fontFamily:"'DM Sans',sans-serif",letterSpacing:"-0.02em"}}>Poker Ledger</h1>
        <p className="text-sm" style={{color:C.t4}}>Set up your home game</p>
      </div>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>Chip value ({CURRENCY} per chip)</label>
          <input type="number" value={chipValue} onChange={e=>setChipValue(e.target.value)} placeholder="e.g. 5"
            className="w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none border transition-all" style={{background:C.bg2,borderColor:C.borderLight,color:C.amber,fontFamily:mono}} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-semibold" style={{color:C.t3}}>Players</label>
            <button onClick={addP} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all" style={{color:C.green,background:C.greenDark}}><Plus size={14}/> Add</button>
          </div>
          <div className="space-y-4">
            {players.map((p,i)=>(
              <div key={p.id} className="rounded-2xl p-5 ar" style={{background:C.bg1,border:`1px solid ${C.border}`,animationDelay:`${i*60}ms`,boxShadow:"0 2px 8px rgba(0,0,0,.2)"}}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{background:`linear-gradient(135deg,${C.bg2},${C.bg3})`,color:C.green}}>{i+1}</div>
                  <div className="flex-1 relative">
                    <input value={p.name} onChange={e=>{upd(p.id,"name",e.target.value);showSug(p.id,e.target.value);}}
                      onBlur={()=>setTimeout(()=>setSug({id:null,list:[]}),200)} placeholder={`Player ${i+1}`}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none border transition-all" style={{background:C.bg2,borderColor:C.borderLight,color:C.t2}} />
                    {sug.id===p.id&&sug.list.length>0&&(
                      <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10" style={{background:C.bg2,border:`1px solid ${C.borderLight}`,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                        {sug.list.map(s=>(
                          <button key={s} className="w-full text-left px-4 py-2.5 text-sm" style={{color:C.t2}}
                            onMouseDown={()=>{upd(p.id,"name",s);setSug({id:null,list:[]});}}
                            onMouseOver={e=>e.currentTarget.style.background=C.bg3} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                            <Search size={12} style={{display:"inline",marginRight:8,color:C.t4}}/>{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {players.length>2&&<button onClick={()=>rmP(p.id)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" style={{color:C.red}}><Trash2 size={16}/></button>}
                </div>
                <TwoWayInput chipValue={cv} chips={p.chips} money={p.money} chipLabel="Buy-in chips" moneyLabel={`Buy-in (${CURRENCY})`}
                  onChange={({chips,money})=>{upd(p.id,"chips",chips);upd(p.id,"money",money);}} />
              </div>
            ))}
          </div>
        </div>
        <Err msg={error}/>
        <Btn onClick={handleStart} full variant="primary"><Play size={16}/> Start Game</Btn>
      </div>
    </div>
  );
}

/* ─────────── DASHBOARD ─────────── */
function DashboardScreen({ game, setGame, onSettle, savedNames }) {
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const [buyPlayer,setBuyPlayer]=useState(""); const [buyAmt,setBuyAmt]=useState({chips:0,money:0});
  const [tSeller,setTSeller]=useState(""); const [tBuyer,setTBuyer]=useState(""); const [tAmt,setTAmt]=useState({chips:0,money:0});
  const [newName,setNewName]=useState(""); const [newSrc,setNewSrc]=useState("bank"); const [newSrcPlayer,setNewSrcPlayer]=useState(""); const [newAmt,setNewAmt]=useState({chips:0,money:0}); const [nameSug,setNameSug]=useState([]);
  const [lp,setLp]=useState(""); const [lChips,setLChips]=useState(""); const [lDest,setLDest]=useState("bank"); const [lDestP,setLDestP]=useState(""); const [lStep,setLStep]=useState(1); const [lCalc,setLCalc]=useState(null); const [lSetP,setLSetP]=useState("");

  const total = game.players.reduce((s,p)=>s+p.cashInvested,0);

  const reset = () => {
    setModal(null);setErr("");setBuyPlayer("");setBuyAmt({chips:0,money:0});
    setTSeller("");setTBuyer("");setTAmt({chips:0,money:0});
    setNewName("");setNewSrc("bank");setNewSrcPlayer("");setNewAmt({chips:0,money:0});setNameSug([]);
    setLp("");setLChips("");setLDest("bank");setLDestP("");setLStep(1);setLCalc(null);setLSetP("");
  };
  const open = m => { reset(); setTimeout(()=>setModal(m),0); };

  const submitBuy = () => {
    setErr("");
    if(!buyPlayer) return setErr("Select a player"); if(buyAmt.chips<=0) return setErr("Enter an amount");
    const pl=game.players.find(p=>p.id===buyPlayer);
    setGame(g=>({...g,
      players:g.players.map(p=>p.id===buyPlayer?{...p,cashInvested:round2(p.cashInvested+buyAmt.money)}:p),
      totalBankChips:g.totalBankChips+buyAmt.chips,
      transactions:[...g.transactions,{type:"bank-buy-in",player:pl.name,chips:buyAmt.chips,money:buyAmt.money,time:Date.now()}],
    })); reset();
  };

  const submitTransfer = () => {
    setErr("");
    if(!tSeller||!tBuyer) return setErr("Select both players");
    if(tSeller===tBuyer) return setErr("Must be different players");
    if(tAmt.chips<=0) return setErr("Enter an amount");
    const seller=game.players.find(p=>p.id===tSeller);
    const buyer=game.players.find(p=>p.id===tBuyer);
    setGame(g=>({...g,
      players:g.players.map(p=>{
        if(p.id===tBuyer) return {...p,cashInvested:round2(p.cashInvested+tAmt.money)};
        if(p.id===tSeller) return {...p,cashInvested:round2(p.cashInvested-tAmt.money)};
        return p;
      }),
      transactions:[...g.transactions,{type:"transfer",seller:seller.name,buyer:buyer.name,chips:tAmt.chips,money:tAmt.money,time:Date.now()}],
    })); reset();
  };

  const submitAdd = () => {
    setErr("");
    const name=newName.trim();
    if(!name) return setErr("Enter name");
    if(game.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) return setErr("Already in game");
    if(newAmt.chips<=0) return setErr("Enter buy-in");
    if(newSrc==="player"&&!newSrcPlayer) return setErr("Select source player");
    const id=pid(); const txns=[]; let up=[...game.players]; let ub=game.totalBankChips;
    if(newSrc==="bank") {
      up.push({id,name,cashInvested:newAmt.money}); ub+=newAmt.chips;
      txns.push({type:"initial",player:name,chips:newAmt.chips,money:newAmt.money,time:Date.now()});
    } else {
      const src=game.players.find(p=>p.id===newSrcPlayer);
      up=up.map(p=>p.id===newSrcPlayer?{...p,cashInvested:round2(p.cashInvested-newAmt.money)}:p);
      up.push({id,name,cashInvested:newAmt.money});
      txns.push({type:"add-transfer",player:name,from:src.name,chips:newAmt.chips,money:newAmt.money,time:Date.now()});
    }
    setGame(g=>({...g,players:up,totalBankChips:ub,transactions:[...g.transactions,...txns]})); reset();
  };

  const calcLeave = () => {
    setErr("");
    if(!lp) return setErr("Select a player");
    const fc=parseFloat(lChips)||0; if(fc<0) return setErr("Cannot be negative");
    if(lDest==="player"&&!lDestP) return setErr("Select chip recipient");
    if(lDest==="player"&&lDestP===lp) return setErr("Cannot be same player");
    const p=game.players.find(x=>x.id===lp);
    const chipMon=round2(fc*game.chipValue);
    let adj=p.cashInvested;
    if(lDest==="player"&&fc>0) adj=round2(adj-chipMon);
    const net=round2(chipMon-adj);
    setLCalc({name:p.name,fc,chipMon,invested:p.cashInvested,adj,net}); setLStep(2);
  };

  const submitLeave = () => {
    setErr("");
    if(!lCalc) return;
    if(Math.abs(lCalc.net)>=0.5&&!lSetP) return setErr("Select settlement person");
    const txns=[]; let up=[...game.players]; let ub=game.totalBankChips;
    if(lDest==="bank"&&lCalc.fc>0) {
      ub-=lCalc.fc;
      txns.push({type:"leave-bank-return",player:lCalc.name,chips:lCalc.fc,money:lCalc.chipMon,time:Date.now()});
    } else if(lDest==="player"&&lCalc.fc>0) {
      const dest=game.players.find(x=>x.id===lDestP);
      up=up.map(p=>{
        if(p.id===lDestP) return {...p,cashInvested:round2(p.cashInvested+lCalc.chipMon)};
        if(p.id===lp) return {...p,cashInvested:round2(p.cashInvested-lCalc.chipMon)};
        return p;
      });
      txns.push({type:"leave-transfer",player:lCalc.name,to:dest.name,chips:lCalc.fc,money:lCalc.chipMon,time:Date.now()});
    }
    const ulp=up.find(x=>x.id===lp);
    const finalNet=round2(lCalc.fc*game.chipValue-ulp.cashInvested);
    if(Math.abs(finalNet)>=0.5&&lSetP) {
      const sw=up.find(x=>x.id===lSetP);
      if(finalNet>0) txns.push({type:"leave-settle",from:sw.name,to:lCalc.name,amount:round2(finalNet),time:Date.now()});
      else txns.push({type:"leave-settle",from:lCalc.name,to:sw.name,amount:round2(Math.abs(finalNet)),time:Date.now()});
    }
    const left={...ulp,name:lCalc.name,finalChips:lCalc.fc,net:finalNet,settledWith:lSetP?up.find(x=>x.id===lSetP)?.name:null};
    setGame(g=>({...g,players:up.filter(p=>p.id!==lp),totalBankChips:ub,leftPlayers:[...(g.leftPlayers||[]),left],transactions:[...g.transactions,...txns]}));
    reset();
  };

  const showNS = name => {
    if(!name||!savedNames.length){setNameSug([]);return;}
    const used=game.players.map(p=>p.name.toLowerCase());
    setNameSug(savedNames.filter(n=>n.toLowerCase().includes(name.toLowerCase())&&!used.includes(n.toLowerCase())).slice(0,5));
  };

  const lpData=game.leftPlayers||[];

  return (
    <div className="af" style={{maxWidth:560,margin:"0 auto",padding:"1.5rem 1.25rem",paddingBottom:120,fontFamily:"'DM Sans',sans-serif"}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{color:C.t1,letterSpacing:"-0.02em"}}>Poker Ledger</h1>
          <p className="text-xs mt-0.5" style={{color:C.t4}}>{game.players.length} active &middot; {CURRENCY}{game.chipValue}/chip</p>
        </div>
        <div className="text-right px-4 py-2.5 rounded-xl" style={{background:C.bg2,border:`1px solid ${C.border}`}}>
          <p className="text-xs" style={{color:C.t4}}>Pot</p>
          <p className="text-base font-bold" style={{color:C.amber,fontFamily:mono}}>{CURRENCY}{total.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2.5 mb-6 flex-wrap">
        <button onClick={()=>open("add")} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all" style={{color:C.blue,background:"#172554",border:"1px solid #1e3a5f"}}><UserPlus size={14}/> Add Player</button>
        {game.players.length>1&&<button onClick={()=>open("leave")} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all" style={{color:C.orange,background:"#431407",border:"1px solid #7c2d12"}}><LogOut size={14}/> Player Leaving</button>}
      </div>

      <div className="space-y-3 mb-6">
        {game.players.map((p,i)=>(
          <div key={p.id} className="flex items-center gap-3.5 rounded-2xl px-5 py-4 ar" style={{background:C.bg1,border:`1px solid ${C.border}`,animationDelay:`${i*50}ms`,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
            {avatar(p.name,i)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{color:C.t2}}>{p.name}</p>
              <p className="text-xs mt-0.5" style={{color:C.t4}}>Invested</p>
            </div>
            <p className="text-sm font-bold ac" key={p.cashInvested} style={{color:C.amber,fontFamily:mono}}>{CURRENCY}{p.cashInvested.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {lpData.length>0&&(
        <details className="mb-6">
          <summary className="text-xs font-medium cursor-pointer mb-2.5 flex items-center gap-1.5" style={{color:C.t4}}><ChevronDown size={14}/> Left the game ({lpData.length})</summary>
          <div className="space-y-1.5">{lpData.map((p,i)=>(
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs" style={{background:C.bg1,border:`1px solid ${C.border}`,color:C.t4}}>
              <span className="font-medium" style={{color:C.t3}}>{p.name}</span><span className="flex-1"/>
              <span style={{color:p.net>=0?C.green:C.red,fontFamily:mono}}>{p.net>=0?"+":""}{CURRENCY}{round2(p.net).toLocaleString()}</span>
              {p.settledWith&&<span>w/ {p.settledWith}</span>}
            </div>
          ))}</div>
        </details>
      )}

      {game.transactions.length>0&&(
        <details className="mb-6">
          <summary className="text-xs font-medium cursor-pointer mb-2.5 flex items-center gap-1.5" style={{color:C.t4}}><ChevronDown size={14}/> Transaction log ({game.transactions.length})</summary>
          <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl p-3" style={{background:C.bg1}}>
            {[...game.transactions].reverse().map((t,i)=>(
              <div key={i} className="text-xs px-3.5 py-2.5 rounded-xl" style={{background:C.bg2,color:C.t3}}>
                {t.type==="initial"&&<><span style={{color:C.green}}>{t.player}</span> bought in: {round2(t.chips)} chips ({CURRENCY}{round2(t.money)})</>}
                {t.type==="bank-buy-in"&&<><span style={{color:C.blue}}>{t.player}</span> bank buy-in: {round2(t.chips)} chips ({CURRENCY}{round2(t.money)})</>}
                {t.type==="transfer"&&<><span style={{color:C.orange}}>{t.seller}</span> sold {round2(t.chips)} chips to <span style={{color:C.purple}}>{t.buyer}</span> ({CURRENCY}{round2(t.money)})</>}
                {t.type==="add-transfer"&&<><span style={{color:C.green}}>{t.player}</span> joined via <span style={{color:C.orange}}>{t.from}</span>: {round2(t.chips)} chips ({CURRENCY}{round2(t.money)})</>}
                {t.type==="leave-bank-return"&&<><span style={{color:C.orange}}>{t.player}</span> returned {round2(t.chips)} chips to bank</>}
                {t.type==="leave-transfer"&&<><span style={{color:C.orange}}>{t.player}</span> gave {round2(t.chips)} chips to <span style={{color:C.blue}}>{t.to}</span></>}
                {t.type==="leave-settle"&&<><span style={{color:C.red}}>{t.from}</span> pays <span style={{color:C.green}}>{t.to}</span> {CURRENCY}{round2(t.amount)}</>}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="fixed bottom-0 left-0 right-0 flex gap-2.5 p-4 z-40" style={{background:`linear-gradient(to top, ${C.bg0} 80%, transparent)`,paddingBottom:"max(1rem, env(safe-area-inset-bottom))"}}>
        <Btn onClick={()=>open("buy")} variant="primary" full><Landmark size={16}/> Bank Buy-in</Btn>
        <Btn onClick={()=>open("transfer")} variant="secondary" full><ArrowRightLeft size={16}/> Transfer</Btn>
        <Btn onClick={onSettle} variant="amber" full><Calculator size={16}/> Settle</Btn>
      </div>

      {/* Bank Buy-in */}
      <Modal open={modal==="buy"} onClose={reset} title="Bank Buy-in" icon={<Landmark size={20} style={{color:C.green}}/>}>
        <div className="space-y-5">
          <PSelect players={game.players} value={buyPlayer} onChange={setBuyPlayer} label="Player"/>
          <TwoWayInput chipValue={game.chipValue} chips={buyAmt.chips} money={buyAmt.money} onChange={setBuyAmt}/>
          <Err msg={err}/><Btn onClick={submitBuy} full variant="primary"><Check size={16}/> Confirm Buy-in</Btn>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal open={modal==="transfer"} onClose={reset} title="Player Transfer" icon={<ArrowRightLeft size={20} style={{color:C.purple}}/>}>
        <div className="space-y-5">
          <PSelect players={game.players} value={tSeller} onChange={setTSeller} exclude={tBuyer} label="Seller (giving chips)"/>
          <PSelect players={game.players} value={tBuyer} onChange={setTBuyer} exclude={tSeller} label="Buyer (receiving chips)"/>
          <TwoWayInput chipValue={game.chipValue} chips={tAmt.chips} money={tAmt.money} onChange={setTAmt}/>
          <Err msg={err}/><Btn onClick={submitTransfer} full variant="primary"><Check size={16}/> Confirm Transfer</Btn>
        </div>
      </Modal>

      {/* Add Player */}
      <Modal open={modal==="add"} onClose={reset} title="Add Player" icon={<UserPlus size={20} style={{color:C.blue}}/>}>
        <div className="space-y-5">
          <div className="relative">
            <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>Player name</label>
            <input value={newName} onChange={e=>{setNewName(e.target.value);showNS(e.target.value);}} onBlur={()=>setTimeout(()=>setNameSug([]),200)}
              placeholder="Name" className="w-full rounded-xl px-3.5 py-3 text-sm focus:outline-none border transition-all" style={{background:C.bg2,borderColor:C.borderLight,color:C.t2}}/>
            {nameSug.length>0&&(
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10" style={{background:C.bg2,border:`1px solid ${C.borderLight}`,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                {nameSug.map(s=><button key={s} className="w-full text-left px-4 py-2.5 text-sm" style={{color:C.t2}}
                  onMouseDown={()=>{setNewName(s);setNameSug([]);}} onMouseOver={e=>e.currentTarget.style.background=C.bg3} onMouseOut={e=>e.currentTarget.style.background="transparent"}>{s}</button>)}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium mb-2.5 block" style={{color:C.t3}}>Getting chips from</label>
            <Toggle value={newSrc} onChange={setNewSrc} options={[["bank","Bank",Building2,C.green,C.greenDark],["player","Player",Users,C.purple,"#312e81"]]}/>
          </div>
          {newSrc==="player"&&<PSelect players={game.players} value={newSrcPlayer} onChange={setNewSrcPlayer} label="Selling player"/>}
          <TwoWayInput chipValue={game.chipValue} chips={newAmt.chips} money={newAmt.money} onChange={setNewAmt} chipLabel="Buy-in chips" moneyLabel={`Buy-in (${CURRENCY})`}/>
          <Err msg={err}/><Btn onClick={submitAdd} full variant="blue"><UserPlus size={16}/> Add to Game</Btn>
        </div>
      </Modal>

      {/* Player Leaving */}
      <Modal open={modal==="leave"} onClose={reset} title="Player Leaving" icon={<LogOut size={20} style={{color:C.orange}}/>}>
        {lStep===1?(
          <div className="space-y-5">
            <PSelect players={game.players} value={lp} onChange={setLp} label="Who is leaving?"/>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{color:C.t3}}>Their final chip count</label>
              <input type="number" value={lChips} onChange={e=>setLChips(e.target.value)} placeholder="0"
                className="w-full rounded-xl px-3.5 py-3 text-sm focus:outline-none border transition-all" style={{background:C.bg2,borderColor:C.borderLight,color:C.t2,fontFamily:mono}}/>
            </div>
            <div>
              <label className="text-xs font-medium mb-2.5 block" style={{color:C.t3}}>What happens to their chips?</label>
              <Toggle value={lDest} onChange={setLDest} options={[["bank","Return to Bank",Building2,C.green,C.greenDark],["player","Give to Player",Users,C.purple,"#312e81"]]}/>
            </div>
            {lDest==="player"&&lp&&<PSelect players={game.players} value={lDestP} onChange={setLDestP} exclude={lp} label="Who gets the chips?"/>}
            <Err msg={err}/><Btn onClick={calcLeave} full variant="amber"><ArrowRight size={16}/> Calculate Settlement</Btn>
          </div>
        ):(
          <div className="space-y-5 as">
            <div className="rounded-2xl p-5" style={{background:C.bg1,border:`1px solid ${C.border}`}}>
              <p className="text-sm font-semibold mb-4" style={{color:C.t1}}>{lCalc.name}&apos;s settlement</p>
              <div className="space-y-2 text-xs" style={{color:C.t3}}>
                <div className="flex justify-between"><span>Final chips</span><span style={{color:C.t2,fontFamily:mono}}>{lCalc.fc}</span></div>
                <div className="flex justify-between"><span>Chip value</span><span style={{color:C.t2,fontFamily:mono}}>{CURRENCY}{lCalc.chipMon.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Cash invested</span><span style={{color:C.t2,fontFamily:mono}}>{CURRENCY}{lCalc.invested.toLocaleString()}</span></div>
                {lDest==="player"&&lCalc.fc>0&&<div className="flex justify-between" style={{color:C.t4}}><span>After chip transfer</span><span style={{fontFamily:mono}}>{CURRENCY}{lCalc.adj.toLocaleString()}</span></div>}
                <div className="flex justify-between pt-3 mt-3" style={{borderTop:`1px solid ${C.border}`}}>
                  <span className="font-semibold">Net balance</span>
                  <span className="font-bold" style={{color:lCalc.net>0?C.green:lCalc.net<0?C.red:C.t3,fontFamily:mono}}>{lCalc.net>=0?"+":""}{CURRENCY}{round2(lCalc.net).toLocaleString()}</span>
                </div>
              </div>
            </div>
            {Math.abs(lCalc.net)>=0.5?(
              <>
                <div className="rounded-xl px-4 py-3 text-xs" style={{background:lCalc.net>0?C.greenDark:C.redDark,color:lCalc.net>0?C.green:"#fca5a5"}}>
                  {lCalc.net>0?`${lCalc.name} is owed ${CURRENCY}${round2(lCalc.net).toLocaleString()}. Who pays?`:`${lCalc.name} owes ${CURRENCY}${round2(Math.abs(lCalc.net)).toLocaleString()}. Who gets paid?`}
                </div>
                <PSelect players={game.players} value={lSetP} onChange={setLSetP} exclude={lp} label={lCalc.net>0?"Who pays them?":"Who do they pay?"}/>
              </>
            ):(
              <div className="rounded-xl px-4 py-3 text-xs flex items-center gap-2" style={{background:C.greenDark,color:C.green}}>
                <Check size={14}/> {lCalc.name} is exactly even.
              </div>
            )}
            <Err msg={err}/>
            <div className="flex gap-2.5">
              <Btn onClick={()=>{setLStep(1);setErr("");}} variant="ghost" full><RotateCcw size={14}/> Back</Btn>
              <Btn onClick={submitLeave} variant="amber" full><Check size={16}/> Confirm &amp; Remove</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─────────── SETTLE ─────────── */
function SettleScreen({ game, onBack, onReset }) {
  const [fc, setFc] = useState(()=>{const m={};game.players.forEach(p=>m[p.id]="");return m;});
  const [result, setResult] = useState(null);
  const [warning, setWarning] = useState("");
  const tb = game.totalBankChips;

  const calc = () => {
    setWarning("");
    const tf = Object.values(fc).reduce((s,v)=>s+(parseFloat(v)||0),0);
    if(Math.abs(tf-tb)>0.5) setWarning(`Chip mismatch! Final (${round2(tf)}) \u2260 bank (${round2(tb)}). Diff: ${round2(Math.abs(tf-tb))}`);
    const bal = game.players.map(p=>{const f=parseFloat(fc[p.id])||0;return{name:p.name,balance:round2(f*game.chipValue-p.cashInvested),finalChips:f,invested:p.cashInvested};});
    setResult({balances:bal,settlements:computeSettlements(bal)});
  };
  const lpData=game.leftPlayers||[];

  return (
    <div className="af" style={{maxWidth:560,margin:"0 auto",padding:"1.5rem 1.25rem 2rem",fontFamily:"'DM Sans',sans-serif"}}>
      <div className="flex items-center gap-3.5 mb-8">
        <button onClick={onBack} className="p-2.5 rounded-xl transition-colors" style={{color:C.t3,background:C.bg2,border:`1px solid ${C.border}`}}><RotateCcw size={16}/></button>
        <div><h1 className="text-xl font-bold" style={{color:C.t1,letterSpacing:"-0.02em"}}>Settle Up</h1>
        <p className="text-xs mt-0.5" style={{color:C.t4}}>Bank chips in play: {round2(tb)}</p></div>
      </div>

      {!result?(
        <div className="space-y-5">
          <p className="text-sm" style={{color:C.t3}}>Enter each player&apos;s final chip count:</p>
          <div className="space-y-3">
          {game.players.map((p,i)=>(
            <div key={p.id} className="flex items-center gap-3.5 rounded-2xl px-5 py-4 ar" style={{background:C.bg1,border:`1px solid ${C.border}`,animationDelay:`${i*50}ms`,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
              {avatar(p.name,i,"w-9 h-9","text-xs")}
              <div className="flex-1 min-w-0"><span className="text-sm font-medium" style={{color:C.t2}}>{p.name}</span>
              <p className="text-xs mt-0.5" style={{color:C.t4}}>Inv: {CURRENCY}{p.cashInvested.toLocaleString()}</p></div>
              <input type="number" value={fc[p.id]} onChange={e=>setFc(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                className="w-24 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none border transition-all" style={{background:C.bg2,borderColor:C.borderLight,color:C.t2,fontFamily:mono}}/>
              <span className="text-xs shrink-0" style={{color:C.t4}}>chips</span>
            </div>
          ))}
          </div>
          {warning&&<div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl text-sm af" style={{background:"#422006",color:C.amber,border:`1px solid ${C.amberDark}`}}><AlertTriangle size={16} className="shrink-0 mt-0.5"/><span>{warning}</span></div>}
          <Btn onClick={calc} full variant="amber"><Calculator size={16}/> Calculate Settlement</Btn>
        </div>
      ):(
        <div className="space-y-7 as">
          <div>
            <h2 className="text-sm font-semibold mb-3.5" style={{color:C.t3}}>Player balances</h2>
            <div className="space-y-2.5">{result.balances.map((b,i)=>(
              <div key={b.name} className="flex items-center gap-3.5 rounded-2xl px-5 py-4 ar"
                style={{background:C.bg1,border:`1px solid ${b.balance>0?C.greenDark:b.balance<0?C.redDark:C.border}`,animationDelay:`${i*60}ms`,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
                <span className="text-sm font-medium flex-1" style={{color:C.t2}}>{b.name}</span>
                <div className="text-right">
                  <p className="text-xs" style={{color:C.t4}}>{b.finalChips} chips &middot; Inv. {CURRENCY}{b.invested.toLocaleString()}</p>
                  <p className="text-sm font-bold mt-0.5" style={{color:b.balance>0?C.green:b.balance<0?C.red:C.t3,fontFamily:mono}}>{b.balance>=0?"+":""}{CURRENCY}{round2(b.balance).toLocaleString()}</p>
                </div>
              </div>
            ))}</div>
          </div>

          {warning&&<div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl text-sm" style={{background:"#422006",color:C.amber,border:`1px solid ${C.amberDark}`}}><AlertTriangle size={16} className="shrink-0 mt-0.5"/><span>{warning}</span></div>}

          {lpData.length>0&&(
            <div>
              <h2 className="text-sm font-semibold mb-2.5" style={{color:C.t3}}>Already settled (left earlier)</h2>
              <div className="space-y-1.5">{lpData.map((p,i)=>(
                <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs" style={{background:C.bg1,border:`1px solid ${C.border}`,color:C.t4}}>
                  <span style={{color:C.t3}}>{p.name}</span><span className="flex-1"/>
                  <span style={{color:p.net>=0?C.green:C.red,fontFamily:mono}}>{p.net>=0?"+":""}{CURRENCY}{round2(p.net).toLocaleString()}</span>
                  {p.settledWith&&<span>w/ {p.settledWith}</span>}
                </div>
              ))}</div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-3.5 flex items-center gap-2" style={{color:C.t3}}>
              <Sparkles size={14} style={{color:C.amber}}/> Settlements ({result.settlements.length} transaction{result.settlements.length!==1?"s":""})
            </h2>
            {result.settlements.length===0?<p className="text-sm" style={{color:C.t4}}>Everyone is even!</p>:(
              <div className="space-y-2.5">{result.settlements.map((s,i)=>(
                <div key={i} className="flex items-center gap-2 sm:gap-3.5 rounded-2xl px-4 sm:px-5 py-4 ar"
                  style={{background:C.bg1,border:"1px solid #312e81",animationDelay:`${i*80}ms`,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
                  <span className="text-xs sm:text-sm font-semibold shrink-0" style={{color:C.red}}>{s.from}</span>
                  <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
                    <div className="h-px flex-1" style={{background:C.bg3}}/>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{background:C.amber,color:C.bg2,fontFamily:mono}}>{CURRENCY}{s.amount.toLocaleString()}</span>
                    <ArrowRight size={12} style={{color:C.t4}} className="shrink-0"/>
                    <div className="h-px flex-1" style={{background:C.bg3}}/>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold shrink-0" style={{color:C.green}}>{s.to}</span>
                </div>
              ))}</div>
            )}
          </div>
          <div className="flex gap-2.5">
            <Btn onClick={()=>setResult(null)} variant="secondary" full><RotateCcw size={16}/> Re-enter</Btn>
            <Btn onClick={onReset} variant="danger" full><Trash2 size={16}/> New Game</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── APP ROOT ─────────── */
export default function App() {
  const [game,setGame]=useState(null);
  const [phase,setPhase]=useState("loading");
  const [savedNames,setSavedNames]=useState([]);

  useEffect(()=>{(async()=>{
    const g=await store.get(GAME_KEY); const n=await store.get(NAMES_KEY);
    setSavedNames(n||[]);
    if(g&&g.phase){setGame(g);setPhase(g.phase);} else setPhase("setup");
  })();},[]);

  useEffect(()=>{
    if(game){
      store.set(GAME_KEY,{...game,phase});
      const names=[...(game.players||[]),...(game.leftPlayers||[])].map(p=>p.name);
      setSavedNames(prev=>{const m=[...new Set([...prev,...names])];store.set(NAMES_KEY,m);return m;});
    }
  },[game,phase]);

  const handleStart=data=>{setGame(data);setPhase("game");};
  const handleReset=async()=>{await store.delete(GAME_KEY);setGame(null);setPhase("setup");};

  if(phase==="loading") return (
    <div className="flex items-center justify-center" style={{minHeight:"100vh",background:C.bg0}}>
      <div style={{color:C.t4,animation:"pulse 1.5s infinite"}}><Coins size={32}/></div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg,${C.bg0} 0%,${C.bg1} 100%)`,fontFamily:"'DM Sans',sans-serif",color:C.t2}}>
      <style>{css}</style>
      {phase==="setup"&&<SetupScreen onStart={handleStart} savedNames={savedNames}/>}
      {phase==="game"&&game&&<DashboardScreen game={game} setGame={setGame} onSettle={()=>setPhase("settle")} savedNames={savedNames}/>}
      {phase==="settle"&&game&&<SettleScreen game={game} onBack={()=>setPhase("game")} onReset={handleReset}/>}
    </div>
  );
}
