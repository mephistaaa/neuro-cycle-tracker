const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes){
  let s='';
  for(const b of bytes) s+=String.fromCharCode(b);
  return btoa(s);
}
function unb64(s){
  const raw=atob(s), out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

export async function deriveKey(passphrase,salt,iterations=250000){
  const material=await crypto.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations,hash:'SHA-256'},
    material,
    {name:'AES-GCM',length:256},
    false,
    ['encrypt','decrypt']
  );
}

export async function encryptJson(value,passphrase){
  if(!passphrase || passphrase.length<8) throw new Error('Das Backup-Passwort muss mindestens 8 Zeichen haben.');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const iterations=250000;
  const key=await deriveKey(passphrase,salt,iterations);
  const plaintext=enc.encode(JSON.stringify(value));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext));
  return JSON.stringify({
    format:'neuro-cycle-tracker-encrypted-backup',
    version:1,
    crypto:{algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations,salt:b64(salt),iv:b64(iv)},
    ciphertext:b64(ciphertext)
  });
}

export async function decryptJson(text,passphrase){
  let wrap;
  try{wrap=typeof text==='string'?JSON.parse(text):text;}catch{throw new Error('Backup-Datei ist kein gültiges JSON.');}
  if(wrap?.format!=='neuro-cycle-tracker-encrypted-backup' || !wrap.crypto || !wrap.ciphertext) throw new Error('Unbekanntes verschlüsseltes Backup-Format.');
  const salt=unb64(wrap.crypto.salt), iv=unb64(wrap.crypto.iv), ciphertext=unb64(wrap.ciphertext);
  const key=await deriveKey(passphrase,salt,Number(wrap.crypto.iterations)||250000);
  try{
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ciphertext);
    return JSON.parse(dec.decode(plaintext));
  }catch{
    throw new Error('Backup konnte nicht entschlüsselt werden. Passwort falsch oder Datei beschädigt.');
  }
}
