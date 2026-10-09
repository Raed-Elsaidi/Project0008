import React, { useState } from 'react';
import ministryLogo from './logo.png';
import { useInstitution, institutionName, institutionLogo } from './institution';
import { validatePasswordPolicy, PASSWORD_POLICY_MESSAGE } from './passwordPolicy';

export default function Password({ supabase, onBack }) {
  const [formData, setFormData] = useState({
    seatingNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const currentServerYear = new Date().getFullYear();
  const institution = useInstitution(supabase);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.seatingNumber || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setMessage({ type: 'error', text: 'يرجى تعبئة جميع الحقول المطلوبة' });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'كلمة المرور الجديدة غير متطابقة' });
      return;
    }

    const policy = validatePasswordPolicy(formData.newPassword);
    if (!policy.valid) {
      setMessage({ type: 'error', text: PASSWORD_POLICY_MESSAGE });
      return;
    }

    setLoading(true);

    try {
      const { data: student, error: fetchError } = await supabase
        .from('students')
        .select('seating_number')
        .eq('seating_number', formData.seatingNumber.trim())
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!student) {
        setMessage({ type: 'error', text: 'رقم الجلوس غير موجود' });
        setLoading(false);
        return;
      }

      const { data: changed, error: updateError } = await supabase.rpc('change_student_password', {
        p_seating_number: formData.seatingNumber.trim(),
        p_current_password: formData.currentPassword,
        p_new_password: formData.newPassword
      });

      if (updateError) throw updateError;
      if (changed !== true) {
        setMessage({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة' });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح!' });
      setFormData({
        seatingNumber: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (err) {
      setMessage({ type: 'error', text: 'حدث خطأ أثناء التحديث، يرجى المحاولة لاحقاً' });
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ visible }) => (visible ? '🙈' : '👁️');

  return (
    <div style={styles.container} dir="rtl">
      
      <div style={{ width: '100%', textAlign: 'center', padding: '10px 0 15px 0', fontSize: '18px', fontWeight: 'bold', color: '#fbbf24', letterSpacing: '1px' }}>
        بسم الله الرحمن الرحيم
      </div>

      <div style={styles.card}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid #334155', padding: '15px 25px', backgroundColor: '#1e293b', boxSizing: 'border-box', borderRadius: '12px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={institutionLogo(institution) || ministryLogo} alt="شعار المؤسسة" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
            <div>
              <h4 style={{ margin: '0', color: '#f8fafc', fontSize: '13px', fontWeight: 'bold' }}>{institutionName(institution)}</h4>
              <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}>
                قسم القياس والتقويم والامتحانات - امتحان إتمام شهادة الدراسة الثانوية العامة - {currentServerYear}
              </p>
            </div>
          </div>
  
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', order: 3 }}>
            {onBack && (
              <button 
                onClick={onBack} 
                style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)' }}
              >
                🏠 الرئيسية
              </button>
            )}
          </div>
        </header>

        <div style={{ width: '100%', textAlign: 'center', marginBottom: '25px' }}>
          <span style={{ display: 'inline-block', backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid #334155', padding: '6px 20px', borderRadius: '20px', fontSize: '13px', color: '#cbd5e1', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            الدورة الأولى | لسنة: {currentServerYear}
          </span>
        </div>

        <div style={styles.header}>
          <div style={styles.iconBg}>🔑</div>
          <h2 style={styles.title}>تغيير كلمة المرور</h2>
          <p style={styles.subtitle}>أدخل رقم الجلوس وكلمة المرور الحالية للتحديث</p>
        </div>

        {message.text && (
          <div style={{
            ...styles.alert,
            backgroundColor: message.type === 'error' ? '#7f1d1d' : '#064e3b',
            color: message.type === 'error' ? '#fca5a5' : '#6ee7b7',
            borderColor: message.type === 'error' ? '#dc2626' : '#059669'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>رقم الجلوس</label>
            <input
              type="text"
              name="seatingNumber"
              value={formData.seatingNumber}
              onChange={handleChange}
              placeholder="مثال: 109249"
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>كلمة المرور الحالية</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showCurrent ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder="••••••••"
                style={{ ...styles.input, paddingLeft: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={styles.eyeBtn}
              >
                <EyeIcon visible={showCurrent} />
              </button>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>كلمة المرور الجديدة</label>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', lineHeight: 1.7 }}>{PASSWORD_POLICY_MESSAGE}</div>
            <div style={styles.passwordWrapper}>
              <input
                type={showNew ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="••••••••"
                style={{ ...styles.input, paddingLeft: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={styles.eyeBtn}
              >
                <EyeIcon visible={showNew} />
              </button>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>تأكيد كلمة المرور الجديدة</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                style={{ ...styles.input, paddingLeft: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={styles.eyeBtn}
              >
                <EyeIcon visible={showConfirm} />
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'جاري التحقق والتحديث...' : 'تحديث كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '20px',
    direction: 'rtl',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    backdropFilter: 'blur(10px)',
    width: '100%',
    maxWidth: '700px',
    margin: '0 auto',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  iconBg: {
    width: '56px',
    height: '56px',
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    color: '#c084fc',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 12px auto',
    border: '1px solid rgba(147, 51, 234, 0.4)'
  },
  title: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 6px 0'
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '18px',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'right'
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    fontSize: '14px',
    color: '#fff',
    outline: 'none',
    direction: 'rtl',
    boxSizing: 'border-box'
  },
  eyeBtn: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtn: {
    marginTop: '10px',
    padding: '14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
    transition: 'background-color 0.2s'
  }
};