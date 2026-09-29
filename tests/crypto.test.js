import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto) globalThis.crypto=webcrypto;
if(!globalThis.btoa) globalThis.btoa=s=>Buffer.from(s,'binary').toString('base64');
if(!globalThis.atob) globalThis.atob=s=>Buffer.from(s,'base64').toString('binary');
import {encryptJson,decryptJson} from '../src/crypto.js';

test('verschlüsseltes Backup lässt sich mit richtigem Passwort wiederherstellen',async()=>{
  const source={format:'neuro-cycle-tracker',entries:[{date:'2026-09-29',value:4}]};
  const encrypted=await encryptJson(source,'ein-langes-testpasswort');
  assert.equal(encrypted.includes('2026-09-29'),false);
  const restored=await decryptJson(encrypted,'ein-langes-testpasswort');
  assert.deepEqual(restored,source);
});

test('falsches Passwort entschlüsselt Backup nicht',async()=>{
  const encrypted=await encryptJson({x:1},'richtiges-passwort');
  await assert.rejects(()=>decryptJson(encrypted,'falsches-passwort'));
});
