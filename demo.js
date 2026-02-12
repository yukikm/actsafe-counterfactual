// ShadowCommit Live Demo (wallet-free)
// This is an interactive explanation tool; not executing real transactions.

const $ = (id) => document.getElementById(id);

const intentEl = $('intent');
const receiptEl = $('receipt');
const verifyInputEl = $('verifyInput');
const verifyOutEl = $('verifyOut');

const btnPlan = $('btnPlan');
const btnSim = $('btnSim');
const btnDiff = $('btnDiff');
const btnCommit = $('btnCommit');
const btnReset = $('btnReset');
const btnVerify = $('btnVerify');
const btnCopy = $('btnCopy');

function nowIso(){ return new Date().toISOString(); }

async function sha256Hex(str){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

let state = {
  requestId: null,
  envelope: null,
  diff: null,
};

function setEnvelope(partial){
  state.envelope = { ...(state.envelope||{}), ...partial };
  receiptEl.textContent = JSON.stringify(state.envelope, null, 2);
}

function reset(){
  state = { requestId:null, envelope:null, diff:null };
  intentEl.value = JSON.stringify({
    kind: 'sol_transfer',
    to: '11111111111111111111111111111111',
    sol: 0.000001,
    cluster: 'devnet',
    notes: 'wallet-free demo: shows how receipts evolve'
  }, null, 2);
  receiptEl.textContent = '';
  verifyInputEl.value = '';
  verifyOutEl.textContent = '';
}

async function plan(){
  const intent = intentEl.value.trim();
  const requestId = await sha256Hex(intent);
  state.requestId = requestId;

  const intentHash = await sha256Hex('intent:'+intent);
  setEnvelope({
    requestId,
    kind: 'sol_transfer',
    finalityState: 'planned',
    intentHash,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

async function simulate(){
  if (!state.requestId) return;
  // In real life: simulateTransaction + precondition checks.
  const evidenceHash = await sha256Hex('evidence:'+JSON.stringify({requestId:state.requestId, shadow:'sim-ok'}));
  setEnvelope({
    finalityState: 'simulated',
    evidenceHash,
    updatedAt: nowIso(),
    shadow: { ok: true, err: null, notes: 'simulation passed (demo)' }
  });
}

async function diff(){
  if (!state.requestId) return;
  state.diff = {
    pre: { balanceLamports: 1000000 },
    post: { balanceLamports: 999000 },
    touched: ['SystemProgram'],
  };
  setEnvelope({
    updatedAt: nowIso(),
    diff: state.diff
  });
}

async function commit(){
  if (!state.requestId) return;
  // In real life: build tx, sendTransaction, confirm/finalize.
  // Demo: show recover_only first, then finalize via evidence.
  setEnvelope({
    finalityState: 'recover_only',
    updatedAt: nowIso(),
    commit: { ok: false, reason: 'ambiguous_rpc_demo', next: 'reconcile signature status + evidence' }
  });
  // After a short delay, assume evidence allows us to treat as finalized.
  setTimeout(()=>{
    setEnvelope({
      finalityState: 'finalized',
      signature: 'DEMO_SIG_'+state.requestId.slice(0,10),
      updatedAt: nowIso(),
      commit: { ok: true, notes: 'finalized-or-evidence gate satisfied (demo)' }
    });
  }, 900);
}

function verifyInvariants(env){
  // Minimal verifier: finalized-or-evidence.
  if (!env.requestId) return { ok:false, reason:'missing_requestId' };
  if (!env.finalityState) return { ok:false, reason:'missing_finalityState' };

  const isFinal = env.finalityState === 'finalized';
  const hasEvidence = !!env.evidenceHash;
  if (!isFinal && !hasEvidence) return { ok:false, reason:'not_finalized_or_evidenced' };

  if (env.signature && env.finalityState === 'planned') return { ok:false, reason:'sig_with_planned_state' };

  return { ok:true };
}

function onVerify(){
  try{
    const env = JSON.parse(verifyInputEl.value);
    const res = verifyInvariants(env);
    verifyOutEl.textContent = JSON.stringify(res, null, 2);
  }catch(e){
    verifyOutEl.textContent = JSON.stringify({ok:false, reason:'invalid_json', error: String(e)}, null, 2);
  }
}

btnReset.addEventListener('click', reset);
btnPlan.addEventListener('click', plan);
btnSim.addEventListener('click', simulate);
btnDiff.addEventListener('click', diff);
btnCommit.addEventListener('click', commit);
btnVerify.addEventListener('click', onVerify);
btnCopy.addEventListener('click', ()=>{ verifyInputEl.value = receiptEl.textContent; });

reset();
