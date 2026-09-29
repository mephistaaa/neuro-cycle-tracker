export function dayNum(s){const [y,m,d]=s.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000)}
export function addDays(s,n){const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+n));return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`}
export function mean(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:NaN}
export function learnCycleStats(entries, settings){
  const starts=entries.filter(e=>e.periodStart).map(e=>e.date).sort();
  const lengths=[]; for(let i=1;i<starts.length;i++) lengths.push(dayNum(starts[i])-dayNum(starts[i-1]));
  const cycleLength=lengths.length>=2?mean(lengths):settings.avgCycleLength;
  const luteals=[];
  for(let i=0;i<starts.length-1;i++){
    const st=starts[i], nx=starts[i+1];
    const ovs=entries.filter(e=>e.ovulationObserved&&e.date>=st&&e.date<nx).sort((a,b)=>a.date.localeCompare(b.date));
    if(ovs.length) luteals.push(dayNum(nx)-dayNum(ovs[ovs.length-1].date));
  }
  const lutealLength=luteals.length>=2?mean(luteals):settings.avgLutealLength;
  return {cycleLength,lutealLength,nCycles:lengths.length,nLuteals:luteals.length};
}
export function cycleInfo(date, entries, settings){
  const starts=entries.filter(e=>e.periodStart).map(e=>e.date).sort();
  const start=starts.filter(x=>x<=date).pop();
  if(!start) return {cycleDay:'',phase:'Unbekannt',ovulationSource:'none',daysFromOvulation:'',daysToNextPeriod:''};
  const next=starts.find(x=>x>date), cycleEnd=starts.find(x=>x>start), stats=learnCycleStats(entries,settings);
  const cycleDay=dayNum(date)-dayNum(start)+1, cycleNumber=starts.indexOf(start)+1;
  const obs=entries.filter(e=>e.ovulationObserved&&e.date>=start&&(!cycleEnd||e.date<cycleEnd)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  let ovDate, minus, plus, source;
  if(obs){ovDate=obs.date;minus=Number.isFinite(+obs.ovuMinus)?+obs.ovuMinus:1;plus=Number.isFinite(+obs.ovuPlus)?+obs.ovuPlus:1;source='beobachtet/vermutet';}
  else {const ovDay=Math.max(1,Math.round(stats.cycleLength-stats.lutealLength));ovDate=addDays(start,ovDay-1);minus=plus=settings.predictionUncertainty;source='geschätzt';}
  const ovDay=dayNum(ovDate)-dayNum(start)+1;
  let phase='Follikelphase'; if(cycleDay>=ovDay-minus&&cycleDay<=ovDay+plus)phase='Ovulationsfenster'; else if(cycleDay>ovDay+plus)phase='Lutealphase';
  return {cycleDay,cycleNumber,cycleStart:start,phase,ovulationDate:ovDate,ovulationDay:ovDay,ovulationSource:source,ovulationWindowStart:ovDay-minus,ovulationWindowEnd:ovDay+plus,daysFromOvulation:dayNum(date)-dayNum(ovDate),daysToNextPeriod:next?dayNum(next)-dayNum(date):'',nextPeriodDate:next||addDays(start,Math.round(stats.cycleLength)),stats};
}
