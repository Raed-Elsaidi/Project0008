import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowRight, FaMessage, FaPaperclip, FaTrash, FaVolumeHigh, FaVolumeXmark, FaLock, FaIdCard, FaUserGraduate } from 'react-icons/fa6';

const BUCKET = 'student-support-messages';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const toEnglishDigits = (value) => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const styles = {
 page:{minHeight:'100vh',padding:'22px 14px',background:'radial-gradient(circle at top,#173b69,#071326 70%)',fontFamily:'Tahoma,Arial',color:'#f8fafc'},
 wrap:{maxWidth:1000,margin:'0 auto'}, back:{padding:'9px 14px',border:'1px solid #526b8a',borderRadius:10,background:'#142b48',color:'#fff',cursor:'pointer'},
 panel:{marginTop:18,padding:20,border:'1px solid #29496b',borderRadius:18,background:'#0c1e35',boxShadow:'0 15px 40px #0004'},
 tab:{padding:'10px 13px',border:'1px solid #345777',borderRadius:10,background:'#132b49',color:'#dbeafe',cursor:'pointer',fontWeight:700},
 input:{width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #31557b',borderRadius:10,background:'#07162b',color:'#fff',marginTop:6,fontSize:16},
 button:{padding:'11px 16px',border:0,borderRadius:10,background:'linear-gradient(110deg,#0759ff,#4c1d95)',border:'1px solid #38bdf8',color:'#fff',fontWeight:800,cursor:'pointer'},
 card:{padding:14,border:'1px solid #29496b',borderRadius:12,background:'#102641',cursor:'pointer',textAlign:'right',color:'#f8fafc'},
 label:{display:'block',color:'#e2e8f0',fontWeight:700,lineHeight:1.8},
};

export default function SupportCenter({ onBack, supabase, student }) {
 const [audience,setAudience]=useState(null);
 const [seatNumber,setSeatNumber]=useState('');
 const [password,setPassword]=useState('');
 const [nationalId,setNationalId]=useState('');
 const [verifiedStudent,setVerifiedStudent]=useState(null);
 const [verifiedUnregistered,setVerifiedUnregistered]=useState(null);
 const [checking,setChecking]=useState(false);
 const [view,setView]=useState('inbox');
 const [messages,setMessages]=useState([]);
 const [selected,setSelected]=useState(null);
 const [subject,setSubject]=useState('');
 const [body,setBody]=useState('');
 const [issueType,setIssueType]=useState('عدم التسجيل');
 const [attachment,setAttachment]=useState(null);
 const [loading,setLoading]=useState(false);
 const [sending,setSending]=useState(false);
 const [notice,setNotice]=useState('');
 const [soundOn,setSoundOn]=useState(true);
 const [volume,setVolume]=useState(0.5);
 const [unread,setUnread]=useState(0);
 const lastIds=useRef(new Set());
 const studentId=verifiedStudent?.id || null;

 const playSound=useCallback(()=>{if(!soundOn)return;try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=740;gain.gain.value=Math.max(0,Math.min(1,volume))*0.12;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.14);osc.onended=()=>ctx.close();}catch{}},[soundOn,volume]);

 const verifyRegistered = async (event) => {
  event?.preventDefault();
  const cleanSeat=toEnglishDigits(seatNumber).trim();
  const cleanPassword=String(password||'');
  if(!cleanSeat||!cleanPassword){setNotice('أدخل رقم الجلوس وكلمة المرور.');return;}
  if(!supabase){setNotice('تعذر الاتصال بقاعدة البيانات.');return;}
  setChecking(true);setNotice('');
  try {
   const {data:record,error:lookupError}=await supabase.from('students').select('id,seating_number,full_name_ar,full_name_en,is_active').eq('seating_number',cleanSeat).maybeSingle();
   if(lookupError) throw lookupError;
   if(!record){setNotice('رقم الجلوس أو كلمة المرور غير صحيحة.');return;}
   if(record.is_active===false){setNotice('حساب الطالب غير مفعّل. يرجى التواصل مع الإدارة.');return;}
   const {data:valid,error:verifyError}=await supabase.rpc('verify_student_password',{p_seating_number:cleanSeat,p_password:cleanPassword});
   if(verifyError){setNotice('تعذر التحقق من كلمة المرور. تأكد من تفعيل دالة verify_student_password في Supabase.');return;}
   if(valid!==true){setNotice('رقم الجلوس أو كلمة المرور غير صحيحة.');return;}
   setVerifiedStudent({...record,seating_number:record.seating_number||cleanSeat,__supportPassword:cleanPassword});
   setPassword('');setView('inbox');setSelected(null);setNotice('تم التحقق من بياناتك. يمكنك الآن فتح نموذج المراسلات.');
  } catch(error){setNotice(`تعذر التحقق من البيانات: ${error?.message||'تحقق من اتصال قاعدة البيانات.'}`);}
  finally{setChecking(false);}
 };

 const verifyUnregistered = async (event) => {
  event?.preventDefault();
  const cleanId=toEnglishDigits(nationalId).replace(/\s/g,'');
  if(!/^\d{9}$/.test(cleanId)){setNotice('أدخل رقم الهوية المكوّن من 9 أرقام.');return;}
  if(!supabase){setNotice('تعذر الاتصال بقاعدة البيانات.');return;}
  setChecking(true);setNotice('');
  try {
   // Only ask whether the exact ID exists; never fetch the full allow_student row.
   const {data,error}=await supabase.from('allow_student').select('national_id').eq('national_id',cleanId).maybeSingle();
   if(error) throw error;
   if(!data){setNotice('رقم الهوية غير موجود في جدول السماح بالتسجيل (allow_student).');return;}
   setVerifiedUnregistered({national_id:cleanId});
   setNotice('تم العثور على رقم الهوية. يمكنك الآن تعبئة طلب الدعم.');
  } catch(error){setNotice(`تعذر التحقق من رقم الهوية. تأكد من صلاحيات القراءة المقيّدة لجدول allow_student في Supabase. ${error?.message||''}`);}
  finally{setChecking(false);}
 };

 const supportIdentity = useCallback(() => {
  if (audience === 'registered' && verifiedStudent) return {
   audience:'registered', seating_number:verifiedStudent.seating_number,
   password:verifiedStudent.__supportPassword,
  };
  if (audience === 'unregistered' && verifiedUnregistered) return {
   audience:'unregistered', national_id:verifiedUnregistered.national_id,
   issue_type:issueType,
  };
  return null;
 },[audience,verifiedStudent,verifiedUnregistered,issueType]);
 const supportAction = useCallback(async (action, extra={}) => {
  if(!supabase) throw new Error('تعذر الاتصال بقاعدة البيانات.');
  const identity=supportIdentity();
  if(!identity) throw new Error('تحقق من بيانات الطالب أولاً.');
  const {data,error}=await supabase.functions.invoke('submit-unregistered-support-request',{body:{...identity,action,...extra}});
  if(error) throw error;
  if(!data?.ok) throw new Error(data?.error||'تعذر تنفيذ العملية.');
  return data;
 },[supabase,supportIdentity]);
 const loadMessages=useCallback(async({silent=false}={})=>{
  if(!supportIdentity())return;
  if(!silent)setLoading(true);
  try{
   const result=await supportAction('list');
   const next=result.messages||[];
   const ids=new Set(next.filter(m=>m.sender_type==='support').map(m=>String(m.id)));
   if(silent&&lastIds.current.size&&[...ids].some(id=>!lastIds.current.has(id)))playSound();
   lastIds.current=ids;setMessages(next);setUnread(next.filter(m=>m.sender_type==='support'&&!m.is_read&&!m.recipient_deleted_at).length);
  }catch(error){setNotice(`تعذر تحميل المراسلات: ${error?.message||'تحقق من إعدادات Supabase.'}`);}
  finally{if(!silent)setLoading(false);}
 },[supportIdentity,supportAction,playSound]);
 useEffect(()=>{if(!supportIdentity())return;loadMessages();const timer=setInterval(()=>loadMessages({silent:true}),30000);return()=>clearInterval(timer);},[loadMessages,supportIdentity]);

 const visible=useMemo(()=>messages.filter(m=>view==='inbox'?m.sender_type==='support'&&!m.recipient_deleted_at:view==='sent'?m.sender_type==='student'&&!m.sender_deleted_at:Boolean(m.sender_deleted_at||m.recipient_deleted_at)),[messages,view]);
 const markRead=async m=>{setSelected(m);if(m.sender_type==='support'&&!m.is_read){try{await supportAction('mark-read',{message_id:m.id});setMessages(prev=>prev.map(x=>x.id===m.id?{...x,is_read:true}:x));setUnread(n=>Math.max(0,n-1));}catch(error){setNotice(`تعذر تحديث حالة القراءة: ${error?.message||''}`);}}};

 const sendRegisteredMessage=async()=>{
  if(!verifiedStudent){setNotice('تحقق من بيانات الطالب أولاً.');return;}
  if(!subject.trim()||(!body.trim()&&!attachment)){setNotice('أدخل عنوان الرسالة والتفاصيل أو أرفق ملفاً.');return;}
  if(attachment&&attachment.size>5*1024*1024){setNotice('حجم المرفق الأقصى 5 ميجابايت.');return;}
  if(!supabase){setNotice('تعذر الاتصال بقاعدة البيانات.');return;}
  setSending(true);setNotice('');
  try{
   let attachmentPayload=null;
   if(attachment){const bytes=new Uint8Array(await attachment.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));attachmentPayload={name:attachment.name,mime:attachment.type||'application/octet-stream',base64:btoa(binary)};}
   const {data,error}=await supabase.functions.invoke('submit-unregistered-support-request',{body:{audience:'registered',seating_number:verifiedStudent.seating_number,password:verifiedStudent.__supportPassword,subject:subject.trim(),message:body.trim(),attachment:attachmentPayload}});
   if(error)throw error;
   if(!data?.ok)throw new Error(data?.error||'لم يؤكد الخادم حفظ الرسالة.');
   setSubject('');setBody('');setAttachment(null);setView('sent');setNotice(`تم إرسال رسالتك بنجاح. رقم الرسالة: ${data.request_id} ✓`);await loadMessages();
  }catch(error){setNotice(`تعذر إرسال الرسالة: ${error?.message||'تحقق من نشر دالة الدعم وإعدادات Supabase.'}`);}
  finally{setSending(false);}
 };
 const sendUnregisteredRequest=async()=>{
  if(!verifiedUnregistered){setNotice('تحقق من رقم الهوية أولاً.');return;}
  if(!body.trim()){setNotice('اكتب تفاصيل المشكلة قبل الإرسال.');return;}
  if(attachment&&attachment.size>5*1024*1024){setNotice('حجم المرفق الأقصى لهذا النموذج 5 ميجابايت.');return;}
  if(!supabase){setNotice('تعذر الاتصال بقاعدة البيانات.');return;}
  setSending(true);setNotice('');
  try{
   let attachmentPayload=null;
   if(attachment){
    const bytes=new Uint8Array(await attachment.arrayBuffer());
    let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    attachmentPayload={name:attachment.name,mime:attachment.type||'application/octet-stream',base64:btoa(binary)};
   }
   const {data,error}=await supabase.functions.invoke('submit-unregistered-support-request',{body:{national_id:verifiedUnregistered.national_id,issue_type:issueType,message:body.trim(),attachment:attachmentPayload}});
   if(error) throw error;
   if(!data?.ok) throw new Error(data?.error||'لم يؤكد الخادم حفظ الطلب.');
   setBody('');setAttachment(null);setView('sent');setNotice(`تم إرسال طلب الدعم بنجاح. رقم الطلب: ${data.request_id} ✓`);await loadMessages();
  }catch(error){setNotice(`تعذر إرسال الطلب: ${error?.message||'تحقق من نشر الدالة وإعدادات Supabase.'}`);}
  finally{setSending(false);}
 };
 const openAttachment=async m=>{if(!m.attachment_path)return;try{const result=await supportAction('attachment-url',{message_id:m.id});window.open(result.signed_url,'_blank','noopener,noreferrer');}catch(error){setNotice(`تعذر فتح المرفق: ${error?.message||'تحقق من صلاحيات التخزين.'}`);}};
 const removeMessage=async m=>{try{await supportAction(view==='trash'?'restore':'delete',{message_id:m.id});setNotice(view==='trash'?'تمت استعادة الرسالة.':'تم نقل الرسالة إلى سلة المحذوفات.');setSelected(null);await loadMessages();}catch(error){setNotice(`تعذر تحديث الرسالة: ${error?.message||''}`);}};
 const resetAudience=next=>{setAudience(next);setNotice('');setVerifiedUnregistered(null);setNationalId('');setVerifiedStudent(null);setSeatNumber('');setPassword('');setBody('');setSubject('');setAttachment(null);setSelected(null);setView('inbox');};

 return <main dir="rtl" style={{...styles.page,position:'relative',isolation:'isolate',overflow:'hidden'}}><div aria-hidden="true" style={{position:'fixed',inset:0,zIndex:-1,pointerEvents:'none',opacity:0.13,background:'linear-gradient(to bottom,#000 0 33.333%,#fff 33.333% 66.666%,#009736 66.666% 100%)',clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)'}}/><div aria-hidden="true" style={{position:'fixed',top:0,left:0,width:'36vw',height:'100vh',zIndex:-1,pointerEvents:'none',opacity:0.16,background:'#ee2a35',clipPath:'polygon(0 0,100% 50%,0 100%)'}}/><div style={styles.wrap}>
  <button onClick={onBack} style={styles.back}><FaArrowRight/> الرئيسية</button>
  <header style={{textAlign:'center',padding:'20px 0 8px'}}><FaMessage size={38} color="#67e8f9"/><h1 style={{margin:'10px 0'}}>الدعم الفني</h1><p style={{color:'#cbd5e1',margin:0}}>المراسلات والاستفسارات ومتابعة الردود</p></header>
  <section style={styles.panel}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:10,marginBottom:18}}>
    <button type="button" onClick={()=>resetAudience('registered')} style={{...styles.tab,background:audience==='registered'?'linear-gradient(110deg,#0759ff,#4c1d95)':'#102641',borderColor:audience==='registered'?'#38bdf8':'#345777',boxShadow:audience==='registered'?'0 0 18px #2563eb66':'none'}}><FaUserGraduate/> الطلاب المسجلون</button>
    <button type="button" onClick={()=>resetAudience('unregistered')} style={{...styles.tab,background:audience==='unregistered'?'linear-gradient(110deg,#0759ff,#4c1d95)':'#102641',borderColor:audience==='unregistered'?'#38bdf8':'#345777',boxShadow:audience==='unregistered'?'0 0 18px #2563eb66':'none'}}><FaIdCard/> الطلاب غير المسجلين</button>
   </div>

   {!audience&&<div style={{padding:18,border:'1px solid #31557b',borderRadius:14,background:'#102641',textAlign:'center',color:'#cbd5e1',lineHeight:1.9}}>اختر فئة الطالب للبدء بالتحقق من البيانات. ستظهر شاشة المراسلات بعد نجاح التحقق فقط.</div>}

   {audience==='registered'&&!studentId&&<form onSubmit={verifyRegistered} style={{display:'grid',gap:14}}>
    <div style={{padding:16,border:'1px solid #2563eb',borderRadius:14,background:'linear-gradient(135deg,#0b2344,#101638)'}}><h2 style={{margin:'0 0 6px',color:'#67e8f9'}}>التحقق من الطالب المسجل</h2><p style={{margin:0,color:'#cbd5e1',lineHeight:1.8}}>أدخل رقم الجلوس وكلمة المرور المستخدمة في بوابة الامتحانات. لن تظهر الرسائل قبل التحقق من كلمة المرور.</p></div>
    <label style={styles.label}>رقم الجلوس<input value={seatNumber} onChange={e=>setSeatNumber(toEnglishDigits(e.target.value))} style={styles.input} inputMode="numeric" autoComplete="username" placeholder="أدخل رقم الجلوس" required/></label>
    <label style={styles.label}>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={styles.input} autoComplete="current-password" placeholder="أدخل كلمة المرور" required/></label>
    <button type="submit" disabled={checking} style={{...styles.button,opacity:checking ? 0.65 : 1}}><FaLock/> {checking?'جارٍ التحقق…':'تحقق وافتح المراسلات'}</button>
   </form>}

   {audience==='unregistered'&&!verifiedUnregistered&&<form onSubmit={verifyUnregistered} style={{display:'grid',gap:14}}>
    <div style={{padding:16,border:'1px solid #2563eb',borderRadius:14,background:'linear-gradient(135deg,#0b2344,#101638)'}}><h2 style={{margin:'0 0 6px',color:'#67e8f9'}}>التحقق من الطالب غير المسجل</h2><p style={{margin:0,color:'#cbd5e1',lineHeight:1.8}}>أدخل رقم الهوية. سيتحقق النظام من وجوده في جدول <code>allow_student</code> دون جلب بقية بيانات الطالب.</p></div>
    <label style={styles.label}>رقم الهوية<input value={nationalId} onChange={e=>setNationalId(toEnglishDigits(e.target.value).replace(/\D/g,'').slice(0,9))} style={styles.input} inputMode="numeric" maxLength={9} placeholder="رقم الهوية من 9 أرقام" required/></label>
    <button type="submit" disabled={checking} style={{...styles.button,opacity:checking ? 0.65 : 1}}><FaLock/> {checking?'جارٍ التحقق…':'تحقق وافتح نموذج الدعم'}</button>
   </form>}

   {audience==='unregistered'&&verifiedUnregistered&&<>
    <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',padding:12,border:'1px solid #0f766e',borderRadius:12,background:'#103a3b',marginBottom:14}}><span>✓ تم التحقق من رقم الهوية المنتهي بـ {verifiedUnregistered.national_id.slice(-3)}.</span><button type="button" onClick={()=>{setVerifiedUnregistered(null);setAudience(null);setMessages([]);setSelected(null);setNotice('تم تسجيل الخروج من نموذج المراسلات.');}} style={styles.tab}>تسجيل الخروج</button></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>{[['inbox','📥 الوارد'],['sent','📤 الصادر'],['trash','🗑️ المحذوفات'],['compose','✉️ رسالة جديدة']].map(([v,label])=><button key={v} type="button" onClick={()=>{setView(v);setSelected(null);setNotice('');}} style={{...styles.tab,...(view===v?{background:'#075985',borderColor:'#38bdf8'}:{})}}>{label}{v==='inbox'&&unread>0&&<b style={{background:'#dc2626',borderRadius:99,padding:'2px 7px',marginRight:4}}>{unread}</b>}</button>)}<button type="button" onClick={()=>loadMessages()} style={{...styles.tab,marginRight:'auto'}}>تحديث ↻</button></div>
    {view==='compose'&&<div style={{display:'grid',gap:12}}><label style={styles.label}>نوع المشكلة<select value={issueType} onChange={e=>setIssueType(e.target.value)} style={styles.input}><option>عدم التسجيل</option><option>نسيت رقم الجلوس</option></select></label><label style={styles.label}>تفاصيل المشكلة<textarea value={body} onChange={e=>setBody(e.target.value)} style={{...styles.input,minHeight:130,resize:'vertical'}} placeholder="اكتب تفاصيل المشكلة بوضوح…"/></label><label style={{...styles.label,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><FaPaperclip/> إرفاق ملف (اختياري)<input type="file" onChange={e=>setAttachment(e.target.files?.[0]||null)} /></label>{attachment&&<small style={{color:'#a5f3fc'}}>{attachment.name} — {(attachment.size/1024/1024).toFixed(2)} MB</small>}<button type="button" disabled={sending} onClick={sendUnregisteredRequest} style={styles.button}>{sending?'جارٍ الإرسال…':'إرسال طلب الدعم'}</button></div>}
    {view!=='compose'&&<>{loading&&<p>جارٍ تحميل الرسائل…</p>}{!loading&&visible.length===0&&<div style={{textAlign:'center',padding:30,color:'#cbd5e1'}}>لا توجد رسائل في هذا القسم حالياً.</div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:10}}>{visible.map(m=><button key={m.id} type="button" onClick={()=>markRead(m)} style={{...styles.card,borderColor:m.sender_type==='support'&&!m.is_read?'#22d3ee':'#29496b'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{m.subject||'رسالة دعم فني'}</b>{m.sender_type==='support'&&!m.is_read&&<span style={{color:'#67e8f9'}}>جديد</span>}</div><p style={{color:'#cbd5e1',fontSize:13,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{m.message||'مرفق'}</p><small style={{color:'#94a3b8'}}>{m.created_at?new Date(m.created_at).toLocaleString('ar'):''}</small></button>)}</div>{selected&&<div style={{marginTop:18,padding:18,border:'1px solid #365779',borderRadius:14,background:'#07162b'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><h3 style={{marginTop:0,color:'#67e8f9'}}>{selected.subject||'رسالة دعم فني'}</h3><button type="button" onClick={()=>setSelected(null)} style={styles.tab}>إغلاق</button></div><p style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{selected.message}</p><small style={{color:'#94a3b8'}}>{selected.created_at?new Date(selected.created_at).toLocaleString('ar'):''}</small><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>{selected.attachment_path&&<button type="button" onClick={()=>openAttachment(selected)} style={styles.tab}><FaPaperclip/> فتح المرفق</button>}<button type="button" onClick={()=>removeMessage(selected)} style={styles.tab}>{view==='trash'?'استعادة الرسالة':'نقل إلى سلة المحذوفات'}</button></div></div>}</>}
   </>}

   {audience==='registered'&&studentId&&<>
    <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',padding:12,border:'1px solid #0f766e',borderRadius:12,background:'#103a3b',marginBottom:14}}><span>✓ تم التحقق من بيانات الطالب {verifiedStudent.full_name_ar?`(${verifiedStudent.full_name_ar})`:''}.</span><button type="button" onClick={()=>{setVerifiedStudent(null);setAudience(null);setMessages([]);setSelected(null);setNotice('تم تسجيل الخروج من نموذج المراسلات.');}} style={styles.tab}>تسجيل الخروج</button></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>{[['inbox','📥 الوارد'],['sent','📤 الصادر'],['trash','🗑️ المحذوفات'],['compose','✉️ رسالة جديدة']].map(([v,label])=><button key={v} type="button" onClick={()=>{setView(v);setSelected(null);setNotice('');}} style={{...styles.tab,...(view===v?{background:'#075985',borderColor:'#38bdf8'}:{})}}>{label}{v==='inbox'&&unread>0&&<b style={{background:'#dc2626',borderRadius:99,padding:'2px 7px',marginRight:4}}>{unread}</b>}</button>)}<button type="button" onClick={()=>setSoundOn(x=>!x)} title="تشغيل أو كتم صوت الرسائل" style={{...styles.tab,marginRight:'auto'}}>{soundOn?<FaVolumeHigh/>:<FaVolumeXmark/>} الصوت</button><label style={{display:'flex',alignItems:'center',gap:6,color:'#cbd5e1',fontSize:12}}>مستوى الصوت <input type="range" min="0" max="1" step="0.1" value={volume} onChange={e=>setVolume(Number(e.target.value))} aria-label="مستوى صوت التنبيهات"/></label><button type="button" onClick={()=>loadMessages()} style={styles.tab}>تحديث ↻</button></div>
    {view==='compose'&&<div style={{display:'grid',gap:12}}><label style={styles.label}>عنوان الرسالة<input value={subject} onChange={e=>setSubject(e.target.value)} style={styles.input} placeholder="مثال: مشكلة في الدخول إلى الامتحان"/></label><label style={styles.label}>تفاصيل المشكلة<textarea value={body} onChange={e=>setBody(e.target.value)} style={{...styles.input,minHeight:130,resize:'vertical'}} placeholder="اشرح المشكلة والخطوات التي ظهرت لك…"/></label><label style={{...styles.label,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><FaPaperclip/> إرفاق ملف (حتى 25MB)<input type="file" onChange={e=>setAttachment(e.target.files?.[0]||null)}/></label>{attachment&&<small style={{color:'#a5f3fc'}}>{attachment.name} — {(attachment.size/1024/1024).toFixed(2)} MB</small>}<button type="button" disabled={sending} onClick={sendRegisteredMessage} style={{...styles.button,opacity:sending ? 0.65 : 1}}>{sending?'جارٍ الإرسال…':'إرسال الرسالة'}</button></div>}
    {view!=='compose'&&<>{loading&&<p>جارٍ تحميل الرسائل…</p>}{!loading&&visible.length===0&&<div style={{textAlign:'center',padding:30,color:'#cbd5e1'}}>لا توجد رسائل في هذا القسم حالياً، أو أن صلاحيات المراسلات لم تُفعّل بعد.</div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:10}}>{visible.map(m=><button key={m.id} type="button" onClick={()=>markRead(m)} style={{...styles.card,borderColor:m.sender_type==='support'&&!m.is_read?'#22d3ee':'#29496b'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{m.subject||'رسالة دعم فني'}</b>{m.sender_type==='support'&&!m.is_read&&<span style={{color:'#67e8f9'}}>جديد</span>}</div><p style={{color:'#cbd5e1',fontSize:13,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{m.message||'مرفق'}</p><small style={{color:'#94a3b8'}}>{m.created_at?new Date(m.created_at).toLocaleString('ar'):''}</small></button>)}</div>{selected&&<div style={{marginTop:18,padding:18,border:'1px solid #365779',borderRadius:14,background:'#07162b'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><h3 style={{marginTop:0,color:'#67e8f9'}}>{selected.subject||'رسالة دعم فني'}</h3><button type="button" onClick={()=>setSelected(null)} style={styles.tab}>إغلاق</button></div><p style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{selected.message}</p><small style={{color:'#94a3b8'}}>{selected.created_at?new Date(selected.created_at).toLocaleString('ar'):''}</small><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>{selected.attachment_path&&<button type="button" onClick={()=>openAttachment(selected)} style={styles.tab}><FaPaperclip/> فتح المرفق</button>}<button type="button" onClick={()=>removeMessage(selected)} style={styles.tab}><FaTrash/> نقل إلى سلة المحذوفات</button></div></div>}</>}
   </>}
   {notice&&<div role="status" style={{padding:12,borderRadius:10,background:'#123c43',color:'#d1fae5',marginTop:14,lineHeight:1.8}}>{notice}</div>}
   <p style={{fontSize:12,color:'#94a3b8',lineHeight:1.8,marginBottom:0}}>ملاحظة أمنية: التحقق من بيانات الطالب في الواجهة لا يمنح وحده صلاحية آمنة لقراءة الرسائل الخاصة. يلزم إعداد API موثوقة أو جلسة مصادقة وصلاحيات RLS مناسبة في Supabase قبل تفعيل تبادل الرسائل الفعلي.</p>
  </section>
 </div></main>;
}
