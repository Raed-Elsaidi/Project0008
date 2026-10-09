import React, { useEffect, useState } from 'react';

export default function StudentProfile({ supabase, onBack }) {
  const [credentials, setCredentials] = useState({ seatingNumber: '', password: '' });
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
      const { data, error } = await supabase.from('students').select('*').eq('seating_number', credentials.seatingNumber.trim()).maybeSingle();
      if (error) throw error;
      if (!data) {
        setMessage({ type: 'error', text: 'رقم الجلوس أو كلمة المرور غير صحيحة.' });
        return;
      }

      const { data: passwordValid, error: passwordError } = await supabase.rpc('verify_student_password', {
        p_seating_number: credentials.seatingNumber.trim(),
        p_password: credentials.password.trim()
      });
      if (passwordError || passwordValid !== true) {
        setMessage({ type: 'error', text: 'رقم الجلوس أو كلمة المرور غير صحيحة.' });
        return;
      }
      if (data.profile_edit_used === true) {
        setMessage({ type: 'error', text: 'لقد استخدمت صلاحية تعديل البيانات مسبقًا. لا يمكن التعديل مرة أخرى.' });
        return;
      }
      setStudent(data);
      setForm({
        full_name_ar: data.full_name_ar || '',
        full_name_en: data.full_name_en || '',
        gender: data.gender || '',
        nationality: data.nationality || '',
        birth_date: data.birth_date || '',
        birth_place: data.birth_place || '',
        phone_number: data.phone_number || '',
        whatsapp_number: data.whatsapp_number || '',
        address: data.address || '',
        directorate_name: data.directorate_name || '',
        school_name: data.school_name || '',
        branch: data.branch || ''
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'تعذر تحميل بيانات الطالب: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!student) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        gender: form.gender || null,
        nationality: form.nationality || null,
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        phone_number: String(form.phone_number || '').replace(/\D/g, '').slice(0, 10) || null,
        whatsapp_number: String(form.whatsapp_number || '').replace(/\D/g, '').slice(0, 14) || null,
        address: form.address || null,
        directorate_name: form.directorate_name || null,
        school_name: form.school_name || null,
        branch: form.branch || null,
        profile_edit_used: true
      };
      const { data, error } = await supabase.from('students')
        .update(payload)
        .eq('id', student.id)
        .eq('profile_edit_used', false)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setMessage({ type: 'error', text: 'تم استخدام صلاحية التعديل مسبقًا أو لم يعد السجل متاحًا.' });
        return;
      }
      setStudent(data);
      setMessage({ type: 'success', text: 'تم حفظ بياناتك بنجاح. هذه الصلاحية كانت متاحة لمرة واحدة فقط.' });
    } catch (error) {
      if (/profile_edit_used|column/i.test(String(error.message || ''))) {
        setMessage({ type: 'error', text: 'يجب إضافة حقل profile_edit_used إلى جدول students أولًا. يوجد ملف SQL جاهز ضمن المشروع.' });
      } else {
        setMessage({ type: 'error', text: 'تعذر حفظ التعديل: ' + error.message });
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!student) return;
  }, [student]);

  const editable = [
    ['gender', 'الجنس'], ['nationality', 'الجنسية'], ['birth_date', 'تاريخ الميلاد'],
    ['birth_place', 'مكان الميلاد'], ['phone_number', 'رقم الهاتف'], ['whatsapp_number', 'رقم الواتساب'],
    ['address', 'العنوان'], ['directorate_name', 'المديرية'], ['school_name', 'المدرسة'], ['branch', 'الفرع']
  ];

  return (
    <div className="student-profile-page" dir="rtl" style={styles.page}>
      <div style={styles.card}>
        <div style={styles.top}><h2 style={{ margin: 0, color: '#38bdf8' }}>👤 تعديل بيانات الطالب</h2><button onClick={onBack} style={styles.back}>🏠 الرئيسية</button></div>
        <p style={styles.help}>يمكن تعديل البيانات مرة واحدة فقط. الاسم ورقم الهوية ثابتان ولا يمكن تعديلهما.</p>

        {!student ? (
          <form onSubmit={login} style={styles.form}>
            <input style={styles.input} placeholder="رقم الجلوس" value={credentials.seatingNumber} onChange={e => setCredentials({ ...credentials, seatingNumber: e.target.value })} />
            <input style={styles.input} type="password" placeholder="كلمة المرور" value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })} />
            <button disabled={loading} style={styles.primary}>{loading ? 'جاري التحقق...' : 'دخول وتعديل البيانات'}</button>
          </form>
        ) : (
          <>
            <div className="student-profile-grid" style={styles.grid}>
              <div><label style={styles.label}>الاسم بالعربية</label><input style={styles.input} value={student.full_name_ar || ''} disabled /></div>
              <div><label style={styles.label}>رقم الهوية</label><input style={styles.input} value={student.national_id || ''} disabled /></div>
              {editable.map(([key, label]) => (
                <div key={key}><label style={styles.label}>{label}</label><input style={styles.input} type={key === 'birth_date' ? 'date' : 'text'} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>
              ))}
            </div>
            <button onClick={save} disabled={saving} style={{ ...styles.primary, width: '100%', marginTop: 18 }}>{saving ? 'جاري الحفظ...' : '💾 حفظ التعديل النهائي'}</button>
          </>
        )}

        {message.text && <div style={{ ...styles.message, background: message.type === 'success' ? '#064e3b' : '#7f1d1d', borderColor: message.type === 'success' ? '#10b981' : '#ef4444' }}>{message.text}</div>}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#020817', color: '#fff', padding: '24px' },
  card: { maxWidth: 900, margin: '0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  help: { color: '#cbd5e1', lineHeight: 1.9, fontSize: 13 },
  back: { padding: '9px 14px', background: '#334155', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' },
  form: { display: 'grid', gap: 12, maxWidth: 500, margin: '25px auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, marginTop: 22 },
  label: { display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 5 },
  input: { width: '100%', padding: 11, background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: 8, boxSizing: 'border-box' },
  primary: { padding: '12px 18px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  message: { marginTop: 18, padding: 13, border: '1px solid', borderRadius: 10, textAlign: 'center', lineHeight: 1.8 }
};
