import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleInfo} from '../src/cycle.js';
const settings={avgCycleLength:30,avgLutealLength:11,predictionUncertainty:2};
test('berechnet Zyklustag aus ZT1',()=>{const e=[{date:'2026-09-01',periodStart:true}];assert.equal(cycleInfo('2026-09-05',e,settings).cycleDay,5)});
test('schätzt Ovulation bei fehlendem Eintrag',()=>{const e=[{date:'2026-09-01',periodStart:true}];assert.equal(cycleInfo('2026-09-19',e,settings).ovulationDay,19)});
test('nutzt beobachtete Ovulation mit Unsicherheitsfenster',()=>{const e=[{date:'2026-09-01',periodStart:true},{date:'2026-09-17',ovulationObserved:true,ovuMinus:1,ovuPlus:2}];const i=cycleInfo('2026-09-18',e,settings);assert.equal(i.ovulationDay,17);assert.equal(i.ovulationWindowStart,16);assert.equal(i.ovulationWindowEnd,19)});
test('berechnet Tage bis nächste Menstruation rückwirkend',()=>{const e=[{date:'2026-09-01',periodStart:true},{date:'2026-10-01',periodStart:true}];assert.equal(cycleInfo('2026-09-27',e,settings).daysToNextPeriod,4)});
