import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCamera, FaCheck, FaCircleExclamation, FaRotateRight, FaShieldHalved } from 'react-icons/fa6';
import { descriptorFromVideo, faceMatch } from './BiometricUtils';

export default function PreExamBiometricGate({ supabase, student, exam, onSuccess, onBack }) {
  const videoRef = useRef(null); const streamRef = useRef(null);
  const [status,setStatus]=useState('checking'); const [message,setMessage]=useState('جاري تشغيل الكاميرا والتحقق من الهوية...');
  const [distance,setDistance]=useState(null); const [timeLeft,setTimeLeft]=useState(null); const [verified,setVerified]=useState(false);
  const [running,setRunning]=useState(false);
  const stop=()=>{if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null;};
  useEffect(()=>()=>stop(),[]);
  const start=async()=>{setRunning(true);setStatus('checking');setMessage('ضع وجهك داخل الإطار وبإضاءة جيدة.');try{
    if(!student?.id) throw new Error('تعذر تحديد بيانات الطالب.');
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('هذا المتصفح لا يدعم الكاميرا.');
    const {data,error}=await supabase.from('students').select('face_descriptor,id_face_descriptor').eq('id',student.id).maybeSingle(); if(error)throw error;
    if(!Array.isArray(data?.face_descriptor)||data.face_descriptor.length!==128) throw new Error('لا توجد بصمة وجه مسجلة لهذا الطالب. يجب إعادة التسجيل/اعتماد البصمة أولًا.');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();await new Promise(r=>setTimeout(r,1000));
    const live=await descriptorFromVideo(videoRef.current); const primary=faceMatch(live,data.face_descriptor,0.60); let best=primary;
    if(Array.isArray(data.id_face_descriptor)&&data.id_face_descriptor.length===128){const idm=faceMatch(live,data.id_face_descriptor,0.60);if(idm.distance<best.distance)best=idm;}
    setDistance(best.distance); setStatus(best.matched?'ok':'bad'); setVerified(best.matched);
    await supabase.from('exam_biometric_verifications').insert([{student_id:student.id,exam_id:exam?.id||null,session_id:crypto?.randomUUID?.()||String(Date.now()),verified:best.matched,distance:best.distance,threshold:best.threshold,failure_reason:best.matched?null:'الصورة الحية لا تطابق البصمة المسجلة'}]);
    if(best.matched){setMessage('تم التحقق من الهوية بنجاح.');}
    else setMessage('لم تتم مطابقة الوجه. غيّر الإضاءة أو وضعية الوجه وحاول مرة أخرى.');
  }catch(e){setStatus('bad');setVerified(false);setMessage(e.message||'تعذر التحقق من الهوية.');}finally{stop();setRunning(false);}};
  useEffect(()=>{start();return()=>stop();},[]);
  useEffect(()=>{if(!verified)return; const startAt=exam?.examStartsAt?new Date(exam.examStartsAt).getTime():Date.now(); const tick=()=>setTimeLeft(Math.max(0,startAt-Date.now()));tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[verified,exam]);
  useEffect(()=>{if(verified&&timeLeft===0){const t=setTimeout(()=>onSuccess(),300);return()=>clearTimeout(t);}},[verified,timeLeft,onSuccess]);
  return <div dir="rtl" style={{minHeight:'100vh',padding:20,background:'#0f172a',fontFamily:'Tahoma,Arial',color:'#fff'}}><div style={{maxWidth:800,margin:'30px auto',background:'#111827',padding:24,borderRadius:22,boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
   <button onClick={onBack} style={{padding:'9px 13px',borderRadius:10,border:'1px solid #334155',background:'#1e293b',color:'#fff'}}><FaArrowRight/> العودة</button>
   <h2 style={{textAlign:'center',color:'#67e8f9'}}>🔐 التحقق البيومتري قبل الامتحان</h2>
   <video ref={videoRef} muted playsInline style={{display:'block',width:'100%',maxWidth:560,aspectRatio:'16/9',objectFit:'cover',margin:'18px auto',borderRadius:18,background:'#020617'}}/>
   <div style={{padding:18,borderRadius:14,background:status==='ok'?'#052e16':status==='bad'?'#450a0a':'#172033',textAlign:'center'}}>{status==='ok'?<FaCheck color="#4ade80" size={30}/>:status==='bad'?<FaCircleExclamation color="#f87171" size={30}/>:<FaCamera color="#67e8f9" size={30}/>}<p style={{fontWeight:800,lineHeight:1.9}}>{message}</p>{distance!=null&&<small>مسافة المطابقة: {distance.toFixed(4)}</small>}</div>
   {verified&&timeLeft>0&&<div style={{marginTop:16,textAlign:'center',padding:18,borderRadius:14,background:'#172554'}}><FaShieldHalved color="#60a5fa"/><div style={{marginTop:8}}>تم التحقق. انتظر حتى يبدأ الامتحان.</div><strong style={{fontSize:28,display:'block',marginTop:8}}>{Math.floor(timeLeft/60000)}:{String(Math.floor((timeLeft%60000)/1000)).padStart(2,'0')}</strong><div style={{marginTop:8}}>بالتوفيق والنجاح 🌷</div></div>}
   {status==='bad'&&<button onClick={start} disabled={running} style={{width:'100%',marginTop:15,padding:13,border:0,borderRadius:12,background:'#2563eb',color:'#fff',fontWeight:800}}><FaRotateRight/> إعادة التحقق</button>}
  </div></div>;
}
