import React, { useEffect, useMemo, useState } from 'react';
import logo from './logo.png';
import { useInstitution, institutionName, institutionLogo } from './institution';

const n = (v, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const text = (v) => String(v ?? '').trim();
const first = (...v) => v.find(x => x !== undefined && x !== null && text(x) !== '');

const englishDigits = (v) => String(v ?? '')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[^0-9]/g, '');

const seatOf = s => englishDigits(first(
  s?.seat_number, s?.seating_number, s?.exam_seating_number, s?.رقم_الجلوس, ''
)).slice(0, 10);

const nameOf = s => first(s?.full_name_ar, s?.name, s?.full_name, s?.fullName, 'غير محدد');

const idOf = s => englishDigits(first(
  s?.national_id, s?.identity_number, s?.id_number, s?.nationalId, ''
)).slice(0, 9);
const branchIdOf = x => first(x?.branch_id, x?.branchId, null);
const subjectIdOf = x => first(x?.subject_id, x?.subjectId, x?.id, null);
const subjectNameOf = x => first(x?.subject_name, x?.name, x?.title, x?.subjectName, 'مادة');
// تحديد دورة تقديم الامتحان: نستخدم registration_cycle إن وُجد، ثم نستخرج رقم الدورة من رقم الجلوس YYC...
const getSubmissionCycle = (submission) => {
  const direct = first(
    submission?.registration_cycle,
    submission?.cycle_number,
    submission?.cycle,
    submission?.exam_cycle
  );
  const directNum = Number(direct);
  if (Number.isFinite(directNum) && [1, 2, 3].includes(directNum)) return directNum;

  const seat = text(first(
    submission?.seating_number,
    submission?.seat_number,
    submission?.exam_seating_number,
    submission?.رقم_الجلوس,
    ''
  ));
  if (/^\d{10}$/.test(seat)) {
    const cycle = Number(seat.charAt(2));
    if ([1, 2, 3].includes(cycle)) return cycle;
  }

  return 0;
};

const getSubmissionTime = (submission) => {
  const value = first(submission?.submitted_at, submission?.created_at, submission?.updated_at, '');
  return value ? new Date(value).getTime() || 0 : 0;
};

// المقارنة: آخر دورة أولاً، ثم أحدث تسليم داخل نفس الدورة.
const isLaterSubmission = (candidate, current) => {
  if (!current) return true;
  const candidateCycle = getSubmissionCycle(candidate);
  const currentCycle = getSubmissionCycle(current);
  if (candidateCycle !== currentCycle) return candidateCycle > currentCycle;
  return getSubmissionTime(candidate) > getSubmissionTime(current);
};

const scoreOf = (s) => {
  // ندعم الحقول المختلفة التي قد تحفظ العلامة النهائية.
  const values = [
    s?.obtained_marks,
    s?.total_score,
    s?.final_score,
    s?.base_score,
    s?.score,
    s?.mark,
  ].map(Number).filter(Number.isFinite);

  // إذا كانت إحدى الحقول غير صفرية فهي العلامة الفعلية.
  return values.find(v => v !== 0) ?? values[0] ?? 0;
};
const maxOf = x => n(first(x?.maximum_mark, x?.max_mark, x?.max_marks, x?.maximum_marks, x?.total_marks, x?.total_mark, 100), 100);
const minOf = x => n(first(x?.minimum_mark, x?.min_mark, x?.min_marks, x?.minimum_marks, x?.passing_marks, 50), 50);

function formatPct(v) { return `${n(v).toFixed(1)}%`; }
function formatIssuanceDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function gradeToWords(num) {
  const nVal = Number(num);
  if (isNaN(nVal) || nVal === 0) return 'صفر فقط';
  if (nVal === 100) return 'مائة درجة';
  if (nVal < 10) {
    const arr = ['صفر', 'درجة واحدة', 'درجتان', 'ثلاث درجات', 'أربع درجات', 'خمس درجات', 'ست درجات', 'سبع درجات', 'ثماني درجات', 'تسع درجات'];
    return arr[nVal];
  }
  return `${nVal} درجة فقط`;
}

function numberToWords(num) {
  const nVal = Number(num);
  if (isNaN(nVal) || nVal === 0) return 'صفر فقط لا غير';
  return `فقط ${nVal} درجة لا غير`;
}

// دالة مساعدة لاختيار العنصر الأعلى بناءً على أسماء المواد
function chooseHighestPair(selectedList, keywords) {
  const matches = selectedList.filter(x => {
    const sName = text(subjectNameOf(x.subject)).toLowerCase();
    return keywords.some(k => sName.includes(k.toLowerCase()));
  });
  if (matches.length <= 1) return;
  matches.sort((a, b) => b.mark - a.mark || b.max - a.max);
  const winner = matches[0];
  // استبعاد العناصر الأخرى المطابقة لنفس القاعدة والابقاء على الأعلى
  return matches.filter(m => m !== winner);
}

function calculateStudent(student, branch, subjects, exams, submissions) {
  if (!branch || !student) return { total: 0, maximum: 700, minimum: 350, percentage: 0, passed: false, status: 'راسب', selected: [] };
  
  const branchSubjects = subjects.filter(s => String(branchIdOf(s)) === String(branch?.id));
  const seat = text(seatOf(student));
  const studentId = String(student?.id || '');
  const bySubject = new Map();

  branchSubjects.forEach(subject => {
    const sid = String(subjectIdOf(subject));
    const examIds = exams.filter(e => {
      const eb = branchIdOf(e);
      const es = subjectIdOf(e);
      return (eb == null || String(eb) === String(branch?.id)) && String(es) === sid;
    }).map(e => String(e.id));

    let best = null;
    submissions.forEach(sub => {
      const examId = first(sub?.exam_id, sub?.examId);
      const subSeat = text(first(sub?.seating_number, sub?.seat_number, sub?.exam_seating_number, sub?.رقم_الجلوس, ''));
      const subStudent = text(first(sub?.student_id, sub?.studentId, ''));
      const studentMatches = (subStudent && studentId && subStudent === studentId) || (seat && subSeat && seat === subSeat);
      if (!studentMatches || examId == null || !examIds.includes(String(examId))) return;
      if (isLaterSubmission(sub, best)) best = sub;
    });

    bySubject.set(sid, {
      subject,
      mark: best ? scoreOf(best) : 0,
      max: maxOf(subject),
      min: minOf(subject),
      submitted: Boolean(best)
    });
  });

  let selected = [...bySubject.values()];
  const bName = text(branch?.display_name || branch?.branch_name || branch?.name).toLowerCase();

  // تطبيق القواعد المخصصة لكل فرع لتصفية واختيار المواد (المجموع 7 مواد دائماً)
  let excludeList = [];

  if (bName.includes('علمي') || bName.includes('scientific')) {
    excludeList.push(...(chooseHighestPair(selected, ['التربية الاسلامية', 'التربية الإسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['الكيمياء', 'كيمياء', 'الاحياء', 'الأحياء', 'احياء']) || []));
  } else if (bName.includes('ادبي') || bName.includes('أدبي')) {
    excludeList.push(...(chooseHighestPair(selected, ['التربية الاسلامية', 'التربية الإسلامية', 'اسلامية', 'جغرافيا']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['الثقافة العلمية', 'التكنولوجيا']) || []));
  } else if (bName.includes('زراعي')) {
    excludeList.push(...(chooseHighestPair(selected, ['الاحياء', 'الأحياء', 'احياء', 'رياضيات']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['الكيمياء', 'التربية الإسلامية', 'التربية الاسلامية']) || []));
  } else if (bName.includes('صناعي')) {
    excludeList.push(...(chooseHighestPair(selected, ['الرسم الصناعي', 'الفيزياء']) || []));
    // معالجة المادة الأقل بين الرسم الصناعي والفيزياء مع التربية الإسلامية أو التكنولوجيا
    excludeList.push(...(chooseHighestPair(selected, ['التربية الاسلامية', 'التكنولوجيا']) || []));
  } else if (bName.includes('اقتصاد منزلي')) {
    excludeList.push(...(chooseHighestPair(selected, ['التكنولوجيا', 'رياضيات', 'التربية الاسلامية', 'التربية الإسلامية', 'الكيمياء']) || []));
  } else if (bName.includes('فندقي')) {
    excludeList.push(...(chooseHighestPair(selected, ['التكنولوجيا', 'رياضيات', 'التربية الاسلامية', 'التربية الإسلامية', 'السياحة']) || []));
  } else if (bName.includes('ريادة') || bName.includes('اعمال')) {
    excludeList.push(...(chooseHighestPair(selected, ['المحاسبة', 'المشاريع الصغيرة']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['التربية الاسلامية', 'التكنولوجيا']) || []));
  } else if (bName.includes('تكنولوجي')) {
    excludeList.push(...(chooseHighestPair(selected, ['الاتصالات والالكترونيات', 'الريادة والاعمال']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['التربية الاسلامية', 'الثقافة العلمية']) || []));
  } else if (bName.includes('شرعي')) {
    excludeList.push(...(chooseHighestPair(selected, ['الفقه الاسلامي', 'التاريخ']) || []));
    excludeList.push(...(chooseHighestPair(selected, ['الجغرافيا', 'التكنولوجيا']) || []));
  }

  // إزالة المواد المستبعدة بناءً على المقارنات
  if (excludeList.length > 0) {
    selected = selected.filter(x => !excludeList.includes(x));
  }

  // الشهادة تعتمد على 7 مواد فقط. إذا بقيت مواد إضافية بعد قواعد الفرع،
  // نحتفظ بسبع مواد فقط حتى لا تصبح الشهادة 800/400 أو أي مجموع لثماني مواد.
  if (selected.length > 7) {
    selected = selected
      .slice()
      .sort((a, b) => b.mark - a.mark || b.max - a.max)
      .slice(0, 7);
  }

  const total = selected.reduce((a, x) => a + x.mark, 0);
  const maximum = 700;
  const minimum = 350;
  const percentage = (total / maximum) * 100;

  // تحديد حالة الطالب (ناجح، مكمل، راسب) بناءً على العلامة الصغرى لكل مادة
  const failedSubjects = selected.filter(x => x.mark < x.min);
  const failedCount = failedSubjects.length;

  let status = 'ناجح';
  let passed = true;

  if (failedCount >= 1 && failedCount <= 4) {
    status = 'مكمل';
    passed = false;
  } else if (failedCount > 4 || percentage < 50) {
    status = 'راسب';
    passed = false;
  }

  return { total, maximum, minimum, percentage, passed, status, failedCount, selected };
}

export default function Result({ supabase, onBack = () => {} }) {
  const institution = useInstitution(supabase);
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [finishStudents, setFinishStudents] = useState([]);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        // PostgREST query builders are thenable but do not expose `.catch()` directly.
        // Wrap the optional archive query in an async function so a missing/blocked
        // finish_student table does not break the whole results screen.
        const finishStudentsQuery = (async () => {
          try {
            return await supabase.from('finish_student').select('*');
          } catch {
            return { data: [], error: null };
          }
        })();

        const [a, b, c, d, e, f] = await Promise.all([
          supabase.from('students').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('subjects').select('*'),
          supabase.from('exams').select('*'),
          supabase.from('submissions').select('*'),
          finishStudentsQuery
        ]);
        if (a.error) throw a.error; if (b.error) throw b.error; if (c.error) throw c.error; if (d.error) throw d.error; if (e.error) throw e.error;
        if (!alive) return;
        setStudents(a.data || []);
        setBranches(b.data || []);
        setSubjects(c.data || []);
        setExams(d.data || []);
        setSubmissions(e.data || []);
        setFinishStudents(f?.data || []);
      } catch (err) {
        if (alive) setError(err?.message || 'تعذر تحميل بيانات النتائج.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [supabase]);

  const allRows = useMemo(() => {
    return branches.flatMap(branch => {
      const bs = students.filter(s => String(branchIdOf(s)) === String(branch.id));
      return bs.map(student => ({
        student,
        branch,
        calc: calculateStudent(student, branch, subjects, exams, submissions)
      }));
    });
  }, [students, branches, subjects, exams, submissions]);

  const searchResult = useMemo(() => {
    const q = text(query).toLowerCase();
    if (!q) return null;
    const active = allRows.find(({ student }) => [idOf(student), seatOf(student)].map(text).some(v => v.toLowerCase().includes(q)));
    if (active) return active;
    const archived = finishStudents.find(student => [idOf(student), seatOf(student)].map(text).some(v => v.toLowerCase().includes(q)));
    if (!archived) return null;
    const branch = branches.find(b => String(b.id) === String(branchIdOf(archived))) || { id: branchIdOf(archived), name: archived.branch_name || archived.branch || 'غير محدد' };
    const storedTotal = n(first(archived.final_total, archived.total_score, archived.final_score), 0);
    const storedAverage = n(first(archived.final_average, archived.percentage), 0);
    const storedResult = first(archived.final_result, archived.result, archived.status, 'غير محدد');
    return { student: archived, branch, calc: { total: storedTotal, maximum: 700, minimum: 350, percentage: storedAverage, passed: storedResult === 'ناجح', status: storedResult, selected: [] }, archived: true };
  }, [query, allRows, finishStudents, branches]);

  const submitSearch = e => {
    e.preventDefault();
    setSearched(Boolean(text(query)));
    setShowCertificate(false);
  };

  const resultToShow = searched ? searchResult : null;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const row = resultToShow;
    if (!row?.student?.id || row.archived || !row.calc) return;
    const persist = async () => {
      const payload = {
        final_total: Number(row.calc.total) || 0,
        final_average: Number(row.calc.percentage) || 0,
        final_result: String(row.calc.status || '').startsWith('مكمل') ? 'مكمل' : (row.calc.status || ''),
        result_updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('students').update(payload).eq('id', row.student.id);
      if (error) console.warn('تعذر حفظ المعدل والنتيجة داخل students:', error.message);
    };
    persist();
  }, [resultToShow, supabase]);

  return (
    <>
      <style>{`
      @page {
        size: A4 portrait;
        margin: 0;
      }

      .certificate-screen-scroll {
        height: calc(100vh - 24px);
        max-height: calc(100vh - 24px);
        overflow-y: scroll;
        overflow-x: hidden;
        width: 100%;
        box-sizing: border-box;
        padding: 12px 14px 24px;
        scrollbar-width: auto;
        scrollbar-color: #2563eb rgba(148,163,184,.18);
      }

      .certificate-screen-scroll::-webkit-scrollbar {
        width: 14px;
      }

      .certificate-screen-scroll::-webkit-scrollbar-thumb {
        background: #2563eb;
        border-radius: 10px;
      }

      .certificate-screen-scroll::-webkit-scrollbar-track {
        background: rgba(148,163,184,.18);
        border-radius: 10px;
      }

      @media (max-width: 600px) {
        .result-page-print { padding: 12px !important; }
        .result-main-card { padding: 16px 13px !important; border-radius: 20px !important; }
        .result-main-card > div:first-child { gap: 10px !important; }
        .result-main-card button { touch-action: manipulation; }
      }

      .result-main-card button:hover { filter: brightness(1.08); }
      .result-main-card button:active { transform: scale(.98); }

      @media print {
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }

        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .result-page-print {
          width: 210mm !important;
          min-height: 297mm !important;
          height: 297mm !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #fff !important;
          overflow: hidden !important;
        }

        .result-page-print > .result-main-card {
          width: 210mm !important;
          min-height: 297mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 8mm !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
          background: #fff !important;
        }

        .certificate-print-card {
          width: 194mm !important;
          height: 281mm !important;
          min-height: 281mm !important;
          margin: 0 auto !important;
          padding: 8mm !important;
          box-sizing: border-box !important;
          border: 1px solid #1e3a8a !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #fff !important;
          overflow: hidden !important;
        }

        .certificate-print-card .certificate-close,
        .certificate-print-card .certificate-print-button {
          display: none !important;
        }

        .certificate-print-overlay {
          position: static !important;
          inset: auto !important;
          padding: 0 !important;
          background: #fff !important;
          display: block !important;
        }
      }
    `}</style>
    <div dir="rtl" className="result-page-print" style={styles.page}>
      <div className="result-main-card" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.headerIdentity}>
            <div style={styles.bismillahMain}>بسم الله الرحمن الرحيم</div>
            <div style={styles.mainLogo} aria-label="شعار المؤسسة">
              <img
                src={institutionLogo(institution) || logo}
                alt="شعار المؤسسة"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div style={styles.ministry}>{institutionName(institution)}</div>
            <div style={styles.sub}>قسم القياس والتقويم والامتحانات</div>
          </div>
          <button onClick={onBack} style={styles.home}>🏠 الرئيسية</button>
        </div>

        <h1 style={styles.title}>عرض النتائج والشهادات المدرسية</h1>
        <p style={styles.hint}>ابحث برقم الجلوس أو رقم الهوية لعرض النتيجة والشهادة الرسمية</p>

        <form onSubmit={submitSearch} style={styles.searchForm}>
          <input
            value={query}
            onChange={e => setQuery(englishDigits(e.target.value).slice(0, 10))}
            inputMode="numeric"
            maxLength={10}
            dir="ltr"
            placeholder="أدخل رقم الجلوس أو رقم الهوية"
            aria-label="رقم الجلوس أو رقم الهوية"
            style={{ ...styles.input, direction: 'ltr', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
          />
          <button type="submit" style={styles.searchBtn}>🔎 بحث</button>
        </form>

        {loading ? (
          <div style={styles.state}>⏳ جاري تحميل البيانات...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : searched && !resultToShow ? (
          <div style={styles.state}>⚠️ لم يتم العثور على نتيجة مطابقة برقم الجلوس أو رقم الهوية المدخل.</div>
        ) : resultToShow ? (
          <div style={styles.resultBox}>
            <h2>نتيجة الطالب</h2>
            
            <div style={{ overflowX: 'auto', marginTop: 15 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>اسم الطالب</th>
                    <th style={styles.th}>رقم الجلوس</th>
                    <th style={styles.th}>رقم الهوية</th>
                    <th style={styles.th}>الفرع</th>
                    <th style={styles.th}>المجموع</th>
                    <th style={styles.th}>المعدل %</th>
                    <th style={styles.th}>النتيجة النهائية</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}>{nameOf(resultToShow.student)}</td>
                    <td style={styles.td}>{seatOf(resultToShow.student) || '—'}</td>
                    <td style={styles.td}>{idOf(resultToShow.student) || '—'}</td>
                    <td style={styles.td}>{resultToShow.branch.branch_name || resultToShow.branch.name || '—'}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{resultToShow.calc.total} / 700</td>
                    <td style={{ ...styles.td, fontWeight: 900, color: '#34d399' }}>{formatPct(resultToShow.calc.percentage)}</td>
                    <td style={{ 
                      ...styles.td, 
                      fontWeight: 900, 
                      color: resultToShow.calc.passed ? '#34d399' : (resultToShow.calc.status.includes('مكمل') ? '#facc15' : '#fb7185') 
                    }}>
                      {resultToShow.calc.status}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <hr style={{ borderColor: 'rgba(56,189,248,.3)', margin: '20px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
              <div>
                <h3 style={{ margin: '0 0 8px', color: '#38bdf8' }}>بيانات الطالب الأساسية</h3>
                <p style={{ margin: 4, color: '#cbd5e1' }}>
                  <b>الاسم:</b> {nameOf(resultToShow.student)} | <b>رقم الجلوس:</b> {seatOf(resultToShow.student)} | <b>رقم الهوية:</b> {idOf(resultToShow.student)}
                </p>
              </div>
              <button onClick={() => setShowCertificate(true)} style={styles.certBtn}>🎓 عرض وزيارة الشهادة الرسمية</button>
            </div>
          </div>
        ) : null}

        {showCertificate && resultToShow && (
          <div className="certificate-print-overlay" style={styles.modalOverlay}>
            <div className="certificate-screen-scroll">
              <div className="certificate-print-card" style={{ ...styles.certificateCard, position: 'relative', overflow: 'hidden' }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 0,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    transform: 'rotate(-28deg)',
                    color: '#1e3a8a',
                    opacity: 0.075,
                    fontSize: '42px',
                    fontWeight: '900',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    userSelect: 'none',
                    letterSpacing: '1px'
                  }}
                >
                  {institutionName(institution)}
                </div>
              </div>

              <div style={{ position: 'relative', zIndex: 2 }}>
                <button className="certificate-close" onClick={() => setShowCertificate(false)} style={styles.closeBtn}>✕ إغلاق</button>

                <div style={styles.certificateHeader}>
                <div style={styles.bismillah}>بسم الله الرحمن الرحيم</div>

                <div style={styles.logoPlaceholder} aria-label="شعار">
                  <img
                    src={institutionLogo(institution) || logo}
                    alt="شعار المؤسسة"
                    style={{
                      width: '78px',
                      height: '78px',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                <div style={styles.countryLine}>{institutionName(institution)}</div>
                <div style={styles.certificateTitle}>
                  شهادة اتمام الدراسة الثانوية العامة لعام : {resultToShow.student.academic_year ?? currentYear}
                </div>
                <div style={styles.certificateRule}></div>
              </div>

              <div style={styles.studentDataFrame}>
                <div style={styles.studentRow}>
                  <div style={styles.studentCell}><b>اسم الطالب:</b> {nameOf(resultToShow.student)}</div>
                  <div style={styles.studentCell}><b>رقم الهوية:</b> <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{idOf(resultToShow.student) || '—'}</span></div>
                  <div style={styles.studentCell}><b>رقم الجلوس:</b> <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{seatOf(resultToShow.student) || '—'}</span></div>
                  <div style={styles.studentCell}><b>الفرع:</b> {resultToShow.branch.branch_name || resultToShow.branch.name || '—'}</div>
                </div>

                <div style={styles.studentRow}>
                  <div style={styles.studentCell}><b>تاريخ الميلاد:</b> {resultToShow.student.date_of_birth || resultToShow.student.birth_date || '—'}</div>
                  <div style={styles.studentCell}><b>مكان الميلاد:</b> {resultToShow.student.place_of_birth || resultToShow.student.birth_place || '—'}</div>
                  <div style={styles.studentCell}><b>الجنسية:</b> {resultToShow.student.nationality || '—'}</div>
                  <div style={styles.studentCell}><b>الجنس:</b> {resultToShow.student.gender || '—'}</div>
                </div>

                <div style={{ ...styles.studentRow, gridTemplateColumns: '1fr 1fr' }}>
                  <div style={styles.studentCell}><b>المديرية:</b> {resultToShow.student.directorate_name || '—'}</div>
                  <div style={styles.studentCell}><b>المدرسة:</b> {resultToShow.student.school_name || '—'}</div>
                </div>
              </div>

              <h3 style={{ color: '#1e3a8a', margin: '15px 0 10px', fontSize: 16, borderBottom: '1px solid #cbd5e1', paddingBottom: 5 }}>علامات المواد الدراسية</h3>
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                <table style={{ ...styles.table, background: '#fff', color: '#000' }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, background: '#1e3a8a', color: '#fff' }}>اسم المادة</th>
                      <th style={{ ...styles.th, background: '#1e3a8a', color: '#fff' }}>العلامة الصغرى</th>
                      <th style={{ ...styles.th, background: '#1e3a8a', color: '#fff' }}>العلامة العظمى</th>
                      <th style={{ ...styles.th, background: '#1e3a8a', color: '#fff' }}>علامة الطالب</th>
                      <th style={{ ...styles.th, background: '#1e3a8a', color: '#fff' }}>العلامات بالحروف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultToShow.calc.selected.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ ...styles.td, color: '#000', borderColor: '#cbd5e1' }}>{subjectNameOf(item.subject)}</td>
                        <td style={{ ...styles.td, color: '#000', borderColor: '#cbd5e1' }}>{item.min}</td>
                        <td style={{ ...styles.td, color: '#000', borderColor: '#cbd5e1' }}>{item.max}</td>
                        <td style={{ ...styles.td, color: '#000', borderColor: '#cbd5e1', fontWeight: 'bold' }}>{item.mark}</td>
                        <td style={{ ...styles.td, color: '#000', borderColor: '#cbd5e1', fontSize: '13px' }}>{gradeToWords(item.mark)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 15, padding: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, color: '#0f172a', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, fontSize: 14 }}>
                <div><b>المجموع بالأرقام:</b> {resultToShow.calc.total} / {resultToShow.calc.maximum}</div>
                <div><b>العلامة الصغرى للفرع:</b> {resultToShow.calc.minimum}</div>
                <div><b>المجموع بالحروف:</b> {numberToWords(resultToShow.calc.total)}</div>
                <div><b>المعدل:</b> {formatPct(resultToShow.calc.percentage)}</div>
                <div>
                  <b>النتيجة النهائية:</b>{' '}
                  <span style={{ color: resultToShow.calc.passed ? 'green' : (resultToShow.calc.status.includes('مكمل') ? 'orange' : 'red'), fontWeight: 'bold' }}>
                    {resultToShow.calc.status}
                  </span>
                </div>
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: 4, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontWeight: '700' }}>
                  صدرت في : فلسطين بتاريخ : <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIssuanceDate()}</span>
                </div>
              </div>

              {/* قسم توقيع المدير والختم الرسمي */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingTop: 15, borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '5px' }}>ختم المدرسة الرسمي</div>
                  <div style={{ width: '90px', height: '90px', border: '2px dashed #1e3a8a', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a', fontSize: '11px', fontWeight: 'bold', transform: 'rotate(-10deg)', background: 'rgba(30,58,138,0.03)' }}>
                    الختم الرسمي
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '220px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '8px' }}>مدير التربية والتعليم / المدرسة</div>
                  <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: '900', fontFamily: 'serif', fontSize: '18px', borderBottom: '1px solid #94a3b8' }}>
                    د. مدير العام المعتمد
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>التوقيع والاعتماد الرسمي</div>
                </div>
              </div>

                <div style={{ textAlign: 'center', marginTop: 25 }}>
                  <button className="certificate-print-button" onClick={() => window.print()} style={{ background: '#1e3a8a', color: '#fff', border: 0, padding: '10px 25px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>🖨️ طباعة الشهادة</button>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '24px', background: '#07152f', color: '#eef7ff', boxSizing: 'border-box', fontFamily: 'Noto Kufi Arabic, sans-serif' },
  card: { width: 'min(1250px,100%)', margin: '0 auto', background: 'rgba(9,28,60,.9)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 20, boxShadow: '0 0 40px rgba(0,0,0,.35)', padding: 22, boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15, borderBottom: '1px solid rgba(96,165,250,.25)', paddingBottom: 18, position: 'relative' },
  headerIdentity: { flex: 1, minWidth: 0, textAlign: 'center' },
  bismillahMain: { fontWeight: 800, fontSize: 16, lineHeight: 1.6, color: '#dbeafe', marginBottom: 8 },
  mainLogo: { width: 76, height: 76, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ministry: { fontWeight: 900, fontSize: 20, lineHeight: 1.7, color: '#f8fafc' },
  sub: { fontSize: 12, color: '#93c5fd', marginTop: 4 },
  home: { background: '#0e7490', color: '#fff', border: '1px solid #38bdf8', borderRadius: 9, padding: '9px 15px', cursor: 'pointer', fontWeight: 800, flexShrink: 0 },
  title: { textAlign: 'center', color: '#38bdf8', margin: '24px 0 8px', fontSize: 'clamp(23px, 4vw, 34px)', lineHeight: 1.6, fontWeight: 900 },
  hint: { textAlign: 'center', color: '#cbd5e1', margin: '0 auto 22px', maxWidth: 720, fontSize: 'clamp(15px, 2.4vw, 20px)', lineHeight: 1.9 },
  searchForm: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, width: '100%', margin: '0 auto 20px' },
  input: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '14px 15px', borderRadius: 12, border: '1px solid #2563eb', background: '#06142c', color: '#fff', outline: 'none', fontSize: 17, minHeight: 54 },
  searchBtn: { width: '100%', minHeight: 52, border: 0, borderRadius: 12, padding: '12px 25px', background: '#2563eb', color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer', transition: 'transform .2s ease, box-shadow .2s ease' },
  resultBox: { background: 'rgba(6,20,44,.85)', border: '1px solid #38bdf8', borderRadius: 14, padding: 18, marginBottom: 24 },
  state: { padding: 30, textAlign: 'center', color: '#cbd5e1' },
  error: { padding: 14, borderRadius: 10, background: 'rgba(127,29,29,.35)', border: '1px solid #ef4444', color: '#fecaca', marginBottom: 18 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'center', background: '#0b2042' },
  th: { background: '#172554', color: '#93c5fd', padding: '10px', border: '1px solid rgba(148,163,184,.2)' },
  td: { padding: '9px', border: '1px solid rgba(148,163,184,.12)' },
  certBtn: { background: '#10b981', color: '#fff', border: 0, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 15 },
  certificateCard: { position: 'relative', background: '#fff', color: '#0f172a', width: '100%', maxWidth: 1000, borderRadius: 14, padding: '34px 30px 30px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box', overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 14, left: 14, background: '#ef4444', color: '#fff', border: 0, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
  certificateHeader: { textAlign: 'center', color: '#111827' },
  bismillah: { fontWeight: 900, fontSize: 17, lineHeight: 1.6, marginBottom: 7 },
  logoPlaceholder: { width: 78, height: 78, margin: '0 auto 10px', border: 'none', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' },
  countryLine: { fontWeight: 900, fontSize: 16, marginTop: 3 },
  certificateTitle: { fontWeight: 900, fontSize: 17, marginTop: 8 },
  certificateRule: { height: 2, background: '#1e3a8a', margin: '16px 0 20px', width: '100%' },
  studentDataFrame: { border: 'none', borderRadius: 10, padding: 0, overflow: 'hidden', color: '#111827', background: '#fff' },
  studentCell: { padding: '10px 12px', borderLeft: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  studentRow: { display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr 1fr', gap: 0, borderBottom: '1px solid #cbd5e1', fontSize: 14, lineHeight: 1.9 },
};