import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCamera, FaCheck, FaCircleExclamation, FaRotateRight, FaShieldHalved } from 'react-icons/fa6';
import { descriptorFromVideo, faceMatch } from './BiometricUtils';

export default function PreExamBiometricGate({ supabase, student, exam, onSuccess, onBack }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('جاري تشغيل الكاميرا والتحقق من الهوية...');
  const [distance, setDistance] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [verified, setVerified] = useState(false);
  const [running, setRunning] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);

  const stop = () => {
    attemptRef.current += 1;
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stop(), []);

  const saveFailedAttemptForRegistrar = async ({ best, sessionId }) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) throw new Error('تعذر التقاط صورة المحاولة الحية. أعد المحاولة مع تشغيل الكاميرا.');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const liveImageDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const { data, error } = await supabase.rpc('submit_exam_biometric_manual_review', {
      p_student_id: Number(student.id),
      p_exam_id: exam?.id ? Number(exam.id) : null,
      p_session_id: sessionId,
      p_live_image_data_url: liveImageDataUrl,
      p_distance: best.distance,
      p_threshold: best.threshold,
      p_match_score: best.score,
      p_failure_reason: `درجة المطابقة ${best.score}% أقل من الحد المطلوب 75%`
    });
    if (error) throw new Error(`تعذر إرسال طلب المراجعة: ${error.message}`);
    setPendingSessionId(sessionId);
    setReviewSubmitted(true);
    return data;
  };

  const start = async () => {
    stop();
    const attempt = ++attemptRef.current;
    setRunning(true);
    setStatus('checking');
    setReviewSubmitted(false);
    setMatchScore(null);
    setDistance(null);
    setVerified(false);
    setMessage('ضع وجهك كاملًا داخل الإطار وبإضاءة جيدة.');

    try {
      if (!exam?.id || exam.is_active !== true || exam.access_enabled !== true) {
        throw new Error('هذا الامتحان غير مفعّل من الإدارة. لا يمكن بدء التحقق البيومتري.');
      }

      // أعد قراءة حالة الامتحان من قاعدة البيانات مباشرة قبل تشغيل الكاميرا.
      const { data: latestExam, error: examStateError } = await supabase
        .from('exams')
        .select('id,is_active,access_enabled')
        .eq('id', exam.id)
        .maybeSingle();

      if (examStateError) throw examStateError;
      if (!latestExam || latestExam.is_active !== true || latestExam.access_enabled !== true) {
        throw new Error('هذا الامتحان غير مفعّل من الإدارة. لا يمكن بدء التحقق البيومتري.');
      }

      if (!student?.id) throw new Error('تعذر تحديد بيانات الطالب.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('هذا المتصفح لا يدعم الكاميرا.');

      const { data, error } = await supabase.from('students')
        .select('face_descriptor,id_face_descriptor')
        .eq('id', student.id).maybeSingle();
      if (error) throw error;
      if (!Array.isArray(data?.face_descriptor) || data.face_descriptor.length !== 128) {
        throw new Error('لا توجد بصمة وجه مسجلة لهذا الطالب. يجب اعتماد البصمة أولًا.');
      }

      // اطلب فيديو عموديًا على الهاتف حتى يظهر الوجه كاملًا داخل الإطار.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          aspectRatio: { ideal: 0.75 },
          width: { ideal: 720 },
          height: { ideal: 1280 }
        },
        audio: false
      });

      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('تعذر تجهيز إطار الكاميرا. أعد المحاولة.');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      if (video.readyState < 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('تأخر تشغيل الكاميرا. تحقق من إذن الكاميرا ثم أعد المحاولة.')), 8000);
          video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
          video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('تعذر تحميل صورة الكاميرا.')); }, { once: true });
        });
      }
      if (attempt !== attemptRef.current) return;
      await video.play();
      await new Promise(resolve => setTimeout(resolve, 900));
      if (attempt !== attemptRef.current) return;

      const live = await descriptorFromVideo(video);
      const primary = faceMatch(live, data.face_descriptor, 75);
      let best = primary;
      if (Array.isArray(data.id_face_descriptor) && data.id_face_descriptor.length === 128) {
        const idMatch = faceMatch(live, data.id_face_descriptor, 75);
        if (idMatch.score > best.score) best = idMatch;
      }
      if (attempt !== attemptRef.current) return;

      setDistance(best.distance);
      setMatchScore(best.score);
      setStatus(best.matched ? 'ok' : 'bad');
      setVerified(best.matched);

      const sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const { error: auditError } = await supabase.from('exam_biometric_verifications').insert([{
        student_id: student.id,
        exam_id: exam?.id || null,
        session_id: sessionId,
        verified: best.matched,
        distance: best.distance,
        threshold: best.threshold,
        failure_reason: best.matched ? null : `مطلوب مراجعة المسجّل: درجة المطابقة ${best.score}% أقل من 75%`
      }]);
      if (auditError) console.error('تعذر حفظ سجل المطابقة البيومترية:', auditError);

      if (best.matched) {
        setMessage('تم التحقق من الهوية بنجاح.');
      } else {
        setVerified(false);
        await saveFailedAttemptForRegistrar({ best, sessionId });
        setMessage('لم تصل المطابقة إلى الحد المطلوب. تم إرسال صورة المحاولة وبياناتها إلى الموظف المختص للمراجعة. ستبقى بانتظار القرار ولن تتمكن من دخول الامتحان قبله.');
      }
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      setStatus('bad');
      setVerified(false);
      const isInterrupted = error?.name === 'AbortError' || /interrupted|play\(\)/i.test(error?.message || '');
      setMessage(isInterrupted
        ? 'انقطع تشغيل الكاميرا أثناء تحميلها. اضغط إعادة التحقق، وحافظ على الصفحة مفتوحة حتى تظهر صورتك.'
        : (error.message || 'تعذر التحقق من الهوية.'));
    } finally {
      if (attempt === attemptRef.current) setRunning(false);
    }
  };

  useEffect(() => {
    start();
    return () => stop();
  }, []);

  useEffect(() => {
    if (!verified) return;
    const startAt = exam?.examStartsAt ? new Date(exam.examStartsAt).getTime() : Date.now();
    const tick = () => setTimeLeft(Math.max(0, startAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [verified, exam]);

  useEffect(() => {
    if (verified && timeLeft === 0) {
      const timer = setTimeout(() => onSuccess(), 300);
      return () => clearTimeout(timer);
    }
  }, [verified, timeLeft, onSuccess]);

  useEffect(() => {
    if (!pendingSessionId || verified) return;
    let active = true;
    const check = async () => {
      const { data, error } = await supabase.rpc('get_exam_biometric_manual_review_status', { p_session_id: pendingSessionId });
      if (!active || error || !Array.isArray(data) || !data.length) return;
      const decision = data[0];
      if (decision.status === 'approved') {
        setVerified(true);
        setStatus('ok');
        setReviewSubmitted(false);
        setMessage('وافق الموظف المختص على التحقق من هويتك. انتظر بدء الامتحان.');
      } else if (decision.status === 'rejected') {
        setReviewSubmitted(false);
        setMessage(`رفض الموظف المختص التحقق. ${decision.reviewer_note || 'يرجى مراجعة الإدارة.'}`);
        setPendingSessionId(null);
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [pendingSessionId, verified, supabase]);

  return (
    <div dir="rtl" style={{ minHeight: '100vh', padding: '24px 16px', background: '#0f172a', fontFamily: 'Tahoma,Arial', color: '#fff' }}>
      <div style={{ maxWidth: 640, margin: '24px auto', background: '#111827', padding: '24px 20px', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid #334155', background: '#1e293b', color: '#fff', fontSize: 17 }}>
            <FaArrowRight style={{ marginLeft: 8 }} /> العودة
          </button>
        </div>

        <h2 style={{ textAlign: 'center', color: '#67e8f9', lineHeight: 1.8, fontSize: 'clamp(23px, 5vw, 34px)', margin: '28px 0 20px' }}>
          🔐 التحقق البيومتري قبل الامتحان
        </h2>

        <div style={{ width: 'min(100%, 370px)', aspectRatio: '3 / 4', margin: '18px auto 22px', borderRadius: 28, overflow: 'hidden', background: '#020617', border: '2px solid rgba(103,232,249,.28)', boxShadow: '0 10px 35px rgba(0,0,0,.25)' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', background: '#020617', transform: 'scaleX(-1)' }}
          />
        </div>

        <div style={{ padding: '22px 18px', borderRadius: 22, background: '#172033', border: '1px solid #26364f', textAlign: 'center', minHeight: 150 }}>
          {status === 'ok' ? <FaCheck color="#4ade80" size={34} /> : status === 'bad' ? <FaCircleExclamation color="#f87171" size={34} /> : <FaCamera color="#67e8f9" size={38} />}
          <p style={{ fontWeight: 800, lineHeight: 1.9, fontSize: 18, margin: '14px 0 0' }}>{message}</p>
          {matchScore !== null && <small>درجة المطابقة الفنية: {matchScore}% (الحد المطلوب 75%)</small>}
          {reviewSubmitted && <p style={{ color: '#86efac' }}>رقم طلب المراجعة أُنشئ بنجاح.</p>}
        </div>

        {verified && timeLeft > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center', padding: 18, borderRadius: 18, background: '#172554' }}>
            <FaShieldHalved color="#60a5fa" />
            <div style={{ marginTop: 8 }}>تم التحقق. انتظر حتى يبدأ الامتحان.</div>
            <strong style={{ fontSize: 28, display: 'block', marginTop: 8 }}>{Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}</strong>
            <div style={{ marginTop: 8 }}>بالتوفيق والنجاح 🌷</div>
          </div>
        )}

        {status === 'bad' && !reviewSubmitted && (
          <button onClick={start} disabled={running} style={{ width: '100%', marginTop: 18, padding: 16, border: 0, borderRadius: 16, background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 18 }}>
            <FaRotateRight style={{ marginLeft: 8 }} /> إعادة التحقق
          </button>
        )}
        {status === 'bad' && reviewSubmitted && <p style={{ textAlign: 'center', color: '#fcd34d' }}>طلبك قيد مراجعة الموظف المختص. ستُحدّث الحالة تلقائيًا عند صدور القرار؛ أبقِ الصفحة مفتوحة.</p>}
      </div>
    </div>
  );
}
