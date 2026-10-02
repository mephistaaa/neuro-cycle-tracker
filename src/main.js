import {GROUPS,CONTEXTS,POSITIVE_KEYS,LABELS} from './data.js';
import {cycleInfo,mean} from './cycle.js';
import {getAllEntries,putEntry,deleteEntry,replaceEntries,getSettings,putSettings} from './db.js';
import {makeBackupPayload,mergeEntries,chooseBackupsToKeep} from './backup.js';
import {encryptJson,decryptJson} from './crypto.js';
import {isDriveConfigured,authorize as authorizeDrive,disconnect as disconnectDrive,isAuthorized as isDriveAuthorized,listBackups,uploadBackup,downloadBackup,deleteDriveFile,backupFolderName} from './drive.js';

const app=document.querySelector('#app'); let entries=[]; let settings=await getSettings();
let localSaveTimer=null; let localSaveBusy=false; let suppressAutoSave=false; let saveLabelTimer=null;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const allMetricKeys=GROUPS.flatMap(g=>g.items.map(i=>i[0]));
const numericKeys=['cycleDay','daysFromOvulation','daysToNextPeriod','sleepHours','waterCount','caffeineCount','alcoholCount','fruitCount','wellbeing','energy',...allMetricKeys];
const clamp=(v,min,max,fb='')=>v===''?fb:(Number.isFinite(+v)?Math.min(max,Math.max(min,+v)):fb);
const esc=v=>'"'+String(Array.isArray(v)?v.join('|'):v??'').replaceAll('"','""')+'"';

app.innerHTML=`<main class="app">
<div class="hero"><div><h1>Tages-, Neuro- & Zyklus-Tracker</h1><p>Selbstbeobachtung · Muster erkennen · lokal & verschlüsselt sichern</p></div><div class="hero-actions"><span id="saveIndicator" class="save-indicator saved">✓ Lokal bereit</span><span id="cloudIndicator" class="save-indicator">☁ Drive nicht verbunden</span><span class="pill blue">Offline-fähig</span></div></div>
<section class="card"><div class="row"><label>Datum<input id="date" type="date" value="${today()}"></label><div><div class="muted">Status</div><div id="editState">Neuer Eintrag</div></div></div></section>
<section class="card"><h2>Schnelle Tageszähler</h2><div class="counter-grid">${[['waterCount','Wasser / Saft'],['caffeineCount','Koffein'],['alcoholCount','Alkohol'],['fruitCount','Obst']].map(([k,l])=>`<div class="counter"><b>${l}</b><div class="counter-controls"><button data-counter="${k}" data-delta="-1">−</button><input id="${k}" type="number" value="0" min="0" max="50"><button data-counter="${k}" data-delta="1">+</button></div></div>`).join('')}</div></section>
<section class="card" id="metrics"></section>
<section class="card"><h2>Tageskontext</h2><div id="contexts" class="context-grid"></div></section>
<section class="card"><div class="hero"><div><h2>Zyklus</h2><div id="cycleHeadline" class="muted">Noch kein Zyklusbeginn hinterlegt.</div></div><span id="phasePill" class="pill">Phase unbekannt</span></div><div id="cycleDetails" class="muted"></div><div class="row section"><label><input id="periodStart" type="checkbox"> 1. Tag der Regel</label><label><input id="ovulationObserved" type="checkbox"> Ovulation vermutet</label></div><div class="section"><label>Blutung<select id="bleeding"><option value="0">Keine</option><option value="1">Sehr leicht</option><option value="2">Leicht</option><option value="3">Mittel</option><option value="4">Stark</option></select></label></div><div id="ovuDetails" class="section hidden"><label>Grundlage<select id="ovulationMethod"><option value="symptoms">Körpersymptome / Mittelschmerz</option><option value="lh">LH-Test</option><option value="temperature">Basaltemperatur</option><option value="combined">Mehrere Hinweise kombiniert</option><option value="medical">Ärztliche Einschätzung</option><option value="other">Sonstiges</option></select></label><div class="row"><label>Unsicherheit davor<input id="ovuMinus" type="number" min="0" max="5" value="1"></label><label>Unsicherheit danach<input id="ovuPlus" type="number" min="0" max="5" value="1"></label></div><p class="muted">Der eingetragene Tag ist der wahrscheinlichste Mittelpunkt, kein exakt sicherer Eisprung.</p></div><details class="section"><summary><b>Prognose-Einstellungen</b></summary><div class="row section"><label>Ø Zykluslänge<input id="avgCycleLength" type="number" min="20" max="45" value="${settings.avgCycleLength}"></label><label>Ø Lutealphase<input id="avgLutealLength" type="number" min="8" max="18" value="${settings.avgLutealLength}"></label></div><label>Prognose-Unsicherheit ± Tage<input id="predictionUncertainty" type="number" min="1" max="5" value="${settings.predictionUncertainty}"></label><p id="learnedInfo" class="muted"></p></details></section>
<section class="card"><h2>Tagesabschluss</h2><div class="row"><label>Wohlbefinden 0–10<input id="wellbeing" type="number" min="0" max="10" value="5"></label><label>Energie 0–10<input id="energy" type="number" min="0" max="10" value="5"></label></div><label>Was war heute auffällig?<textarea id="notes" rows="4" maxlength="1200"></textarea></label><div class="btns"><button id="save" class="btn primary">Tag speichern</button><button id="delete" class="btn danger" disabled>Eintrag löschen</button><button id="clear" class="btn">Neuer Eintrag</button></div><div id="status" class="status"></div></section>
<section class="card"><h2>Daten & Backup</h2>
<div class="backup-grid">
  <div class="backup-panel"><h3>Lokale Dateien</h3><p class="muted">Für Analyse, manuellen Export und Notfälle.</p><div class="btns"><button id="jsonExport" class="btn">JSON-Backup</button><button id="csvWide" class="btn">CSV breit</button><button id="csvLong" class="btn">CSV lang</button><label class="btn">Backup importieren<input id="jsonImport" type="file" accept=".json" hidden></label></div></div>
  <div class="backup-panel"><div class="row"><div><h3>Google Drive</h3><p id="driveStatus" class="muted">${isDriveConfigured()?'Nicht verbunden.':'Noch nicht konfiguriert.'}</p></div><span id="driveBadge" class="pill">${isDriveConfigured()?'Offline':'Setup nötig'}</span></div>
    <label>Backup-Passwort<input id="backupPassphrase" type="password" minlength="8" autocomplete="new-password" placeholder="Mindestens 8 Zeichen"></label>
    <label class="checkline"><input id="rememberPassphrase" type="checkbox" ${settings.rememberBackupPassphrase?'checked':''}> Passwort nur auf diesem Gerät merken</label>
    <p class="muted">Die Sicherungen landen in Google Drive im Ordner <b>${backupFolderName()}</b>. Sie werden vor dem Upload im Browser mit AES-256-GCM verschlüsselt; das Passwort wird nie zu Google übertragen.</p><p class="backup-warning"><b>Wichtig:</b> Ohne dieses Backup-Passwort können die verschlüsselten Sicherungen nicht wiederhergestellt werden. Bewahre es unabhängig vom Handy auf.</p>
    <div class="btns"><button id="driveConnect" class="btn primary">Drive verbinden</button><button id="driveBackupNow" class="btn" disabled>Jetzt sichern</button><button id="driveRefresh" class="btn" disabled>Sicherungen laden</button><button id="driveDisconnect" class="btn" disabled>Trennen</button></div>
    <div class="section"><label>Sicherung auswählen<select id="driveBackupSelect" disabled><option value="">Keine Sicherungen geladen</option></select></label><div id="restorePreview" class="muted section">Wähle eine Sicherung, um Datum und Umfang zu prüfen.</div><div class="btns"><button id="driveRestoreMerge" class="btn" disabled>Zusammenführen</button><button id="driveRestoreReplace" class="btn danger" disabled>Lokale Daten ersetzen</button></div></div>
    <p id="driveLastBackup" class="muted">Noch keine Cloud-Sicherung in dieser Installation.</p>
  </div>
</div><div id="history"></div></section>
<section class="card"><h2>Auswertungen</h2><div class="tabs"><button class="tab active" data-tab="time">Zeitreihe</button><button class="tab" data-tab="cycle">Zyklusmuster</button><button class="tab" data-tab="pre">Prämenstruell</button><button class="tab" data-tab="corr">Korrelationen</button></div><div id="analysis"></div></section>
<div id="searchOverlay" class="search-overlay hidden" aria-hidden="true">
  <section class="search-panel" role="dialog" aria-modal="true" aria-labelledby="searchTitle">
    <div class="search-head"><div><h2 id="searchTitle">In der App suchen</h2><p class="muted">Suche z. B. nach „Emotionen“, „Alkohol“, „Trigger“ oder „Zyklus“.</p></div><button id="searchClose" class="icon-btn" type="button" aria-label="Suche schließen">×</button></div>
    <div class="search-input-wrap"><span aria-hidden="true">🔍</span><input id="appSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Begriff eingeben …" aria-label="App durchsuchen"></div>
    <div id="searchResults" class="search-results" role="listbox"><div class="muted">Tippe einen Begriff ein.</div></div>
  </section>
</div>
<button id="floatingSearch" class="floating-search" type="button" aria-label="In der App suchen" title="Suchen">🔍</button>
<button id="floatingSave" class="floating-save" type="button" aria-label="Aktuellen Tag jetzt speichern" title="Jetzt lokal speichern">✓</button><div id="floatingSaveLabel" class="floating-save-label">Lokal gespeichert</div>
</main>`;

const metricRoot=document.querySelector('#metrics');
for(const g of GROUPS){const sec=document.createElement('div');sec.className='section';sec.innerHTML=`<h3>${g.title}</h3>`;for(const [k,l] of g.items){const pos=POSITIVE_KEYS.has(k);const row=document.createElement('div');row.className='metric';row.innerHTML=`<div class="metric-head"><label for="m_${k}">${l}</label><output id="o_${k}">${pos?2:0}</output></div><input id="m_${k}" type="range" min="0" max="4" step="1" value="${pos?2:0}"><div class="scale"><span>${pos?'sehr wenig':'gar nicht'}</span><span>${pos?'sehr viel':'extrem'}</span></div>`;sec.appendChild(row);row.querySelector('input').addEventListener('input',e=>row.querySelector('output').textContent=e.target.value)}metricRoot.appendChild(sec)}
const nutrition=document.createElement('div');nutrition.className='section';nutrition.innerHTML=`<label>Ernährungsweise heute<select id="dietType"><option value="vegan">Vegan</option><option value="vegetarian">Vegetarisch</option><option value="omnivore">Omnivor</option><option value="mixed">Gemischt / nicht eindeutig</option></select></label>`;metricRoot.children[1].appendChild(nutrition);
const sleepRow=document.createElement('div');sleepRow.className='metric';sleepRow.innerHTML='<label>Schlafstunden<input id="sleepHours" type="number" min="0" max="24" step="0.5" placeholder="7.5"></label>';metricRoot.children[0].insertBefore(sleepRow,metricRoot.children[0].children[1]);
for(const [k,l] of CONTEXTS){const lab=document.createElement('label');lab.innerHTML=`<input type="checkbox" value="${k}"> ${l}`;document.querySelector('#contexts').appendChild(lab)}

const searchOverlay=document.querySelector('#searchOverlay');
const searchInput=document.querySelector('#appSearchInput');
const searchResults=document.querySelector('#searchResults');
const floatingSearch=document.querySelector('#floatingSearch');
let searchIndex=[];

function normalizeSearchText(value){
  return String(value||'').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function buildSearchIndex(){
  const items=[];
  const seen=new Set();
  const add=(label,target,category='Bereich')=>{
    const text=String(label||'').replace(/\s+/g,' ').trim();
    if(!text||!target)return;
    const key=category+'|'+text;
    if(seen.has(key))return;
    seen.add(key);
    items.push({label:text,category,target,haystack:normalizeSearchText(category+' '+text)});
  };
  document.querySelectorAll('.card > h2, .card .hero h2').forEach(el=>add(el.textContent,el.closest('.card'),'Bereich'));
  metricRoot.querySelectorAll('.section > h3').forEach(el=>add(el.textContent,el.closest('.section'),'Kategorie'));
  metricRoot.querySelectorAll('.metric label').forEach(el=>add(el.textContent,el.closest('.metric'),'Eintrag'));
  document.querySelectorAll('.counter b').forEach(el=>add(el.textContent,el.closest('.counter'),'Zähler'));
  document.querySelectorAll('#contexts label').forEach(el=>add(el.textContent,el.closest('label'),'Tageskontext'));
  add('Schlafstunden',document.querySelector('#sleepHours')?.closest('.metric'),'Eintrag');
  add('Ernährungsweise heute',document.querySelector('#dietType')?.closest('.section'),'Eintrag');
  add('1. Tag der Regel',document.querySelector('#periodStart')?.closest('label'),'Zyklus');
  add('Ovulation vermutet',document.querySelector('#ovulationObserved')?.closest('label'),'Zyklus');
  add('Blutung',document.querySelector('#bleeding')?.closest('.section'),'Zyklus');
  add('Wohlbefinden',document.querySelector('#wellbeing')?.closest('label'),'Tagesabschluss');
  add('Energie',document.querySelector('#energy')?.closest('label'),'Tagesabschluss');
  add('Was war heute auffällig Tagesnotiz Notizen',document.querySelector('#notes')?.closest('label'),'Tagesabschluss');
  add('Google Drive Backup Sicherung Wiederherstellen',document.querySelector('#driveStatus')?.closest('.backup-panel'),'Daten & Backup');
  add('JSON Backup CSV Export Import',document.querySelector('#jsonExport')?.closest('.backup-panel'),'Daten & Backup');
  add('Zeitreihe Zyklusmuster Prämenstruell Korrelationen Auswertungen',document.querySelector('#analysis')?.closest('.card'),'Auswertungen');
  searchIndex=items;
}
function highlightSearchTarget(target){
  if(!target)return;
  document.querySelectorAll('.search-highlight').forEach(el=>el.classList.remove('search-highlight'));
  target.classList.add('search-highlight');
  target.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>target.classList.remove('search-highlight'),1800);
}
function closeSearch(){
  searchOverlay.classList.add('hidden');
  searchOverlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('search-open');
}
function openSearch(){
  buildSearchIndex();
  searchOverlay.classList.remove('hidden');
  searchOverlay.setAttribute('aria-hidden','false');
  document.body.classList.add('search-open');
  searchInput.value='';
  searchResults.innerHTML='<div class="muted">Tippe einen Begriff ein.</div>';
  setTimeout(()=>searchInput.focus(),30);
}
function renderSearchResults(){
  const q=normalizeSearchText(searchInput.value);
  if(!q){searchResults.innerHTML='<div class="muted">Tippe einen Begriff ein.</div>';return;}
  const terms=q.split(' ').filter(Boolean);
  const matches=searchIndex.filter(item=>terms.every(t=>item.haystack.includes(t))).slice(0,24);
  if(!matches.length){searchResults.innerHTML='<div class="search-empty">Kein Treffer. Versuch einen kürzeren oder allgemeineren Begriff.</div>';return;}
  searchResults.innerHTML='';
  for(const item of matches){
    const button=document.createElement('button');
    button.type='button';
    button.className='search-result';
    button.setAttribute('role','option');
    button.innerHTML=`<span class="search-result-main">${item.label}</span><span class="search-result-category">${item.category}</span>`;
    button.addEventListener('click',()=>{const target=item.target;closeSearch();setTimeout(()=>highlightSearchTarget(target),80);});
    searchResults.appendChild(button);
  }
}

floatingSearch.addEventListener('click',openSearch);
document.querySelector('#searchClose').addEventListener('click',closeSearch);
searchOverlay.addEventListener('click',e=>{if(e.target===searchOverlay)closeSearch();});
searchInput.addEventListener('input',renderSearchResults);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!searchOverlay.classList.contains('hidden'))closeSearch();});

document.querySelectorAll('[data-counter]').forEach(b=>b.addEventListener('click',()=>{const i=document.querySelector('#'+b.dataset.counter);i.value=Math.max(0,Math.min(50,(+i.value||0)+(+b.dataset.delta)));scheduleLocalSave();}));
document.querySelector('#ovulationObserved').addEventListener('change',e=>document.querySelector('#ovuDetails').classList.toggle('hidden',!e.target.checked));

function getInfo(date){return cycleInfo(date,entries,settings)}
function updateCycle(){settings={...settings,avgCycleLength:clamp(document.querySelector('#avgCycleLength').value,20,45,30),avgLutealLength:clamp(document.querySelector('#avgLutealLength').value,8,18,11),predictionUncertainty:clamp(document.querySelector('#predictionUncertainty').value,1,5,2)}; const i=getInfo(document.querySelector('#date').value);document.querySelector('#cycleHeadline').textContent=i.cycleDay?`Zyklustag ${i.cycleDay}`:'Noch kein Zyklusbeginn hinterlegt.';document.querySelector('#phasePill').textContent=i.phase||'Phase unbekannt';document.querySelector('#cycleDetails').textContent=i.cycleDay?`${i.phase}. Ovulation ${i.ovulationSource} um ZT ${i.ovulationDay}; Fenster ZT ${i.ovulationWindowStart}–${i.ovulationWindowEnd}. Erwarteter/nächster Menstruationsbeginn: ${i.nextPeriodDate}.`:'Dieser Bereich muss nicht täglich ausgefüllt werden.'; if(i.stats)document.querySelector('#learnedInfo').textContent=`Verwendet: ${i.stats.cycleLength.toFixed(1)} Tage Zyklus (${i.stats.nCycles>=2?'eigene Daten':'Vorgabe'}), ${i.stats.lutealLength.toFixed(1)} Tage Lutealphase (${i.stats.nLuteals>=2?'eigene Daten':'Vorgabe'}).`;}
['date','periodStart','avgCycleLength','avgLutealLength','predictionUncertainty','ovuMinus','ovuPlus'].forEach(id=>document.querySelector('#'+id).addEventListener('change',()=>{updateCycle();putSettings(settings);scheduleAutoBackup();}));

function collect(){const date=document.querySelector('#date').value;if(!date)throw new Error('Datum fehlt.');const e={date,updatedAt:new Date().toISOString(),periodStart:document.querySelector('#periodStart').checked,bleeding:+document.querySelector('#bleeding').value,ovulationObserved:document.querySelector('#ovulationObserved').checked,ovulationMethod:document.querySelector('#ovulationObserved').checked?document.querySelector('#ovulationMethod').value:'',ovuMinus:clamp(document.querySelector('#ovuMinus').value,0,5,1),ovuPlus:clamp(document.querySelector('#ovuPlus').value,0,5,1),sleepHours:clamp(document.querySelector('#sleepHours').value,0,24,''),waterCount:clamp(document.querySelector('#waterCount').value,0,50,0),caffeineCount:clamp(document.querySelector('#caffeineCount').value,0,30,0),alcoholCount:clamp(document.querySelector('#alcoholCount').value,0,30,0),fruitCount:clamp(document.querySelector('#fruitCount').value,0,20,0),dietType:document.querySelector('#dietType').value,wellbeing:clamp(document.querySelector('#wellbeing').value,0,10,5),energy:clamp(document.querySelector('#energy').value,0,10,5),contexts:[...document.querySelectorAll('#contexts input:checked')].map(x=>x.value),notes:document.querySelector('#notes').value.trim()};for(const k of allMetricKeys)e[k]=+document.querySelector('#m_'+k).value;return e}
function load(e){suppressAutoSave=true;document.querySelector('#date').value=e.date;document.querySelector('#periodStart').checked=!!e.periodStart;document.querySelector('#bleeding').value=e.bleeding??0;document.querySelector('#ovulationObserved').checked=!!e.ovulationObserved;document.querySelector('#ovuDetails').classList.toggle('hidden',!e.ovulationObserved);document.querySelector('#ovulationMethod').value=e.ovulationMethod||'symptoms';document.querySelector('#ovuMinus').value=e.ovuMinus??1;document.querySelector('#ovuPlus').value=e.ovuPlus??1;document.querySelector('#sleepHours').value=e.sleepHours??'';for(const k of ['waterCount','caffeineCount','alcoholCount','fruitCount'])document.querySelector('#'+k).value=e[k]??0;document.querySelector('#dietType').value=e.dietType||'vegan';document.querySelector('#wellbeing').value=e.wellbeing??5;document.querySelector('#energy').value=e.energy??5;for(const k of allMetricKeys){const v=e[k]??(POSITIVE_KEYS.has(k)?2:0);document.querySelector('#m_'+k).value=v;document.querySelector('#o_'+k).textContent=v}document.querySelectorAll('#contexts input').forEach(x=>x.checked=(e.contexts||[]).includes(x.value));document.querySelector('#notes').value=e.notes||'';document.querySelector('#editState').textContent='Bestehender Eintrag wird bearbeitet';document.querySelector('#delete').disabled=false;updateCycle();setLocalSaveState('saved','Lokal gespeichert');suppressAutoSave=false}
function reset(){suppressAutoSave=true;document.querySelector('#periodStart').checked=false;document.querySelector('#bleeding').value=0;document.querySelector('#ovulationObserved').checked=false;document.querySelector('#ovuDetails').classList.add('hidden');document.querySelector('#sleepHours').value='';for(const k of ['waterCount','caffeineCount','alcoholCount','fruitCount'])document.querySelector('#'+k).value=0;document.querySelector('#dietType').value='vegan';document.querySelector('#wellbeing').value=5;document.querySelector('#energy').value=5;for(const k of allMetricKeys){const v=POSITIVE_KEYS.has(k)?2:0;document.querySelector('#m_'+k).value=v;document.querySelector('#o_'+k).textContent=v}document.querySelectorAll('#contexts input').forEach(x=>x.checked=false);document.querySelector('#notes').value='';document.querySelector('#editState').textContent='Neuer Eintrag';document.querySelector('#delete').disabled=true;updateCycle();setLocalSaveState('saved','Bereit');suppressAutoSave=false}
function renderHistory(){const h=document.querySelector('#history');h.innerHTML=`<p class="muted">${entries.length} Einträge gespeichert.</p>`;for(const e of [...entries].reverse().slice(0,12)){const info=getInfo(e.date),r=document.createElement('div');r.className='history-item';r.innerHTML=`<div><b>${e.date}${info.cycleDay?' · ZT '+info.cycleDay:''}</b><div class="muted">${info.phase||''} · ${e.waterCount??0} Wasser/Saft · ${e.caffeineCount??0} Koffein · ${e.alcoholCount??0} Alkohol · ${e.fruitCount??0} Obst</div></div>`;const b=document.createElement('button');b.className='btn';b.textContent='Bearbeiten';b.addEventListener('click',()=>load(e));r.appendChild(b);h.appendChild(r)}}
function enriched(){return entries.map(e=>({...e,...getInfo(e.date)}))}
function pearson(a,b){const p=a.map((x,i)=>[+x,+b[i]]).filter(q=>Number.isFinite(q[0])&&Number.isFinite(q[1]));if(p.length<3)return{r:NaN,n:p.length};const ax=mean(p.map(q=>q[0])),ay=mean(p.map(q=>q[1]));let top=0,xx=0,yy=0;p.forEach(([x,y])=>{x-=ax;y-=ay;top+=x*y;xx+=x*x;yy+=y*y});return{r:xx&&yy?top/Math.sqrt(xx*yy):NaN,n:p.length}}
function selectOptions(extraNone=false){return (extraNone?'<option value="">Keine</option>':'')+numericKeys.map(k=>`<option value="${k}">${LABELS[k]||k}</option>`).join('')}
function renderAnalysis(tab='time'){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const a=document.querySelector('#analysis'),rows=enriched();if(tab==='time'){a.innerHTML=`<div class="row"><label>Variable 1<select id="t1">${selectOptions()}</select></label><label>Variable 2<select id="t2">${selectOptions(true)}</select></label></div><canvas id="chart" class="chart" width="800" height="240"></canvas>`;document.querySelector('#t1').value='irritability';const draw=()=>{const c=document.querySelector('#chart'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(rows.length<2){ctx.fillText('Noch nicht genug Daten.',20,30);return}const ks=[document.querySelector('#t1').value,document.querySelector('#t2').value].filter(Boolean);const vals=ks.flatMap(k=>rows.map(r=>+r[k]).filter(Number.isFinite));const lo=Math.min(...vals),hi=Math.max(...vals),sp=hi-lo||1;ctx.strokeStyle='#34465c';ctx.fillStyle='#94a3b8';ctx.beginPath();ctx.moveTo(40,200);ctx.lineTo(780,200);ctx.stroke();ks.forEach((k,j)=>{ctx.strokeStyle=j?'#a78bfa':'#3f8cff';ctx.beginPath();rows.forEach((r,i)=>{const v=+r[k];if(!Number.isFinite(v))return;const x=40+(740*i/Math.max(1,rows.length-1)),y=200-(160*(v-lo)/sp);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()})};draw();document.querySelector('#t1').onchange=draw;document.querySelector('#t2').onchange=draw}
if(tab==='cycle'){a.innerHTML=`<label>Symptom<select id="cm">${selectOptions()}</select></label><div id="cres" class="section"></div>`;document.querySelector('#cm').value='irritability';const f=()=>{const k=document.querySelector('#cm').value,ph={};rows.forEach(r=>{if(r.phase)(ph[r.phase]??=[]).push(+r[k])});document.querySelector('#cres').innerHTML=Object.entries(ph).map(([p,v])=>`<div class="history-item"><span>${p}</span><b>Ø ${mean(v.filter(Number.isFinite)).toFixed(2)}</b></div>`).join('')||'<p class="muted">Noch nicht genug Zyklusdaten.</p>'};f();document.querySelector('#cm').onchange=f}
if(tab==='pre'){a.innerHTML=`<label>Symptom<select id="pm">${selectOptions()}</select></label><div id="pres" class="section"></div>`;document.querySelector('#pm').value='irritability';const f=()=>{const k=document.querySelector('#pm').value,pre=rows.filter(r=>Number.isFinite(+r.daysToNextPeriod)&&r.daysToNextPeriod>=0&&r.daysToNextPeriod<=7);document.querySelector('#pres').innerHTML=pre.length?`<p><b>${pre.length}</b> Messungen in den letzten 7 Tagen vor einer nachfolgenden Menstruation. Mittelwert ${mean(pre.map(r=>+r[k]).filter(Number.isFinite)).toFixed(2)}.</p>`:'<p class="muted">Noch nicht genug abgeschlossene Zyklen.</p>'};f();document.querySelector('#pm').onchange=f}
if(tab==='corr'){a.innerHTML=`<div class="row"><label>Variable X<select id="cx">${selectOptions()}</select></label><label>Variable Y<select id="cy">${selectOptions()}</select></label></div><div id="corrRes" class="section"></div>`;document.querySelector('#cx').value='caffeineCount';document.querySelector('#cy').value='sleepQuality';const f=()=>{const x=document.querySelector('#cx').value,y=document.querySelector('#cy').value,r=pearson(rows.map(e=>e[x]),rows.map(e=>e[y]));document.querySelector('#corrRes').textContent=r.n<5?`${r.n} gemeinsame Messpunkte. Mindestens fünf erforderlich.`:`Pearson r = ${r.r.toFixed(2)} bei n=${r.n}.`};f();document.querySelector('#cx').onchange=f;document.querySelector('#cy').onchange=f}}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>renderAnalysis(b.dataset.tab)));
function download(name,text,type){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

let cloudBackups=[];
let selectedCloudPayload=null;
let autoBackupTimer=null;
let cloudBusy=false;

const saveIndicator=document.querySelector('#saveIndicator');
const floatingSave=document.querySelector('#floatingSave');
const floatingSaveLabel=document.querySelector('#floatingSaveLabel');
const cloudIndicator=document.querySelector('#cloudIndicator');
function setLocalSaveState(state,text){
  const icon=state==='saved'?'✓':state==='saving'?'↻':state==='dirty'?'•':'!';
  saveIndicator.className=`save-indicator ${state}`;
  saveIndicator.textContent=`${icon} ${text}`;
  floatingSave.className=`floating-save ${state}`;
  floatingSave.textContent=state==='saving'?'↻':state==='error'?'!':'✓';
}
function flashSaveLabel(text){
  clearTimeout(saveLabelTimer); floatingSaveLabel.textContent=text; floatingSaveLabel.classList.add('show');
  saveLabelTimer=setTimeout(()=>floatingSaveLabel.classList.remove('show'),1800);
}
async function persistCurrentDay({manual=false}={}){
  if(localSaveBusy) return;
  clearTimeout(localSaveTimer); localSaveBusy=true; setLocalSaveState('saving','Speichere lokal …');
  try{
    const e=collect(); await putEntry(e); entries=await getAllEntries();
    document.querySelector('#delete').disabled=false;
    document.querySelector('#editState').textContent='Bestehender Eintrag wird bearbeitet';
    renderHistory(); updateCycle(); renderAnalysis(document.querySelector('.tab.active')?.dataset.tab||'time');
    const stamp=new Date().toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});
    setLocalSaveState('saved',`Lokal gespeichert · ${stamp}`);
    if(manual){document.querySelector('#status').textContent=`${e.date} lokal gespeichert. Auswertungen wurden aktualisiert.`;flashSaveLabel('✓ Lokal gespeichert');}
    scheduleAutoBackup();
  }catch(err){setLocalSaveState('error','Speichern fehlgeschlagen');document.querySelector('#status').textContent=err.message;flashSaveLabel('Speichern fehlgeschlagen');}
  finally{localSaveBusy=false;}
}
function scheduleLocalSave(){
  if(suppressAutoSave) return;
  clearTimeout(localSaveTimer); setLocalSaveState('dirty','Ungespeicherte Änderungen');
  localSaveTimer=setTimeout(()=>persistCurrentDay({manual:false}),900);
}
function isDailyControl(el){
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return false;
  if(el.id==='date' || el.id==='backupPassphrase' || el.id==='rememberPassphrase' || el.id==='jsonImport') return false;
  if(['avgCycleLength','avgLutealLength','predictionUncertainty'].includes(el.id)) return false;
  if(el.closest('.backup-grid') || el.closest('#analysis')) return false;
  return true;
}
app.addEventListener('input',e=>{if(isDailyControl(e.target))scheduleLocalSave();});
app.addEventListener('change',e=>{if(isDailyControl(e.target))scheduleLocalSave();});
floatingSave.addEventListener('click',()=>persistCurrentDay({manual:true}));

const driveStatus=document.querySelector('#driveStatus');
const driveBadge=document.querySelector('#driveBadge');
const driveBackupSelect=document.querySelector('#driveBackupSelect');
const restorePreview=document.querySelector('#restorePreview');
const backupPassphrase=document.querySelector('#backupPassphrase');
if(settings.rememberBackupPassphrase && settings.backupPassphrase) backupPassphrase.value=settings.backupPassphrase;
if(settings.lastCloudBackupAt) document.querySelector('#driveLastBackup').textContent=`Zuletzt erfolgreich gesichert: ${new Date(settings.lastCloudBackupAt).toLocaleString('de-AT')}`;

function setCloudUi(connected,message=''){
  document.querySelector('#driveBackupNow').disabled=!connected || backupPassphrase.value.length<8;
  document.querySelector('#driveRefresh').disabled=!connected;
  document.querySelector('#driveDisconnect').disabled=!connected;
  driveBadge.textContent=connected?'Verbunden':(isDriveConfigured()?'Offline':'Setup nötig');
  driveStatus.textContent=message||(connected?'Google Drive verbunden.':'Nicht verbunden.');
  if(cloudIndicator){
    cloudIndicator.className=`save-indicator ${connected?'saved':''}`;
    if(connected && settings.lastCloudBackupAt){const t=new Date(settings.lastCloudBackupAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});cloudIndicator.textContent=`☁ Drive · ${t}`;}
    else cloudIndicator.textContent=connected?'☁ Drive verbunden':(isDriveConfigured()?'☁ Drive offline':'☁ Drive Setup nötig');
  }
}
function getBackupPassphrase(){
  const p=backupPassphrase.value;
  if(!p || p.length<8) throw new Error('Bitte ein Backup-Passwort mit mindestens 8 Zeichen eingeben.');
  return p;
}
async function persistPassphrasePreference(){
  const remember=document.querySelector('#rememberPassphrase').checked;
  settings={...settings,rememberBackupPassphrase:remember,backupPassphrase:remember?backupPassphrase.value:''};
  await putSettings(settings);
}
function formatBackupLabel(f){
  const d=new Date(f.createdTime||f.modifiedTime);
  const size=f.size?` · ${(Number(f.size)/1024).toFixed(1)} KB`:'';
  return `${d.toLocaleString('de-AT')}${size}`;
}
async function pruneCloudBackups(files){
  const keep=chooseBackupsToKeep(files);
  const doomed=files.filter(f=>!keep.has(f.id));
  for(const f of doomed){
    try{await deleteDriveFile(f.id,{interactive:false});}catch(e){console.warn('Altes Drive-Backup konnte nicht gelöscht werden',e);}
  }
}
async function refreshCloudBackups({interactive=false}={}){
  cloudBackups=await listBackups({interactive});
  driveBackupSelect.innerHTML='';
  if(!cloudBackups.length){
    driveBackupSelect.innerHTML='<option value="">Keine Cloud-Sicherungen vorhanden</option>';
    driveBackupSelect.disabled=true;
    restorePreview.textContent='Noch keine Sicherung in Google Drive.';
    document.querySelector('#driveRestoreMerge').disabled=true;
    document.querySelector('#driveRestoreReplace').disabled=true;
    return;
  }
  for(const f of cloudBackups){const o=document.createElement('option');o.value=f.id;o.textContent=formatBackupLabel(f);driveBackupSelect.appendChild(o)}
  driveBackupSelect.disabled=false;
  await previewSelectedCloudBackup();
}
async function previewSelectedCloudBackup(){
  selectedCloudPayload=null;
  const id=driveBackupSelect.value;
  if(!id){restorePreview.textContent='Keine Sicherung ausgewählt.';return;}
  const f=cloudBackups.find(x=>x.id===id);
  document.querySelector('#driveRestoreMerge').disabled=true;
  document.querySelector('#driveRestoreReplace').disabled=true;
  try{
    const pass=getBackupPassphrase();
    restorePreview.textContent='Sicherung wird geprüft …';
    const encrypted=await downloadBackup(id,{interactive:false});
    const payload=await decryptJson(encrypted,pass);
    if(payload?.format!=='neuro-cycle-tracker' || !Array.isArray(payload.entries)) throw new Error('Unbekanntes Tracker-Backup.');
    selectedCloudPayload=payload;
    const dates=payload.entries.map(e=>e.date).filter(Boolean).sort();
    const range=dates.length?`${dates[0]} bis ${dates[dates.length-1]}`:'keine Einträge';
    restorePreview.textContent=`${formatBackupLabel(f)} · ${payload.entries.length} Einträge · Zeitraum ${range}`;
    document.querySelector('#driveRestoreMerge').disabled=false;
    document.querySelector('#driveRestoreReplace').disabled=false;
  }catch(e){restorePreview.textContent=e.message;}
}
async function createCloudBackup({interactive=false,announce=true}={}){
  if(cloudBusy) return;
  cloudBusy=true;
  try{
    const pass=getBackupPassphrase();
    await persistPassphrasePreference();
    driveStatus.textContent='Verschlüssele und sichere …';
    const payload=makeBackupPayload(entries,settings);
    const encrypted=await encryptJson(payload,pass);
    await uploadBackup(encrypted,{interactive});
    settings={...settings,lastCloudBackupAt:new Date().toISOString()};
    await putSettings(settings);
    document.querySelector('#driveLastBackup').textContent=`Zuletzt erfolgreich gesichert: ${new Date(settings.lastCloudBackupAt).toLocaleString('de-AT')}`;
    setCloudUi(true,'Cloud-Sicherung erfolgreich.');
    saveIndicator.title=`Google Drive gesichert: ${new Date(settings.lastCloudBackupAt).toLocaleString('de-AT')}`;
    if(cloudIndicator){const t=new Date(settings.lastCloudBackupAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});cloudIndicator.className='save-indicator saved';cloudIndicator.textContent=`☁ Drive · ${t}`;}
    cloudBackups=await listBackups({interactive:false});
    await pruneCloudBackups(cloudBackups);
    await refreshCloudBackups({interactive:false});
    if(announce) document.querySelector('#status').textContent='Zusätzlich verschlüsselt in Google Drive gesichert.';
  }catch(e){
    driveStatus.textContent=`Cloud-Backup fehlgeschlagen: ${e.message}`;
    if(cloudIndicator){cloudIndicator.className='save-indicator error';cloudIndicator.textContent='☁ Drive Fehler';}
    if(announce) document.querySelector('#status').textContent=`Lokal gespeichert, Cloud-Backup fehlgeschlagen: ${e.message}`;
  }finally{cloudBusy=false;}
}
function scheduleAutoBackup(){
  clearTimeout(autoBackupTimer);
  if(!isDriveAuthorized() || !backupPassphrase.value) return;
  autoBackupTimer=setTimeout(()=>createCloudBackup({interactive:false,announce:false}),8000);
}
async function restoreCloud(mode){
  if(!selectedCloudPayload) await previewSelectedCloudBackup();
  if(!selectedCloudPayload) return;
  const cloudEntries=selectedCloudPayload.entries||[];
  const result=mode==='merge'?mergeEntries(entries,cloudEntries):cloudEntries;
  if(mode==='replace' && !confirm(`Lokale Daten wirklich durch ${cloudEntries.length} Einträge aus dieser Sicherung ersetzen?`)) return;
  await replaceEntries(result);
  if(selectedCloudPayload.settings){
    const keepCloud={rememberBackupPassphrase:settings.rememberBackupPassphrase,backupPassphrase:settings.backupPassphrase,lastCloudBackupAt:settings.lastCloudBackupAt};
    settings={...settings,...selectedCloudPayload.settings,...keepCloud};
    await putSettings(settings);
    document.querySelector('#avgCycleLength').value=settings.avgCycleLength;
    document.querySelector('#avgLutealLength').value=settings.avgLutealLength;
    document.querySelector('#predictionUncertainty').value=settings.predictionUncertainty;
  }
  entries=await getAllEntries();
  renderHistory();updateCycle();renderAnalysis(document.querySelector('.tab.active').dataset.tab);
  document.querySelector('#status').textContent=mode==='merge'?`Cloud-Sicherung zusammengeführt. ${entries.length} Einträge vorhanden.`:`Cloud-Sicherung wiederhergestellt. ${entries.length} Einträge vorhanden.`;
}

document.querySelector('#driveConnect').addEventListener('click',async()=>{
  try{driveStatus.textContent='Verbinde mit Google Drive …';await authorizeDrive({interactive:true});setCloudUi(true,`Google Drive verbunden · Ordner: ${backupFolderName()}`);await refreshCloudBackups({interactive:false});}
  catch(e){setCloudUi(false,`Verbindung fehlgeschlagen: ${e.message}`);}
});
document.querySelector('#driveDisconnect').addEventListener('click',()=>{disconnectDrive();setCloudUi(false);cloudBackups=[];driveBackupSelect.innerHTML='<option value="">Nicht verbunden</option>';driveBackupSelect.disabled=true;});
document.querySelector('#driveBackupNow').addEventListener('click',()=>createCloudBackup({interactive:false,announce:true}));
document.querySelector('#driveRefresh').addEventListener('click',async()=>{try{await refreshCloudBackups({interactive:false});setCloudUi(true,'Sicherungen aktualisiert.');}catch(e){driveStatus.textContent=e.message;}});
driveBackupSelect.addEventListener('change',previewSelectedCloudBackup);
backupPassphrase.addEventListener('input',()=>{document.querySelector('#driveBackupNow').disabled=!isDriveAuthorized() || backupPassphrase.value.length<8;});
backupPassphrase.addEventListener('change',async()=>{await persistPassphrasePreference();if(driveBackupSelect.value)previewSelectedCloudBackup();});
document.querySelector('#rememberPassphrase').addEventListener('change',persistPassphrasePreference);
document.querySelector('#driveRestoreMerge').addEventListener('click',()=>restoreCloud('merge'));
document.querySelector('#driveRestoreReplace').addEventListener('click',()=>restoreCloud('replace'));
if(!isDriveConfigured()) document.querySelector('#driveConnect').disabled=true;

document.querySelector('#save').addEventListener('click',()=>persistCurrentDay({manual:true}));
document.querySelector('#delete').addEventListener('click',async()=>{const d=document.querySelector('#date').value;if(!entries.some(e=>e.date===d))return; if(confirm(`Eintrag vom ${d} wirklich löschen?`)){await deleteEntry(d);entries=await getAllEntries();reset();renderHistory();renderAnalysis(document.querySelector('.tab.active').dataset.tab);document.querySelector('#status').textContent=`${d} gelöscht. Alles neu berechnet.`;scheduleAutoBackup()}});
document.querySelector('#clear').addEventListener('click',reset);
document.querySelector('#date').addEventListener('change',()=>{const e=entries.find(e=>e.date===document.querySelector('#date').value);e?load(e):reset()});
document.querySelector('#jsonExport').addEventListener('click',()=>download('tracker-backup.json',JSON.stringify(makeBackupPayload(entries,settings),null,2),'application/json'));
document.querySelector('#csvWide').addEventListener('click',()=>{const rows=enriched(),cols=['date','cycleNumber','cycleStart','cycleDay','phase','daysToNextPeriod','ovulationDate','ovulationDay','ovulationSource','ovulationWindowStart','ovulationWindowEnd','daysFromOvulation','periodStart','bleeding','ovulationObserved','ovulationMethod','sleepHours','waterCount','caffeineCount','alcoholCount','fruitCount','dietType','wellbeing','energy',...allMetricKeys,'contexts','notes'];download('tracker-breit.csv','\ufeff'+[cols.map(esc).join(';'),...rows.map(e=>cols.map(k=>esc(e[k])).join(';'))].join('\n'),'text/csv;charset=utf-8')});
document.querySelector('#csvLong').addEventListener('click',()=>{const rows=enriched(),lines=[['date','cycleNumber','cycleDay','phase','daysToNextPeriod','daysFromOvulation','dietType','metric','metricLabel','value'].map(esc).join(';')];for(const e of rows)for(const k of numericKeys)if(e[k]!==''&&e[k]!=null)lines.push([e.date,e.cycleNumber,e.cycleDay,e.phase,e.daysToNextPeriod,e.daysFromOvulation,e.dietType,k,LABELS[k]||k,e[k]].map(esc).join(';'));download('tracker-lang.csv','\ufeff'+lines.join('\n'),'text/csv;charset=utf-8')});
document.querySelector('#jsonImport').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const o=JSON.parse(r.result),arr=Array.isArray(o)?o:o.entries;if(!Array.isArray(arr))throw new Error('Ungültiges Backup');await replaceEntries(arr);if(o.settings){const cloudLocal={rememberBackupPassphrase:settings.rememberBackupPassphrase,backupPassphrase:settings.backupPassphrase,lastCloudBackupAt:settings.lastCloudBackupAt};settings={...settings,...o.settings,...cloudLocal};await putSettings(settings);document.querySelector('#avgCycleLength').value=settings.avgCycleLength;document.querySelector('#avgLutealLength').value=settings.avgLutealLength;document.querySelector('#predictionUncertainty').value=settings.predictionUncertainty}entries=await getAllEntries();renderHistory();updateCycle();renderAnalysis('time');setLocalSaveState('saved','Lokal bereit');document.querySelector('#status').textContent=`${entries.length} Einträge importiert.`;scheduleAutoBackup()}catch{document.querySelector('#status').textContent='Backup konnte nicht gelesen werden.'}};r.readAsText(f)});
entries=await getAllEntries();renderHistory();updateCycle();renderAnalysis('time');
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
