import {GOOGLE_CLIENT_ID,DRIVE_SCOPE} from './config.js';

const API='https://www.googleapis.com/drive/v3';
const UPLOAD='https://www.googleapis.com/upload/drive/v3';
let tokenClient=null;
let accessToken='';
let tokenExpiresAt=0;
let gisPromise=null;

export function isDriveConfigured(){
  return GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('PASTE_') && GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com');
}

function loadGis(){
  if(globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if(gisPromise) return gisPromise;
  gisPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';
    s.async=true;s.defer=true;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Google-Anmeldung konnte nicht geladen werden.'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

async function init(){
  if(!isDriveConfigured()) throw new Error('Google Drive ist noch nicht konfiguriert. Trage zuerst die OAuth Client-ID in src/config.js ein.');
  await loadGis();
  if(!tokenClient){
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:DRIVE_SCOPE,callback:()=>{}});
  }
}

export async function authorize({interactive=true}={}){
  await init();
  if(accessToken && Date.now()<tokenExpiresAt-60000) return accessToken;
  return new Promise((resolve,reject)=>{
    tokenClient.callback=(resp)=>{
      if(resp?.error){reject(new Error(resp.error_description||resp.error));return;}
      accessToken=resp.access_token;
      tokenExpiresAt=Date.now()+(Number(resp.expires_in)||3600)*1000;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({prompt:interactive?'consent':''});
  });
}

export function disconnect(){accessToken='';tokenExpiresAt=0;}
export function isAuthorized(){return !!accessToken && Date.now()<tokenExpiresAt-60000;}

async function apiFetch(url,opts={},interactive=false){
  const token=await authorize({interactive});
  const headers=new Headers(opts.headers||{});headers.set('Authorization',`Bearer ${token}`);
  const r=await fetch(url,{...opts,headers});
  if(r.status===401 && !interactive){
    accessToken=''; tokenExpiresAt=0;
    throw new Error('Google-Sitzung abgelaufen. Bitte Drive erneut verbinden.');
  }
  if(!r.ok){let msg=`Google Drive Fehler ${r.status}`;try{const j=await r.json();msg=j.error?.message||msg;}catch{}throw new Error(msg);}
  return r;
}

export async function listBackups({interactive=false}={}){
  const params=new URLSearchParams({spaces:'appDataFolder',q:"'appDataFolder' in parents and trashed = false and name contains 'nct-backup-'",fields:'files(id,name,createdTime,modifiedTime,size)',orderBy:'createdTime desc',pageSize:'100'});
  const r=await apiFetch(`${API}/files?${params}`,{},interactive);
  return (await r.json()).files||[];
}

export async function uploadBackup(content,{interactive=false}={}){
  const stamp=new Date().toISOString().replaceAll(':','-').replace('.','-');
  const metadata={name:`nct-backup-${stamp}.enc.json`,parents:['appDataFolder'],mimeType:'application/json'};
  const boundary='nct_'+crypto.randomUUID().replaceAll('-','');
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const r=await apiFetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body},interactive);
  return r.json();
}

export async function downloadBackup(fileId,{interactive=false}={}){
  const r=await apiFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`,{},interactive);
  return r.text();
}

export async function deleteDriveFile(fileId,{interactive=false}={}){
  await apiFetch(`${API}/files/${encodeURIComponent(fileId)}`,{method:'DELETE'},interactive);
}
