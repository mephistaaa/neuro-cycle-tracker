import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeEntries,chooseBackupsToKeep} from '../src/backup.js';

test('mergeEntries nutzt bei gleichem Datum die neuere Änderung',()=>{
  const local=[{date:'2026-09-01',value:1,updatedAt:'2026-09-01T10:00:00Z'}];
  const cloud=[{date:'2026-09-01',value:2,updatedAt:'2026-09-01T11:00:00Z'},{date:'2026-09-02',value:3}];
  const out=mergeEntries(local,cloud);
  assert.equal(out.length,2);
  assert.equal(out[0].value,2);
});

test('Backup-Aufbewahrung behält aktuelles Backup und reduziert alte Versionen',()=>{
  const now=new Date('2026-09-29T12:00:00Z');
  const files=[];
  for(let i=0;i<40;i++) files.push({id:String(i),createdTime:new Date(now.getTime()-i*86400000).toISOString()});
  const keep=chooseBackupsToKeep(files,now);
  assert.ok(keep.has('0'));
  assert.ok(keep.size<40);
  assert.ok(keep.size>=7);
});
