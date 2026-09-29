export function makeBackupPayload(entries,settings){
  return {
    format:'neuro-cycle-tracker',
    version:2,
    exportedAt:new Date().toISOString(),
    settings:{...settings,rememberBackupPassphrase:undefined,backupPassphrase:undefined},
    entries:entries.map(e=>({...e}))
  };
}

export function mergeEntries(localEntries,cloudEntries){
  const map=new Map();
  for(const e of localEntries||[]) if(e?.date) map.set(e.date,{...e});
  for(const e of cloudEntries||[]){
    if(!e?.date) continue;
    const old=map.get(e.date);
    if(!old){map.set(e.date,{...e});continue;}
    const oldTime=Date.parse(old.updatedAt||'')||0;
    const newTime=Date.parse(e.updatedAt||'')||0;
    if(newTime>=oldTime) map.set(e.date,{...e});
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function isoWeekKey(date){
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function chooseBackupsToKeep(files,now=new Date()){
  const sorted=[...(files||[])].filter(f=>f?.id&&f?.createdTime).sort((a,b)=>new Date(b.createdTime)-new Date(a.createdTime));
  const keep=new Set();
  if(sorted[0]) keep.add(sorted[0].id);
  const dayBuckets=new Map(), weekBuckets=new Map(), monthBuckets=new Map();
  for(const f of sorted){
    const d=new Date(f.createdTime);
    const ageDays=(now-d)/86400000;
    const day=d.toISOString().slice(0,10);
    const week=isoWeekKey(d);
    const month=d.toISOString().slice(0,7);
    if(ageDays<=7 && !dayBuckets.has(day)){dayBuckets.set(day,f.id);keep.add(f.id);}
    if(ageDays<=7*8 && !weekBuckets.has(week)){weekBuckets.set(week,f.id);keep.add(f.id);}
    if(ageDays<=366 && !monthBuckets.has(month)){monthBuckets.set(month,f.id);keep.add(f.id);}
  }
  return keep;
}
