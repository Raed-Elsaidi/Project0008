import React, { useState } from 'react';
import { generateStrongPassword, validatePasswordPolicy, PASSWORD_POLICY_MESSAGE } from './passwordPolicy';

export default function ForgotStudentPassword({ supabase, onBack }) {
  const [step, setStep] = useState('verify');
  const [form, setForm] = useState({ seatingNumber: '', nationalId: '', phone: '' });
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (name, value) => setForm(v => ({ ...v, [name]: value }));

  const verify = async (e) => {
    e.preventDefault(); setError('');
    if (Object.values(form).some(v => !String(v).trim())) { setError('يرجى تعبئة جميع الحقول.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_student_password_reset_identity', {
        p_seating_number: form.seatingNumber.trim(), p_national_id: form.nationalId.trim(), p_phone: form.phone.trim()
      });
      if (error) throw error;
      if (data !== true) { setError('بيانات الطالب غير صحيحة. تأكد من جميع البيانات المدخلة.'); return; }
      const generated = generateStrongPassword(10);
      if (!validatePasswordPolicy(generated).valid) throw new Error('PASSWORD_GENERATION_FAILED');
      const { data: changed, error: changeError } = await supabase.rpc('reset_student_password_verified', {
        p_seating_number: form.seatingNumber.trim(), p_national_id: form.nationalId.trim(), p_phone: form.phone.trim(), p_new_password: generated
      });
      if (changeError) throw changeError;
      if (changed !== true) throw new Error('RESET_FAILED');
      setNewPassword(generated); setStep('done');
    } catch (err) {
      console.error(err); setError('تعذر التحقق أو إنشاء كلمة المرور الجديدة. تأكد من تشغيل ملف SQL الخاص باستعادة كلمات المرور.');
    } finally { setLoading(false); }
  };
  const copyPassword = async () => { try { await navigator.clipboard.writeText(newPassword); setCopied(true); setTimeout(()=>setCopied(false),1800); } catch { setError('تعذر النسخ تلقائيًا، يرجى نسخها يدويًا.'); } };

  return <div className="forgot-password-page" dir="rtl"><div className="forgot-password-card">
    <div className="forgot-password-icon">🔐</div>
    <h1>{step === 'verify' ? 'فقدان كلمة المرور' : 'إنشاء كلمة مرور جديدة'}</h1>
    <p className="forgot-password-subtitle">{step === 'verify' ? 'أدخل بياناتك للتحقق من هويتك' : 'تم التحقق من بيانات الطالب بنجاح'}</p>
    {error && <div className="forgot-password-error">⚠️ {error}</div>}
    {step === 'verify' ? <form onSubmit={verify} className="forgot-password-form">
      {[["seatingNumber","رقم الجلوس"],["nationalId","رقم الهوية"],["phone","رقم الهاتف المدخل"]].map(([name,label])=><div key={name}><label>{label}</label><input value={form[name]} onChange={e=>update(name,e.target.value)} disabled={loading} autoComplete="off" /></div>)}
      <button className="forgot-primary" disabled={loading}>{loading ? 'جاري التحقق...' : 'تحقق وإنشاء كلمة مرور جديدة'}</button>
    </form> : <div className="forgot-done">
      <p>كلمة المرور الجديدة:</p><div className="generated-password-row"><code>{newPassword}</code><button type="button" onClick={copyPassword}>{copied ? '✓ تم النسخ' : 'نسخ'}</button></div>
      <div className="policy-note">{PASSWORD_POLICY_MESSAGE}</div><div className="forgot-warning">الرجاء الاحتفاظ بكلمة المرور الجديدة حتى تتمكن من الدخول بها لاحقًا.</div>
      <button className="forgot-close" onClick={onBack}>إغلاق</button>
    </div>}
    {step === 'verify' && <button className="forgot-close secondary" onClick={onBack}>إغلاق</button>}
  </div></div>;
}
