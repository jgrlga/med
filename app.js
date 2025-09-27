// SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

// ========== Helpers ==========
function $(id){ return document.getElementById(id); }
function daysBetween(d1, d2){ const ms = d2 - d1; return Math.round(ms/86400000); }
function ymdSplit(d1, d2){
  const days = daysBetween(d1,d2);
  const years = Math.floor(days/365.25);
  const remDays = days - Math.round(years*365.25);
  const months = Math.floor(remDays/30.44);
  const dd = Math.max(0, Math.round(remDays - months*30.44));
  return {years, months, days: dd, totalDays: days};
}

// ========== ICD-11 Search ==========
function loadICDSettings(){
  const endpoint = localStorage.getItem('icd_endpoint') || 'https://id.who.int/icd/entity/search';
  const token = localStorage.getItem('icd_token') || '';
  if ($('icd_endpoint')) $('icd_endpoint').value = endpoint;
  if ($('icd_token')) $('icd_token').value = token;
  return {endpoint, token};
}
function saveICDSettings(){
  const ep = ($('icd_endpoint')?.value||'').trim();
  const tk = ($('icd_token')?.value||'').trim();
  if(ep) localStorage.setItem('icd_endpoint', ep);
  if(tk) localStorage.setItem('icd_token', tk);
  const el = $('icd_status'); if(el) el.textContent = 'Configuración guardada.';
}
async function icdSearch(){
  const {endpoint, token} = loadICDSettings();
  const q = ($('icd_q')?.value||'').trim();
  const lang = $('icd_lang')?.value || 'es';
  const status = $('icd_status'); const ul = $('icd_results');
  if(!q){ status.textContent = 'Escribe un término o código.'; return; }
  ul.innerHTML = ''; status.textContent = 'Buscando...';
  try{
    const url = new URL(endpoint);
    url.searchParams.set('q', q);
    url.searchParams.set('include', 'code,title,definition');
    url.searchParams.set('flatResults', 'true');
    url.searchParams.set('useFlexisearch', 'true');
    url.searchParams.set('locale', lang);
    const resp = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', ...(token?{'Authorization':'Bearer '+token}:{}) }
    });
    if(!resp.ok){ status.textContent = `Error ${resp.status}`; return; }
    const data = await resp.json();
    const items = data?.destinationEntities || data?.results || [];
    if(items.length===0){ status.textContent = 'Sin resultados.'; return; }
    items.forEach(it=>{
      const code = it.code || it.theCode || '';
      const title = (it.title && (it.title['@value']||it.title.title||it.title)) || it.bestTitle || it.fullySpecifiedName || '—';
      const def = (it.definition && (it.definition['@value']||it.definition)) || '';
      const li = document.createElement('li');
      li.className = 'icd-item';
      li.innerHTML = `<div><b>${title}</b> <small>${code}</small></div>` + (def?`<div class="muted">${def}</div>`:'');
      ul.appendChild(li);
    });
    status.textContent = `Resultados: ${items.length}`;
  }catch(e){
    console.error(e); status.textContent = 'Error de red o CORS.';
  }
}
document.addEventListener('DOMContentLoaded', loadICDSettings);

// ========== Calculators ==========
// Date diff
function calcDateDiff(){
  const d1 = new Date($('d1').value); const d2 = new Date($('d2').value);
  if(isNaN(d1) || isNaN(d2)){ $('datediff_out').textContent = 'Faltan fechas'; return; }
  const {years, months, days, totalDays} = ymdSplit(d1, d2);
  $('datediff_out').textContent = `${totalDays} días (~${years} años, ${months} meses, ${days} días)`;
}

// BMI + IBW
function heightToCm(m){ return m*100; }
function ibw(heightCm, sex, formula){
  const base = 152.4; const over = Math.max(0, heightCm - base)/2.54;
  switch(formula){
    case 'Hamwi': return (sex==='M' ? 48.0 : 45.5) + 2.7*over;
    case 'Devine': return (sex==='M' ? 50.0 : 45.5) + 2.3*over;
    case 'Robinson': return (sex==='M' ? 52.0 : 49.0) + 1.9*over;
    default: return (sex==='M' ? 56.2 : 53.1) + 1.41*over;
  }
}
function calcBMI(){
  const sex = $('bmi_sex').value; const w = parseFloat($('bmi_w').value); const h = parseFloat($('bmi_h').value); const f = $('ibw_formula').value;
  if(!w || !h){ $('bmi_out').textContent = 'Faltan datos'; return; }
  const bmi = w/(h*h); const cat = (bmi<18.5)?'Bajo peso':(bmi<25)?'Normal':(bmi<30)?'Sobrepeso':'Obesidad';
  const ibwKg = ibw(heightToCm(h), sex, f);
  $('bmi_out').textContent = `IMC: ${bmi.toFixed(1)} — ${cat} | Peso ideal (${f}): ${ibwKg.toFixed(1)} kg`;
}

// CKD-EPI 2021
function calcCKDEPI(){
  const cr = parseFloat($('cr').value); const age = parseInt($('age_ckd').value); const sex = $('sex_ckd').value;
  if(!cr || !age){ $('ckd_out').textContent = 'Faltan datos'; return; }
  const k = (sex==='F')?0.7:0.9; const a = (sex==='F')?-0.241:-0.302;
  const minPart = Math.pow(Math.min(cr/k,1), a); const maxPart = Math.pow(Math.max(cr/k,1), -1.200);
  let egfr = 142 * minPart * maxPart * Math.pow(0.9938, age); if(sex==='F') egfr*=1.012;
  $('ckd_out').textContent = `FG: ${egfr.toFixed(1)} mL/min/1.73m²`;
}

// Alvarado
function calcAlvarado(){
  const sum = ['alv_mig','alv_ano','alv_nv','alv_rlq','alv_reb','alv_temp','alv_wbc','alv_shift']
    .map(id=>parseFloat($(id).value)).reduce((a,b)=>a+b,0);
  let msg = `Alvarado: ${sum}`; if(sum<=4) msg+=' — bajo riesgo'; else if(sum<=6) msg+=' — compatible/observación'; else msg+=' — alto, considerar cirugía';
  $('alvarado_out').textContent = msg;
}

// RIPASA
function calcRIPASA(){
  const ids=['ri_age','ri_male','ri_rlq','ri_mig','ri_ano','ri_nv','ri_lt48','ri_reb','ri_fever','ri_cough','ri_wbc','ri_urine'];
  const sum=ids.map(id=>parseFloat($(id).value)).reduce((a,b)=>a+b,0);
  let msg=`RIPASA: ${sum.toFixed(1)}`; if(sum<5) msg+=' — baja'; else if(sum<7.5) msg+=' — intermedia'; else msg+=' — alta';
  $('ripasa_out').textContent=msg;
}

// AHA placeholder
async function loadAHAConfig(){ try{ const r=await fetch('config/aha2025.json'); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } }
async function calcAHA(){
  const cfg = await loadAHAConfig();
  const age=parseFloat($('aha_age').value||'0'), sbp=parseFloat($('aha_sbp').value||'0'), tc=parseFloat($('aha_tc').value||'0'), hdl=parseFloat($('aha_hdl').value||'0');
  const smoke=parseInt($('aha_smoke').value||'0'), dm=parseInt($('aha_dm').value||'0');
  if(!cfg){
    $('aha_out').innerHTML='Faltan coeficientes (<code>config/aha2025.json</code>). Mostrando ejemplo cualitativo.';
    const rough=Math.max(0,Math.min(30,(age-40)*0.4+(sbp-120)*0.05+(tc-hdl)*0.03+smoke*2+dm*3));
    $('aha_out').innerHTML+=` Riesgo aprox. (no clínico): ~${rough.toFixed(1)}% / 10 años.`; return;
  }
  $('aha_out').textContent='Modelo PREVENT cargado (implementación según coeficientes).';
}

// Pregnancy wheel
function calcPregnancy(){
  const furStr=$('fur').value; let todayStr=$('today').value;
  if(!todayStr){ const now=new Date(); todayStr=now.toISOString().slice(0,10); $('today').value=todayStr; }
  const fur=new Date(furStr); const today=new Date(todayStr); if(isNaN(fur)){ $('preg_out').textContent='Falta FUR'; return; }
  const days=daysBetween(fur,today); const weeks=Math.floor(days/7); const rem=days%7; const edd=new Date(fur.getTime()+280*86400000);
  $('preg_out').textContent=`EG: ${weeks} semanas + ${rem} días | FPP: ${edd.toISOString().slice(0,10)}`;
}

// ABL with categories + Hb
function ebvPerKg(category){
  switch(category){
    case 'adult_male': return 75;
    case 'adult_female': return 65;
    case 'infant': return 80;
    case 'neonate': return 85;
    case 'preterm': return 95;
    default: return 70;
  }
}
function calcABL(){
  const cat=$('abl_cat').value; const w=parseFloat($('abl_w').value||'0'); const hb_i=parseFloat($('abl_hb_i').value||'0'); const hb_f=parseFloat($('abl_hb_f').value||'0');
  if(!w||!hb_i||!hb_f){ $('abl_out').textContent='Faltan datos'; return; }
  const ebv = ebvPerKg(cat) * w; // mL
  // ABL por Hb (modelo simple: ABL ≈ EBV × (Hb_i − Hb_f) / Hb_prom)
  const hb_avg=(hb_i+hb_f)/2;
  const abl = ebv * (hb_i - hb_f) / hb_avg;
  $('abl_out').textContent = `EBV ≈ ${ebv.toFixed(0)} mL | ABL ≈ ${Math.max(0, abl).toFixed(0)} mL`;
}

// Child-Pugh
function calcChildPugh(){
  const bili=parseFloat($('cp_bili').value||'0'), alb=parseFloat($('cp_alb').value||'0'), inr=parseFloat($('cp_inr').value||'0');
  const asc=parseInt($('cp_asc').value||'1'), enc=parseInt($('cp_enc').value||'1'); if(!bili||!alb||!inr){ $('cp_out').textContent='Faltan datos'; return; }
  let pB=(bili<2)?1:(bili<=3)?2:3, pA=(alb>3.5)?1:(alb>=2.8)?2:3, pI=(inr<1.7)?1:(inr<=2.3)?2:3;
  const total=pB+pA+pI+asc+enc; const cls=(total<=6)?'A':(total<=9)?'B':'C'; $('cp_out').textContent=`Child-Pugh: ${total} (Clase ${cls})`;
}

// Calcium correction
function calcCalcium(){
  const ca=parseFloat($('ca_meas').value||'0'), alb=parseFloat($('alb_meas').value||'0'); if(!ca||!alb){ $('ca_out').textContent='Faltan datos'; return; }
  const corr= ca + 0.8*(4 - alb); $('ca_out').textContent=`Calcio corregido: ${corr.toFixed(2)} mg/dL`;
}

// Pediatric dosing
function calcPedDose(){
  const w=parseFloat($('pd_w').value||'0'), mgkg=parseFloat($('pd_mgkg').value||'0'); const maxmg=parseFloat($('pd_max').value||'0'); const conc=parseFloat($('pd_conc').value||'0'); const freq=parseInt($('pd_freq').value||'1');
  if(!w||!mgkg){ $('pd_out').textContent='Faltan datos'; return; }
  let dosePerDay=w*mgkg; if(maxmg) dosePerDay=Math.min(dosePerDay,maxmg);
  const perDose=dosePerDay/(freq||1); let msg=`Dosis total diaria: ${dosePerDay.toFixed(1)} mg | Por toma (${freq}×/día): ${perDose.toFixed(1)} mg`;
  if(conc){ msg+=` | Volumen por toma: ${(perDose/conc).toFixed(2)} mL`; } $('pd_out').textContent=msg;
}

// GCS adult + peds
function populateGCS(){
  const type=$('gcs_type').value; const e=$('gcs_e'), v=$('gcs_v'), m=$('gcs_m'); e.innerHTML=''; v.innerHTML=''; m.innerHTML='';
  if(type==='adult'){
    [['No abre',1],['A dolor',2],['A voz',3],['Espontánea',4]].forEach(([t,vv])=> e.append(new Option(`${t} (${vv})`, vv)));
    [['Ninguna',1],['Sonidos ininteligibles',2],['Palabras inapropiadas',3],['Confuso',4],['Orientado',5]].forEach(([t,vv])=> v.append(new Option(`${t} (${vv})`, vv)));
    [['Ninguna',1],['Extensión',2],['Flexión anormal',3],['Retirada',4],['Localiza dolor',5],['Obedece',6]].forEach(([t,vv])=> m.append(new Option(`${t} (${vv})`, vv)));
  }else{
    [['No abre',1],['A dolor',2],['A voz',3],['Espontánea',4]].forEach(([t,vv])=> e.append(new Option(`${t} (${vv})`, vv)));
    [['Ninguna',1],['Quejidos',2],['Llanto',3],['Palabras',4],['Orientado/Interacciona',5]].forEach(([t,vv])=> v.append(new Option(`${t} (${vv})`, vv)));
    [['Ninguna',1],['Extensión',2],['Flexión anormal',3],['Retirada',4],['Localiza dolor',5],['Obedece',6]].forEach(([t,vv])=> m.append(new Option(`${t} (${vv})`, vv)));
  }
}
function calcGCS(){
  const E=parseInt($('gcs_e').value||'1'), V=parseInt($('gcs_v').value||'1'), M=parseInt($('gcs_m').value||'1'); $('gcs_out').textContent=`GCS: ${E+V+M} (E${E} V${V} M${M})`;
}
document.addEventListener('DOMContentLoaded', ()=>{ populateGCS(); $('gcs_type')?.addEventListener('change', populateGCS); });

// GBS
function calcGBS(){
  const bun=parseFloat($('gbs_bun').value||'0'), hb=parseFloat($('gbs_hb').value||'0'); const sbp=parseInt($('gbs_sbp').value||'0'), hr=parseInt($('gbs_hr').value||'0');
  const melena=parseInt($('gbs_melena').value||'0'), syncope=parseInt($('gbs_syncope').value||'0'), hepatic=parseInt($('gbs_hepatic').value||'0'), chf=parseInt($('gbs_chf').value||'0');
  let score=0;
  if(bun>=18.2 && bun<22.4) score+=2; else if(bun<27.9) score+=3; else if(bun<34.9) score+=4; else if(bun<69.9) score+=6; else if(bun>=69.9) score+=8;
  if(hb<12) score+=6; else if(hb<12.9) score+=3; else if(hb<13.9) score+=1;
  if(sbp<90) score+=3; else if(sbp<100) score+=2; else if(sbp<110) score+=1;
  if(hr>100) score+=1; score+=melena+syncope+hepatic+chf;
  let msg=`GBS: ${score}`; if(score===0) msg+=' — muy bajo riesgo'; $('gbs_out').textContent=msg;
}
