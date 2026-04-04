import { useState, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import * as htmlToImage from "html-to-image";
import {
  Plus, Trash2, ArrowRightLeft, Landmark, Calculator, X,
  Coins, AlertTriangle, Check, ChevronDown, Play,
  RotateCcw, ArrowRight, Sparkles, Search, UserPlus,
  LogOut, Building2, Users, Palette, Crown, Download, Share2
} from "lucide-react";
import './App.css';

const GAME_KEY = "poker-ledger-game";
const NAMES_KEY = "poker-ledger-names";
const CURRENCY = "₹";

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

export const haptic = () => { try { if(navigator.vibrate) navigator.vibrate(40); } catch(e){} };

export function AnimatedNumber({ value, prefix="", suffix="", decimals=0, duration=400 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    let start = performance.now();
    let startVal = displayValue;
    let endVal = value;
    if (startVal === endVal) return;
    
    const animate = (time) => {
      let progress = (time - start) / duration;
      if (progress > 1) progress = 1;
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = startVal + (endVal - startVal) * easeProgress;
      setDisplayValue(currentVal);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toString();
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return <span>{prefix}{parts.join(".")}{suffix}</span>;
}

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

function TwoWayInput({ chipValue, chips, money, onChange, chipLabel, moneyLabel }) {
  const [focus, setFocus] = useState(null);

  const getSwipeHandlers = (id) => useSwipeable({
    onSwipedLeft: () => { setLp(id); open("leave"); haptic(); },
    onSwipedRight: () => { setBuyPlayer(id); open("add"); haptic(); },
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 50
  });
  const [cStr, setCStr] = useState(chips > 0 ? String(chips) : "");
  const [mStr, setMStr] = useState(money > 0 ? String(money) : "");
  
  useEffect(() => {
    if (focus !== "c") setCStr(chips > 0 ? String(round2(chips)) : "");
    if (focus !== "m") setMStr(money > 0 ? String(round2(money)) : "");
  }, [chips, money]);
  
  const onC = e => { const v=e.target.value; setCStr(v); setFocus("c"); const n=parseFloat(v)||0; const m=round2(n*chipValue); setMStr(m>0?String(m):""); onChange({chips:n,money:m}); };
  const onM = e => { const v=e.target.value; setMStr(v); setFocus("m"); const n=parseFloat(v)||0; const c=chipValue>0?round2(n/chipValue):0; setCStr(c>0?String(c):""); onChange({chips:c,money:n}); };
  
  const adjustC = delta => {
    const current = parseFloat(cStr) || 0;
    const n = Math.max(0, current + delta);
    setCStr(n > 0 ? String(n) : "");
    const m = round2(n * chipValue);
    setMStr(m > 0 ? String(m) : "");
    onChange({ chips: n, money: m });
  };
  
  return (
    <div className="flex items-end gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        {chipLabel !== null && <label className="text-[10px] sm:text-xs font-semibold mb-1.5 block tracking-wider uppercase text-slate-400">{chipLabel || "Chips"}</label>}
        <div className="relative group flex items-center">
          <button onClick={(e)=>{haptic(); adjustC(-10)}} className="absolute left-1 z-10 w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors font-bold">-</button>
          <input type="number" value={cStr} onChange={onC} onFocus={()=>setFocus("c")} onBlur={()=>setFocus(null)} placeholder="0" 
            className={`w-full rounded-xl px-7 text-center py-2 text-sm glass-input font-mono ${focus === "c" ? "focus:ring-theme-500/20 focus:border-theme-500/50" : ""}`} />
          <button onClick={(e)=>{haptic(); adjustC(10)}} className="absolute right-1 z-10 w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors font-bold">+</button>
        </div>
      </div>
      <div className="pb-2 text-slate-500 font-medium shrink-0">=</div>
      <div className="flex-1 min-w-0">
        {moneyLabel !== null && <label className="text-[10px] sm:text-xs font-semibold mb-1.5 block tracking-wider uppercase text-slate-400 truncate">{moneyLabel || `Money (${CURRENCY})`}</label>}
        <div className="relative group">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">{CURRENCY}</span>
          <input type="number" value={mStr} onChange={onM} onFocus={()=>setFocus("m")} onBlur={()=>setFocus(null)} placeholder="0" 
            className={`w-full rounded-xl pl-6 pr-3 py-2 text-sm glass-input font-mono text-amber-400 ${focus === "m" ? "focus:ring-amber-500/20 focus:border-amber-500/50" : ""}`} />
        </div>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 sm:px-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto glass-panel animate-slide-up shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 px-6 py-5 sticky top-0 z-10 bg-slate-900/90 backdrop-blur-xl border-b border-white/5">
          {icon}
          <h3 className="text-lg font-semibold flex-1 text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 text-slate-400 transition-all"><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function PSelect({ players, value, onChange, exclude, label }) {
  const exc = Array.isArray(exclude) ? exclude : exclude ? [exclude] : [];
  return (
    <div>
      <label className="text-xs font-semibold mb-2.5 block tracking-wider uppercase text-slate-400">{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3.5 text-sm sm:text-base glass-input text-slate-200 cursor-pointer">
        <option value="" className="bg-slate-900 text-slate-400">Select player...</option>
        {players.filter(p=>!exc.includes(p.id)).map(p=><option key={p.id} value={p.id} className="bg-slate-800 text-slate-100">{p.name}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, onClick, variant="primary", disabled, full, className="" }) {
  const base = `rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm sm:text-base flex items-center justify-center gap-2.5 outline-none hover:-translate-y-0.5 ${full ? "w-full" : ""} ${className}`;
  const variants = {
    primary: "glass-button-primary",
    secondary: "glass-button-secondary",
    danger: "glass-button-danger",
    amber: "glass-button-amber",
    blue: "glass-button-blue",
    ghost: "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5 active:scale-[0.98] transition-all"
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed hover:transform-none' : ''}`}>
      {children}
    </button>
  );
}

function Err({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-sm animate-fade-in bg-rose-500/10 border border-rose-500/20 text-rose-300">
      <AlertTriangle size={16} className="shrink-0"/> {msg}
    </div>
  );
}

function Toggle({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(([val,lbl,Icon,activeColor])=>(
        <button key={val} onClick={()=>onChange(val)}
          className={`flex-1 flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl px-3 py-3 text-xs sm:text-sm font-medium transition-all duration-300 border ${
            value === val 
            ? `bg-${activeColor}-500/15 border-${activeColor}-500/30 text-${activeColor}-400 shadow-[inset_0_0_12px_rgba(0,0,0,0.2)]` 
            : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
          }`}>
          <Icon size={16}/> <span className="truncate">{lbl}</span>
        </button>
      ))}
    </div>
  );
}

function hue(i) { return (i * 67 + 120) % 360; }
function avatar(name, i, size="w-10 h-10", textSize="text-sm font-bold") {
  return (
    <div className={`${size} rounded-full flex items-center justify-center ${textSize} shrink-0 shadow-lg`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue(i)},65%,22%), hsl(${hue(i)},55%,12%))`,
        color: `hsl(${hue(i)},85%,78%)`,
        border: `1px solid hsl(${hue(i)},45%,35%)`
      }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─────────── SETUP ─────────── */
function SetupScreen({ onStart, savedNames }) {
  const [chipValue, setChipValue] = useState("");
  const [players, setPlayers] = useState([{id:"1",name:"",chips:0,money:0},{id:"2",name:"",chips:0,money:0},{id:"3",name:"",chips:0,money:0},{id:"4",name:"",chips:0,money:0}]);
  const [error, setError] = useState("");
  const [sug, setSug] = useState({id:null,list:[]});
  const nid = useRef(5);

  const addP = () => setPlayers(p=>[...p,{id:String(nid.current++),name:"",chips:0,money:0}]);
  
  const quickFill = () => {
    const curV = parseFloat(chipValue) || 5;
    if (!chipValue) setChipValue("5");
    setPlayers([
      {id: "1", name: "Nishant", chips: 40, money: round2(40 * curV)},
      {id: "2", name: "Agrim",   chips: 20, money: round2(20 * curV)},
      {id: "3", name: "Nema",    chips: 20, money: round2(20 * curV)},
      {id: "4", name: "Parth",   chips: 40, money: round2(40 * curV)},
      {id: "5", name: "Monty",   chips: 40, money: round2(40 * curV)},
      {id: "6", name: "Ritabrata", chips: 20, money: round2(20 * curV)}
    ]);
    nid.current = 7;
  };
  const rmP = id => { if(players.length>2) setPlayers(p=>p.filter(x=>x.id!==id)); };
  const upd = (id, f, v) => setPlayers(p => p.map(x => {
    if (x.id !== id) return x;
    const nx = { ...x, [f]: v };
    if (f === "name" && !x.name && v.trim() && nx.chips === 0) {
      nx.chips = 20;
      nx.money = round2(20 * (parseFloat(chipValue) || 5));
    }
    return nx;
  }));

  const showSug = (id,name) => {
    if(!name||!savedNames.length){setSug({id:null,list:[]});return;}
    const used=players.map(p=>p.name.toLowerCase());
    const list=savedNames.filter(n=>n.toLowerCase().includes(name.toLowerCase())&&!used.includes(n.toLowerCase()));
    setSug(list.length?{id,list:list.slice(0,5)}:{id:null,list:[]});
  };

  const cv = parseFloat(chipValue)||5;

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
    <div className="animate-fade-in w-full max-w-2xl mx-auto px-2 py-3 sm:py-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
        <div className="inline-flex items-center justify-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-theme-400 to-theme-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-theme-300/30 shrink-0">
          <Coins size={18} className="text-white drop-shadow-md" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-theme-50 to-theme-200 bg-clip-text text-transparent tracking-tight leading-none mb-0.5">Poker Ledger</h1>
          <p className="text-slate-400 text-[9px] sm:text-xs font-medium">Set up your home game</p>
        </div>
      </div>
      
      <div className="space-y-3 glass-panel p-2.5 sm:p-6 rounded-[1rem] sm:rounded-[1.5rem]">
        <div className="flex items-center gap-3">
          <label className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-theme-400/90 flex items-center gap-1.5 shrink-0">
            <Coins size={14}/> {CURRENCY} / Chip
          </label>
          <div className="relative group flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">{CURRENCY}</span>
            <input type="number" value={chipValue} onChange={e=>setChipValue(e.target.value)} placeholder="5"
              className="w-full rounded-xl pl-7 pr-3 py-2 text-sm sm:text-base glass-input text-amber-400 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
        
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Users size={16}/> Players
            </label>
            <div className="flex gap-2">
              <button onClick={quickFill} className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
                <Sparkles size={12}/> Auto-fill
              </button>
              <button onClick={addP} className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-full border border-theme-500/30 bg-theme-500/10 hover:bg-theme-500/20 text-theme-400 transition-colors">
                <Plus size={12}/> Add player
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-end gap-3 sm:gap-4 px-2 mb-1">
              <div className="flex-1"><label className="text-[9px] sm:text-xs font-semibold tracking-wider uppercase text-slate-400 ml-10">Name</label></div>
              <div className="flex-1"><label className="text-[9px] sm:text-xs font-semibold tracking-wider uppercase text-slate-400 ml-2">Buy-in (# Chip)</label></div>
            </div>
            {players.map((p,i)=>(
              <div key={p.id} className="rounded-xl p-2 sm:p-4 glass-card animate-slide-up" style={{animationDelay: `${i * 60}ms`}}>
                <div className="flex items-center gap-2 sm:gap-4 mb-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold shrink-0 bg-theme-500/10 text-theme-400 border border-theme-500/20">
                    {i+1}
                  </div>
                  <div className="flex-1 relative min-w-0">
                    <input value={p.name} onChange={e=>{upd(p.id,"name",e.target.value);showSug(p.id,e.target.value);}}
                      onBlur={()=>setTimeout(()=>setSug({id:null,list:[]}),200)} placeholder={`Player ${i+1}`}
                      className="w-full rounded-xl px-3 py-2 text-sm sm:text-base glass-input" />
                    {sug.id===p.id&&sug.list.length>0&&(
                      <div className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-20 glass-panel border-white/20 p-1">
                        {sug.list.map(s=>(
                          <button key={s} className="w-full text-left px-4 py-2.5 text-sm text-slate-200 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
                            onMouseDown={()=>{upd(p.id,"name",s);setSug({id:null,list:[]});}}>
                            <Search size={14} className="text-slate-400 shrink-0"/> <span className="truncate">{s}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {players.length>2&&<button onClick={()=>rmP(p.id)} className="p-1.5 sm:p-2 rounded-lg border border-rose-500/0 hover:border-rose-500/20 hover:bg-rose-500/10 text-rose-400/80 hover:text-rose-400 transition-all shrink-0"><Trash2 size={14}/></button>}
                </div>
                <TwoWayInput chipValue={cv} chips={p.chips} money={p.money} chipLabel={null} moneyLabel={null}
                  onChange={({chips,money})=>{upd(p.id,"chips",chips);upd(p.id,"money",money);}} />
              </div>
            ))}
          </div>
        </div>
        
        {error && <Err msg={error}/>}
        <div className="pt-2">
          <Btn onClick={handleStart} full variant="primary" className="py-2.5 sm:py-4 shadow-theme-500/30 text-sm sm:text-base shadow-[0_8px_30px_rgba(16,185,129,0.3)]"><Play size={16} fill="currentColor"/> Start Ledger</Btn>
        </div>
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
    const net=round2(chipMon-p.cashInvested);
    setLCalc({name:p.name,fc,chipMon,invested:p.cashInvested,net}); setLStep(2);
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
      up=up.map(p=> p.id===lDestP ? {...p, cashInvested: round2(p.cashInvested + lCalc.chipMon)} : p);
      txns.push({type:"leave-transfer",player:lCalc.name,to:dest.name,chips:lCalc.fc,money:lCalc.chipMon,time:Date.now()});
    }

    let settledWithName = null;
    if(Math.abs(lCalc.net)>=0.5&&lSetP) {
      up = up.map(p => p.id === lSetP ? {...p, cashInvested: round2(p.cashInvested + lCalc.net)} : p);
      const sw=up.find(x=>x.id===lSetP);
      settledWithName = sw.name;
      if(lCalc.net>0) txns.push({type:"leave-settle",from:sw.name,to:lCalc.name,amount:round2(lCalc.net),time:Date.now()});
      else txns.push({type:"leave-settle",from:lCalc.name,to:sw.name,amount:round2(Math.abs(lCalc.net)),time:Date.now()});
    }

    const ulp=game.players.find(x=>x.id===lp);
    const left={...ulp, finalChips:lCalc.fc, net:lCalc.net, settledWith: settledWithName};
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
    <div className="animate-fade-in w-full max-w-3xl mx-auto px-4 py-4 sm:py-8 pb-32 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 sm:mb-6">
        <div className="pr-12 sm:pr-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Coins size={24} className="text-theme-400" />
            Poker Ledger
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-1.5">
            <span className="bg-theme-500/20 text-theme-400 px-1.5 py-0.5 rounded border border-theme-500/20">{game.players.length} active</span>
            <span>&middot;</span> 
            <span>{CURRENCY}{game.chipValue}/chip</span>
          </p>
        </div>
        
        <div className="text-right px-4 py-3 rounded-2xl glass-panel relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80 mb-0.5">Total Pot</p>
          <p className="text-2xl font-bold text-amber-400 font-mono tracking-tight drop-shadow-md">{CURRENCY}{total.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap">
        <button onClick={()=>open("add")} className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all shadow-[0_4px_14px_rgba(59,130,246,0.1)] hover:-translate-y-0.5">
          <UserPlus size={16}/> Add Player
        </button>
        {game.players.length>1&&
          <button onClick={()=>open("leave")} className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-all shadow-[0_4px_14px_rgba(249,115,22,0.1)] hover:-translate-y-0.5">
            <LogOut size={16}/> Player Leaving
          </button>
        }
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mb-5">
        {game.players.map((p,i)=>{
          const handlers = useSwipeable({
            onSwipedLeft: () => { setLp(p.id); open("leave"); haptic(); },
            onSwipedRight: () => { setBuyPlayer(p.id); open("add"); haptic(); },
            preventScrollOnSwipe: true,
            delta: 50
          });
          return (
          <div {...handlers} key={p.id} className="relative group isolate animate-slide-up" style={{animationDelay:`${i*50}ms`}}>
            <div className="absolute inset-y-0 left-0 w-1/2 bg-blue-500/20 rounded-xl sm:rounded-2xl opacity-0"></div>
            <div className="absolute inset-y-0 right-0 w-1/2 bg-orange-500/20 rounded-xl sm:rounded-2xl opacity-0"></div>
            <div className="flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card relative z-10 transition-transform active:scale-[0.98] w-full">
              {avatar(p.name, i, "w-10 h-10", "text-sm font-bold")}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">Invested</p>
            </div>
            <p className="text-base font-bold text-amber-400 font-mono drop-shadow-sm bg-slate-950/40 px-2.5 py-1 rounded-lg border border-amber-500/20" key={p.cashInvested}>
              <AnimatedNumber value={p.cashInvested} prefix={CURRENCY} />
            </p>
            </div>
          </div>
        )})}
      </div>

      <div className="space-y-4 max-w-2xl">
        {lpData.length>0&&(
          <details className="group glass-panel rounded-2xl border-white/5 overflow-hidden">
            <summary className="text-sm font-semibold cursor-pointer p-4 sm:p-5 flex items-center gap-2.5 text-slate-300 hover:text-slate-100 transition-colors select-none">
              <ChevronDown size={18} className="text-slate-500 group-open:rotate-180 transition-transform duration-300"/> 
              Players who left ({lpData.length})
            </summary>
            <div className="p-4 sm:p-5 pt-0 space-y-2 border-t border-white/5">
              {lpData.map((p,i)=>(
                <div key={i} className="flex items-center gap-3 sm:gap-4 rounded-xl px-4 py-3 text-sm bg-slate-900/50 border border-white/5">
                  <span className="font-semibold text-slate-200">{p.name}</span><div className="flex-1 border-b border-dashed border-white/10 mx-2"/>
                  <span className={`font-mono font-bold ${p.net>=0?'text-theme-400 bg-theme-400/10':'text-rose-400 bg-rose-400/10'} px-2.5 py-1 rounded-md`}>
                    {p.net>=0?"+":""}{CURRENCY}{round2(p.net).toLocaleString()}
                  </span>
                  {p.settledWith&&<span className="text-xs text-slate-500 font-medium">with {p.settledWith}</span>}
                </div>
              ))}
            </div>
          </details>
        )}

        {game.transactions.length>0&&(
          <details className="group glass-panel rounded-2xl border-white/5 overflow-hidden" open>
            <summary className="text-sm font-semibold cursor-pointer p-4 sm:p-5 flex items-center gap-2.5 text-slate-300 hover:text-slate-100 transition-colors select-none">
              <ChevronDown size={18} className="text-slate-500 group-open:rotate-180 transition-transform duration-300"/> 
              Transaction Log ({game.transactions.length})
            </summary>
            <div className="p-4 sm:p-5 pt-0 border-t border-white/5">
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 no-scrollbar">
                {[...game.transactions].reverse().map((t,i)=>(
                  <div key={i} className="text-xs sm:text-sm px-4 py-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-400 flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-slate-600"/>
                    <div>
                      {t.type==="initial"&&<><span className="font-semibold text-theme-400">{t.player}</span> bought in: <span className="font-mono">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)})</>}
                      {t.type==="bank-buy-in"&&<><span className="font-semibold text-blue-400">{t.player}</span> bank buy-in: <span className="font-mono">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)})</>}
                      {t.type==="transfer"&&<><span className="font-semibold text-orange-400">{t.seller}</span> sold <span className="font-mono text-slate-300">{round2(t.chips)}</span> chips to <span className="font-semibold text-purple-400">{t.buyer}</span> ({CURRENCY}{round2(t.money)})</>}
                      {t.type==="add-transfer"&&<><span className="font-semibold text-theme-400">{t.player}</span> joined via <span className="font-semibold text-orange-400">{t.from}</span>: <span className="font-mono px-1 bg-slate-800 rounded">{round2(t.chips)} chips</span> ({CURRENCY}{round2(t.money)})</>}
                      {t.type==="leave-bank-return"&&<><span className="font-semibold text-orange-400">{t.player}</span> returned <span className="font-mono text-slate-300">{round2(t.chips)}</span> chips to bank</>}
                      {t.type==="leave-transfer"&&<><span className="font-semibold text-orange-400">{t.player}</span> gave <span className="font-mono text-slate-300">{round2(t.chips)}</span> chips to <span className="font-semibold text-blue-400">{t.to}</span></>}
                      {t.type==="leave-settle"&&<><span className="font-semibold text-rose-400">{t.from}</span> pays <span className="font-semibold text-theme-400">{t.to}</span> <span className="font-mono font-bold text-amber-400">{CURRENCY}{round2(t.amount)}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-12 pb-6 sm:pb-8 px-4">
        <div className="flex gap-2 sm:gap-4 max-w-3xl mx-auto">
          <Btn onClick={()=>open("buy")} variant="primary" full className="shadow-theme-500/20 whitespace-nowrap px-2 sm:px-5"><Landmark size={18} className="shrink-0"/> <span className="hidden sm:inline">Bank</span> Buy-in</Btn>
          <Btn onClick={()=>open("transfer")} variant="secondary" full className="border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.4)] whitespace-nowrap px-2 sm:px-5"><ArrowRightLeft size={18} className="shrink-0"/> Transfer</Btn>
          <Btn onClick={onSettle} variant="amber" full className="shadow-amber-500/20 whitespace-nowrap px-2 sm:px-5"><Calculator size={18} className="shrink-0"/> Settle <span className="hidden sm:inline">Up</span></Btn>
        </div>
      </div>

      {/* Modals remain mostly identical in layout but updated to Tailwind */}
      <Modal open={modal==="buy"} onClose={reset} title="Bank Buy-in" icon={<div className="p-2 bg-theme-500/20 rounded-lg text-theme-400"><Landmark size={20}/></div>}>
        <div className="space-y-6">
          <PSelect players={game.players} value={buyPlayer} onChange={setBuyPlayer} label="Player"/>
          <TwoWayInput chipValue={game.chipValue} chips={buyAmt.chips} money={buyAmt.money} onChange={setBuyAmt}/>
          <Err msg={err}/>
          <Btn onClick={submitBuy} full variant="primary" className="mt-2"><Check size={18}/> Confirm Buy-in</Btn>
        </div>
      </Modal>

      <Modal open={modal==="transfer"} onClose={reset} title="Player Transfer" icon={<div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><ArrowRightLeft size={20}/></div>}>
        <div className="space-y-6">
          <PSelect players={game.players} value={tSeller} onChange={setTSeller} exclude={tBuyer} label="Seller (giving chips)"/>
          <PSelect players={game.players} value={tBuyer} onChange={setTBuyer} exclude={tSeller} label="Buyer (receiving chips)"/>
          <TwoWayInput chipValue={game.chipValue} chips={tAmt.chips} money={tAmt.money} onChange={setTAmt}/>
          <Err msg={err}/>
          <Btn onClick={submitTransfer} full variant="primary" className="mt-2"><Check size={18}/> Confirm Transfer</Btn>
        </div>
      </Modal>

      <Modal open={modal==="add"} onClose={reset} title="Add Player" icon={<div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><UserPlus size={20}/></div>}>
        <div className="space-y-6">
          <div className="relative">
            <label className="text-xs font-semibold mb-2.5 block tracking-wider uppercase text-slate-400">Player name</label>
            <input value={newName} onChange={e=>{setNewName(e.target.value);showNS(e.target.value);}} onBlur={()=>setTimeout(()=>setNameSug([]),200)}
              placeholder="Name" className="w-full rounded-xl px-4 py-3.5 text-base glass-input"/>
            {nameSug.length>0&&(
              <div className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-20 glass-panel border-white/20 p-1 shadow-2xl">
                {nameSug.map(s=><button key={s} className="w-full text-left px-4 py-2.5 text-sm text-slate-200 rounded-lg hover:bg-white/10 transition-colors"
                  onMouseDown={()=>{setNewName(s);setNameSug([]);}}>{s}</button>)}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold mb-3 block tracking-wider uppercase text-slate-400">Getting chips from</label>
            <Toggle value={newSrc} onChange={setNewSrc} options={[["bank","Bank",Building2,"theme"],["player","Player",Users,"purple"]]}/>
          </div>
          {newSrc==="player"&&<PSelect players={game.players} value={newSrcPlayer} onChange={setNewSrcPlayer} label="Selling player"/>}
          <TwoWayInput chipValue={game.chipValue} chips={newAmt.chips} money={newAmt.money} onChange={setNewAmt} chipLabel="Buy-in chips" moneyLabel={`Buy-in (${CURRENCY})`}/>
          <Err msg={err}/>
          <Btn onClick={submitAdd} full variant="blue" className="mt-2"><UserPlus size={18}/> Add to Game</Btn>
        </div>
      </Modal>

      <Modal open={modal==="leave"} onClose={reset} title="Player Leaving" icon={<div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><LogOut size={20}/></div>}>
        {lStep===1?(
          <div className="space-y-6">
            <PSelect players={game.players} value={lp} onChange={setLp} label="Who is leaving?"/>
            <div>
              <label className="text-xs font-semibold mb-2.5 block tracking-wider uppercase text-slate-400">Their final chip count</label>
              <input type="number" value={lChips} onChange={e=>setLChips(e.target.value)} placeholder="0"
                className="w-full rounded-xl px-4 py-3.5 text-base glass-input font-mono"/>
            </div>
            <div>
              <label className="text-xs font-semibold mb-3 block tracking-wider uppercase text-slate-400">What happens to their chips?</label>
              <Toggle value={lDest} onChange={setLDest} options={[["bank","Return to Bank",Building2,"theme"],["player","Give to Player",Users,"purple"]]}/>
            </div>
            {lDest==="player"&&lp&&<PSelect players={game.players} value={lDestP} onChange={setLDestP} exclude={lp} label="Who gets the chips?"/>}
            <Err msg={err}/>
            <Btn onClick={calcLeave} full variant="amber" className="mt-2"><ArrowRight size={18}/> Calculate Settlement</Btn>
          </div>
        ):(
          <div className="space-y-6 animate-slide-up">
            <div className="rounded-2xl p-6 glass-card bg-slate-900/60 border-white/10">
              <p className="text-base font-bold mb-4 text-slate-100 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400"/> {lCalc.name}&apos;s settlement
              </p>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex justify-between items-center"><span>Final chips</span><span className="font-mono bg-slate-800/50 px-2 py-0.5 rounded text-slate-200">{lCalc.fc}</span></div>
                <div className="flex justify-between items-center"><span>Chip value</span><span className="font-mono text-amber-400/90">{CURRENCY}{lCalc.chipMon.toLocaleString()}</span></div>
                <div className="flex justify-between items-center"><span>Cash invested</span><span className="font-mono text-slate-200">{CURRENCY}{lCalc.invested.toLocaleString()}</span></div>
                <div className="flex justify-between pt-4 mt-4 border-t border-white/10">
                  <span className="font-bold text-slate-200">Net balance</span>
                  <span className={`font-mono text-base font-bold bg-slate-950/50 px-3 py-1 rounded-lg border ${lCalc.net>0?'text-theme-400 border-theme-500/20':lCalc.net<0?'text-rose-400 border-rose-500/20':'text-slate-400 border-white/10'}`}>
                    {lCalc.net>=0?"+":""}{CURRENCY}{round2(lCalc.net).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            {Math.abs(lCalc.net)>=0.5?(
              <>
                <div className={`rounded-xl px-5 py-4 text-sm font-medium border shadow-inner ${lCalc.net>0?'bg-theme-500/10 border-theme-500/20 text-theme-300':'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                  {lCalc.net>0?`${lCalc.name} is owed ${CURRENCY}${round2(lCalc.net).toLocaleString()}. Who pays?`:`${lCalc.name} owes ${CURRENCY}${round2(Math.abs(lCalc.net)).toLocaleString()}. Who gets paid?`}
                </div>
                <PSelect players={game.players} value={lSetP} onChange={setLSetP} exclude={lp} label={lCalc.net>0?"Who pays them?":"Who do they pay?"}/>
              </>
            ):(
              <div className="rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3 bg-theme-500/10 border border-theme-500/30 text-theme-300 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]">
                <div className="bg-theme-500/20 p-1.5 rounded-full"><Check size={16}/></div> {lCalc.name} is exactly even.
              </div>
            )}
            <Err msg={err}/>
            <div className="flex gap-3 mt-2">
              <Btn onClick={()=>{setLStep(1);setErr("");}} variant="secondary" className="flex-1"><RotateCcw size={16}/> Back</Btn>
              <Btn onClick={submitLeave} variant="amber" className="flex-[2]"><Check size={18}/> Confirm & Remove</Btn>
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
  const tf = Object.values(fc).reduce((s,v)=>s+(parseFloat(v)||0),0);
  const remaining = round2(tb - tf);

  const calc = () => {
    setWarning("");
    if(Math.abs(tf-tb)>0.5) setWarning(`Chip mismatch! Final (${round2(tf)}) ≠ bank (${round2(tb)}). Diff: ${round2(Math.abs(tf-tb))}`);
    const bal = game.players.map(p=>{const f=parseFloat(fc[p.id])||0;return{name:p.name,balance:round2(f*game.chipValue-p.cashInvested),finalChips:f,invested:p.cashInvested};});
    const winnerName = bal.reduce((m,x)=>x.balance>m.balance?x:m, bal[0])?.balance > 0 ? bal.reduce((m,x)=>x.balance>m.balance?x:m, bal[0]).name : null;
    setResult({balances:bal,settlements:computeSettlements(bal), winner: winnerName});
  };
  const lpData=game.leftPlayers||[];

  const receiptRef = useRef(null);
  const shareReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(receiptRef.current, { backgroundColor: '#020617', style: { padding: '20px' } });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'poker-ledger-receipt.png', { type: blob.type });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Poker Ledger Settlement',
          text: 'Here is our final poker settlement!',
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.download = 'poker-ledger-receipt.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (e) {
      console.error('Failed to generate receipt', e);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <div className="flex items-center gap-4 sm:gap-5 mb-10 pr-12 sm:pr-0">
        <button onClick={onBack} className="p-3 sm:p-3.5 rounded-xl transition-all border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 hover:text-white glass-panel"><RotateCcw size={20}/></button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">Settle Up</h1>
          <p className="text-sm font-medium mt-1 text-slate-400">
            Chips to account for: <span className={`font-mono ${remaining === 0 ? 'text-theme-400' : remaining < 0 ? 'text-rose-400' : 'text-amber-400'}`}>{round2(remaining)}</span> <span className="text-slate-500 text-xs ml-1">(of {round2(tb)})</span>
          </p>
        </div>
      </div>

      {!result?(
        <div className="space-y-8 glass-panel p-5 sm:p-8 rounded-[2rem]">
          <p className="text-sm sm:text-base font-semibold text-slate-300">Enter each player's final chip count:</p>
          <div className="space-y-4">
          {game.players.map((p,i)=>(
            <div key={p.id} className="flex items-center gap-4 sm:gap-5 rounded-[1.5rem] px-5 sm:px-6 py-4 sm:py-5 glass-card animate-slide-up" style={{animationDelay:`${i*50}ms`}}>
              {avatar(p.name, i, "w-10 h-10 sm:w-12 sm:h-12", "text-sm sm:text-base font-bold")}
              <div className="flex-1 min-w-0">
                <span className="text-base sm:text-lg font-bold text-slate-100 truncate block">{p.name}</span>
                <p className="text-xs font-medium mt-0.5 text-slate-400 uppercase tracking-wider">Inv: <span className="font-mono ml-1">{CURRENCY}{p.cashInvested.toLocaleString()}</span></p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <input type="number" value={fc[p.id]} onChange={e=>setFc(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                  className="w-20 sm:w-28 rounded-xl px-3 sm:px-4 py-3 text-base text-right glass-input font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"/>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0 hidden sm:block">chips</span>
              </div>
            </div>
          ))}
          </div>
          {warning&&<div className="flex items-start gap-3 px-5 py-4 rounded-xl text-sm font-medium animate-fade-in bg-amber-500/10 border border-amber-500/20 text-amber-300"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><span>{warning}</span></div>}
          <div className="pt-2">
            <Btn onClick={calc} full variant="amber" className="py-4 text-base"><Calculator size={20}/> Calculate Settlement</Btn>
          </div>
        </div>
      ):(
        <div className="space-y-8 animate-slide-up">
          <div ref={receiptRef} className="glass-panel p-5 sm:p-8 rounded-[2rem]">
            <h2 className="text-sm font-semibold mb-5 tracking-wider uppercase text-slate-400">Player balances</h2>
            <div className="space-y-3">{result.balances.map((b,i)=>(
              <div key={b.name} className={`flex items-center gap-4 rounded-[1.5rem] px-5 py-4 animate-slide-up border relative overflow-hidden ${b.name===result.winner?'bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30':b.balance>0?'bg-theme-500/5 border-theme-500/20':b.balance<0?'bg-rose-500/5 border-rose-500/20':'bg-white/5 border-white/10'}`} style={{animationDelay:`${i*60}ms`}}>
                {b.name===result.winner && <div className="absolute top-0 right-0 p-1.5 bg-amber-500/20 text-amber-400 rounded-bl-[0.75rem] backdrop-blur-md border-b border-l border-amber-500/30"><Crown size={14} /></div>}
                <span className="text-base sm:text-lg font-bold flex-1 text-slate-100 truncate">{b.name}</span>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-400"><span className="font-mono">{b.finalChips}</span> chips &middot; Inv. {CURRENCY}{b.invested.toLocaleString()}</p>
                  <p className={`text-lg font-bold mt-1 font-mono ${b.balance>0?'text-theme-400':b.balance<0?'text-rose-400':'text-slate-400'}`}>
                    {b.balance>=0?"+":""}{CURRENCY}{round2(b.balance).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}</div>
          </div>

          {warning&&<div className="flex items-start gap-3 px-5 py-4 rounded-xl text-sm font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><span>{warning}</span></div>}

          {lpData.length>0&&(
            <div className="glass-panel p-5 sm:p-8 rounded-[2rem]">
              <h2 className="text-sm font-semibold mb-4 tracking-wider uppercase text-slate-400">Already settled (left earlier)</h2>
              <div className="space-y-2">{lpData.map((p,i)=>(
                <div key={i} className="flex items-center gap-3 sm:gap-4 rounded-xl px-5 py-3.5 text-sm bg-slate-900/60 border border-white/5 text-slate-300">
                  <span className="font-semibold text-slate-100">{p.name}</span><div className="flex-1 border-b border-dashed border-white/10 mx-2"/>
                  <span className={`font-mono font-bold ${p.net>=0?'text-theme-400':'text-rose-400'}`}>{p.net>=0?"+":""}{CURRENCY}{round2(p.net).toLocaleString()}</span>
                  {p.settledWith&&<span className="text-xs text-slate-500">w/ {p.settledWith}</span>}
                </div>
              ))}</div>
            </div>
          )}

          <div className="glass-panel p-5 sm:p-8 rounded-[2rem] bg-gradient-to-b from-indigo-950/40 to-slate-900/60 shadow-[0_0_40px_rgba(79,70,229,0.1)] border-indigo-500/20">
            <h2 className="text-base font-bold mb-6 flex items-center gap-3 text-indigo-200">
              <Sparkles size={20} className="text-amber-400"/> Settlements ({result.settlements.length} transaction{result.settlements.length!==1?"s":""})
            </h2>
            {result.settlements.length===0?<div className="py-8 text-center border border-dashed border-white/10 rounded-2xl"><p className="text-base font-medium text-theme-400">Everyone is even! 🎉</p></div>:(
              <div className="space-y-3">{result.settlements.map((s,i)=>(
                <div key={i} className="flex items-center gap-3 sm:gap-4 rounded-2xl px-5 py-4 animate-slide-up bg-slate-900/80 border border-indigo-500/30 shadow-lg" style={{animationDelay:`${i*80}ms`}}>
                  <span className="text-sm sm:text-base font-bold shrink-0 text-rose-400 w-20 sm:w-28 truncate">{s.from}</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center min-w-0">
                    <div className="h-px flex-1 bg-indigo-500/30"/>
                    <span className="text-sm font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]">
                      {CURRENCY}{s.amount.toLocaleString()}
                    </span>
                    <ArrowRight size={14} className="text-indigo-400 shrink-0"/>
                    <div className="h-px flex-1 bg-indigo-500/30"/>
                  </div>
                  <span className="text-sm sm:text-base font-bold shrink-0 text-theme-400 w-20 sm:w-28 truncate text-right">{s.to}</span>
                </div>
              ))}</div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
            <Btn onClick={()=>setResult(null)} variant="secondary" className="flex-1 py-3 text-sm sm:text-base"><RotateCcw size={18}/> Re-enter</Btn>
            <Btn onClick={()=>{haptic(); shareReceipt();}} variant="primary" className="flex-1 py-3 text-sm sm:text-base"><Download size={18}/> Share Receipt</Btn>
            <Btn onClick={onReset} variant="danger" className="flex-1 py-3 text-sm sm:text-base"><Trash2 size={18}/> New Game</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSwitcher() {
  const THEMES = ["emerald", "gold", "sapphire", "amethyst"];
  const themeColors = {emerald:"bg-[#10b981]", gold:"bg-[#f59e0b]", sapphire:"bg-[#3b82f6]", amethyst:"bg-[#a855f7]"};
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "emerald");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // wait, where do I put it? absolute top-3 right-14 ?
  return (
    <div className="absolute top-3 right-16 sm:top-5 sm:right-20 z-50">
      <button onClick={()=>{haptic(); setOpen(!open)}} className={`p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:bg-white/10 transition-all shadow-lg backdrop-blur-md ${open?'bg-white/10 ring-2 ring-white/20':''}`}>
        <Palette size={18} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 p-2 rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[120px] animate-slide-up origin-top-right">
          {THEMES.map(t => (
            <button key={t} onClick={()=>{haptic(); setTheme(t); setOpen(false);}} className={`flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors ${theme===t?'bg-white/5':''}`}>
              <span className="text-xs font-semibold text-slate-200 capitalize">{t}</span>
              <div className={`w-3 h-3 rounded-full ${themeColors[t]}`} />
            </button>
          ))}
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
  const [exitPrompt, setExitPrompt]=useState(false);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-theme-500 z-50">
      <Coins size={48} className="animate-bounce" />
      <div className="mt-4 text-slate-500 font-medium tracking-widest uppercase text-sm animate-pulse">Loading Ledger...</div>
    </div>
  );

  return (
    <>
      <div className="bg-glow-container">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
      </div>
      
      <div className="relative min-h-screen pt-2 sm:pt-0">
        {phase!=="loading"&&phase!=="setup"&&(
          <>
            <button onClick={()=>{haptic(); setExitPrompt(true);}} className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-[0_4px_15px_rgba(244,63,94,0.2)] backdrop-blur-md">
              <LogOut size={18} />
            </button>
            <ThemeSwitcher />
          </>
        )}
        {phase==="setup"&&<SetupScreen onStart={handleStart} savedNames={savedNames}/>}
        {phase==="game"&&game&&<DashboardScreen game={game} setGame={setGame} onSettle={()=>setPhase("settle")} savedNames={savedNames}/>}
        {phase==="settle"&&game&&<SettleScreen game={game} onBack={()=>setPhase("game")} onReset={()=>setExitPrompt(true)}/>}

        <Modal open={exitPrompt} onClose={()=>setExitPrompt(false)} title="End Game?" icon={<div className="p-2 bg-rose-500/20 rounded-lg text-rose-400"><AlertTriangle size={20}/></div>}>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">Are you sure you want to completely end this game and return to the home screen? All current game data will be lost permanently.</p>
          <div className="flex gap-3">
            <Btn onClick={()=>setExitPrompt(false)} variant="secondary" className="flex-1">Cancel</Btn>
            <Btn onClick={()=>{setExitPrompt(false);handleReset();}} variant="danger" className="flex-1">End Game</Btn>
          </div>
        </Modal>
      </div>
    </>
  );
}
