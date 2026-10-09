import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowRight, FaPaperclip, FaFaceSmile, FaPaperPlane, FaInbox, FaPaperclip as FaClip, FaTrash, FaEnvelopeOpen, FaCheck, FaUser, FaLock, FaXmark, FaEye, FaEyeSlash } from 'react-icons/fa6';
import { playIncomingMessageSound, playMessageSentSound } from './soundUtils';

const BUCKET = 'student-support-messages';
const EMOJIS = ['😀','😊','😂','😍','🥰','👍','👏','🙏','❤️','💙','💚','✨','🎉','✅','❓','⚠️','📚','📝','💡'];
const clean = v => String(v ?? '').trim();
const studentName = s => s?.full_name_ar || s?.full_name || s?.name || 'الطالب';
const seat = s => s?.seating_number || s?.seat_number || s?.seat || '—';
const fmt = v => v ? new Date(v).toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short', numberingSystem:'latn' }) : '—';

export default function StudentMessages({ supabase, onBack }) {
  const [step, setStep] = useState('login');
  const [seatingNumber, setSeatingNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [student, setStudent] = useState(null);
  const [directorateName, setDirectorateName] = useState('—');
  const [schoolName, setSchoolName] = useState('—');
  const [branchName, setBranchName] = useState('—');
  const errorTimer = useRef(null);
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [box, setBox] = useState('sent');
  const [selected, setSelected] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const knownIds = useRef(new Set());

  const showToast = (text) => { setToast(text); window.setTimeout(() => setToast(''), 2000); };
  const showError = (text) => {
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    setError(String(text || 'حدث خطأ.'));
    errorTimer.current = window.setTimeout(() => setError(''), 2000);
  };

  const loadMessages = async (studentId) => {
    const { data, error: e } = await supabase.from('student_support_messages').select('*').eq('student_id', studentId).order('created_at', { ascending:false });
    if (e) throw e;
    const rows = data || [];
    if (knownIds.current.size > 0) {
      const freshIncoming = rows.filter(m => m.sender_type === 'support' && !knownIds.current.has(m.id));
      if (freshIncoming.length) playIncomingMessageSound();
    }
    rows.forEach(m => knownIds.current.add(m.id));
    setMessages(rows);
  };

  const login = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const sn = clean(seatingNumber), pw = clean(password);
      if (!sn || !pw) throw new Error('يرجى إدخال رقم الجلوس وكلمة المرور.');
      const { data:s, error:e1 } = await supabase.from('students').select('*').eq('seating_number', sn).maybeSingle();
      if (e1) throw e1;
      if (!s) throw new Error('رقم الجلوس غير موجود.');
      if (s.is_active === false) {
        showError(`🚫 لطفاً ... عزيز الطالب: ${studentName(s)}\nلقد تم تعطيل دخولك للنظام\nيرجى التوجه لمديرية التعليم بمنطقتك وشكراً`);
        return;
      }
      const { data:valid, error:e2 } = await supabase.rpc('verify_student_password', { p_seating_number: sn, p_password: pw });
      if (e2) throw e2;
      if (valid !== true) throw new Error('كلمة المرور غير صحيحة.');
      setStudent(s);
      const branchRes = s.branch_id
        ? await supabase.from('branches').select('*').eq('id', s.branch_id).maybeSingle()
        : { data:null };

      // بيانات المديرية والمدرسة تأتي من سجل الطالب نفسه، مع محاولة جلب الاسم من الجداول
      // عند توفر المعرف فقط؛ وأي فشل في الجلب لا يمنع فتح شاشة المراسلة.
      const directDirectorate = s.directorate_name || s.directorate || s.directorateName || s.directorate_title;
      const directSchool = s.school_name || s.school || s.schoolName || s.school_title;
      let resolvedDirectorate = directDirectorate || '—';
      let resolvedSchool = directSchool || '—';

      if (s.directorate_id) {
        try {
          const r = await supabase.from('directorates').select('*').eq('id', s.directorate_id).maybeSingle();
          resolvedDirectorate = r?.data?.directorate_name || r?.data?.display_name || r?.data?.name || resolvedDirectorate;
        } catch (_) {}
      }
      if (s.school_id) {
        try {
          const r = await supabase.from('schools').select('*').eq('id', s.school_id).maybeSingle();
          resolvedSchool = r?.data?.school_name || r?.data?.display_name || r?.data?.name || resolvedSchool;
        } catch (_) {}
      }

      setDirectorateName(resolvedDirectorate);
      setSchoolName(resolvedSchool);
      setBranchName(branchRes?.data?.branch_name || branchRes?.data?.display_name || branchRes?.data?.name || s.branch_name || s.branch || '—');
      await loadMessages(s.id);
      setStep('messages');
    } catch (e2) { console.error(e2); showError(e2.message || 'تعذر تسجيل الدخول.'); }
    finally { setLoading(false); }
  };

  useEffect(() => () => { if (errorTimer.current) window.clearTimeout(errorTimer.current); }, []);

  useEffect(() => {
    if (step !== 'messages' || !student?.id) return;
    const timer = setInterval(() => loadMessages(student.id).catch(()=>{}), 12000);
    const channel = supabase.channel(`student-messages-${student.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'student_support_messages', filter:`student_id=eq.${student.id}` }, payload => {
        const row = payload?.new;
        if (!row || row.sender_type !== 'support' || knownIds.current.has(row.id)) return;
        knownIds.current.add(row.id); setMessages(prev => prev.some(x=>x.id===row.id)?prev:[row,...prev]); playIncomingMessageSound();
      }).subscribe();
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [step, student?.id]);

  const inbox = useMemo(() => messages.filter(m => m.sender_type === 'support' && !m.recipient_deleted_at), [messages]);
  const sent = useMemo(() => messages.filter(m => m.sender_type === 'student' && !m.sender_deleted_at), [messages]);
  const trash = useMemo(() => messages.filter(m => m.sender_deleted_at || m.recipient_deleted_at), [messages]);
  const list = box === 'inbox' ? inbox : box === 'trash' ? trash : sent;
  const unread = inbox.filter(m => !m.is_read).length;

  const choose = async m => {
    setSelected(m);
    if (m.sender_type === 'support' && !m.is_read) {
      const now = new Date().toISOString();
      const { error:e } = await supabase.from('student_support_messages').update({ is_read:true, read_at:now }).eq('id', m.id).eq('student_id', student.id);
      if (!e) setMessages(prev=>prev.map(x=>x.id===m.id?{...x,is_read:true,read_at:now}:x));
    }
  };

  const send = async () => {
    if (!subject.trim()) return showError('اكتب عنوان الرسالة.');
    if (!messageText.trim() && !attachment) return showError('اكتب الرسالة أو أرفق ملفاً.');
    setSending(true); setError('');
    try {
      let path=null,name=null,mime=null,size=null;
      if (attachment) {
        if (attachment.size > 25*1024*1024) throw new Error('حجم المرفق يجب ألا يتجاوز 25MB.');
        const safe=attachment.name.replace(/[^a-zA-Z0-9._-\u0600-\u06FF]/g,'_');
        path=`student/${student.id}/${Date.now()}_${safe}`;
        const {error:e}=await supabase.storage.from(BUCKET).upload(path,attachment,{upsert:false,contentType:attachment.type||undefined});
        if(e) throw e; name=attachment.name; mime=attachment.type||'application/octet-stream'; size=attachment.size;
      }
      const now=new Date().toISOString();
      const payload={student_id:student.id,sender_type:'student',sender_employee_id:null,subject:subject.trim(),message:messageText.trim(),attachment_path:path,attachment_name:name,attachment_mime:mime,attachment_size:size,delivered_at:now,is_read:false,read_at:null,sender_deleted_at:null,recipient_deleted_at:null};
      const {data,error:e}=await supabase.from('student_support_messages').insert(payload).select('*').single();
      if(e) throw e; setMessages(prev=>[data,...prev]); setSubject('');setMessageText('');setAttachment(null);setBox('sent');
      const input=document.getElementById('student-msg-attachment'); if(input) input.value=''; playMessageSentSound(); showToast('تم إرسال الرسالة بنجاح ✓');
    } catch(e) { console.error(e); showError(e.message||'تعذر إرسال الرسالة.'); }
    finally { setSending(false); }
  };

  const deleteMsg = async m => {
    const field = m.sender_type === 'student' ? 'sender_deleted_at' : 'recipient_deleted_at';
    const now = new Date().toISOString(); const {error:e}=await supabase.from('student_support_messages').update({[field]:now}).eq('id',m.id);
    if(e) return showError(e.message); setMessages(prev=>prev.map(x=>x.id===m.id?{...x,[field]:now}:x));setSelected(null);
  };

  const openAttachment = async m => {
    if(!m.attachment_path) return; const {data,error:e}=await supabase.storage.from(BUCKET).createSignedUrl(m.attachment_path,300); if(e) return showError(e.message); window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };

  if (step === 'login') return <div className="student-msg-page" dir="rtl"><div className="student-msg-login"><button className="msg-back" onClick={onBack}>🏠 الرئيسية</button><div className="msg-login-icon">🔐</div><h1 className="msg-login-title">استفسارات وشكاوي واشعارات النظام</h1><p>فريق كامل من أجلك تواصل معنا — أدخل رقم الجلوس وكلمة المرور.</p><form className="msg-login-form" onSubmit={login}>
        <div className="msg-field-row">
          <label className="msg-field-label">رقم الجلوس</label>
          <input inputMode="numeric" value={seatingNumber} onChange={e=>setSeatingNumber(e.target.value)} placeholder="أدخل رقم الجلوس" aria-label="رقم الجلوس"/>
        </div>
        <div className="msg-field-row">
          <label className="msg-field-label">كلمة المرور</label>
          <div className="msg-password-wrap">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="أدخل كلمة المرور" aria-label="كلمة المرور"/>
            <button type="button" className="msg-password-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              {showPassword ? <FaEyeSlash/> : <FaEye/>}
            </button>
          </div>
        </div>
        <button className="msg-login-submit" disabled={loading}>{loading?'جارٍ التحقق...':'دخول'}</button>
      </form>{error&&<div className="msg-error">{error}</div>}</div></div>;

  return <div className="student-msg-page" dir="rtl">
    <div className="student-msg-wrap">
      <header className="msg-head"><div><div className="msg-kicker">بوابة الطالب</div><h1>✉️ الدعم الفني</h1></div><button className="msg-back" onClick={onBack}>← الرئيسية</button></header>
      <section className="student-info student-info-grid"><div><span>اسم الطالب</span><b>{studentName(student)}</b></div><div><span>رقم الجلوس</span><b>{seat(student)}</b></div><div><span>المديرية</span><b>{directorateName}</b></div><div><span>المدرسة</span><b>{schoolName}</b></div><div><span>الفرع</span><b>{branchName}</b></div></section>
      <section className="compose"><div className="recipient"><span>المرسل له</span><strong>👥 فريق الدعم الفني</strong></div><div className="message-subject-row"><label htmlFor="student-message-subject">عنوان الرسالة</label><input id="student-message-subject" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="اكتب عنوان الرسالة"/></div><textarea value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="اكتب رسالتك هنا..."></textarea><div className="msg-tools"><label className="tool"><FaClip/> المرفقات<input id="student-msg-attachment" type="file" hidden onChange={e=>setAttachment(e.target.files?.[0]||null)}/></label><button className="tool" onClick={()=>setEmojiOpen(v=>!v)}><FaFaceSmile/> الإيموجي</button><button className="send" onClick={send} disabled={sending}><FaPaperPlane/> {sending?'جارٍ الإرسال...':'إرسال'}</button>{attachment&&<span className="attachment-name">{attachment.name}</span>}</div>{emojiOpen&&<div className="emoji-row">{EMOJIS.map(e=><button key={e} onClick={()=>setMessageText(v=>v+e)}>{e}</button>)}</div>}</section>
      <nav className="boxes">{[['inbox','📥 البريد الوارد'],['sent','📤 البريد الصادر'],['trash','🗑️ صندوق المحذوفات']].map(([k,l])=><button key={k} className={box===k?'active':''} onClick={()=>{setBox(k);setSelected(null)}}>{l}{k==='inbox'&&unread>0&&<em>{unread}</em>}</button>)}</nav>
      {toast&&<div className="center-toast">✓ {toast}</div>}{error&&<div className="msg-error">{error}</div>}
      <section className="table-card"><div className="table-scroll"><table><thead><tr><th>رقم مسلسل</th><th>عنوان الرسالة</th><th>الإرسال</th><th>التسليم</th><th>المرفقات</th></tr></thead><tbody>{list.length===0?<tr><td colSpan="5" className="empty">لا توجد رسائل في هذا الصندوق.</td></tr>:list.map((m,i)=><tr key={m.id} onClick={()=>choose(m)}><td>{i+1}</td><td>{m.subject||'—'}</td><td>{fmt(m.created_at)}</td><td>{m.delivered_at?<FaCheck className="check"/>:'—'}</td><td>{m.attachment_path?<FaPaperclip/>:'—'}</td></tr>)}</tbody></table></div></section>
      {selected&&<div className="modal" onClick={()=>setSelected(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><FaXmark/></button><h2>{selected.subject||'الرسالة'}</h2><p className="modal-meta">{selected.sender_type==='support'?'الدعم الفني':'أنت'} — {fmt(selected.created_at)}</p><div className="modal-body">{selected.message||'—'}</div><div className="modal-actions">{selected.attachment_path&&<button className="tool" onClick={()=>openAttachment(selected)}>📎 فتح المرفق</button>}<button className="delete" onClick={()=>deleteMsg(selected)}><FaTrash/> حذف</button></div></div></div>}
    </div>
  </div>;
}
