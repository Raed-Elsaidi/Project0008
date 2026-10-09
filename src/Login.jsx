import React, { useState } from 'react';
import ForgotStudentPassword from './ForgotStudentPassword';

export default function Login({ supabase, onLoginSuccess, onBackHome, onBack }) {
  const [seatingNumber, setSeatingNumber] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // =========================================================
  // الرجوع إلى الشاشة الرئيسية
  // =========================================================
  const handleBackHome = () => {
    if (loading) return;

    if (typeof onBackHome === 'function') {
      onBackHome();
      return;
    }

    if (typeof onBack === 'function') {
      onBack();
      return;
    }

    window.location.assign('/');
  };

  // =========================================================
  // إظهار رسالة
  // =========================================================
  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  if (showForgotPassword) {
    return <ForgotStudentPassword supabase={supabase} onBack={() => { setShowForgotPassword(false); setMessage(''); }} />;
  }

  // =========================================================
  // الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
  // =========================================================
  const getTodayString = () => {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // =========================================================
  // تحويل تاريخ + وقت الامتحان إلى Date
  // =========================================================
  const createExamDateTime = (examDate, examTime) => {
    if (!examDate || !examTime) {
      return null;
    }

    try {
      const dateString = String(examDate)
        .split('T')[0]
        .trim();

      let timeString = String(examTime).trim();

      // إذا كان الوقت HH:MM
      if (/^\d{2}:\d{2}$/.test(timeString)) {
        timeString = `${timeString}:00`;
      }

      // إذا كان أطول من المطلوب
      if (timeString.length > 8) {
        timeString = timeString.substring(0, 8);
      }

      const result = new Date(
        `${dateString}T${timeString}`
      );

      if (Number.isNaN(result.getTime())) {
        return null;
      }

      return result;
    } catch (error) {
      console.error(
        'createExamDateTime error:',
        error
      );

      return null;
    }
  };

  // =========================================================
  // حساب وقت نهاية الامتحان
  // =========================================================
  const getExamEndDateTime = (exam) => {
    if (!exam) {
      return null;
    }

    const startDateTime = createExamDateTime(
      exam.exam_date,
      exam.exam_time
    );

    if (!startDateTime) {
      return null;
    }

    const durationMinutes = Number(
      exam.duration_minutes ?? 60
    );

    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return null;
    }

    return new Date(
      startDateTime.getTime() +
        durationMinutes * 60 * 1000
    );
  };

  // =========================================================
  // فحص هل الامتحان فعال الآن
  // =========================================================
  const isExamActiveNow = (exam) => {
    if (!exam) {
      return false;
    }

    // يجب أن يكون الامتحان مفعّلًا من الإدارة
    if (exam.is_active !== true) {
      return false;
    }

    if (!exam.exam_date || !exam.exam_time) {
      return false;
    }

    const startDateTime = createExamDateTime(
      exam.exam_date,
      exam.exam_time
    );

    if (!startDateTime) {
      return false;
    }

    const endDateTime = getExamEndDateTime(exam);

    if (!endDateTime) {
      return false;
    }

    const now = new Date();

    /*
      الامتحان فعال فقط عندما:

      الآن >= وقت البداية
      والآن < وقت النهاية
    */
    return (
      now >= startDateTime &&
      now < endDateTime
    );
  };

  // =========================================================
  // التحقق هل الامتحان منتهي
  // =========================================================
  const isExamFinished = (exam) => {
    if (!exam) {
      return false;
    }

    const endDateTime = getExamEndDateTime(exam);

    if (!endDateTime) {
      return false;
    }

    return new Date() >= endDateTime;
  };

  const formatExamStartTime = (exam) => {
    const raw = String(exam?.exam_time || '').slice(0, 5);
    if (!raw) return 'غير محدد';
    const [h, m] = raw.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
    const period = h >= 12 ? 'مساءً' : 'صباحًا';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
  };

  // =========================================================
  // تسجيل الدخول
  // =========================================================
  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage('');
    setMessageType('');

    const cleanSeatingNumber =
      seatingNumber.trim();

    const cleanPassword =
      password.trim();

    // =====================================================
    // التحقق من المدخلات
    // =====================================================
    if (!cleanSeatingNumber) {
      showMessage(
        'يرجى إدخال رقم الجلوس.'
      );

      return;
    }

    if (!cleanPassword) {
      showMessage(
        'يرجى إدخال كلمة المرور.'
      );

      return;
    }

    if (!supabase) {
      showMessage(
        'خطأ في الاتصال بقاعدة البيانات.'
      );

      return;
    }

    setLoading(true);

    try {
      // ===================================================
      // 1. البحث عن الطالب وجلب بياناته (بما فيها الاسم) باستخدام رقم الجلوس
      // ===================================================
      const {
        data: student,
        error: studentError
      } = await supabase
        .from('students')
        .select('*')
        .eq(
          'seating_number',
          cleanSeatingNumber
        )
        .maybeSingle();

      if (studentError) {
        console.error(
          'Student error:',
          studentError
        );

        throw new Error(
          'حدث خطأ أثناء البحث عن الطالب.'
        );
      }

      // الطالب غير موجود
      if (!student) {
        showMessage(
          'رقم الجلوس غير موجود.'
        );

        return;
      }

      // ===================================================
      // 2. التحقق من أن حساب الطالب فعال
      // ===================================================
      if (student.is_active === false) {
        showMessage(
          'حساب الطالب غير مفعّل.'
        );

        return;
      }

      // ===================================================
      // 3. التحقق من كلمة المرور عبر bcrypt داخل قاعدة البيانات
      // ===================================================
      const { data: passwordValid, error: passwordError } = await supabase.rpc(
        'verify_student_password',
        {
          p_seating_number: cleanSeatingNumber,
          p_password: cleanPassword
        }
      );

      if (passwordError) {
        console.error('Student password verification error:', passwordError);
        showMessage('تعذر التحقق من كلمة المرور. تأكد من تشغيل migration الخاصة بأمان كلمات المرور.');
        return;
      }

      if (passwordValid !== true) {
        showMessage('كلمة المرور غير صحيحة.');
        return;
      }

      // ===================================================
      // 4. التأكد من وجود فرع
      // ===================================================
      if (
        student.branch_id === null ||
        student.branch_id === undefined ||
        student.branch_id === ''
      ) {
        showMessage(
          'لا يوجد فرع مرتبط بهذا الطالب.'
        );

        return;
      }

      // ===================================================
      // 5. الحصول على تاريخ اليوم
      // ===================================================
      const todayString =
        getTodayString();

      // ===================================================
      // 6. جلب امتحانات الفرع لليوم فقط
      // ===================================================
      const {
        data: exams,
        error: examsError
      } = await supabase
        .from('exams')
        .select('*')
        .eq(
          'branch_id',
          student.branch_id
        )
        .eq(
          'exam_date',
          todayString
        )
        .order(
          'exam_time',
          {
            ascending: true
          }
        );

      if (examsError) {
        console.error(
          'Exams error:',
          examsError
        );

        throw new Error(
          'حدث خطأ أثناء البحث عن الامتحان.'
        );
      }

      /*
       * مزامنة حالة الامتحان تلقائيًا:
       *
       * 1) قبل البداية بـ 10 دقائق: is_active = true
       *    للسماح بالدخول والتحقق فقط.
       * 2) من وقت البداية وحتى النهاية: is_active = true
       *    ويصبح الامتحان متاحًا فعليًا.
       * 3) بعد النهاية: is_active = false.
       *
       * access_enabled يبقى مفتاح السماح الإداري ولا يتم تغييره هنا.
       */
      let examsForLogin = exams || [];

      if (examsForLogin.length > 0) {
        const now = new Date();
        const updatedExams = [];

        for (const exam of examsForLogin) {
          const startDateTime = createExamDateTime(
            exam.exam_date,
            exam.exam_time
          );
          const endDateTime = getExamEndDateTime(exam);

          if (!startDateTime || !endDateTime) {
            updatedExams.push(exam);
            continue;
          }

          const verificationStart = new Date(
            startDateTime.getTime() - 10 * 60 * 1000
          );

          // الإتاحة تعتمد على تاريخ الامتحان ووقته ومدته.
          // لا نمنع الطالب بسبب قيمة access_enabled القديمة في السجل.
          const shouldBeActive =
            now >= verificationStart &&
            now < endDateTime;

          const shouldBeInactive =
            now >= endDateTime;

          if (
            (shouldBeActive && exam.is_active !== true) ||
            (shouldBeInactive && exam.is_active !== false)
          ) {
            const nextIsActive = shouldBeActive;

            const { error: stateError } = await supabase
              .from('exams')
              .update({ is_active: nextIsActive })
              .eq('id', exam.id);

            if (stateError) {
              console.error(
                'Could not synchronize exam is_active:',
                stateError
              );
              updatedExams.push(exam);
            } else {
              updatedExams.push({
                ...exam,
                is_active: nextIsActive
              });
            }
          } else {
            updatedExams.push(exam);
          }
        }

        examsForLogin = updatedExams;
      }

      // لا يوجد امتحان اليوم
      if (!examsForLogin || examsForLogin.length === 0) {
        showMessage(
          'لا يوجد امتحان فعال لهذا الفرع اليوم.'
        );

        return;
      }

      // ===================================================
      // 7. البحث عن الامتحان المسموح بالدخول إليه
      // ===================================================
      // يسمح بالدخول من 10 دقائق قبل البداية وحتى نهاية الامتحان.
      // قبل البداية يكون الدخول للتحقق فقط، ولا يبدأ عداد الامتحان.
      const nowForAccess = new Date();

      const activeExam = examsForLogin.find((exam) => {
        if (exam.is_active !== true) return false;

        // لا نعتمد على access_enabled لمنع الدخول.
        // التاريخ + وقت البداية + مدة الامتحان هي التي تحدد توفره.

        const startDateTime = createExamDateTime(
          exam.exam_date,
          exam.exam_time
        );
        const endDateTime = getExamEndDateTime(exam);

        if (!startDateTime || !endDateTime) return false;

        const verificationStart = new Date(
          startDateTime.getTime() - 10 * 60 * 1000
        );

        return (
          nowForAccess >= verificationStart &&
          nowForAccess < endDateTime
        );
      });

      if (!activeExam) {
        const hasUpcomingExam =
          examsForLogin.some((exam) => {
            const startDateTime =
              createExamDateTime(
                exam.exam_date,
                exam.exam_time
              );

            if (!startDateTime) {
              return false;
            }

            const verificationStart = new Date(
              startDateTime.getTime() - 10 * 60 * 1000
            );

            return new Date() < verificationStart;
          });

        const hasFinishedExam =
          examsForLogin.some((exam) =>
            isExamFinished(exam)
          );

        if (hasUpcomingExam) {
          const upcoming = examsForLogin
            .filter((exam) => {
              const start = createExamDateTime(exam.exam_date, exam.exam_time);
              return start && new Date() < new Date(start.getTime() - 10 * 60 * 1000);
            })
            .sort((a, b) => String(a.exam_time).localeCompare(String(b.exam_time)))[0];
          showMessage(
            `يوجد امتحان لك اليوم، امتحانك الساعة ${formatExamStartTime(upcoming)}.`
          );
          return;
        }

        if (hasFinishedExam) {
          showMessage(
            'امتحان اليوم لهذا الفرع انتهى وقته.'
          );

          return;
        }

        showMessage(
          'لا يوجد امتحان فعال الآن.'
        );

        return;
      }

      const examIdText =
        String(activeExam.id);

      // ===================================================
      // 8. التحقق هل الطالب قدم الامتحان مسبقًا
      // ===================================================
      const {
        data: existingSubmission,
        error: submissionError
      } = await supabase
        .from('submissions')
        .select(
          'id, seating_number, exam_id, submitted_at'
        )
        .eq(
          'seating_number',
          cleanSeatingNumber
        )
        .eq(
          'exam_id',
          examIdText
        )
        .maybeSingle();

      if (submissionError) {
        console.error(
          'Submission check error:',
          submissionError
        );

        throw new Error(
          'حدث خطأ أثناء التحقق من حالة تقديم الامتحان.'
        );
      }

      if (existingSubmission) {
        showMessage(
          'لقد قمت بتقديم هذا الامتحان مسبقًا، ولا يمكن الدخول إليه مرة أخرى.'
        );

        return;
      }

      // ===================================================
      // 9. تجهيز بيانات الطالب (تحتوي على الاسم واسم العائلة وكل الأعمدة من جدول students)
      // ===================================================
      const studentData = {
        ...student,
        seating_number: cleanSeatingNumber,
        branch_id: student.branch_id
      };

      // حفظ رقم الجلوس وبيانات الطالب محليًا حتى تبقى متاحة
      // عند الانتقال إلى شاشة الامتحان حتى لو لم يمررها المكوّن الأب.
      try {
        localStorage.setItem(
          'exam_seating_number',
          cleanSeatingNumber
        );
        localStorage.setItem(
          'seating_number',
          cleanSeatingNumber
        );

        localStorage.setItem(
          'exam_student',
          JSON.stringify(studentData)
        );
      } catch (storageError) {
        console.warn(
          'Could not save student login data:',
          storageError
        );
      }

      // ===================================================
      // 10. تجهيز بيانات الامتحان
      // ===================================================
      const examStartDateTime = createExamDateTime(
        activeExam.exam_date,
        activeExam.exam_time
      );

      const examEndDateTime = getExamEndDateTime(activeExam);
      const verificationOnly =
        examStartDateTime &&
        examEndDateTime &&
        new Date() < examStartDateTime;

      const examData = {
        ...activeExam,
        id: activeExam.id,
        exam_date: activeExam.exam_date,
        exam_time: activeExam.exam_time,
        duration_minutes: Number(
          activeExam.duration_minutes ?? 60
        ),
        // true during the 5-minute pre-start verification window.
        // The actual exam remains locked until exam_date + exam_time.
        verificationOnly: Boolean(verificationOnly),
        examStartsAt: examStartDateTime
          ? examStartDateTime.toISOString()
          : null,
        examEndsAt: examEndDateTime
          ? examEndDateTime.toISOString()
          : null
      };

      // ===================================================
      // 11. فتح الامتحان وتمرير بيانات الطالب والامتحان
      // ===================================================
      if (
        typeof onLoginSuccess ===
        'function'
      ) {
        onLoginSuccess(
          studentData,
          examData,
          {
            verificationOnly: Boolean(verificationOnly),
            examStartsAt: examData.examStartsAt,
            examEndsAt: examData.examEndsAt
          }
        );

        return;
      }

      showMessage(
        'لم يتم إعداد الانتقال إلى صفحة الامتحان.'
      );
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      showMessage(
        error?.message ||
          'حدث خطأ غير متوقع أثناء تسجيل الدخول.'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // الواجهة
  // =========================================================
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        direction: 'rtl',
        fontFamily:
          'Arial, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '450px',
          backgroundColor: '#1e293b',
          border:
            '1px solid #334155',
          borderRadius: '16px',
          padding: '35px',
          boxShadow:
            '0 20px 50px rgba(0,0,0,0.35)'
        }}
      >
        {/* ==========================================
            زر العودة للشاشة الرئيسية
        ========================================== */}
        <div style={{ marginBottom: '20px', textAlign: 'right' }}>
          <button
            type="button"
            onClick={handleBackHome}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#60a5fa';
              e.currentTarget.style.color = '#60a5fa';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#475569';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            🏠 الشاشة الرئيسية
          </button>
        </div>

        {/* ==========================================
            العنوان
        ========================================== */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '30px'
          }}
        >
          <div
            style={{
              fontSize: '50px',
              marginBottom: '10px'
            }}
          >
            📝
          </div>

          <h1
            style={{
              color: '#60a5fa',
              margin:
                '0 0 10px',
              fontSize: '26px'
            }}
          >
            نظام الامتحانات الإلكترونية
          </h1>

          <p
            style={{
              color: '#94a3b8',
              margin: 0,
              fontSize: '14px'
            }}
          >
            تسجيل دخول الطالب
          </p>
        </div>

        {/* ==========================================
            النموذج
        ========================================== */}
        <form onSubmit={handleLogin}>
          {/* ========================================
              رقم الجلوس
          ======================================== */}
          <div
            style={{
              marginBottom: '18px'
            }}
          >
            <label
              style={{
                display: 'block',
                color: '#cbd5e1',
                marginBottom: '8px',
                fontWeight: 'bold'
              }}
            >
              رقم الجلوس
            </label>

            <input
              type="text"
              value={seatingNumber}
              onChange={(e) =>
                setSeatingNumber(
                  e.target.value
                )
              }
              placeholder="أدخل رقم الجلوس"
              autoComplete="username"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                padding: '13px',
                borderRadius: '8px',
                border:
                  '2px solid #3b82f6',
                backgroundColor:
                  '#fff',
                color: '#0f172a',
                fontSize: '16px',
                direction: 'ltr',
                textAlign: 'left',
                outline: 'none'
              }}
            />
          </div>

          {/* ========================================
              كلمة المرور
          ======================================== */}
          <div
            style={{
              marginBottom: '20px'
            }}
          >
            <label
              style={{
                display: 'block',
                color: '#cbd5e1',
                marginBottom: '8px',
                fontWeight: 'bold'
              }}
            >
              كلمة المرور
            </label>

            <div
              style={{
                position: 'relative'
              }}
            >
              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%',
                  boxSizing:
                    'border-box',
                  padding:
                    '13px 50px 13px 13px',
                  borderRadius: '8px',
                  border:
                    '2px solid #3b82f6',
                  backgroundColor:
                    '#fff',
                  color: '#0f172a',
                  fontSize: '16px',
                  direction: 'ltr',
                  textAlign: 'left',
                  outline: 'none'
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (prev) => !prev
                  )
                }
                disabled={loading}
                style={{
                  position:
                    'absolute',
                  right: '8px',
                  top: '50%',
                  transform:
                    'translateY(-50%)',
                  border: 'none',
                  background:
                    'transparent',
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                {showPassword
                  ? '🙈'
                  : '👁️'}
              </button>
            </div>
          </div>

          {/* ========================================
              الرسالة
          ======================================== */}
          {message && (
            <div
              style={{
                backgroundColor:
                  messageType ===
                  'success'
                    ? '#064e3b'
                    : '#7f1d1d',

                border:
                  messageType ===
                  'success'
                    ? '1px solid #10b981'
                    : '1px solid #ef4444',

                color: '#fff',

                padding: '13px',

                borderRadius: '8px',

                marginBottom: '18px',

                textAlign: 'center',

                fontSize: '14px',

                lineHeight: '1.6'
              }}
            >
              {message}
            </div>
          )}

          {/* ========================================
              زر الدخول
          ======================================== */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor:
                loading
                  ? '#64748b'
                  : '#2563eb',
              color: '#fff',
              fontSize: '17px',
              fontWeight: 'bold',
              cursor: loading
                ? 'not-allowed'
                : 'pointer'
            }}
          >
            {loading
              ? 'جاري التحقق...'
              : 'دخول إلى الامتحان 🔐'}
          </button>

          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            disabled={loading}
            style={{
              width: '100%', marginTop: '10px', padding: '10px', border: 'none',
              background: 'transparent', color: '#60a5fa', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 'bold'
            }}
          >
            نسيت كلمة المرور؟
          </button>
        </form>

        {/* ==========================================
            الملاحظة
        ========================================== */}
        <div
          style={{
            marginTop: '22px',
            padding: '12px',
            backgroundColor:
              '#0f172a',
            borderRadius: '8px',
            color: '#94a3b8',
            textAlign: 'center',
            fontSize: '12px',
            lineHeight: '1.7'
          }}
        >
          سيتم السماح بالدخول فقط إذا كان هناك
          امتحان فعال حاليًا للفرع الخاص بك.
        </div>
      </div>
    </div>
  );
}