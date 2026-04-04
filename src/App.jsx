import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import SlotCounter from "react-slot-counter";
import * as htmlToImage from "html-to-image";
import {
  Plus, Trash2, ArrowRightLeft, Landmark, Calculator, X,
  Coins, AlertTriangle, Check, ChevronDown, Play,
  RotateCcw, ArrowRight, Sparkles, Search, UserPlus, MoreVertical,
  LogOut, Building2, Users, Palette, Crown, Download, Share2,
  Link2, Wifi, WifiOff, Copy, ExternalLink,
  History, QrCode, Clock, ChevronRight, Smartphone
} from "lucide-react";
import {
  createSession, joinSession, updateSessionGame,
  listenToSession, deleteSession, isFirebaseReady,
  getSessionUrl, getSessionIdFromUrl
} from "./firebase.js";
import './App.css';

const GAME_KEY = "poker-ledger-game";
const NAMES_KEY = "poker-ledger-names";
const HISTORY_KEY = "poker-ledger-history";
const UPI_KEY = "poker-ledger-upi";
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
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};

function round2(n) { return Math.round(n * 100) / 100; }
let _pid = 100;
function pid() { return String(_pid++); }

const haptic = () => { try { if(navigator.vibrate) navigator.vibrate(40); } catch { /* ignore */ } };

function computeSettlements(netBalances) {
  // Clone balances to avoid mutating the original objects used for display
  const b = netBalances.map(x => ({ ...x, balance: round2(x.balance) }));
  const out = [];
  const p = b.filter(x => x.balance > 0.01).sort((a,b)=>b.balance-a.balance);
  const n = b.filter(x => x.balance < -0.01).sort((a,b)=>a.balance-b.balance);

  let pi=0; let ni=0;
  while(pi < p.length && ni < n.length) {
    const amt = Math.min(p[pi].balance, Math.abs(n[ni].balance));
    if (amt > 0.01) {
      out.push({ from: n[ni].name, to: p[pi].name, amount: round2(amt) });
    }
    p[pi].balance = round2(p[pi].balance - amt);
    n[ni].balance = round2(n[ni].balance + amt);
    if(p[pi].balance <= 0.01) pi++;
    if(Math.abs(n[ni].balance) <= 0.01) ni++;
  }
  return out;
}

function TwoWayInput({ chipValue, chips, money, onChange, chipLabel, moneyLabel, maxChips }) {
  const [focus, setFocus] = useState(null);
  const [cStr, setCStr] = useState(chips > 0 ? String(chips) : "");
  const [mStr, setMStr] = useState(money > 0 ? String(money) : "");

  useEffect(() => {
    let focusTimer;
    if (focus !== "c") {
      focusTimer = setTimeout(() => setCStr(chips > 0 ? String(round2(chips)) : ""), 0);
    }
    if (focus !== "m") {
      focusTimer = setTimeout(() => setMStr(money > 0 ? String(round2(money)) : ""), 0);
    }
    return () => clearTimeout(focusTimer);
  }, [chips, money, focus]);

  const onC = e => {
    const v = e.target.value; setCStr(v); setFocus("c");
    let n = parseFloat(v) || 0;
    if (maxChips != null && n > maxChips) { n = round2(maxChips); setCStr(String(n)); }
    const m = round2(n * chipValue); setMStr(m > 0 ? String(m) : ""); onChange({ chips: n, money: m });
  };
  const onM = e => {
    const v = e.target.value; setMStr(v); setFocus("m");
    let money = parseFloat(v) || 0;
    const maxMoney = maxChips != null ? round2(maxChips * chipValue) : null;
    if (maxMoney != null && money > maxMoney) { money = maxMoney; setMStr(String(money)); }
    const c = chipValue > 0 ? round2(money / chipValue) : 0; setCStr(c > 0 ? String(c) : ""); onChange({ chips: c, money });
  };

  const adjustC = delta => {
    const current = parseFloat(cStr) || 0;
    let n = Math.max(0, current + delta);
    if (maxChips != null) n = Math.min(maxChips, n);
    setCStr(n > 0 ? String(n) : "");
    const m = round2(n * chipValue);
    setMStr(m > 0 ? String(m) : "");
    onChange({ chips: n, money: m });
  };

  const atMax = maxChips != null && (parseFloat(cStr) || 0) >= maxChips;

  return (
    <div className="flex items-end gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        {chipLabel !== null && <label className="text-[10px] sm:text-xs font-semibold mb-1.5 block tracking-wider uppercase text-slate-400">{chipLabel || "Chips"}</label>}
        <div className="relative group flex items-center">
          <button onClick={()=>{haptic(); adjustC(-10)}} className="absolute left-1 z-10 w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors font-bold">-</button>
          <input type="number" value={cStr} onChange={onC} onFocus={()=>setFocus("c")} onBlur={()=>setFocus(null)} placeholder="0"
            className={`w-full rounded-xl px-7 text-center py-2 text-sm glass-input font-mono ${focus === "c" ? "focus:ring-theme-500/20 focus:border-theme-500/50" : ""}`} />
          <button onClick={()=>{if(atMax) return; haptic(); adjustC(10);}} disabled={atMax}
            className={`absolute right-1 z-10 w-7 h-7 flex items-center justify-center rounded-md transition-colors font-bold ${atMax ? "text-slate-700 cursor-not-allowed" : "hover:bg-white/10 text-slate-400 hover:text-slate-200"}`}>+</button>
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
      <div className="absolute inset-0 bg-slate-950/80 animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto glass-panel animate-slide-up shadow-[0_0_40px_rgba(0,0,0,0.5)]" style={{willChange:'transform'}}>
        <div className="flex items-center gap-3 px-6 py-5 sticky top-0 z-10 bg-slate-900/95 border-b border-white/5">
          {icon}
          <h3 className="text-lg font-semibold flex-1 text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 text-slate-400 transition-all"><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function PSelect({ players, value, onChange, exclude, label, showEndOption }) {
  const exc = Array.isArray(exclude) ? exclude : exclude ? [exclude] : [];
  return (
    <div>
      <label className="text-xs font-semibold mb-2.5 block tracking-wider uppercase text-slate-400">{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3.5 text-sm sm:text-base glass-input text-slate-200 cursor-pointer">
        <option value="" className="bg-slate-900 text-slate-400">Select...</option>
        {players.filter(p=>!exc.includes(p.id)).map(p=><option key={p.id} value={p.id} className="bg-slate-800 text-slate-100">{p.name}</option>)}
        {showEndOption && <option value="end-game" className="bg-slate-800 text-amber-400">Settle at end of game</option>}
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
      {options.map(([val, lbl, iComp, activeColor]) => {
        const IconComponent = iComp;
        return (
          <button key={val} onClick={()=>onChange(val)}
            className={`flex-1 flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl px-3 py-3 text-xs sm:text-sm font-medium transition-all duration-300 border ${
              value === val 
              ? `bg-${activeColor}-500/15 border-${activeColor}-500/30 text-${activeColor}-400 shadow-[inset_0_0_12px_rgba(0,0,0,0.2)]` 
              : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}>
            <IconComponent size={16}/> <span className="truncate">{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}

const Avatar = memo(({ name, i, size="w-10 h-10", textSize="text-sm font-bold" }) => {
  return (
    <div className={`${size} rounded-full flex items-center justify-center ${textSize} shrink-0 bg-slate-800 border border-white/5 text-slate-300 shadow-inner`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
});

const SwipeableCard = memo(({ p, i, onSwipeLeft, onSwipeRight, onSettle }) => {
  const cardRef = useRef(null);
  const leftBgRef = useRef(null);
  const rightBgRef = useRef(null);
  const isDragging = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const resetSwipe = () => {
    isDragging.current = false;
    if (cardRef.current) {
      cardRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      cardRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }
    if (leftBgRef.current) leftBgRef.current.style.opacity = '0';
    if (rightBgRef.current) rightBgRef.current.style.opacity = '0';
  };

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !isDragging.current) return;
      isDragging.current = true;
      const x = Math.max(-100, Math.min(100, e.deltaX));
      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(${x}px, 0px, 0px)`;
        cardRef.current.style.transition = 'none';
      }
      if (leftBgRef.current) leftBgRef.current.style.opacity = x > 20 ? '1' : '0';
      if (rightBgRef.current) rightBgRef.current.style.opacity = x < -20 ? '1' : '0';
    },
    onSwipedLeft: (e) => { if (e.deltaX < -50) onSwipeLeft(p.id); resetSwipe(); },
    onSwipedRight: (e) => { if (e.deltaX > 50) onSwipeRight(p.id); resetSwipe(); },
    onSwiped: () => resetSwipe(),
    preventScrollOnSwipe: false,
    trackMouse: true,
    delta: 20
  });

  return (
    <div {...handlers} className="relative group isolate overflow-hidden rounded-xl sm:rounded-2xl animate-slide-up bg-slate-800/40" style={{animationDelay:`${i*50}ms`, touchAction: 'pan-y'}}>
      <div ref={leftBgRef} className="absolute inset-y-0 left-0 w-1/2 bg-blue-500/20 text-blue-400 flex items-center pl-4 sm:pl-5 font-bold transition-opacity duration-200" style={{opacity: 0}}>
        <UserPlus size={20} className="mr-2"/> Buy-in
      </div>
      <div ref={rightBgRef} className="absolute inset-y-0 right-0 w-1/2 bg-rose-500/20 text-rose-400 flex items-center justify-end pr-4 sm:pr-5 font-bold transition-opacity duration-200" style={{opacity: 0}}>
        Exiting <LogOut size={20} className="ml-2"/>
      </div>
      <div ref={cardRef} onClick={() => onSwipeRight(p.id)} className="flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card relative z-10 w-full cursor-pointer transition-transform duration-300">
        <Avatar name={p.name} i={i} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">Invested</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex text-base font-bold text-amber-400 font-mono drop-shadow-sm bg-slate-950/40 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span className="mr-0.5">{CURRENCY}</span>
            <SlotCounter value={p.cashInvested.toLocaleString()} charClassName="text-amber-400 font-mono text-base font-bold" debounceDelay={1} />
          </div>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className={`p-1.5 rounded-lg transition-all ${menuOpen ? "bg-white/10 text-slate-200" : "hover:bg-white/10 text-slate-400"}`}>
              <MoreVertical size={18}/>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl z-50 animate-scale-in overflow-hidden"
                style={{background:'rgba(10,15,30,0.97)', backdropFilter:'blur(24px)', boxShadow:'0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)'}}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-0.5">Actions</p>
                  <p className="text-sm font-bold text-slate-200 truncate">{p.name}</p>
                </div>
                {/* Main actions */}
                <div className="p-1.5 space-y-0.5">
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSwipeRight(p.id); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-theme-500/10 group">
                    <div className="w-8 h-8 rounded-lg bg-theme-500/10 flex items-center justify-center shrink-0 group-hover:bg-theme-500/20 transition-colors">
                      <ArrowRightLeft size={14} className="text-theme-400"/>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-200 leading-tight">Buy-in / Transfer</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Add chips or move stacks</p>
                    </div>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSwipeLeft(p.id); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-rose-500/10 group">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 group-hover:bg-rose-500/20 transition-colors">
                      <LogOut size={14} className="text-rose-400"/>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-rose-400 leading-tight">Cash Out / Exit</p>
                      <p className="text-[10px] text-rose-400/50 leading-tight mt-0.5">Remove from this game</p>
                    </div>
                  </button>
                </div>
                {/* Settle — separated */}
                <div className="border-t border-white/[0.06] p-1.5">
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSettle(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-amber-500/10 group">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                      <Calculator size={14} className="text-amber-400"/>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-amber-400 leading-tight">Global Settle Up</p>
                      <p className="text-[10px] text-amber-400/50 leading-tight mt-0.5">End game & calculate</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
    </div>
  );
});

/* ─────────── SETUP ─────────── */
function SetupScreen({ onStart, savedNames, upiMap, onUpdateUpi }) {
  const [chipValue, setChipValue] = useState("");
  const [players, setPlayers] = useState([{id:"1",name:"",chips:0,money:0},{id:"2",name:"",chips:0,money:0},{id:"3",name:"",chips:0,money:0},{id:"4",name:"",chips:0,money:0}]);
  const [error, setError] = useState("");
  const [sug, setSug] = useState({id:null,list:[]});
  const nid = useRef(5);

  const addP = () => { setError(""); setPlayers(p=>[...p,{id:String(nid.current++),name:"",chips:0,money:0}]); };

  const quickFill = () => {
    setError("");
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
  const rmP = id => { setError(""); if(players.length>2) setPlayers(p=>p.filter(x=>x.id!==id)); };
  const upd = (id, f, v) => { setError(""); setPlayers(p => p.map(x => {
    if (x.id !== id) return x;
    const nx = { ...x, [f]: v };
    if (f === "name" && !x.name && v.trim() && nx.chips === 0) {
      nx.chips = 20;
      nx.money = round2(20 * (parseFloat(chipValue) || 5));
    }
    return nx;
  })); };

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
      players:valid.map(p=>({
        id:p.id,
        name:p.name.trim(),
        cashInvested:round2(p.chips*cv),
        upi: upiMap && upiMap[p.name.trim()] ? upiMap[p.name.trim()] : ""
      })),
      totalBankChips:valid.reduce((s,p)=>s+p.chips,0),
      leftPlayers:[],
      transactions:valid.map(p=>({type:"initial",player:p.name.trim(),chips:p.chips,money:round2(p.chips*cv),time:Date.now()})),
    });
  };

  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto px-4 py-6 sm:py-12">
      {/* ── Hero Section ── */}
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-slate-100 opacity-90">
          Poker <span className="text-theme-400">Ledger</span>
        </h1>
        <p className="text-slate-500 text-[10px] sm:text-xs font-semibold tracking-[0.1em] uppercase opacity-60">
          Home Game Tracker
        </p>
      </div>

      {/* ── Main Card ── */}
      <div className="space-y-4 glass-panel p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.4)]">
        {/* Chip Value */}
        <div className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Coins size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-amber-400/80 block mb-1">Chip Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">{CURRENCY}</span>
              <input type="number" value={chipValue} onChange={e=>{setChipValue(e.target.value);setError("");}} placeholder="5"
                className="w-full rounded-xl pl-7 pr-3 py-2 text-sm sm:text-base glass-input text-amber-400 font-mono" />
            </div>
          </div>
        </div>

        {/* Players Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-theme-400" />
            <span className="text-sm sm:text-base font-bold text-slate-200">Players</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-500/15 text-theme-400 border border-theme-500/20">{players.filter(p=>p.name.trim()).length}/{players.length}</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button onClick={quickFill} className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
              <Sparkles size={14}/> <span className="hidden sm:inline">Auto-fill</span>
            </button>
            <button onClick={addP} className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold px-3 py-2 rounded-xl border border-theme-500/30 bg-theme-500/10 hover:bg-theme-500/20 text-theme-400 transition-colors">
              <Plus size={14}/> <span className="hidden sm:inline">Add Player</span><span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className="flex items-end gap-3 sm:gap-4 px-2">
          <div className="flex-1"><label className="text-[9px] sm:text-xs font-semibold tracking-wider uppercase text-slate-500 ml-10">Name</label></div>
          <div className="flex-1"><label className="text-[9px] sm:text-xs font-semibold tracking-wider uppercase text-slate-500 ml-2">Buy-in (Chips)</label></div>
        </div>

        {/* Player Rows */}
        <div className="space-y-2">
          {players.map((p,i)=>(
            <div key={p.id} className="rounded-xl p-2 sm:p-4 glass-card animate-slide-up" style={{animationDelay: `${i * 60}ms`}}>
              <div className="flex items-start gap-2 sm:gap-4 mb-2">
                <div className="mt-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold shrink-0 bg-theme-500/10 text-theme-400 border border-theme-500/20">
                  {i+1}
                </div>
                <div className="flex-1 relative min-w-0 flex flex-col gap-2">
                  <input value={p.name} onChange={e=>{upd(p.id,"name",e.target.value);showSug(p.id,e.target.value);}}
                    onBlur={()=>setTimeout(()=>setSug({id:null,list:[]}),200)} placeholder={`Player ${i+1}`}
                    className="w-full rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-base glass-input" />
                  
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Smartphone size={12}/></span>
                    <input value={p.name ? upiMap[p.name] || "" : ""} onChange={e=>p.name && onUpdateUpi(p.name, e.target.value)} 
                      placeholder="UPI ID or Num (optional)"
                      className="w-full rounded-lg pl-8 pr-3 py-2 text-xs glass-input placeholder:text-slate-600 focus:bg-slate-900/60"
                      disabled={!p.name} />
                  </div>

                  {sug.id===p.id&&sug.list.length>0&&(
                    <div className="absolute left-0 right-0 top-[40px] mt-2 rounded-xl overflow-hidden z-20 glass-panel border-white/20 p-1">
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

        {error && <Err msg={error}/>}

        {/* Start Button */}
        <div className="pt-3">
          <Btn onClick={handleStart} full variant="primary" className="py-3.5 sm:py-4 text-base sm:text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] rounded-2xl">
            <Play size={18} fill="currentColor"/> Deal Me In
          </Btn>
        </div>
      </div>

      {/* Footer tagline */}
      <p className="text-center text-[10px] sm:text-xs text-slate-600 mt-6 font-medium tracking-wider uppercase">Built for the felt · No signup required</p>
    </div>
  );
}

/* ─────────── DASHBOARD ─────────── */
function DashboardScreen({ game, setGame, onSettle, savedNames, sessionId, viewerCount, onReverse }) {
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const [biTarget, setBiTarget] = useState(""); 
  const [biMode, setBiMode] = useState("add"); 
  const [biSources, setBiSources] = useState([{ id: Date.now(), type: "bank", player: "", chips: 0, money: 0 }]);
  const [newName,setNewName]=useState(""); 
  const [newSrc,setNewSrc]=useState("player");
  const [newSrcPlayer,setNewSrcPlayer]=useState(""); 
  const [newAmt,setNewAmt]=useState({chips:0,money:0}); 
  const [nameSug,setNameSug]=useState([]);
  const [lp,setLp]=useState("");
  const [lFinalAmount, setLFinalAmount] = useState({chips:0, money:0});
  const [lDestSources, setLDestSources] = useState([{ id: Date.now(), type: "bank", player: "", chips: 0, money: 0 }]);
  const [lStep,setLStep]=useState(1);
  const [lCalc,setLCalc]=useState(null);
  const [lSetP,setLSetP]=useState("");
  const [lSettlements, setLSettlements] = useState([{ id: Date.now(), player: "", amount: 0 }]);
  const [lSettleAtEnd, setLSettleAtEnd] = useState(false);

  const total = game.players.reduce((s,p)=>s+p.cashInvested,0);

  // Auto-clear errors when user changes any modal input
  useEffect(() => { if (err) setErr(""); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [biMode, biSources, newName, newSrc, newSrcPlayer, newAmt, lFinalAmount, lDestSources, lSettlements, lSettleAtEnd]);

  const reset = () => {
    setModal(null); setErr("");
    setBiTarget(""); setBiMode("add"); setBiSources([{ id: Date.now(), type: "player", player: "", chips: 0, money: 0 }]);
    setNewName(""); setNewSrc("player"); setNewSrcPlayer(""); setNewAmt({chips:0,money:0}); setNameSug([]);
    setLp(""); setLFinalAmount({chips:0,money:0}); setLDestSources([{ id: Date.now(), type: "bank", player: "", chips: 0, money: 0 }]); setLStep(1); setLCalc(null); setLSetP(""); setLSettlements([{ id: Date.now(), player: "", amount: 0 }]); setLSettleAtEnd(false);
  };
  const open = m => { reset(); setTimeout(()=>setModal(m),0); };
  const openBi = useCallback((id, mode = "add") => {
    setErr("");
    setBiTarget(id);
    setBiMode(mode);
    setBiSources([{ id: Date.now(), type: mode === "add" ? "player" : "bank", player: "", chips: 0, money: 0 }]);
    setModal("buyin");
  }, []);

  const submitBuyIn = () => {
    setErr("");
    if (!biTarget) return setErr("Select player");
    if (biSources.some(s => s.chips <= 0)) return setErr("All sources must have chips > 0");
    if (biSources.some(s => s.type === "player" && !s.player)) return setErr("Select source player");
    if (biSources.some(s => s.type === "player" && s.player === biTarget)) return setErr("Cannot buy from self");
    const pSources = biSources.filter(s => s.type === "player").map(s => s.player);
    if (new Set(pSources).size !== pSources.length) return setErr("Duplicate player sources");

    const target = game.players.find(p => p.id === biTarget);
    setGame(g => {
      let players = [...g.players];
      let bank = g.totalBankChips;
      let txns = [...g.transactions];
      const gid = Date.now();
      biSources.forEach(s => {
        if (s.type === "bank") {
          players = players.map(p => p.id === biTarget ? { ...p, cashInvested: round2(p.cashInvested + (biMode === "add" ? s.money : -s.money)) } : p);
          bank = round2(bank + (biMode === "add" ? s.chips : -s.chips));
          txns.push({ type: biMode === "add" ? "bank-buy-in" : "bank-return", player: target.name, chips: s.chips, money: s.money, time: Date.now(), groupId: biSources.length > 1 ? gid : null });
        } else {
          const src = g.players.find(p => p.id === s.player);
          players = players.map(p => {
            if (p.id === biTarget) return { ...p, cashInvested: round2(p.cashInvested + (biMode === "add" ? s.money : -s.money)) };
            if (p.id === s.player) return { ...p, cashInvested: round2(p.cashInvested - (biMode === "add" ? s.money : -s.money)) };
            return p;
          });
          txns.push({ 
            type: "transfer", 
            seller: biMode === "add" ? src.name : target.name,
            buyer: biMode === "add" ? target.name : src.name,
            chips: s.chips, money: s.money, time: Date.now(), groupId: biSources.length > 1 ? gid : null
          });
        }
      });
      return { ...g, players, totalBankChips: bank, transactions: txns };
    });
    reset();
  };

  const openLeave = useCallback((id) => {
    setErr("");
    setLp(id);
    setLStep(1);
    setLCalc(null);
    setLFinalAmount({chips:0, money:0});
    setLDestSources([{ id: Date.now(), type: "bank", player: "", chips: 0, money: 0 }]);
    setLSettlements([{ id: Date.now(), player: "", amount: 0 }]);
    setLSettleAtEnd(false);
    setModal("leave");
  }, []);

  const handleSwipeRight = useCallback((id) => { openBi(id, "add"); haptic(); }, [openBi]);
  const handleSwipeLeft  = useCallback((id) => { openLeave(id); haptic(); }, [openLeave]);
  const handleSettle     = useCallback(() => { onSettle(); haptic(); }, [onSettle]);

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
    if(lFinalAmount.chips <= 0) return setErr("Enter final chip count");

    const p = game.players.find(x => x.id === lp);
    const chipMon = round2(lFinalAmount.chips * game.chipValue);
    const net = round2(chipMon - p.cashInvested);

    setLCalc({ name: p.name, fc: lFinalAmount.chips, chipMon, invested: p.cashInvested, net });
    // Pre-fill destination: all chips go to bank by default
    setLDestSources([{ id: Date.now(), type: "bank", player: "", chips: lFinalAmount.chips, money: chipMon }]);
    setLSettlements([{ id: Date.now(), player: "", amount: Math.abs(net) }]);
    setLSettleAtEnd(false);
    setLStep(2);
  };

  const submitLeave = () => {
    setErr("");
    if(!lCalc) return;

    // Validate destinations sum to final chip count
    const totalDestChips = lDestSources.reduce((s,x)=>s+(x.chips||0), 0);
    if(Math.abs(totalDestChips - lCalc.fc) > 0.01) {
      return setErr(`Chip destinations must total ${lCalc.fc} chips (currently ${round2(totalDestChips)})`);
    }
    if(lDestSources.some(s => s.type === "player" && !s.player)) return setErr("Select recipient player");

    // Only validate settlement total if not settling at end
    if(!lSettleAtEnd && Math.abs(lCalc.net) > 0.5) {
      const totalSet = lSettlements.reduce((s,x)=>s+x.amount, 0);
      if(Math.abs(totalSet - Math.abs(lCalc.net)) > 1) {
        return setErr(`Settlement total must be ${CURRENCY}${Math.abs(lCalc.net)}`);
      }
      if(lSettlements.some(s => s.amount > 0 && !s.player)) return setErr("Select settlement player");
    }

    setGame(g => {
      let players = [...g.players];
      let bank = g.totalBankChips;
      let txns = [...g.transactions];

      const quitter = players.find(p=>p.id===lp);
      let settledWithName = null;
      const gid = Date.now(); // shared groupId for entire leave event

      // Snapshot BEFORE any changes (for undo)
      const bankBefore = bank;
      const playerSnapshot = players.filter(p => p.id !== lp).map(p => ({ id: p.id, name: p.name, cashInvested: p.cashInvested }));

      // Master leave-exit transaction (header of group, stores reversal data)
      txns.push({
        type: "leave-exit",
        player: quitter.name,
        playerData: { ...quitter },
        finalChips: lCalc.fc,
        finalValue: lCalc.chipMon,
        invested: lCalc.invested,
        net: lCalc.net,
        settleAtEnd: lSettleAtEnd,
        bankBefore,
        playerSnapshot,
        time: Date.now(),
        groupId: gid
      });

      // 1. Distribute chips to their destination
      lDestSources.forEach(s => {
        if(s.chips <= 0) return;
        if(s.type === "bank") {
          bank = round2(bank - s.chips);
          txns.push({type:"leave-bank-return", player:quitter.name, chips:s.chips, money:s.money, time:Date.now(), groupId: gid});
        } else {
          const dest = players.find(x=>x.id===s.player);
          players = players.map(p => p.id === s.player ? {...p, cashInvested: round2(p.cashInvested + s.money)} : p);
          txns.push({type:"leave-transfer", player:quitter.name, to:dest?.name || s.player, chips:s.chips, money:s.money, time:Date.now(), groupId: gid});
        }
      });

      // 2. Settlement (skip if settling at end of game)
      if(!lSettleAtEnd) {
        lSettlements.forEach(s => {
          if(s.amount <= 0) return;
          const sw = players.find(x=>x.id===s.player);
          if(sw) {
            players = players.map(p => p.id === s.player ? {...p, cashInvested: round2(p.cashInvested + (lCalc.net > 0 ? -s.amount : s.amount))} : p);
            settledWithName = sw.name;
          }
          if(lCalc.net > 0) txns.push({type:"leave-settle", from: sw?.name || "BANK/OTHER", to: quitter.name, amount: s.amount, time: Date.now(), groupId: gid});
          else txns.push({type:"leave-settle", from: quitter.name, to: sw?.name || "BANK/OTHER", amount: s.amount, time: Date.now(), groupId: gid});
        });
      }

      const left = {...quitter, finalChips: lCalc.fc, net: lCalc.net, settledWith: settledWithName};
      return {
        ...g,
        players: players.filter(p=>p.id!==lp),
        totalBankChips: bank,
        leftPlayers: [...(g.leftPlayers||[]), left],
        transactions: txns
      };
    });
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
          <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Coins size={20} className="text-theme-400" />
            Poker Ledger
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-1.5">
            <span className="bg-theme-500/20 text-theme-400 px-1.5 py-0.5 rounded border border-theme-500/20">{game.players.length} active</span>
            <span>&middot;</span> 
            <span>{CURRENCY}{game.chipValue}/chip</span>
            {sessionId && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1 bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                  <Wifi size={10} /> Live{viewerCount > 1 ? ` · ${viewerCount}` : ''}
                </span>
              </>
            )}
          </p>
        </div>
        
        <div className="text-right px-4 py-3 rounded-2xl glass-panel relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80 mb-0.5">Total Pot</p>
          <div className="flex text-2xl font-bold text-amber-400 font-mono tracking-tight drop-shadow-md">
            <span className="mr-0.5">{CURRENCY}</span>
            <SlotCounter value={total.toLocaleString()} charClassName="text-amber-400 font-mono text-2xl font-bold" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
        {/* Actions moved to top corner */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mb-5">
        {game.players.map((p,i)=>(
          <SwipeableCard key={p.id} p={p} i={i} onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight} onSettle={handleSettle} />
        ))}
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
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar mt-2">
                {(() => {
                  const groups = [];
                  let curG = null;
                  game.transactions.forEach((t, i) => {
                    if (t.groupId) {
                      if (curG && curG.gid === t.groupId) { curG.items.push({...t, idx: i}); }
                      else { curG = { gid: t.groupId, kind: 'group', items: [{...t, idx: i}] }; groups.push(curG); }
                    } else { groups.push({ ...t, kind: 'single', idx: i }); curG = null; }
                  });
                  return [...groups].reverse().map((g, gi) => {
                    if (g.kind === 'single') {
                      const t = g;
                      return (
                        <div key={`s-${gi}`} className="group/txn text-xs sm:text-sm px-4 py-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-400 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-slate-600"/>
                            <div className="min-w-0 truncate">
                              {t.type==="initial"&&<><span className="font-semibold text-theme-400">{t.player}</span> initial: <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)})</>}
                              {t.type==="bank-buy-in"&&<><span className="font-semibold text-blue-400">{t.player}</span> buy-in: <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)})</>}
                              {t.type==="bank-return"&&<><span className="font-semibold text-amber-400">{t.player}</span> returned: <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)})</>}
                              {t.type==="transfer"&&<><span className="font-semibold text-orange-400">{t.seller}</span> sold <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)}) to <span className="font-semibold text-purple-400">{t.buyer}</span></>}
                              {t.type==="add-transfer"&&<><span className="font-semibold text-theme-400">{t.player}</span> joined via <span className="font-semibold text-orange-400">{t.from}</span>: <span className="font-mono text-slate-200 font-bold">{round2(t.chips)} chips</span> ({CURRENCY}{round2(t.money)})</>}
                              {t.type==="leave-bank-return"&&<><span className="font-semibold text-orange-400">{t.player}</span> returned <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)}) to bank</>}
                              {t.type==="leave-transfer"&&<><span className="font-semibold text-orange-400">{t.player}</span> gave <span className="font-mono text-slate-200">{round2(t.chips)}</span> chips ({CURRENCY}{round2(t.money)}) to <span className="font-semibold text-blue-400">{t.to}</span></>}
                              {t.type==="leave-settle"&&<><span className="font-semibold text-rose-400">{t.from}</span> pays <span className="font-semibold text-theme-400">{t.to}</span> <span className="font-mono font-bold text-amber-400">{CURRENCY}{round2(t.amount)}</span></>}
                            </div>
                          </div>
                          <button onClick={()=>onReverse(t.idx)} className="p-2 -mr-2 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 transition-all opacity-60 sm:opacity-0 sm:group-hover/txn:opacity-100"><Trash2 size={14}/></button>
                        </div>
                      );
                    } else {
                      // Check if this is a leave group
                      const leaveExit = g.items.find(x => x.type === "leave-exit");
                      if (leaveExit) {
                        const subItems = g.items.filter(x => x.type !== "leave-exit");
                        return (
                          <div key={`g-${gi}`} className="group/txn rounded-xl overflow-hidden bg-orange-500/5 border border-orange-500/15">
                            <div className="px-4 py-3 bg-orange-500/5 border-b border-orange-500/10 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <LogOut size={14} className="text-orange-400 shrink-0"/>
                                <div className="text-xs sm:text-sm">
                                  <span className="font-bold text-orange-300">{leaveExit.player}</span>
                                  <span className="text-slate-400"> exited </span>
                                  <span className={`font-mono font-bold ${leaveExit.net>=0?'text-theme-400':'text-rose-400'}`}>
                                    {leaveExit.net>=0?"+":""}{CURRENCY}{round2(leaveExit.net)}
                                  </span>
                                  {leaveExit.settleAtEnd && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">settle at end</span>}
                                </div>
                              </div>
                              <button onClick={()=>onReverse(leaveExit.idx)} className="p-2 -mr-2 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 transition-all opacity-60 sm:opacity-0 sm:group-hover/txn:opacity-100" title="Undo exit — bring player back">
                                <RotateCcw size={14}/>
                              </button>
                            </div>
                            {subItems.length > 0 && (
                              <div className="p-1 px-2 space-y-1">
                                {subItems.map((item, ii) => (
                                  <div key={ii} className="px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 flex items-center gap-2">
                                    <ArrowRight size={10} className="text-slate-600 shrink-0"/>
                                    {item.type==="leave-bank-return"&&<span>{round2(item.chips)} chips returned to bank</span>}
                                    {item.type==="leave-transfer"&&<span>{round2(item.chips)} chips to <span className="font-semibold text-slate-400">{item.to}</span></span>}
                                    {item.type==="leave-settle"&&<span><span className="text-slate-400">{item.from}</span> → <span className="text-slate-400">{item.to}</span>: <span className="font-mono text-amber-400/80">{CURRENCY}{round2(item.amount)}</span></span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Regular buy-in/return group
                      const first = g.items[0];
                      const totalC = g.items.reduce((s, x) => s + (x.chips||0), 0);
                      const totalM = g.items.reduce((s, x) => s + (x.money||0), 0);
                      const pName = first.type.includes('bank') ? first.player : (first.buyer || first.player);
                      const isReturn = first.type.includes('return') || (first.type === 'transfer' && first.seller === pName);

                      return (
                        <div key={`g-${gi}`} className="rounded-xl overflow-hidden bg-slate-900/50 border border-white/5">
                          <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-theme-500/40"/>
                              <div className="text-xs sm:text-sm">
                                <span className="font-bold text-slate-100">{pName}</span> {isReturn ? 'returned' : 'took'} <span className="font-mono font-bold text-theme-400">{round2(totalC)}</span> chips <span className="text-slate-500">({CURRENCY}{round2(totalM)})</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-1 px-2 space-y-1">
                            {g.items.map((item, ii) => {
                              const from = item.type.includes('bank') ? 'Bank' : (isReturn ? (item.buyer || item.to) : (item.seller || item.from));
                              return (
                                <div key={ii} className="group/item flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400 italic">
                                    <ArrowRight size={10} className="text-slate-600"/>
                                    <span>{round2(item.chips)} chips <span className="text-slate-500">({CURRENCY}{round2(item.money)})</span> {isReturn ? 'to' : 'from'} <span className="font-semibold text-slate-300">{from}</span></span>
                                  </div>
                                  <button onClick={()=>onReverse(item.idx)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 transition-all opacity-60 sm:opacity-0 sm:group-hover/item:opacity-100">
                                    <Trash2 size={12}/>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </details>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-12 pb-6 sm:pb-8 px-4 pointer-events-none">
        <div className="flex gap-2 sm:gap-4 max-w-3xl mx-auto pointer-events-auto">
          <Btn onClick={onSettle} variant="amber" full className="shadow-amber-500/20 whitespace-nowrap px-2 sm:px-5 py-4 text-base sm:text-lg"><Calculator size={20} className="shrink-0"/> Settle Up Game</Btn>
        </div>
      </div>

      {/* Modals remain mostly identical in layout but updated to Tailwind */}
      <Modal open={modal==="buyin"} onClose={reset} title={<>{biMode==="add"?"Buy-in":"Return chips"} <span className="mx-2 text-white/30">&middot;</span> {game.players.find(p=>p.id===biTarget)?.name}</>} icon={<div className="p-2 bg-theme-500/20 rounded-lg text-theme-400"><ArrowRightLeft size={20}/></div>}>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold mb-3 block tracking-wider uppercase text-slate-400">Action</label>
              <Toggle value={biMode} onChange={setBiMode} options={[["add","Get Chips",Plus,"theme"],["return","Return",RotateCcw,"amber"]]}/>
            </div>
          </div>
          
          <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
            {biSources.map((s, idx) => (
              <div key={s.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4 relative group/row">
                {biSources.length > 1 && (
                  <button onClick={() => setBiSources(prev => prev.filter(x => x.id !== s.id))} className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover/row:opacity-100">
                    <X size={14}/>
                  </button>
                )}
                <div>
                  <label className="text-[10px] font-bold mb-2 block tracking-widest uppercase text-slate-500">{biMode==="add"?"Source":"Return to"}</label>
                  <Toggle value={s.type} onChange={v => setBiSources(prev => prev.map(x => x.id === s.id ? { ...x, type: v, player: v === "bank" ? "" : x.player } : x))} 
                    options={[["bank","Bank",Building2,"theme"],["player","Player",Users,"purple"]]} />
                </div>
                {s.type === "player" && (
                  <PSelect players={game.players} value={s.player} onChange={v => setBiSources(prev => prev.map(x => x.id === s.id ? { ...x, player: v } : x))} exclude={biTarget} label={biMode==="add"?"Taking from":"Giving to"}/>
                )}
                <TwoWayInput chipValue={game.chipValue} chips={s.chips} money={s.money} onChange={v => setBiSources(prev => prev.map(x => x.id === s.id ? { ...x, ...v } : x))} 
                  chipLabel={null} moneyLabel={null}/>
              </div>
            ))}
          </div>

          <button onClick={() => setBiSources([...biSources, { id: Date.now(), type: "player", player: "", chips: 0, money: 0 }])}
            className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-slate-200 hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium">
            <Plus size={16}/> Add another source
          </button>

          <Err msg={err}/>
          <Btn onClick={submitBuyIn} full variant="primary" className="mt-2"><Check size={18}/> Confirm Transaction</Btn>
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

      <Modal open={modal==="leave"} onClose={reset} title={<>Cash Out / Exit <span className="mx-2 text-white/30">&middot;</span> {game.players.find(p=>p.id===lp)?.name}</>} icon={<div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><LogOut size={20}/></div>}>
        {lStep===1?(
          /* ── Step 1: Final chip count ── */
          <div className="space-y-6">
            <div className="rounded-2xl p-4 bg-orange-500/5 border border-orange-500/10 text-sm text-slate-400">
              Enter the <span className="text-orange-300 font-semibold">final chip count</span> for {game.players.find(p=>p.id===lp)?.name} — how many chips are they walking away with?
            </div>
            <TwoWayInput
              chipValue={game.chipValue}
              chips={lFinalAmount.chips}
              money={lFinalAmount.money}
              onChange={v => setLFinalAmount(v)}
              chipLabel="Final chip count"
              moneyLabel={`Final value (${CURRENCY})`}
            />
            <Err msg={err}/>
            <Btn onClick={calcLeave} full variant="amber" className="mt-2"><ArrowRight size={18}/> Next: Settlement</Btn>
          </div>
        ):(
          /* ── Step 2: Exit summary + chip destination + settlement ── */
          <div className="space-y-5 animate-slide-up">

            {/* Exit Summary */}
            <div className="rounded-2xl p-5 glass-card bg-slate-900/60 border-white/10">
              <p className="text-sm font-bold mb-3 text-slate-100 flex items-center gap-2">
                <Sparkles size={15} className="text-amber-400"/> Exit Summary
              </p>
              <div className="space-y-2.5 text-sm text-slate-300">
                <div className="flex justify-between items-center"><span>Final chips</span><span className="font-mono bg-slate-800/50 px-2 py-0.5 rounded text-slate-200">{lCalc.fc}</span></div>
                <div className="flex justify-between items-center"><span>Final value</span><span className="font-mono text-amber-400/90">{CURRENCY}{lCalc.chipMon.toLocaleString()}</span></div>
                <div className="flex justify-between items-center"><span>Total invested</span><span className="font-mono text-slate-200">{CURRENCY}{lCalc.invested.toLocaleString()}</span></div>
                <div className="flex justify-between pt-3 mt-3 border-t border-white/10">
                  <span className="font-bold text-slate-200">Net profit/loss</span>
                  <span className={`font-mono text-base font-bold bg-slate-950/50 px-3 py-1 rounded-lg border ${lCalc.net>0?'text-theme-400 border-theme-500/20':lCalc.net<0?'text-rose-400 border-rose-500/20':'text-slate-400 border-white/10'}`}>
                    {lCalc.net>=0?"+":""}{CURRENCY}{round2(lCalc.net).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Chip Destination */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block">What happens to these chips?</label>
              <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1 no-scrollbar">
                {lDestSources.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 relative group/row">
                    {lDestSources.length > 1 && (
                      <button onClick={() => setLDestSources(prev => prev.filter(x => x.id !== s.id))} className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover/row:opacity-100">
                        <X size={14}/>
                      </button>
                    )}
                    <Toggle value={s.type} onChange={v => setLDestSources(prev => prev.map(x => x.id === s.id ? { ...x, type: v, player: v === "bank" ? "" : x.player } : x))}
                      options={[["bank","Return to Bank",Building2,"theme"],["player","Give to Player",Users,"purple"]]} />
                    {s.type === "player" && (
                      <PSelect players={game.players} value={s.player} onChange={v => setLDestSources(prev => prev.map(x => x.id === s.id ? { ...x, player: v } : x))} exclude={lp} label="Recipient player"/>
                    )}
                    <TwoWayInput chipValue={game.chipValue} chips={s.chips} money={s.money}
                      onChange={v => setLDestSources(prev => prev.map(x => x.id === s.id ? { ...x, ...v } : x))}
                      chipLabel={null} moneyLabel={null}/>
                  </div>
                ))}
              </div>
              <button onClick={() => setLDestSources([...lDestSources, { id: Date.now(), type: "player", player: "", chips: 0, money: 0 }])}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-slate-200 hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                <Plus size={15}/> Add another destination
              </button>
            </div>

            {/* Settlement Section */}
            {Math.abs(lCalc.net) >= 0.5 && (
              <div className="space-y-3">
                <div className={`rounded-xl px-4 py-3 text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${lCalc.net>0?'bg-theme-500/10 text-theme-400':'bg-rose-500/10 text-rose-400'}`}>
                  {lCalc.net > 0
                    ? <><Crown size={12}/> Settlement — who owes them {CURRENCY}{round2(Math.abs(lCalc.net))}?</>
                    : <><ArrowRight size={12}/> Settlement — they owe {CURRENCY}{round2(Math.abs(lCalc.net))}</>}
                </div>

                {/* Settle Now vs Settle at End toggle */}
                <Toggle
                  value={lSettleAtEnd ? "end" : "now"}
                  onChange={v => { setLSettleAtEnd(v === "end"); setErr(""); }}
                  options={[["now","Settle Now",Check,"theme"],["end","Settle at End of Game",Clock,"amber"]]}
                />

                {!lSettleAtEnd && (
                  <div className="space-y-3">
                    {lSettlements.map((s) => (
                      <div key={s.id} className="flex flex-col sm:flex-row gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 relative group/row">
                        {lSettlements.length > 1 && (
                          <button onClick={() => setLSettlements(prev => prev.filter(x => x.id !== s.id))} className="absolute top-2 right-2 p-1 text-slate-600 hover:text-rose-400 transition-all opacity-0 group-hover/row:opacity-100">
                            <X size={14}/>
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <PSelect players={game.players} value={s.player}
                            onChange={v => setLSettlements(prev => prev.map(x => x.id === s.id ? { ...x, player: v } : x))}
                            exclude={lp} label={lCalc.net > 0 ? "Receiving from" : "Paying to"}/>
                        </div>
                        <div className="w-full sm:w-1/3">
                          <label className="text-[10px] font-bold mb-2 block tracking-widest uppercase text-slate-500">Amount ({CURRENCY})</label>
                          <input type="number" value={s.amount}
                            onChange={e => setLSettlements(prev => prev.map(x => x.id === s.id ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                            className="w-full rounded-xl px-4 py-3 text-sm glass-input font-mono" />
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setLSettlements([...lSettlements, { id: Date.now(), player: "", amount: 0 }])}
                      className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-[11px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2 font-medium">
                      <Plus size={14}/> Split settlement between more players
                    </button>
                  </div>
                )}

                {lSettleAtEnd && (
                  <div className="rounded-xl px-4 py-3 bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400/80">
                    This player's balance ({lCalc.net>0?"+":""}{CURRENCY}{round2(lCalc.net)}) will be included in the final settlement when the game ends.
                  </div>
                )}
              </div>
            )}

            <Err msg={err}/>
            <div className="flex gap-3 mt-2">
              <Btn onClick={()=>{setLStep(1);setErr("");}} variant="secondary" className="flex-1"><RotateCcw size={16}/> Back</Btn>
              <Btn onClick={submitLeave} variant="amber" className="flex-[2]"><Check size={18}/> Confirm Cash Out</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─────────── SETTLE ─────────── */
function SettleScreen({ game, onBack, onReset, upiMap, onSettleResult, onFcChange }) {
  const [fc, setFc] = useState(() => {
    if (game.fc) return game.fc;
    const m = {};
    game.players.forEach(p => m[p.id] = "");
    return m;
  });
  const [result, setResult] = useState(game.settleResult || null);
  const [prevGameResult, setPrevGameResult] = useState(game.settleResult);
  
  if (game.settleResult !== prevGameResult) {
    setPrevGameResult(game.settleResult);
    setResult(game.settleResult);
  }
  
  if (game.fc && JSON.stringify(game.fc) !== JSON.stringify(fc)) {
    setFc(game.fc);
  }
  
  const handleFcChange = (id, val) => {
    const newFc = {...fc, [id]: val};
    setFc(newFc);
    if (onFcChange) onFcChange(newFc);
  };
  const [warning, setWarning] = useState("");
  const [adj, setAdj] = useState([]); // {id, from, to, amount}
  const [newAdj, setNewAdj] = useState({from:"", to:"", amount:""});
  
  const tb = game.totalBankChips;
  const tf = Object.values(fc).reduce((s,v)=>s+(parseFloat(v)||0),0);
  const remaining = round2(tb - tf);

  const addAdj = () => {
    if (!newAdj.from || !newAdj.to || !newAdj.amount) return;
    if (newAdj.from === newAdj.to) return;
    setAdj([...adj, { ...newAdj, id: Date.now(), amount: parseFloat(newAdj.amount)||0 }]);
    setNewAdj({from:"", to:"", amount:""});
    haptic();
  };
  const rmAdj = (id) => setAdj(adj.filter(a=>a.id!==id));

  const calc = () => {
    setWarning("");
    if(Math.abs(tf-tb)>0.5) setWarning(`Chip mismatch! Final (${round2(tf)}) ≠ bank (${round2(tb)}). Diff: ${round2(Math.abs(tf-tb))}`);
    
    // 1. Current players
    const bal = game.players.map(p=>{
      const f=parseFloat(fc[p.id])||0;
      return{name:p.name,balance:round2(f*game.chipValue-p.cashInvested),finalChips:f,invested:p.cashInvested};
    });

    // 2. Add non-settled left players to the debt pool
    const lpBalances = (game.leftPlayers||[])
      .filter(p => !p.settledWith) // Those who chose "Settle at End"
      .map(p => ({
        name: p.name,
        balance: p.net,
        finalChips: p.finalChips,
        invested: p.cashInvested,
        isLeft: true
      }));

    const combined = [...bal, ...lpBalances];
    
    // 3. Apply external adjustments
    const finalBalances = combined.map(p => {
      let totalAdj = 0;
      adj.forEach(a => {
        if (a.from === p.name) totalAdj -= a.amount;
        if (a.to === p.name) totalAdj += a.amount;
      });
      return { ...p, balance: round2(p.balance + totalAdj) };
    });

    const winnerName = bal.reduce((m,x)=>x.balance>m.balance?x:m, bal[0])?.balance > 0 ? bal.reduce((m,x)=>x.balance>m.balance?x:m, bal[0]).name : null;
    
    const finalResult = {
      balances: finalBalances.filter(p => !p.isLeft), // Display only on-table players in the balance list
      settlements: computeSettlements(finalBalances), // Calculate settlements for everyone
      winner: winnerName
    };
    if (onSettleResult) onSettleResult(finalResult);
    setResult(finalResult);
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
          {game.players.map((p,i)=>{
            const currentChips = parseFloat(fc[p.id]) || 0;
            const maxForPlayer = round2(currentChips + remaining);
            return (
            <div key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 rounded-[1.5rem] px-4 sm:px-6 py-4 sm:py-5 glass-card animate-slide-up" style={{animationDelay:`${i*50}ms`}}>
              <div className="flex items-center gap-3 sm:gap-4 sm:flex-1 sm:min-w-0">
                <Avatar name={p.name} i={i} size="w-9 h-9 sm:w-12 sm:h-12" textSize="text-sm sm:text-base font-bold" />
                <div className="min-w-0">
                  <span className="text-base sm:text-lg font-bold text-slate-100 truncate block">{p.name}</span>
                  <p className="text-xs font-medium mt-0.5 text-slate-400 uppercase tracking-wider">Inv: <span className="font-mono ml-1">{CURRENCY}{p.cashInvested.toLocaleString()}</span></p>
                </div>
              </div>
              <div className="sm:w-64">
                <TwoWayInput chipValue={game.chipValue} chips={currentChips} money={round2(currentChips*game.chipValue)}
                  onChange={(v) => handleFcChange(p.id, v.chips)} chipLabel={null} moneyLabel={null}
                  maxChips={maxForPlayer} />
              </div>
            </div>
            );
          })}
          </div>
          {warning&&<div className="flex items-start gap-3 px-5 py-4 rounded-xl text-sm font-medium animate-fade-in bg-amber-500/10 border border-amber-500/20 text-amber-300"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><span>{warning}</span></div>}

          {/* External Adjustments Section */}
          <div className="pt-6 border-t border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-blue-400" /> External Dues (Optional)
            </h3>
            
            {adj.length > 0 && (
              <div className="space-y-2">
                {adj.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-bold text-rose-400/80">{a.from}</span>
                      <ArrowRight size={12} className="text-slate-600" />
                      <span className="font-bold text-theme-400/80">{a.to}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-slate-200">{CURRENCY}{a.amount.toLocaleString()}</span>
                      <button onClick={()=>rmAdj(a.id)} className="text-slate-600 hover:text-rose-400 transition-colors"><X size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <select value={newAdj.from} onChange={e=>setNewAdj({...newAdj, from: e.target.value})} className="rounded-xl px-3 py-2 text-xs glass-input sm:text-sm">
                <option value="">From...</option>
                {[...game.players, ...(game.leftPlayers||[])].map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <select value={newAdj.to} onChange={e=>setNewAdj({...newAdj, to: e.target.value})} className="rounded-xl px-3 py-2 text-xs glass-input sm:text-sm">
                <option value="">To...</option>
                {[...game.players, ...(game.leftPlayers||[])].map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">{CURRENCY}</span>
                <input type="number" value={newAdj.amount} onChange={e=>setNewAdj({...newAdj, amount: e.target.value})} placeholder="Amount owed"
                  className="w-full rounded-xl pl-7 pr-4 py-2.5 text-sm glass-input font-mono"/>
              </div>
              <button onClick={addAdj} className="px-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
                Add Due
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic px-1">Note: These dues are one-off for this settlement and won't be saved to history.</p>
          </div>

          <div className="pt-4">
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
              <div className="space-y-3">{result.settlements.map((s,i)=>{
                const pInfo = game.players.find(p=>p.name===s.to) || game.leftPlayers?.find(p=>p.name===s.to);
                const targetUpi = pInfo?.upi || (upiMap && upiMap[s.to]);
                return (
                 <div key={i} className="flex flex-col gap-2 rounded-2xl px-5 py-4 animate-slide-up bg-slate-900/80 border border-indigo-500/30 shadow-lg" style={{animationDelay:`${i*80}ms`}}>
                  <div className="flex items-center gap-3 sm:gap-4">
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
                  {targetUpi && (
                    <div className="flex justify-end mt-1">
                      <a href={`upi://pay?pa=${targetUpi}&pn=${encodeURIComponent(s.to)}&am=${s.amount}&cu=INR`} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors text-xs font-semibold shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                        onClick={()=>haptic()}>
                        <QrCode size={14}/> Pay with UPI
                      </a>
                    </div>
                  )}
                 </div>
                );
              })}</div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
            <Btn onClick={()=>{
              setResult(null);
              if (onSettleResult) onSettleResult(null);
            }} variant="secondary" className="flex-1 py-3 text-sm sm:text-base"><RotateCcw size={18}/> Re-enter</Btn>
            <Btn onClick={()=>{haptic(); shareReceipt();}} variant="primary" className="flex-1 py-3 text-sm sm:text-base"><Download size={18}/> Share Receipt</Btn>
            <Btn onClick={()=>onReset(result)} variant="danger" className="flex-1 py-3 text-sm sm:text-base"><Trash2 size={18}/> New Game</Btn>
          </div>
        </div>
      )}
    </div>
  );
}



/* ─────────── HISTORY ─────────── */
function HistoryScreen({ history, onBack }) {
  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <div className="flex items-center gap-4 sm:gap-5 mb-10">
        <button onClick={onBack} className="p-3 sm:p-3.5 rounded-xl transition-all border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 hover:text-white glass-panel"><RotateCcw size={20}/></button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">Game History</h1>
          <p className="text-sm font-medium mt-1 text-slate-400">Past sessions and settlements</p>
        </div>
      </div>
      
      {history.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-[2rem] glass-panel">
          <Clock size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-base font-medium text-slate-400">No game history yet.</p>
          <p className="text-sm text-slate-500 mt-2">Completed games will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((h, i) => {
            const date = new Date(h.id).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={h.id} className="glass-panel p-5 rounded-[1.5rem] animate-slide-up" style={{animationDelay:`${i*50}ms`}}>
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                    <Clock size={16} className="text-purple-400" /> {date}
                  </div>
                  {h.result?.winner && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                      <Crown size={12}/> {h.result.winner}
                    </div>
                  )}
                </div>
                {h.result?.settlements?.length > 0 ? (
                  <div className="space-y-2">
                    {h.result.settlements.map((s, j) => (
                      <div key={j} className="flex justify-between items-center text-sm">
                        <span className="text-rose-400 font-medium truncate max-w-[80px] sm:max-w-[120px]">{s.from}</span>
                        <div className="flex items-center gap-2 flex-1 mx-2">
                          <div className="h-px flex-1 bg-white/5" />
                          <span className="text-amber-400 font-mono text-xs font-bold">{CURRENCY}{s.amount.toLocaleString()}</span>
                          <ArrowRight size={12} className="text-slate-500" />
                          <div className="h-px flex-1 bg-white/5" />
                        </div>
                        <span className="text-theme-400 font-medium truncate max-w-[80px] sm:max-w-[120px] text-right">{s.to}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm font-medium text-theme-400 py-2">Everyone was even! 🎉</p>
                )}
              </div>
            );
          })}
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
  const [upiMap, setUpiMap] = useState({});
  const [history, setHistory] = useState([]);

  // ── Session state ──
  const [sessionId, setSessionId] = useState(null);
  const [_isHost, setIsHost] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [shareModal, setShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revConfirm, setRevConfirm] = useState(null);
  const unsubRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  // ── Initial load: check URL for session, or load from localStorage ──
  useEffect(()=>{(async()=>{
    const urlSessionId = getSessionIdFromUrl();
    
    if (urlSessionId && isFirebaseReady()) {
      // Joining a shared session
      try {
        const sessionData = await joinSession(urlSessionId);
        if (sessionData && sessionData.game) {
          setSessionId(urlSessionId);
          setIsHost(false);
          isRemoteUpdate.current = true;
          setGame(sessionData.game);
          setPhase(sessionData.game.phase || "game");
          return;
        }
      } catch (e) {
        console.warn("Failed to join session:", e);
      }
    }
    
    // Fallback: load from localStorage
    const g=await store.get(GAME_KEY); const n=await store.get(NAMES_KEY);
    const u=await store.get(UPI_KEY); const h=await store.get(HISTORY_KEY);
    setSavedNames(n||[]);
    setUpiMap(u||{});
    setHistory(h||[]);
    if(g&&g.phase){setGame(g);setPhase(g.phase);} else setPhase("setup");
  })();},[]);

  // ── Listen for real-time changes when in a session ──
  useEffect(() => {
    if (!sessionId || !isFirebaseReady()) return;
    
    const unsub = listenToSession(sessionId, (data) => {
      if (!data) {
        // Session was deleted
        setSessionId(null);
        setIsHost(false);
        return;
      }
      setViewerCount(data.viewerCount || 1);
      if (data.game) {
        isRemoteUpdate.current = true;
        setGame(data.game);
        if (data.game.phase) setPhase(data.game.phase);
      }
    });
    unsubRef.current = unsub;
    
    return () => { if (unsub) unsub(); };
  }, [sessionId]);

  // ── Persist game state (localStorage + Firebase) ──
  useEffect(()=>{
    if (!game) return;
    
    // Always save to localStorage
    store.set(GAME_KEY,{...game,phase});
    const names=[...(game.players||[]),...(game.leftPlayers||[])].map(p=>p.name);
    setTimeout(()=>{
      setSavedNames(prev=>{const m=[...new Set([...prev,...names])];store.set(NAMES_KEY,m);return m;});
    }, 0);
    
    // Write to Firebase if in a session and this is a LOCAL change
    if (sessionId && isFirebaseReady() && !isRemoteUpdate.current) {
      updateSessionGame(sessionId, {...game, phase}).catch(console.warn);
    }
    isRemoteUpdate.current = false;
  },[game,phase,sessionId]);

  const handleStart=data=>{setGame(data);setPhase("game");};
  const handleReset=async(completedResult = null)=>{
    if (completedResult) {
      const record = { id: Date.now(), gameData: { ...game }, result: completedResult };
      setHistory(prev => {
        const next = [record, ...prev].slice(0, 50);
        store.set(HISTORY_KEY, next);
        return next;
      });
    }

    if (sessionId) {
      try { await deleteSession(sessionId); } catch(e) { console.warn(e); }
      setSessionId(null);
      setIsHost(false);
      window.location.hash = '';
    }
    await store.delete(GAME_KEY);
    setGame(null);
    setPhase("setup");
  };

  const handleReverse = (index) => {
    if (index === null) return;
    setGame(g => {
      let txns = [...g.transactions];
      const t = txns[index];
      if (!t) return g;

      let players = [...g.players];
      let bank = g.totalBankChips;
      let leftPlayers = [...(g.leftPlayers || [])];

      // ── Leave group reversal: bring player back ──
      const isLeaveType = ["leave-exit","leave-bank-return","leave-transfer","leave-settle"].includes(t.type);
      if (isLeaveType && t.groupId) {
        const leaveExit = txns.find(x => x.groupId === t.groupId && x.type === "leave-exit");
        if (leaveExit) {
          // Restore bank to pre-leave value
          bank = leaveExit.bankBefore;
          // Restore all other players' cashInvested from snapshot
          if (leaveExit.playerSnapshot) {
            leaveExit.playerSnapshot.forEach(snap => {
              players = players.map(p => p.id === snap.id ? { ...p, cashInvested: snap.cashInvested } : p);
            });
          }
          // Re-add the quitter with their original data
          if (leaveExit.playerData) {
            players.push(leaveExit.playerData);
          }
          // Remove from leftPlayers
          leftPlayers = leftPlayers.filter(p => p.name !== leaveExit.player);
          // Remove ALL transactions in this leave group
          txns = txns.filter(x => x.groupId !== t.groupId);
          return { ...g, players, totalBankChips: bank, leftPlayers, transactions: txns };
        }
      }

      // ── Standard transaction reversal ──
      if (t.type === "bank-buy-in" || t.type === "initial") {
        players = players.map(p => p.name === t.player ? { ...p, cashInvested: round2(p.cashInvested - t.money) } : p);
        bank = round2(bank - t.chips);
      } else if (t.type === "bank-return") {
        players = players.map(p => p.name === t.player ? { ...p, cashInvested: round2(p.cashInvested + t.money) } : p);
        bank = round2(bank + t.chips);
      } else if (t.type === "transfer" || t.type === "add-transfer") {
        players = players.map(p => {
          if (p.name === (t.buyer || t.player)) return { ...p, cashInvested: round2(p.cashInvested - t.money) };
          if (p.name === (t.seller || t.from)) return { ...p, cashInvested: round2(p.cashInvested + (t.type === "add-transfer" ? 0 : t.money)) };
          return p;
        });
      }

      txns.splice(index, 1);
      return { ...g, players, totalBankChips: bank, leftPlayers, transactions: txns };
    });
    setRevConfirm(null);
    haptic();
  };

  const handleUpdateUpi = (name, upi) => {
    setUpiMap(prev => {
      const next = { ...prev, [name]: upi.trim() };
      store.set(UPI_KEY, next);
      return next;
    });
  };

  // ── Share session ──
  const handleShare = async () => {
    if (!isFirebaseReady()) {
      alert("Firebase is not configured. Please set up Firebase first.");
      return;
    }
    
    if (sessionId) {
      // Already shared — just show the modal
      setShareModal(true);
      return;
    }
    
    try {
      const hostName = game?.players?.[0]?.name || "Host";
      const id = await createSession({...game, phase}, hostName);
      setSessionId(id);
      setIsHost(true);
      window.location.hash = `/session/${id}`;
      setShareModal(true);
    } catch (e) {
      console.error("Failed to create session:", e);
      alert("Failed to create session. Check Firebase config.");
    }
  };
  
  const copyLink = () => {
    if (!sessionId) return;
    const url = getSessionUrl(sessionId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for mobile
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const nativeShare = () => {
    if (!sessionId) return;
    const url = getSessionUrl(sessionId);
    if (navigator.share) {
      navigator.share({
        title: 'Poker Ledger Session',
        text: 'Join my poker session!',
        url: url,
      }).catch(()=>{});
    } else {
      copyLink();
    }
  };

  if(phase==="loading") return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-theme-500 z-50">
      <Coins size={48} className="animate-bounce" />
      <div className="mt-4 text-slate-500 font-medium tracking-widest uppercase text-sm animate-pulse">Loading Ledger...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-theme-500/30 selection:text-white">
      <div className="relative min-h-screen pt-2 sm:pt-0">
        {phase!=="loading"&&(
          <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 flex gap-2">
            {phase==="setup" && (
              <button onClick={()=>{haptic(); setPhase("history");}} className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all shadow-[0_4px_15px_rgba(168,85,247,0.2)] backdrop-blur-md">
                <History size={18} />
              </button>
            )}
            {phase==="game" && (
              <>
                {isFirebaseReady() && (
                  <button onClick={()=>{haptic(); handleShare();}} className={`p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border transition-all backdrop-blur-md ${
                    sessionId 
                      ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 shadow-[0_4px_15px_rgba(59,130,246,0.2)]' 
                      : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 shadow-[0_4px_15px_rgba(168,85,247,0.2)]'
                  }`}>
                    {sessionId ? <Wifi size={18} /> : <Share2 size={18} />}
                  </button>
                )}
                <button onClick={()=>{haptic(); window.dispatchEvent(new CustomEvent('open-add-player'));}} className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.2)] backdrop-blur-md">
                  <UserPlus size={18} />
                </button>
              </>
            )}
            {(phase==="game" || phase==="settle") && (
              <button onClick={()=>{haptic(); setExitPrompt(true);}} className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-[0_4px_15px_rgba(244,63,94,0.2)] backdrop-blur-md">
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
        {phase==="setup"&&<SetupScreen onStart={handleStart} savedNames={savedNames} upiMap={upiMap} onUpdateUpi={handleUpdateUpi} />}
        {phase==="history" && <HistoryScreen history={history} onBack={()=>setPhase("setup")} />}
        {phase==="game"&&game&&<DashboardScreen game={game} setGame={setGame} onSettle={()=>setPhase("settle")} savedNames={savedNames} sessionId={sessionId} viewerCount={viewerCount} onShare={handleShare} onReverse={setRevConfirm} />}
        {phase==="settle"&&game&&<SettleScreen game={game} upiMap={upiMap} onBack={()=>setPhase("game")} onReset={(res)=>setExitPrompt(res || true)} onSettleResult={(res)=>setGame(prev=>({...prev, settleResult: res}))} onFcChange={(fc)=>setGame(prev=>({...prev, fc: fc}))}/>}

        {/* Exit Confirmation */}
        <Modal open={exitPrompt} onClose={()=>setExitPrompt(false)} title="End Game?" icon={<div className="p-2 bg-rose-500/20 rounded-lg text-rose-400"><AlertTriangle size={20}/></div>}>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">Are you sure you want to completely end this game and return to the home screen? {sessionId ? 'This will end the shared session for everyone.' : 'All current game data will be lost permanently.'}</p>
          <div className="flex gap-3">
            <Btn onClick={()=>setExitPrompt(false)} variant="secondary" className="flex-1">Cancel</Btn>
            <Btn onClick={()=>{handleReset(typeof exitPrompt === 'object' ? exitPrompt : null);setExitPrompt(false);}} variant="danger" className="flex-1">End Game</Btn>
          </div>
        </Modal>

        {/* Share Session Modal */}
        <Modal open={shareModal} onClose={()=>setShareModal(false)} title="Share Session" icon={<div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Link2 size={20}/></div>}>
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold mb-4">
                <Wifi size={14} /> Session Active
              </div>
              <p className="text-slate-400 text-sm">Anyone with this link can view and edit the game in real-time.</p>
            </div>
            
            {sessionId && (
              <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 font-mono text-sm text-slate-300 break-all select-text">
                {getSessionUrl(sessionId)}
              </div>
            )}
            
            <div className="flex gap-3">
              <Btn onClick={copyLink} variant="secondary" full className="flex-1">
                {copied ? <><Check size={16}/> Copied!</> : <><Copy size={16}/> Copy Link</>}
              </Btn>
              <Btn onClick={nativeShare} variant="primary" full className="flex-1">
                <ExternalLink size={16}/> Share
              </Btn>
            </div>
            
            <div className="text-center text-xs text-slate-500">
              Session Code: <span className="font-mono font-bold text-slate-400">{sessionId}</span>
              {viewerCount > 0 && <span className="ml-2">· {viewerCount} connected</span>}
            </div>
          </div>
        </Modal>

        {/* App-level Reversal Confirmation Modal */}
        <Modal open={revConfirm !== null} onClose={()=>setRevConfirm(null)}
          title={(() => {
            const t = game?.transactions?.[revConfirm];
            const isLeave = t && ["leave-exit","leave-bank-return","leave-transfer","leave-settle"].includes(t.type) && t.groupId;
            return isLeave ? "Undo Player Exit?" : "Cancel Transaction?";
          })()}
          icon={<div className="p-2 bg-rose-500/20 rounded-lg text-rose-400"><RotateCcw size={20}/></div>}>
          <div className="space-y-6">
            {(() => {
              const t = game?.transactions?.[revConfirm];
              const isLeave = t && ["leave-exit","leave-bank-return","leave-transfer","leave-settle"].includes(t.type) && t.groupId;
              const leaveExit = isLeave ? game.transactions.find(x => x.groupId === t.groupId && x.type === "leave-exit") : null;
              return isLeave && leaveExit ? (
                <div className="text-sm space-y-3">
                  <p className="text-slate-400 leading-relaxed">
                    This will bring <span className="font-semibold text-orange-300">{leaveExit.player}</span> back into the game. All chip transfers, settlements, and balance changes from their exit will be fully reversed.
                  </p>
                  <div className="rounded-xl px-4 py-3 bg-orange-500/5 border border-orange-500/10 text-orange-400/80 text-xs">
                    {leaveExit.player} will return with {CURRENCY}{leaveExit.playerData?.cashInvested} invested (their state before exiting).
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm leading-relaxed">
                  Are you sure you want to reverse this transaction? All balances and bank totals will be restored as if it never happened.
                </p>
              );
            })()}
            <div className="flex gap-3">
              <Btn onClick={()=>setRevConfirm(null)} variant="secondary" full className="flex-1">Keep it</Btn>
              <Btn onClick={()=>handleReverse(revConfirm)} variant="danger" full className="flex-1">
                {(() => {
                  const t = game?.transactions?.[revConfirm];
                  const isLeave = t && ["leave-exit","leave-bank-return","leave-transfer","leave-settle"].includes(t.type) && t.groupId;
                  return isLeave ? "Yes, Bring Back" : "Yes, Reverse";
                })()}
              </Btn>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
