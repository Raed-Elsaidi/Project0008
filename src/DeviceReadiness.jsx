import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCamera, FaCheck, FaGlobe, FaMicrophone, FaRotateRight, FaUserShield, FaXmark } from 'react-icons/fa6';
import { descriptorFromVideo } from './BiometricUtils';

const initial = [
  { key: 'browser', label: 'المتصفح والجهاز', icon: FaGlobe },
  { key: 'network', label: 'اتصال الإنترنت', icon: FaGlobe },
  { key: 'camera', label: 'الكاميرا', icon: FaCamera },
  { key: 'microphone', label: 'الميكروفون', icon: FaMicrophone },
  { key: 'face', label: 'كشف الوجه', icon: FaUserShield },
];

export default function DeviceReadiness({ supabase, student, onBack }) {
  const videoRef = useRef(null); const streamRef = useRef(null);
  const [checks, setChecks] = useState(Object.fromEntries(initial.map(x => [x.key, {status:'pending', text:'لم يتم الفحص'}])));
  const [running, setRunning] = useState(false); const [error, setError] = useState('');

  const stop = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; };
  useEffect(() => () => stop(), []);
  const set = (key, status, text) => setChecks(v => ({...v, [key]: {status, text}}));

  const run = async () => {
    setRunning(true); setError('');
    Object.keys(checks).forEach(k => set(k, 'pending', 'جارٍ الفحص...'));
    try {
      set('browser', 'ok', `${navigator.userAgent ? 'مدعوم' : 'غير معروف'}`);
      const online = navigator.onLine;
      set('network', online ? 'ok' : 'bad', online ? 'الاتصال متاح' : 'لا يوجد اتصال بالإنترنت');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('المتصفح لا يدعم الوصول إلى الكاميرا والميكروفون.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const videoTrack = stream.getVideoTracks()[0]; const audioTrack = stream.getAudioTracks()[0];
      set('camera', videoTrack?.readyState === 'live' ? 'ok' : 'bad', videoTrack?.readyState === 'live' ? 'الكاميرا تعمل' : 'الكاميرا غير متاحة');
      set('microphone', audioTrack?.readyState === 'live' ? 'ok' : 'bad', audioTrack?.readyState === 'live' ? 'الميكروفون يعمل' : 'الميكروفون غير متاح');
      await new Promise(r => setTimeout(r, 800));
      try { await descriptorFromVideo(videoRef.current); set('face','ok','تم اكتشاف وجه واضح واحد'); }
      catch (e) { set('face','bad',e.message || 'تعذر اكتشاف الوجه'); }
    } catch (e) {
      setError(e.message || 'تعذر إتمام الفحص.');
      set('camera','bad','تعذر الوصول إلى الكاميرا'); set('microphone','bad','تعذر الوصول إلى الميكروفون');
    } finally { stop(); setRunning(false); }
  };
  const values = Object.values(checks); const done = values.length && values.every(x => x.status === 'ok');
  return <div dir="rtl" style={{minHeight:'100vh',padding:20,background:'#f8fafc',fontFamily:'Tahoma,Arial'}}>
    <div style={{maxWidth:900,margin:'30px auto',background:'#fff',borderRadius:20,padding:24,boxShadow:'0 15px 45px rgba(0,0,0,.12)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><button onClick={onBack} style={btn.secondary}><FaArrowRight/> العودة</button><h2 style={{margin:0,color:'#123b67'}}>🖥️ اختبار جاهزية الجهاز</h2></div>
      <p style={{color:'#64748b',lineHeight:1.8}}>يفحص هذا الاختبار الجهاز قبل الامتحان فقط، ولا يبدأ الامتحان ولا يحفظ تسجيلًا صوتيًا أو مرئيًا.</p>
      <video ref={videoRef} muted playsInline style={{width:'100%',maxWidth:520,aspectRatio:'16/9',objectFit:'cover',background:'#0f172a',borderRadius:16,display:'block',margin:'15px auto'}} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{initial.map(x=>{const Icon=x.icon,c=checks[x.key];return <div key={x.key} style={{padding:15,borderRadius:14,border:`1px solid ${c.status==='ok'?'#86efac':c.status==='bad'?'#fecaca':'#cbd5e1'}`,background:c.status==='ok'?'#f0fdf4':c.status==='bad'?'#fef2f2':'#f8fafc'}}><div style={{display:'flex',alignItems:'center',gap:10,fontWeight:800}}><Icon/>{x.label}<span style={{marginInlineStart:'auto'}}>{c.status==='ok'?<FaCheck color="#16a34a"/>:c.status==='bad'?<FaXmark color="#dc2626"/>:'—'}</span></div><small style={{display:'block',marginTop:8,color:'#64748b'}}>{c.text}</small></div>})}</div>
      {error && <div style={{marginTop:14,padding:12,borderRadius:10,background:'#fef2f2',color:'#991b1b'}}>{error}</div>}
      <button onClick={run} disabled={running} style={{...btn.primary,marginTop:18,width:'100%'}}><FaRotateRight/>{running?'جارٍ فحص الجهاز...':'بدء الاختبار / إعادة الاختبار'}</button>
      {done && <div style={{marginTop:15,padding:15,borderRadius:12,background:'#ecfdf5',color:'#166534',textAlign:'center',fontWeight:900}}>✅ جهازك جاهز مبدئيًا للامتحان</div>}
    </div>
  </div>;
}
const btn={primary:{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'13px 18px',border:0,borderRadius:12,background:'#0f766e',color:'#fff',fontWeight:800,cursor:'pointer'},secondary:{display:'flex',alignItems:'center',gap:7,padding:'9px 13px',border:'1px solid #cbd5e1',borderRadius:10,background:'#fff',color:'#334155',cursor:'pointer'}};
