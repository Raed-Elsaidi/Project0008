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
  return <div dir="rtl" style={{minHeight:'100vh',padding:'16px 12px',background:'radial-gradient(ellipse at top,#102f68 0%,#071a3a 48%,#041126 100%)',fontFamily:'Tahoma,Arial',color:'#f8fafc'}}>
    <div style={{maxWidth:900,margin:'12px auto',background:'linear-gradient(145deg,rgba(8,31,67,.98),rgba(5,18,42,.98))',border:'1px solid #164e9b',borderRadius:24,padding:'clamp(14px,3vw,28px)',boxShadow:'0 18px 50px rgba(0,100,255,.18)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><button onClick={onBack} style={btn.secondary}><FaArrowRight/> العودة</button><h2 style={{margin:0,color:'#49c6ff',fontSize:'clamp(21px,4vw,30px)',fontWeight:900,textShadow:'0 0 18px rgba(0,174,255,.25)'}}>🖥️ اختبار جاهزية الجهاز</h2></div>
      <p style={{color:'#c2d6f5',lineHeight:1.9}}>يفحص هذا الاختبار الجهاز قبل الامتحان فقط، ولا يبدأ الامتحان ولا يحفظ تسجيلًا صوتيًا أو مرئيًا.</p>
      <div style={{width:'100%',maxWidth:420,aspectRatio:'1 / 1',position:'relative',margin:'18px auto 24px',padding:10,borderRadius:26,border:'1px solid #1476cf',background:'linear-gradient(145deg,rgba(9,44,91,.9),rgba(7,24,53,.96))',boxShadow:'0 0 28px rgba(0,136,255,.18)'}}>
        <video ref={videoRef} muted playsInline style={{width:'100%',height:'100%',aspectRatio:'1 / 1',objectFit:'cover',background:'#07172f',borderRadius:18,display:'block'}} />
        {['top-right','top-left','bottom-right','bottom-left'].map((corner) => <span key={corner} style={{position:'absolute',width:42,height:42,borderColor:'#12d8ff',borderStyle:'solid',borderWidth:0,borderTopWidth:corner.startsWith('top')?4:0,borderBottomWidth:corner.startsWith('bottom')?4:0,borderRightWidth:corner.endsWith('right')?4:0,borderLeftWidth:corner.endsWith('left')?4:0,[corner.includes('top')?'top':'bottom']:18,[corner.endsWith('right')?'right':'left']:18,borderRadius:corner==='top-right'?'0 12px 0 0':corner==='top-left'?'12px 0 0 0':corner==='bottom-right'?'0 0 12px 0':'0 0 0 12px',pointerEvents:'none',filter:'drop-shadow(0 0 5px #00bfff)'}} />)}
        <div style={{position:'absolute',bottom:20,left:20,right:20,textAlign:'center',fontWeight:800,color:'#fff',textShadow:'0 2px 10px #000',fontSize:14,pointerEvents:'none'}}>ضع وجهك داخل الإطار المربع</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>{initial.map((x,i)=>{const Icon=x.icon,c=checks[x.key],accent=['#24c7ff','#bd54ff','#ec4bd2','#15d6c1','#2c8dff'][i];return <div key={x.key} style={{minWidth:0,padding:'clamp(11px,2.6vw,17px)',borderRadius:18,border:`1px solid ${c.status==='ok'?'#20d9a0':c.status==='bad'?'#fb7185':accent}`,background:c.status==='ok'?'linear-gradient(145deg,rgba(5,86,77,.55),rgba(7,31,56,.95))':c.status==='bad'?'linear-gradient(145deg,rgba(107,24,57,.55),rgba(7,31,56,.95))':'linear-gradient(145deg,rgba(12,48,93,.88),rgba(13,25,62,.96))',boxShadow:`0 0 16px ${accent}22`,color:'#f8fafc'}}><div style={{display:'flex',alignItems:'center',gap:8,fontWeight:900,fontSize:'clamp(12px,2.6vw,16px)',minHeight:42}}><span style={{display:'grid',placeItems:'center',flexShrink:0,width:36,height:36,borderRadius:11,background:`${accent}25`,color:accent,fontSize:18}}><Icon/></span><span style={{overflowWrap:'anywhere'}}>{x.label}</span><span style={{marginInlineStart:'auto',color:c.status==='ok'?'#20d9a0':c.status==='bad'?'#fb7185':accent}}>{c.status==='ok'?<FaCheck/>:c.status==='bad'?<FaXmark/>:'—'}</span></div><small style={{display:'block',marginTop:8,color:'#c6d7f2',lineHeight:1.7,fontSize:'clamp(11px,2.3vw,13px)'}}>{c.text}</small></div>})}</div>
      {error && <div style={{marginTop:14,padding:12,borderRadius:12,background:'#501c34',color:'#fecdd3',border:'1px solid #fb7185'}}>{error}</div>}
      <button onClick={run} disabled={running} style={{...btn.primary,marginTop:18,width:'100%',background:'linear-gradient(100deg,#05bff2,#245dff 55%,#b32cff)',boxShadow:'0 0 24px rgba(56,115,255,.35)',fontSize:'clamp(15px,3.5vw,19px)',padding:'16px 14px'}}><FaRotateRight/>{running?'جارٍ فحص الجهاز...':'بدء الاختبار / إعادة الاختبار'}</button>
      {done && <div style={{marginTop:15,padding:15,borderRadius:12,background:'rgba(5,150,105,.18)',border:'1px solid #10b981',color:'#a7f3d0',textAlign:'center',fontWeight:900}}>✅ جهازك جاهز مبدئيًا للامتحان</div>}
    </div>
  </div>;
}
const btn={primary:{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'13px 18px',border:0,borderRadius:14,background:'linear-gradient(100deg,#05bff2,#245dff 55%,#b32cff)',color:'#fff',fontWeight:900,cursor:'pointer'},secondary:{display:'flex',alignItems:'center',gap:7,padding:'9px 13px',border:'1px solid #2184e8',borderRadius:12,background:'rgba(10,35,75,.9)',color:'#dff4ff',cursor:'pointer'}};
