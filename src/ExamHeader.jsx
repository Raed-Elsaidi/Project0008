import React, { useState, useEffect } from 'react';
import logoImg from './logo.png';
import { useInstitution, institutionName, institutionLogo } from './institution';

export default function ExamHeader({
  student,
  studentName,
  seatingNumber,
  currentExam,
  examTitle,
  subjectName,
  sectionsCount,
  questionsCount,
  answeredCount,
  unansweredCount,
  reviewCount,
  warnings,
  MAX_WARNINGS = 3,
  handleLogout,
  styles: externalStyles,
  supabase
}) {
  const currentYear = new Date().getFullYear();
  const institution = useInstitution(supabase);
  const styles = externalStyles || defaultStyles;

  const [remainingTime, setRemainingTime] = useState(0);

  // =====================================================
  // بيانات الطالب
  // =====================================================

  const displayedStudentName =
    studentName ||
    student?.full_name ||
    student?.full_name_ar ||
    student?.fullName ||
    student?.name ||
    student?.student_name ||
    student?.studentName ||
    student?.اسم_الطالب ||
    student?.['اسم الطالب'] ||
    student?.الاسم ||
    student?.['الاسم'] ||
    'غير متوفر';

  const displayedSeatingNumber =
    seatingNumber ||
    student?.seating_number ||
    student?.seat_number ||
    student?.seatingNumber ||
    student?.seatNo ||
    student?.رقم_الجلوس ||
    'غير متوفر';

  // =====================================================
  // بيانات الامتحان
  // =====================================================

  const title =
    currentExam?.title ||
    examTitle ||
    currentExam?.exam_title ||
    'امتحان المادة';

  // =====================================================
  // المبحث
  // =====================================================

  const subject =
    subjectName ||
    currentExam?.subjects?.subject_name ||
    currentExam?.subjects?.name ||
    currentExam?.subjects?.title ||
    currentExam?.subject_name ||
    currentExam?.subjectName ||
    currentExam?.subject ||
    currentExam?.المبحث ||
    '-';

  // =====================================================
  // الفرع
  // =====================================================

  const branch =
    currentExam?.branches?.name ||
    currentExam?.branches?.branch_name ||
    currentExam?.branch ||
    currentExam?.branch_name ||
    currentExam?.الفرع ||
    '-';

  // =====================================================
  // مدة الامتحان
  // =====================================================

  const duration =
    currentExam?.nminutes ||
    currentExam?.duration_minutes ||
    currentExam?.duration ||
    60;

  // =====================================================
  // وقت بدء الامتحان
  // =====================================================

  const formatStartTime = timeStr => {
    if (!timeStr) return 'غير محدد';

    const parts = timeStr.split(':');

    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';

    const period = h >= 12 ? 'مساءً' : 'صباحاً';

    const formattedHours = h % 12 || 12;

    return `${formattedHours}:${m} ${period}`;
  };

  const examStartTime = formatStartTime(
    currentExam?.exam_time
  );

  // =====================================================
  // العلامة النهائية
  // =====================================================

  const totalMarks =
    currentExam?.total_marks ??
    currentExam?.total_mark ??
    currentExam?.max_marks ??
    100;

  // =====================================================
  // التاريخ
  // =====================================================

  const rawDate =
    currentExam?.exam_date ||
    currentExam?.date ||
    null;

  const dateStr = rawDate
    ? String(rawDate).split('T')[0]
    : '-';

  // =====================================================
  // اسم اليوم
  // =====================================================

  let dayName = '-';

  if (rawDate) {
    const daysMap = [
      'الأحد',
      'الإثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت'
    ];

    // منع مشكلة اختلاف المنطقة الزمنية
    const dateOnly = String(rawDate).split('T')[0];
    const [year, month, day] = dateOnly
      .split('-')
      .map(Number);

    const localDate = new Date(year, month - 1, day);

    dayName = daysMap[localDate.getDay()];
  }

  // =====================================================
  // حساب الوقت المتبقي
  // =====================================================

  useEffect(() => {
    const examTimeStr = currentExam?.exam_time;

    const durationMinutes =
      Number(
        currentExam?.nminutes ||
        currentExam?.duration_minutes ||
        currentExam?.duration ||
        60
      );

    if (!examTimeStr) {
      setRemainingTime(durationMinutes * 60);
      return;
    }

    const calculateRemaining = () => {
      const now = new Date();

      const parts = examTimeStr.split(':');

      const hours = Number(parts[0]) || 0;
      const minutes = Number(parts[1]) || 0;
      const seconds = Number(parts[2]) || 0;

      const startTime = new Date();

      startTime.setHours(
        hours,
        minutes,
        seconds,
        0
      );

      const endTime =
        startTime.getTime() +
        durationMinutes * 60 * 1000;

      const remaining = Math.max(
        0,
        Math.floor(
          (endTime - now.getTime()) / 1000
        )
      );

      setRemainingTime(remaining);

      return remaining;
    };

    calculateRemaining();

    const timer = setInterval(() => {
      const remaining = calculateRemaining();

      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentExam, duration]);

  // =====================================================
  // تنسيق الوقت
  // =====================================================

  const formatTime = seconds => {
    const safeSeconds = Math.max(
      0,
      Number(seconds) || 0
    );

    const hours = Math.floor(
      safeSeconds / 3600
    );

    const mins = Math.floor(
      (safeSeconds % 3600) / 60
    );

    const secs = safeSeconds % 60;

    const h = String(hours).padStart(2, '0');
    const m = String(mins).padStart(2, '0');
    const s = String(secs).padStart(2, '0');

    if (hours > 0) {
      return `${h}:${m}:${s}`;
    }

    return `${m}:${s}`;
  };

  // =====================================================
  // الواجهة
  // =====================================================

  return (
    <div style={styles.headerCard}>

      <div style={styles.topBar}>
        <button
          onClick={handleLogout}
          style={styles.logoutBtn}
        >
          تسجيل الخروج
        </button>

        {warnings > 0 && (
          <div style={styles.warningBadge}>
            ⚠️ المخالفات: {warnings} / {MAX_WARNINGS}
          </div>
        )}
      </div>

      {/* عنوان الامتحان في وسط الشاشة */}
      <div style={styles.logoSection}>
        <div style={styles.basmala}>
          بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
        </div>

        <div style={{ margin: '8px 0' }}>
          <img
            src={institutionLogo(institution) || logoImg}
            alt="شعار المؤسسة"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain'
            }}
            onError={e => {
              e.target.style.display = 'none';
            }}
          />
        </div>

        <div style={styles.country}>{institutionName(institution)}</div>
        <div style={styles.ministry}>{institution?.name_line_2 || ''}</div>
        <div style={styles.subMinistry}>
          الإدارة العامة للقياس والتقويم والامتحانات
        </div>
        <div style={styles.subMinistry}>
          امتحان إتمام شهادة الثانوية العامة لسنة - {currentYear}
        </div>

        <div style={styles.examTitle}>
          {title}
        </div>
      </div>

      <hr style={styles.divider} />

      {/* الصف الأول */}
      <div style={styles.infoRow}>
        <InfoItem label="اسم الطالب" value={displayedStudentName} />
        <InfoItem label="رقم الجلوس" value={displayedSeatingNumber} ltr />
        <InfoItem label="الفرع" value={branch} />
        <InfoItem label="المبحث" value={subject} />
        <InfoItem label="العلامة" value={`${totalMarks}`} suffix="علامة" ltr />
      </div>

      {/* الصف الثاني */}
      <div style={styles.infoRow}>
        <InfoItem label="اليوم" value={dayName} />
        <InfoItem label="التاريخ" value={dateStr} ltr />
        <InfoItem label="وقت البدء" value={examStartTime} ltr />
        <InfoItem label="المدة" value={`${duration}`} suffix="دقيقة" ltr />
      </div>

      {/* الصف الثالث */}
      <div style={styles.infoRow}>
        <InfoItem label="عدد أقسام الامتحان" value={sectionsCount} ltr />
        <InfoItem label="عدد الأسئلة في الورقة" value={questionsCount} ltr />
        <InfoItem label="الأسئلة المجابة" value={answeredCount} ltr />
        <InfoItem label="الأسئلة الغير مجابة" value={unansweredCount} ltr />
        <InfoItem label="الأسئلة للمراجعة" value={reviewCount} ltr />
      </div>

      {/* الوقت المتبقي */}
      <div style={styles.timerContainer}>
        <div style={styles.timerBox}>
          <div style={styles.timerTitle}>
            ⏳ الوقت المتبقي للامتحان
          </div>
          <div style={styles.timerValue}>
            {formatTime(remainingTime)}
          </div>
        </div>
      </div>

    </div>
  );
}

function InfoItem({ label, value, suffix = '', ltr = false }) {
  return (
    <div style={defaultStyles.infoItem}>
      <strong>{label}:</strong>
      <span
        style={{
          ...defaultStyles.infoValue,
          ...(ltr ? {
            direction: 'ltr',
            display: 'inline-block'
          } : {})
        }}
      >
        {value ?? '-'}{suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

// =====================================================
// التنسيقات
// =====================================================

const defaultStyles = {

  headerCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    marginBottom: '20px',
    direction: 'rtl',
    fontFamily: 'Noto Kufi Arabic, sans-serif'
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },

  logoutBtn: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  warningBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold'
  },

  logoSection: {
    textAlign: 'center',
    marginBottom: '10px'
  },

  basmala: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '2px'
  },

  country: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f2937'
  },

  ministry: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e3a8a'
  },

  subMinistry: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '5px'
  },

  examTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#047857',
    textAlign: 'center',
    marginTop: '8px'
  },

  subjectInHeader: {
    marginTop: '10px',
    textAlign: 'right',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#111827',
    paddingRight: '8px'
  },

  divider: {
    border: '0',
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '15px 0'
  },

  infoRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '0',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '8px',
    backgroundColor: '#fff'
  },

  infoItem: {
    minWidth: 0,
    minHeight: '44px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    textAlign: 'center',
    borderLeft: '1px solid #e5e7eb',
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.35
  },

  infoValue: {
    fontWeight: 'bold',
    color: '#111827'
  },

  timerContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '15px',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '15px'
  },

  timerBox: {
    backgroundColor: '#f0fdf4',
    border: '2px solid #bbf7d0',
    padding: '10px 35px',
    borderRadius: '10px',
    textAlign: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
  },

  timerTitle: {
    fontSize: '14px',
    fontWeight: '900',
    color: '#166534',
    marginBottom: '4px'
  },

  timerValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#15803d',
    direction: 'ltr',
    letterSpacing: '1px'
  }

};