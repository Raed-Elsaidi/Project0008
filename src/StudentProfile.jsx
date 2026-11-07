import React, { useState } from 'react';
import {
  FaUser, FaIdCard, FaVenusMars, FaFlag, FaCalendarDays, FaLocationDot,
  FaPhone, FaWhatsapp, FaMap, FaSchool, FaCodeBranch,
  FaArrowRightFromBracket, FaFloppyDisk, FaRightToBracket
} from 'react-icons/fa6';

export default function StudentProfile({ supabase, onBack }) {
  const [credentials, setCredentials] = useState({ nationalId: '' });
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const login = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);
    try {
      const nationalId = credentials.nationalId.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      if (!/^\d{9}$/.test(nationalId)) throw new Error('رقم الهوية يجب أن يتكون من 9 أرقام.');
      const { data, error } = await supabase.from('allow_student').select('*').eq('national_id', nationalId).maybeSingle();
      if (error) throw error;
      if (!data) {
        setMessage({ type: 'error', text: 'رقم الهوية غير مؤهل للتسجيل أو غير موجود في النظام.' });
        return;
      }
      setStudent(data);
      setForm({
        gender: data.gender || '', nationality: data.nationality || '',
        birth_date: data.birth_date || '', birth_place: data.birth_place || '',
        phone_number: data.phone_number || '', whatsapp_number: data.whatsapp_number || '',
        address: data.address || '', directorate_name: data.directorate_name || '',
        school_name: data.school_name || '', branch: data.branch || ''
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'تعذر البحث عن الطالب: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!student) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const fields = [
        'gender', 'nationality', 'birth_date', 'birth_place', 'phone_number',
        'whatsapp_number', 'address', 'directorate_name', 'school_name', 'branch'
      ];
      const changes = fields
        .filter((field) => String(form[field] ?? '') !== String(student[field] ?? ''))
        .map((field) => ({
          field_name: field,
          current_value: String(student[field] ?? ''),
          requested_value: String(form[field] ?? '')
        }));
      if (!changes.length) {
        setMessage({ type: 'error', text: 'لم تغيّر أي بيانات لإرسالها للمراجعة.' });
        return;
      }
      const { data, error } = await supabase.rpc('submit_student_personal_data_change_request', {
        p_national_id: credentials.nationalId.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))),
        p_changes: changes
      });
      if (error) throw error;
      if (!data) throw new Error('لم يتم إنشاء طلب التعديل.');
      setMessage({ type: 'success', text: 'تم إرسال طلبك إلى المسجّل بنجاح. لن تتغير بياناتك إلا بعد الموافقة عليه.' });
    } catch (error) {
      if (/allow_student|national_id|رقم الهوية/i.test(String(error.message || ''))) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'error', text: 'تعذر حفظ التعديل: ' + error.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const editable = [
    ['gender', 'الجنس', FaVenusMars, 'violet'],
    ['nationality', 'الجنسية', FaFlag, 'blue'],
    ['birth_date', 'تاريخ الميلاد', FaCalendarDays, 'gold'],
    ['birth_place', 'مكان الميلاد', FaLocationDot, 'pink'],
    ['phone_number', 'رقم الهاتف', FaPhone, 'cyan'],
    ['whatsapp_number', 'رقم الواتساب', FaWhatsapp, 'green'],
    ['address', 'العنوان', FaMap, 'violet'],
    ['directorate_name', 'المديرية', FaLocationDot, 'gold'],
    ['school_name', 'المدرسة', FaSchool, 'blue'],
    ['branch', 'الفرع', FaCodeBranch, 'pink']
  ];

  return (
    <div className="student-profile-page" dir="rtl">
      <style>{`
        .student-profile-page {
          --sp-text: #f8fafc; --sp-muted: #b8c7dc;
          min-height: 100vh; padding: clamp(14px,3vw,30px); color: var(--sp-text);
          background: radial-gradient(ellipse at 12% 10%,rgba(124,58,237,.18),transparent 32%),
            radial-gradient(ellipse at 90% 45%,rgba(14,165,233,.16),transparent 35%),
            linear-gradient(145deg,#030817,#071b36 58%,#061329);
          font-family: "Noto Kufi Arabic",Tahoma,sans-serif; box-sizing: border-box;
        }
        .student-profile-page * { box-sizing: border-box; }
        .sp-card {
          width:min(960px,100%); margin:0 auto; padding:clamp(18px,4vw,34px); border-radius:24px;
          background:linear-gradient(145deg,rgba(15,34,65,.97),rgba(7,22,44,.97));
          border:1px solid rgba(56,189,248,.30); box-shadow:0 24px 65px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.05);
          backdrop-filter:blur(12px);
        }
        .sp-top { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding-bottom:18px;border-bottom:1px solid rgba(148,163,184,.18); }
        .sp-heading { display:flex;align-items:center;gap:13px;margin:0;color:#f8fafc;font-size:clamp(20px,3vw,28px);font-weight:900; }
        .sp-heading-icon { display:grid;place-items:center;flex:0 0 54px;width:54px;height:54px;border-radius:16px;color:#38bdf8;background:rgba(14,165,233,.13);border:1px solid rgba(56,189,248,.34);box-shadow:0 0 25px rgba(14,165,233,.12); }
        .sp-help { color:var(--sp-muted);line-height:1.9;font-size:13px;margin:17px 0 8px; }
        .sp-button { display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:11px 17px;border:1px solid var(--button-border,rgba(56,189,248,.55));border-radius:13px;color:#fff;background:var(--button-bg,rgba(14,165,233,.15));font:inherit;font-weight:800;cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,background .22s ease; }
        .sp-button:hover:not(:disabled),.sp-button:focus-visible:not(:disabled) { transform:translateY(-3px);background:var(--button-hover,rgba(14,165,233,.28));box-shadow:0 0 22px var(--button-glow,rgba(56,189,248,.23));outline:none; }
        .sp-button:active:not(:disabled) { transform:scale(.97); }
        .sp-button:disabled { opacity:.65;cursor:wait; }
        .sp-back { --button-border:rgba(167,139,250,.55);--button-bg:rgba(124,58,237,.13);--button-hover:rgba(124,58,237,.27);--button-glow:rgba(139,92,246,.24); }
        .sp-primary { --button-border:rgba(56,189,248,.7);--button-bg:linear-gradient(135deg,rgba(37,99,235,.55),rgba(8,145,178,.34));--button-hover:linear-gradient(135deg,rgba(37,99,235,.8),rgba(8,145,178,.52));--button-glow:rgba(56,189,248,.27);width:100%; }
        .sp-form { display:grid;gap:15px;max-width:520px;margin:25px auto 8px; }
        .sp-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:24px; }
        .sp-field-card { --field-color:#38bdf8;min-width:0;padding:14px;border-radius:16px;border:1px solid rgba(56,189,248,.27);background:linear-gradient(145deg,rgba(19,40,73,.92),rgba(8,24,47,.95));transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease; }
        .sp-field-card:hover,.sp-field-card:focus-within { transform:translateY(-3px);border-color:var(--field-color);box-shadow:0 0 23px var(--field-glow,rgba(56,189,248,.2)); }
        .sp-field-card.blue { --field-color:#38bdf8;--field-glow:rgba(56,189,248,.2); }
        .sp-field-card.violet { --field-color:#a78bfa;--field-glow:rgba(167,139,250,.2); }
        .sp-field-card.gold { --field-color:#facc15;--field-glow:rgba(250,204,21,.18); }
        .sp-field-card.pink { --field-color:#f472b6;--field-glow:rgba(244,114,182,.2); }
        .sp-field-card.cyan { --field-color:#22d3ee;--field-glow:rgba(34,211,238,.2); }
        .sp-field-card.green { --field-color:#34d399;--field-glow:rgba(52,211,153,.2); }
        .sp-label { display:flex;align-items:center;gap:8px;color:#dbeafe;font-size:13px;font-weight:800;margin-bottom:9px; }
        .sp-label-icon { display:inline-grid;place-items:center;width:30px;height:30px;flex:0 0 30px;border-radius:9px;color:var(--field-color,#38bdf8);background:rgba(56,189,248,.1); }
        .sp-input { width:100%;min-width:0;padding:12px 13px;color:#f8fafc;background:rgba(3,12,27,.82);border:1px solid rgba(148,163,184,.32);border-radius:11px;outline:none;font:inherit;font-size:14px;transition:border-color .2s ease,box-shadow .2s ease; }
        .sp-input:focus { border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.13); }
        .sp-input:disabled { color:#b8c7dc;opacity:.9;cursor:not-allowed; }
        .sp-input::placeholder { color:#7f94af; }
        .sp-message { margin-top:18px;padding:13px 15px;border:1px solid;border-radius:13px;text-align:center;line-height:1.9; }
        @media(max-width:620px) { .student-profile-page{padding:10px}.sp-card{padding:17px 12px;border-radius:19px}.sp-top{align-items:flex-start}.sp-heading{font-size:20px}.sp-heading-icon{width:46px;height:46px;flex-basis:46px}.sp-grid{grid-template-columns:1fr;gap:11px}.sp-field-card{padding:12px}.sp-button{width:100%} }
        @media(prefers-reduced-motion:reduce) { .sp-button,.sp-field-card,.sp-input{transition:none} }
      `}</style>

      <div className="sp-card">
        <div className="sp-top">
          <h2 className="sp-heading"><span className="sp-heading-icon"><FaUser size={25} /></span>تعديل بيانات الطالب</h2>
          <button type="button" onClick={onBack} className="sp-button sp-back"><FaArrowRightFromBracket /> الرئيسية</button>
        </div>
        <p className="sp-help">أدخل رقم الهوية للبحث عن أهليتك للتسجيل. يمكنك إرسال طلب تعديل، ولن تتغير البيانات إلا بعد موافقة المسجّل.</p>

        {!student ? (
          <form onSubmit={login} className="sp-form">
            <div className="sp-field-card blue">
              <label className="sp-label" htmlFor="sp-national-id-search"><span className="sp-label-icon"><FaIdCard /></span>رقم الهوية</label>
              <input id="sp-national-id-search" className="sp-input" placeholder="أدخل رقم الهوية المكوّن من 9 أرقام" value={credentials.nationalId} onChange={e => setCredentials({ ...credentials, nationalId: e.target.value })} inputMode="numeric" maxLength={9} required />
            </div>
            <button disabled={loading} className="sp-button sp-primary" type="submit"><FaRightToBracket />{loading ? 'جاري البحث...' : 'بحث عن بياناتي'}</button>
          </form>
        ) : (
          <>
            <div className="sp-grid">
              <div className="sp-field-card violet">
                <label className="sp-label" htmlFor="sp-full-name"><span className="sp-label-icon"><FaUser /></span>الاسم بالعربية</label>
                <input id="sp-full-name" className="sp-input" value={student.full_name_ar || ''} disabled />
              </div>
              <div className="sp-field-card gold">
                <label className="sp-label" htmlFor="sp-national-id"><span className="sp-label-icon"><FaIdCard /></span>رقم الهوية</label>
                <input id="sp-national-id" className="sp-input" value={student.national_id || ''} disabled />
              </div>
              {editable.map(([key,label,Icon,color]) => (
                <div className={`sp-field-card ${color}`} key={key}>
                  <label className="sp-label" htmlFor={`sp-${key}`}><span className="sp-label-icon"><Icon /></span>{label}</label>
                  <input id={`sp-${key}`} className="sp-input" type={key === 'birth_date' ? 'date' : 'text'} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <button type="button" onClick={save} disabled={saving} className="sp-button sp-primary" style={{ marginTop:20 }}><FaFloppyDisk />{saving ? 'جاري الحفظ...' : 'إرسال طلب التعديل للمسجّل'}</button>
          </>
        )}

        {message.text && <div className="sp-message" role="status" style={{
          background:message.type === 'success' ? 'rgba(6,78,59,.42)' : 'rgba(127,29,29,.42)',
          borderColor:message.type === 'success' ? '#10b981' : '#ef4444',
          color:message.type === 'success' ? '#a7f3d0' : '#fecaca'
        }}>{message.text}</div>}
      </div>
    </div>
  );
}
