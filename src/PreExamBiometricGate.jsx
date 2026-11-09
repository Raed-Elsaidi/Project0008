import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCamera, FaCheck, FaCircleExclamation, FaRotateRight, FaShieldHalved, FaClock } from 'react-icons/fa6';
import { descriptorFromVideo, faceMatch } from './BiometricUtils';

const BIOMETRIC_THRESHOLD = 75;

export default function PreExamBiometricGate({ supabase, student, exam, onSuccess, onBack }) {
  const videoRef = useRef(null); const streamRef = useRef(null);
  const [status,setStatus]=useState('checking'); const [message,setMessage]=useState('جاري تشغيل الكاميرا والتحقق من الهوية...');
  const [distance,setDistance]=useState(null); const [matchScore,setMatchScore]=useState(null); const [timeLeft,setTimeLeft]=useState(null); const [verified,setVerified]=useState(false);
  const [running,setRunning]=useState(false); const [reviewRequestId,setReviewRequestId]=useState(null); const [reviewNote,setReviewNote]=useState('');
  const stop=()=>{if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null;};
  useEffect(()=>()=>stop(),[]);

  const start=async()=>{
    setRunning(true);setStatus('checking');setMatchScore(null);setDistance(null);setReviewRequestId(null);setReviewNote('');setMessage('ضع وجهك داخل الإطار وبإضاءة جيدة.');
    try{
      if(!student?.id) throw new Error('تعذر تحديد بيانات الطالب.');
      if(!exam?.id) throw new Error('تعذر تحديد الامتحان الحالي.');
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('هذا المتصفح لا يدعم الكاميرا.');
      const {data,error}=await supabase.from('students').select('face_descriptor,id_face_descriptor').eq('id',student.id).maybeSingle(); if(error)throw error;
      if(!Array.isArray(data?.face_descriptor)||data.face_descriptor.length!==128) throw new Error('لا توجد بصمة وجه مسجلة لهذا الطالب. يجب إعادة التسجيل/اعتماد البصمة أولًا.');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:720},height:{ideal:1280},aspectRatio:{ideal:3/4}},audio:false});streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();await new Promise(r=>setTimeout(r,1000));
      const live=await descriptorFromVideo(videoRef.current); const primary=faceMatch(live,data.face_descriptor,BIOMETRIC_THRESHOLD); let best=primary;
      if(Array.isArray(data.id_face_descriptor)&&data.id_face_descriptor.length===128){const idm=faceMatch(live,data.id_face_descriptor,BIOMETRIC_THRESHOLD);if(idm.score>best.score)best=idm;}
      setDistance(best.distance); setMatchScore(best.score);
      const passed = Number(best.score) >= BIOMETRIC_THRESHOLD;
      const { error: auditError } = await supabase.from('exam_biometric_verifications').insert([{student_id:student.id,exam_id:exam.id,session_id:globalThis.crypto?.randomUUID?.()||String(Date.now()),verified:passed,distance:best.distance,threshold:BIOMETRIC_THRESHOLD,failure_reason:passed?null:`إحالة تلقائية للمسجّل: درجة المطابقة ${best.score}% أقل من ${BIOMETRIC_THRESHOLD}%`}]);
      if(auditError) console.error('تعذر حفظ سجل المطابقة البيومترية:', auditError);

      if(passed){
        setVerified(true);setStatus('ok');setMessage('تم التحقق من الهوية بنجاح.');
      } else {
        // Capture a compressed frame for the registrar's side-by-side review.
        const canvas=document.createElement('canvas');
        const video=videoRef.current;
        const width=Math.min(video.videoWidth||640,640);
        const height=Math.round(width*(video.videoHeight||480)/(video.videoWidth||640));
        canvas.width=width;canvas.height=height;
        canvas.getContext('2d')?.drawImage(video,0,0,width,height);
        const liveImage=canvas.toDataURL('image/jpeg',0.68);
        const {data:requestId,error:queueError}=await supabase.rpc('submit_exam_biometric_manual_review',{
          p_student_id:Number(student.id),p_exam_id:Number(exam.id),p_match_score:Number(best.score),
          p_distance:Number(best.distance),p_threshold:BIOMETRIC_THRESHOLD,p_live_image_data_url:liveImage,
          p_failure_reason:`درجة المطابقة ${best.score}% أقل من الحد المطلوب ${BIOMETRIC_THRESHOLD}%`
        });
        if(queueError) throw new Error(`تعذر تحويل الطلب إلى المسجّل: ${queueError.message}`);
        setReviewRequestId(requestId);setStatus('pending');
        setMessage('نسبة المطابقة أقل من 75%. تم تحويل طلبك تلقائيًا إلى المسجّل للمراجعة. لن تتمكن من دخول الامتحان قبل صدور القرار.');
      }
    }catch(e){setStatus('bad');setVerified(false);setMessage(e.message||'تعذر التحقق من الهوية.');}
    finally{stop();setRunning(false);}
  };

  useEffect(()=>{start();return()=>stop();},[]);

  // Keep the student on this screen until the registrar approves or rejects the request.
  useEffect(()=>{
    if(!reviewRequestId||verified)return;
    let active=true;
    const check=async()=>{
      const {data,error}=await supabase.rpc('get_exam_biometric_review_status',{p_request_id:reviewRequestId,p_student_id:Number(student?.id)});
      if(!active||error||!data)return;
      const result=Array.isArray(data)?data[0]:data;
      if(result?.status==='approved'){
        setVerified(true);setStatus('ok');setReviewNote('');setMessage('اعتمد المسجّل التحقق من هويتك. سيتم السماح لك بدخول الامتحان حسب موعده.');
      } else if(result?.status==='rejected'){
        setStatus('bad');setReviewNote(result.reviewer_note||'');setMessage('لم يعتمد المسجّل التحقق البيومتري. يرجى مراجعة المسجّل.');
      } else if(result?.status==='pending'){
        setStatus('pending');setMessage('طلبك قيد المراجعة لدى المسجّل. يرجى الانتظار؛ سيتم تحديث الحالة تلقائيًا.');
      }
    };
    check();const timer=setInterval(check,8000);return()=>{active=false;clearInterval(timer);};
  },[reviewRequestId,verified,supabase,student?.id]);

  useEffect(()=>{if(!verified)return; const startAt=exam?.examStartsAt?new Date(exam.examStartsAt).getTime():Date.now(); const tick=()=>setTimeLeft(Math.max(0,startAt-Date.now()));tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[verified,exam]);
  useEffect(()=>{if(verified&&timeLeft===0){const t=setTimeout(()=>onSuccess(),300);return()=>clearTimeout(t);}},[verified,timeLeft,onSuccess]);

  return <div dir="rtl" style={{minHeight:'100vh',padding:20,background:'#0f172a',fontFamily:'Tahoma,Arial',color:'#fff'}}><div style={{maxWidth:800,margin:'30px auto',background:'#111827',padding:24,borderRadius:22,boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
   <button onClick={onBack} style={{padding:'9px 13px',borderRadius:10,border:'1px solid #334155',background:'#1e293b',color:'#fff'}}><FaArrowRight/> العودة</button>
   <h2 style={{textAlign:'center',color:'#67e8f9'}}>🔐 التحقق البيومتري قبل الامتحان</h2>
   <video ref={videoRef} muted playsInline style={{display:'block',width:'100%',maxWidth:420,aspectRatio:'3/4',height:'auto',maxHeight:'70vh',objectFit:'cover',margin:'18px auto',borderRadius:18,background:'#020617'}}/>
   <div style={{padding:18,borderRadius:14,background:status==='ok'?'#052e16':status==='pending'?'#422006':status==='bad'?'#450a0a':'#172033',textAlign:'center'}}>{status==='ok'?<FaCheck color="#4ade80" size={30}/>:status==='pending'?<FaClock color="#fbbf24" size={30}/>:status==='bad'?<FaCircleExclamation color="#f87171" size={30}/>:<FaCamera color="#67e8f9" size={30}/>}<p style={{fontWeight:800,lineHeight:1.9}}>{message}</p>{matchScore!=null&&<small>درجة المطابقة الفنية: {matchScore}% (الحد المطلوب {BIOMETRIC_THRESHOLD}%)</small>}{reviewNote&&<p style={{color:'#fecaca'}}>ملاحظة المسجّل: {reviewNote}</p>}</div>
   {verified&&timeLeft>0&&<div style={{marginTop:16,textAlign:'center',padding:18,borderRadius:14,background:'#172554'}}><FaShieldHalved color="#60a5fa"/><div style={{marginTop:8}}>تم التحقق. انتظر حتى يبدأ الامتحان.</div><strong style={{fontSize:28,display:'block',marginTop:8}}>{Math.floor(timeLeft/60000)}:{String(Math.floor((timeLeft%60000)/1000)).padStart(2,'0')}</strong><div style={{marginTop:8}}>بالتوفيق والنجاح 🌷</div></div>}
   {status==='bad'&&!reviewRequestId&&<button onClick={start} disabled={running} style={{width:'100%',marginTop:15,padding:13,border:0,borderRadius:12,background:'#2563eb',color:'#fff',fontWeight:800}}><FaRotateRight/> إعادة التحقق</button>}
  </div></div>;
}
