import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import ExamHeader from './ExamHeader';
import successImage from './success.jpg';
import { createMonitoringSessionId, saveOfflineChunk, syncOfflineChunks } from './offlineExamRecorder';

export default function Exam({
  supabase,
  student,
  initialExam,
  onLogout
}) {
  // =========================================================
  // STATES
  // =========================================================

  const [examData, setExamData] = useState(initialExam || null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);
  const [timeToStart, setTimeToStart] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [reviewQuestions, setReviewQuestions] = useState([]);

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [warnings, setWarnings] = useState(0);
  const MAX_WARNINGS = 3;

  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState('');

  const [monitoringActive, setMonitoringActive] = useState(false);

  const [subjectName, setSubjectName] = useState('');

  // بيانات الطالب النهائية: القادمة من الصفحة الأب أو من تسجيل الدخول المحفوظ.
  const [resolvedStudent, setResolvedStudent] = useState(student || null);

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const monitoringSessionRef = useRef(null);
  const monitoringSequenceRef = useRef(0);

  const submissionStartedRef = useRef(false);
  const endTimestampRef = useRef(null);
  const submitExamRef = useRef(null);

  // =========================================================
  // RESOLVE STUDENT FROM SEATING NUMBER
  // =========================================================
  useEffect(() => {
    let cancelled = false;

    const resolveStudent = async () => {
      // الأولوية للبيانات التي وصلت مباشرة.
      if (student && typeof student === 'object') {
        setResolvedStudent(student);
        return;
      }

      let savedStudent = null;
      let savedSeatingNumber = '';

      try {
        const rawStudent = localStorage.getItem('exam_student');
        if (rawStudent) {
          const parsed = JSON.parse(rawStudent);
          if (parsed && typeof parsed === 'object') {
            savedStudent = parsed;
          }
        }

        savedSeatingNumber =
          String(
            localStorage.getItem('exam_seating_number') || ''
          ).trim();
      } catch (error) {
        console.warn('Read saved student error:', error);
      }

      if (savedStudent) {
        if (!cancelled) {
          setResolvedStudent(savedStudent);
        }
        return;
      }

      // إذا لم تحفظ بيانات الطالب، نستخرج الاسم مباشرة من جدول students
      // باستخدام رقم الجلوس المحفوظ.
      if (supabase && savedSeatingNumber) {
        let data = null;
        let error = null;

        // الرقم الأساسي المتوقع.
        let result = await supabase
          .from('students')
          .select('*')
          .eq('seating_number', savedSeatingNumber)
          .maybeSingle();

        data = result.data;
        error = result.error;

        // احتياط إذا كان اسم الحقل في جدول الطلاب seat_number.
        if (!data && !error) {
          result = await supabase
            .from('students')
            .select('*')
            .eq('seat_number', savedSeatingNumber)
            .maybeSingle();

          data = result.data;
          error = result.error;
        }

        if (error) {
          console.warn('Student lookup in Exam failed:', error);
          return;
        }

        if (data && !cancelled) {
          const studentData = {
            ...data,
            seating_number: savedSeatingNumber
          };

          setResolvedStudent(studentData);

          try {
            localStorage.setItem(
              'exam_student',
              JSON.stringify(studentData)
            );
          } catch {}
        }
      }
    };

    resolveStudent();

    return () => {
      cancelled = true;
    };
  }, [student, supabase]);

  const getStudentDisplayName = (s) => {
    if (!s || typeof s !== 'object') return '';

    const direct =
      s.full_name ||
      s.full_name_ar ||
      s.fullName ||
      s.name ||
      s.student_name ||
      s.studentName ||
      s.اسم_الطالب ||
      s['اسم الطالب'] ||
      s.الاسم ||
      s['الاسم'] ||
      s.display_name;

    if (direct) return String(direct).trim();

    const first =
      s.first_name || s.firstname || s['first_name'] ||
      s.الاسم_الأول || s['الاسم الأول'] ||
      s.firstName || '';

    const father =
      s.father_name || s.middle_name || s.second_name ||
      s.اسم_الأب || s['اسم الأب'] ||
      s.fatherName || '';

    const last =
      s.last_name || s.lastname || s.family_name ||
      s.surname || s.اسم_العائلة || s['اسم العائلة'] ||
      s.lastName || '';

    return [first, father, last]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  };

  // =========================================================
  // STUDENT NAME
  // =========================================================

  const studentName = useMemo(
    () => getStudentDisplayName(resolvedStudent),
    [resolvedStudent]
  );

  // =========================================================
  // STUDENT SEATING NUMBER
  // =========================================================

  const seatingNumber = useMemo(
    () => String(
      resolvedStudent?.seating_number ||
      resolvedStudent?.seat_number ||
      resolvedStudent?.seatingNumber ||
      resolvedStudent?.رقم_الجلوس ||
      resolvedStudent?.['رقم الجلوس'] ||
      resolvedStudent?.seatNo ||
      ''
    ).trim(),
    [resolvedStudent]
  );

  // =========================================================
  // EXAM ID
  // =========================================================

  const examId = useMemo(() => {
    if (!examData?.id) return '';

    return String(examData.id);
  }, [examData]);

  // =========================================================
  // LOCAL STORAGE KEYS
  // =========================================================

  const answersStorageKey = useMemo(() => {
    if (!seatingNumber || !examId) {
      return 'exam_answers';
    }

    return `exam_answers_${seatingNumber}_${examId}`;
  }, [seatingNumber, examId]);

  const endTimeStorageKey = useMemo(() => {
    if (!seatingNumber || !examId) {
      return 'exam_end_time';
    }

    return `exam_end_time_${seatingNumber}_${examId}`;
  }, [seatingNumber, examId]);

  const submittedStorageKey = useMemo(() => {
    if (!seatingNumber || !examId) {
      return 'exam_submitted';
    }

    return `submitted_${seatingNumber}_${examId}`;
  }, [seatingNumber, examId]);

  // =========================================================
  // MESSAGE
  // =========================================================

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  // =========================================================
  // CREATE DATE/TIME
  // =========================================================

  const createExamDateTime = (
    examDate,
    examTime
  ) => {
    if (!examDate || !examTime) {
      return null;
    }

    try {
      const dateString =
        String(examDate).split('T')[0];

      const timeString =
        String(examTime).substring(0, 8);

      const dateTime = new Date(
        `${dateString}T${timeString}`
      );

      if (
        Number.isNaN(
          dateTime.getTime()
        )
      ) {
        return null;
      }

      return dateTime;
    } catch {
      return null;
    }
  };

  // =========================================================
  // GET EXAM START TIME
  // =========================================================

  const getExamStartTime = (
    exam = examData
  ) => {
    if (!exam) return null;

    return createExamDateTime(
      exam.exam_date,
      exam.exam_time
    );
  };

  // =========================================================
  // GET EXAM DURATION
  // =========================================================

  const getExamDuration = (
    exam = examData
  ) => {
    const duration = Number(
      exam?.duration_minutes ||
      exam?.duration ||
      60
    );

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return 60;
    }

    return duration;
  };

  // =========================================================
  // GET EXAM END TIME
  // =========================================================

  const getExamEndTime = (
    exam = examData
  ) => {
    if (!exam) return null;

    const startTime =
      getExamStartTime(exam);

    if (!startTime) {
      return null;
    }

    const durationMinutes =
      getExamDuration(exam);

    return new Date(
      startTime.getTime() +
      durationMinutes * 60 * 1000
    );
  };

  // =========================================================
  // RESOLVE SUBJECT NAME
  // =========================================================
  const resolveSubjectName = async (exam) => {
    if (!exam) return 'المبحث غير محدد';

    let loadedSubjectName =
      exam.subject_name ||
      exam.subjectName ||
      exam.subject ||
      '';

    if (!loadedSubjectName && exam.subject_id) {
      try {
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('*')
          .eq('id', exam.subject_id)
          .maybeSingle();

        if (subjectData) {
          loadedSubjectName =
            subjectData.name ||
            subjectData.subject_name ||
            subjectData.title ||
            subjectData.subjectName ||
            subjectData.اسم_المبحث ||
            '';
        }
      } catch (error) {
        console.warn('Subject loading error:', error);
      }
    }

    if (!loadedSubjectName) {
      loadedSubjectName = exam.title || 'المبحث غير محدد';
    }

    return String(loadedSubjectName).trim();
  };

  // =========================================================
  // LOAD EXAM
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const loadExam = async () => {
      setLoading(true);

      try {
        let currentExam =
          initialExam || null;

        if (!currentExam) {
          const studentBranchId =
            student?.branch_id ||
            student?.branchId ||
            null;

          let query = supabase
            .from('exams')
            .select('*');

          if (studentBranchId) {
            query = query.or(
              `branch_id.eq.${studentBranchId},branch_id.is.null`
            );
          }

          const {
            data: examsData,
            error: examsError
          } = await query;

          if (examsError) {
            throw examsError;
          }

          const now =
            new Date();

          if (
            Array.isArray(
              examsData
            )
          ) {
            currentExam =
              examsData.find(
                (exam) => {
                  const startTime =
                    getExamStartTime(
                      exam
                    );

                  const endTime =
                    getExamEndTime(
                      exam
                    );

                  if (
                    !startTime ||
                    !endTime
                  ) {
                    return false;
                  }

                  const verificationStart =
                    new Date(startTime.getTime() - 10 * 60 * 1000);

                  return (
                    now >= verificationStart &&
                    now < endTime
                  );
                }
              ) || null;
          }
        }

        if (!currentExam) {
          throw new Error(
            'لا يوجد امتحان فعال في هذا الوقت. يرجى العودة إلى صفحة تسجيل الدخول.'
          );
        }

        const examStartTime =
          getExamStartTime(
            currentExam
          );

        const examEndTime =
          getExamEndTime(
            currentExam
          );

        const now =
          new Date();

        if (
          !examStartTime ||
          !examEndTime
        ) {
          throw new Error(
            'تاريخ أو وقت الامتحان غير صحيح.'
          );
        }

        // يسمح بالدخول قبل الامتحان فقط خلال آخر 10 دقائق للتحقق،
        // لكن لا يسمح بعرض الأسئلة أو بدء عداد الامتحان قبل الموعد.
        const verificationWindowStart =
          new Date(examStartTime.getTime() - 10 * 60 * 1000);

        if (
          now < verificationWindowStart
        ) {
          throw new Error(
            'لم يحن وقت التحقق بعد. يفتح البرنامج للتحقق قبل الامتحان بـ10 دقائق فقط.'
          );
        }

        if (
          now >= examEndTime
        ) {
          throw new Error(
            'انتهى وقت هذا الامتحان.'
          );
        }

        if (cancelled) {
          return;
        }

        setExamData(
          currentExam
        );

        const resolvedName = await resolveSubjectName(currentExam);
        if (!cancelled) {
          setSubjectName(resolvedName);
        }

        // لا نحمل أسئلة الامتحان قبل وقت البداية. في نافذة الـ10 دقائق
        // السابقة نعرض شاشة التحقق والعد التنازلي فقط.
        endTimestampRef.current = examEndTime.getTime();
        const waitUntilStart = now < examStartTime;
        setTimeToStart(Math.max(0, Math.ceil((examStartTime.getTime() - now.getTime()) / 1000)));
        setTimeLeft(0);
        if (waitUntilStart) {
          if (!cancelled) setQuestions([]);
          return;
        }

        const currentExamId =
          String(
            currentExam.id
          );

        if (seatingNumber) {
          const {
            data: existingSubmission,
            error:
              submissionError
          } = await supabase
            .from('submissions')
            .select(
              'id, seating_number, exam_id, submitted_at'
            )
            .eq(
              'seating_number',
              seatingNumber
            )
            .eq(
              'exam_id',
              currentExamId
            )
            .maybeSingle();

          if (
            submissionError
          ) {
            console.warn(
              'Submission check warning:',
              submissionError
            );
          }

          if (
            existingSubmission
          ) {
            setIsSubmitted(
              true
            );

            setLoading(
              false
            );

            return;
          }
        }

        // =========================================================
        // تحميل أسئلة الامتحان بالطريقة الصحيحة
        // =========================================================
        // مهم:
        // questions.exam_id ليس هو مصدر ربط السؤال بالامتحان في هذا
        // النظام؛ الامتحان يحفظ IDs الأسئلة في selected_questions
        // ويحفظ الهيكل في exam_structure. لذلك لا نعتمد على exam_id
        // وحده، لأن السؤال يمكن أن يكون ضمن أكثر من امتحان.
        let selectedQuestionIds =
          currentExam.selected_questions;

        if (
          typeof selectedQuestionIds ===
          'string'
        ) {
          try {
            selectedQuestionIds =
              JSON.parse(
                selectedQuestionIds
              );
          } catch {
            selectedQuestionIds =
              [];
          }
        }

        if (
          !Array.isArray(
            selectedQuestionIds
          )
        ) {
          selectedQuestionIds = [];
        }

        // توحيد الـ IDs للمقارنة مع أعمدة Supabase.
        selectedQuestionIds =
          selectedQuestionIds
            .map(id => {
              const n = Number(id);
              return Number.isFinite(n)
                ? n
                : id;
            })
            .filter(id => id !== null && id !== undefined && String(id) !== '');

        // الاستعلام القديم كان يبحث فقط عن questions.exam_id = exam.id.
        // هذا يفشل مع الامتحان 22 مثلًا لأن selected_questions = [27,28]
        // بينما questions.exam_id للسؤالين ليس 22.
        const {
          data: questionData,
          error: questionError
        } = await supabase
          .from('questions')
          .select('*')
          .eq(
            'exam_id',
            currentExam.id
          );

        if (
          questionError
        ) {
          console.warn(
            'Questions fetch by exam_id warning:',
            questionError
          );
        }

        let finalQuestions =
          Array.isArray(
            questionData
          )
            ? [...questionData]
            : [];

        // المصدر الأساسي إذا كان الامتحان يحفظ selected_questions.
        // نسترجع الأسئلة مباشرة بواسطة IDs حتى لو كان exam_id مختلفًا أو NULL.
        let selectedQuestionData = [];

        if (
          selectedQuestionIds.length > 0
        ) {
          const {
            data: selectedData,
            error: selectedDataError
          } = await supabase
            .from('questions')
            .select('*')
            .in(
              'id',
              selectedQuestionIds
            );

          if (
            selectedDataError
          ) {
            console.warn(
              'Selected questions fetch error:',
              selectedDataError
            );
          } else if (
            Array.isArray(
              selectedData
            )
          ) {
            selectedQuestionData =
              selectedData;
          }

          if (
            selectedQuestionData.length > 0
          ) {
            finalQuestions =
              selectedQuestionData;
          }
        }

        // احتياط أخير فقط عندما لا توجد أسئلة محددة ولم نجد أسئلة بالامتحان.
        // لا نستخدم أسئلة المادة عشوائيًا إذا كان الامتحان يحتوي selected_questions،
        // لأن ذلك قد يدخل أسئلة ليست ضمن الامتحان.
        if (
          finalQuestions.length === 0 &&
          selectedQuestionIds.length === 0 &&
          currentExam.subject_id
        ) {
          const {
            data: fallbackData,
            error: fallbackError
          } = await supabase
            .from('questions')
            .select('*')
            .eq(
              'subject_id',
              currentExam.subject_id
            );

          if (
            fallbackError
          ) {
            console.warn(
              'Subject questions error:',
              fallbackError
            );
          }

          if (
            Array.isArray(
              fallbackData
            ) &&
            fallbackData.length > 0
          ) {
            finalQuestions =
              fallbackData;
          }
        }

        // خريطة للأسئلة الحديثة من قاعدة البيانات.
        // نستخدمها لتحديث السؤال الموجود داخل exam_structure إذا كان محفوظًا
        // كنسخة قديمة داخل JSON.
        const questionById =
          new Map();

        finalQuestions.forEach(q => {
          if (
            q &&
            q.id !== null &&
            q.id !== undefined
          ) {
            questionById.set(
              String(q.id),
              q
            );
          }
        });

        if (
          currentExam.exam_structure
        ) {
          let struct =
            currentExam.exam_structure;

          if (
            typeof struct ===
            'string'
          ) {
            try {
              struct =
                JSON.parse(
                  struct
                );
            } catch {
              struct = [];
            }
          }

          if (
            Array.isArray(struct)
          ) {
            const structuredQuestions =
              [];

            struct.forEach(
              (section, sectionIndex) => {
                if (
                  Array.isArray(
                    section.types
                  )
                ) {
                  section.types.forEach(
                    (type, typeIndex) => {
                      if (
                        Array.isArray(
                          type.questions
                        )
                      ) {
                        type.questions.forEach(
                          (q) => {
                            const dbQuestion =
                              questionById.get(
                                String(q?.id)
                              );

                            // نأخذ البيانات الحديثة من questions،
                            // مع إبقاء إعدادات الهيكل/العلامة الخاصة بالامتحان.
                            const mergedQuestion =
                              dbQuestion
                                ? {
                                    ...q,
                                    ...dbQuestion
                                  }
                                : {
                                    ...q
                                  };

                            const customMark =
                              q?.custom_mark !== undefined
                                ? q.custom_mark
                                : mergedQuestion?.custom_mark;

                            structuredQuestions.push(
                              {
                                ...mergedQuestion,

                                marks:
                                  customMark !== undefined
                                    ? Number(
                                        customMark
                                      )
                                    : Number(
                                        mergedQuestion?.marks ||
                                        1
                                      ),

                                section_title:
                                  section.name,

                                section_index:
                                  sectionIndex,

                                optional_branch_index:
                                  null,

                                type_index:
                                  typeIndex,

                                question_type:
                                  type.typeKey ||
                                  mergedQuestion.question_type ||
                                  mergedQuestion.type
                              }
                            );
                          }
                        );
                      }
                    }
                  );
                }

                if (
                  Array.isArray(
                    section.subQuestions
                  )
                ) {
                  section.subQuestions.forEach(
                    (subQ, subQIndex) => {
                      if (
                        Array.isArray(
                          subQ.types
                        )
                      ) {
                        subQ.types.forEach(
                          (type, typeIndex) => {
                            if (
                              Array.isArray(
                                type.questions
                              )
                            ) {
                              type.questions.forEach(
                                (q) => {
                                  const dbQuestion =
                                    questionById.get(
                                      String(q?.id)
                                    );

                                  const mergedQuestion =
                                    dbQuestion
                                      ? {
                                          ...q,
                                          ...dbQuestion
                                        }
                                      : {
                                          ...q
                                        };

                                  const customMark =
                                    q?.custom_mark !== undefined
                                      ? q.custom_mark
                                      : mergedQuestion?.custom_mark;

                                  structuredQuestions.push(
                                    {
                                      ...mergedQuestion,

                                      marks:
                                        customMark !== undefined
                                          ? Number(
                                              customMark
                                            )
                                          : Number(
                                              mergedQuestion?.marks ||
                                              1
                                            ),

                                      section_title:
                                        `${section.name} - ${subQ.title}`,

                                      section_index:
                                        sectionIndex,

                                      optional_branch_index:
                                        subQIndex,

                                      type_index:
                                        typeIndex,

                                      question_type:
                                        type.typeKey ||
                                        mergedQuestion.question_type ||
                                        mergedQuestion.type
                                    }
                                  );
                                }
                              );
                            }
                          }
                        );
                      }
                    }
                  );
                }
              }
            );

            // تجهيز العلامة المنطقية لكل سؤال (مجموع علامات فروعه)
            // وتجهيز علامة كل قسم للعرض والتصحيح.
            const groupedByKey = new Map();
            structuredQuestions.forEach(q => {
              const key = `${q.section_index}__${q.optional_branch_index ?? 'normal'}__${q.type_index}`;
              if (!groupedByKey.has(key)) groupedByKey.set(key, []);
              groupedByKey.get(key).push(q);
            });

            const branchGroupMarks = new Map();
            groupedByKey.forEach((group, key) => {
              const mark = group.reduce((sum, q) => {
                const m = Number(q?.marks ?? 1);
                return sum + (Number.isFinite(m) ? m : 1);
              }, 0);
              branchGroupMarks.set(key, mark);
            });

            const optionalMaxByType = new Map();
            structuredQuestions.forEach(q => {
              const branch = q.optional_branch_index;
              if (branch === null || branch === undefined) return;
              const typeKey = `${q.section_index}__${q.type_index}`;
              const mark = branchGroupMarks.get(
                `${q.section_index}__${branch}__${q.type_index}`
              ) || 0;
              optionalMaxByType.set(
                typeKey,
                Math.max(optionalMaxByType.get(typeKey) || 0, mark)
              );
            });

            structuredQuestions.forEach(q => {
              const isOptional = q.optional_branch_index !== null && q.optional_branch_index !== undefined;
              const groupKey = `${q.section_index}__${q.optional_branch_index ?? 'normal'}__${q.type_index}`;
              q.logical_question_mark = isOptional
                ? (optionalMaxByType.get(`${q.section_index}__${q.type_index}`) || branchGroupMarks.get(groupKey) || 0)
                : (branchGroupMarks.get(groupKey) || q.marks || 0);
            });

            if (
              structuredQuestions.length >
              0
            ) {
              finalQuestions =
                structuredQuestions;
            }
          }
        }

        // الحفاظ على ترتيب selected_questions عندما لا يوجد هيكل تفصيلي.
        const hasExamStructure =
          Array.isArray(
            currentExam.exam_structure
          )
            ? currentExam.exam_structure.length > 0
            : Boolean(
                currentExam.exam_structure
              );

        if (
          selectedQuestionIds.length >
            0 &&
          !hasExamStructure
        ) {
          const orderMap =
            new Map();

          selectedQuestionIds.forEach(
            (id, index) => {
              orderMap.set(
                String(id),
                index
              );
            }
          );

          finalQuestions.sort(
            (a, b) => {
              const aIndex =
                orderMap.has(
                  String(a.id)
                )
                  ? orderMap.get(
                      String(a.id)
                    )
                  : 999999;

              const bIndex =
                orderMap.has(
                  String(b.id)
                )
                  ? orderMap.get(
                      String(b.id)
                    )
                  : 999999;

              return (
                aIndex -
                bIndex
              );
            }
          );
        }

        let savedAnswers =
          {};

        try {
          const saved =
            localStorage.getItem(
              `exam_answers_${seatingNumber}_${currentExamId}`
            );

          if (saved) {
            const parsed =
              JSON.parse(
                saved
              );

            if (
              parsed &&
              typeof parsed ===
                'object'
            ) {
              savedAnswers =
                parsed;
            }
          }
        } catch (
          error
        ) {
          console.error(
            'Local answers error:',
            error
          );
        }

        setAnswers(
          savedAnswers
        );

        setQuestions(
          finalQuestions
        );

        const realEndTime =
          examEndTime.getTime();

        let savedEndTimestamp =
          null;

        try {
          const savedEnd =
            localStorage.getItem(
              `exam_end_time_${seatingNumber}_${currentExamId}`
            );

          if (savedEnd) {
            const parsedEnd =
              Number(
                savedEnd
              );

            if (
              Number.isFinite(
                parsedEnd
              )
            ) {
              savedEndTimestamp =
                parsedEnd;
            }
          }
        } catch (
          error
        ) {
          console.warn(
            'Read end time error:',
            error
          );
        }

        // وقت النهاية ثابت من وقت بداية الامتحان + مدة الامتحان.
        // لا نستخدم وقتًا محفوظًا أقدم لتمديد/تقليص الامتحان بشكل غير صحيح.
        const finalEndTimestamp = realEndTime;

        endTimestampRef.current = finalEndTimestamp;

        try {
          localStorage.setItem(
            `exam_end_time_${seatingNumber}_${currentExamId}`,
            String(finalEndTimestamp)
          );
        } catch (error) {
          console.warn('Save end time error:', error);
        }

        const nowTimestamp = Date.now();
        const startTimestamp = examStartTime.getTime();
        const remaining =
          nowTimestamp < startTimestamp
            ? 0
            : Math.max(
                0,
                Math.floor(
                  (finalEndTimestamp - nowTimestamp) / 1000
                )
              );

        setTimeToStart(
          Math.max(0, Math.ceil((startTimestamp - nowTimestamp) / 1000))
        );
        setTimeLeft(remaining);

      } catch (
        error
      ) {
        console.error(
          'Load exam error:',
          error
        );

        if (
          !cancelled
        ) {
          showMessage(
            error?.message ||
            'حدث خطأ أثناء تحميل الامتحان.'
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    };

    loadExam();

    return () => {
      cancelled = true;
    };
  }, [
    initialExam,
    supabase,
    student?.branch_id,
    student?.branchId
  ]);

  // =========================================================
  // TIMER — يبدأ عند موعد الامتحان فقط
  // =========================================================

  useEffect(() => {
    if (
      loading ||
      isSubmitted ||
      !examData ||
      !endTimestampRef.current
    ) {
      return;
    }

    const startTime = getExamStartTime(examData);
    if (!startTime) return;

    const startTimestamp = startTime.getTime();
    const endTimestamp = endTimestampRef.current;

    const updateTimer = () => {
      const now = Date.now();

      // قبل الموعد: لا يوجد عداد امتحان، فقط عداد انتظار/تحقق.
      if (now < startTimestamp) {
        setTimeToStart(
          Math.max(0, Math.ceil((startTimestamp - now) / 1000))
        );
        setTimeLeft(0);
        return;
      }

      setTimeToStart(0);

      const remaining = Math.max(
        0,
        Math.floor((endTimestamp - now) / 1000)
      );

      setTimeLeft(remaining);

      if (
        now >= endTimestamp &&
        !submissionStartedRef.current
      ) {
        submissionStartedRef.current = true;
        submitExamRef.current?.(true);
      }
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    loading,
    isSubmitted,
    examData
  ]);

  // =========================================================
  // SAVE ANSWERS
  // =========================================================

  useEffect(() => {
    if (
      !seatingNumber ||
      !examId
    ) {
      return;
    }

    if (
      !answers ||
      typeof answers !==
        'object'
    ) {
      return;
    }

    try {
      localStorage.setItem(
        answersStorageKey,
        JSON.stringify(
          answers
        )
      );
    } catch (
      error
    ) {
      console.error(
        'Save answers error:',
        error
      );
    }
  }, [
    answers,
    answersStorageKey,
    seatingNumber,
    examId
  ]);

  // =========================================================
  // CAMERA + MICROPHONE
  // =========================================================

  useEffect(() => {
    if (
      loading ||
      isSubmitted ||
      !examData
    ) {
      return;
    }

    let mounted = true;

    const startMonitoring =
      async () => {
        try {
          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
              .getUserMedia
          ) {
            setMonitoringActive(
              false
            );

            return;
          }

          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: true,
                audio: true
              }
            );

          if (!mounted) {
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            return;
          }

          mediaStreamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // التسجيل لا يعتمد على الإنترنت. MediaRecorder يستمر بالعمل محليًا،
          // وتُحفظ القطع في IndexedDB ثم تتم مزامنتها عند عودة الاتصال.
          const sessionId = createMonitoringSessionId(resolvedStudent?.id || seatingNumber, examData?.id);
          monitoringSessionRef.current = sessionId;
          monitoringSequenceRef.current = 0;

          if (typeof MediaRecorder !== 'undefined') {
            const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
              ? 'video/webm;codecs=vp8,opus'
              : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
            const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = async (event) => {
              if (!event.data || event.data.size === 0) return;
              const sequence = monitoringSequenceRef.current++;
              try {
                await saveOfflineChunk({
                  id: `${sessionId}_${sequence}`,
                  sessionId,
                  studentId: resolvedStudent?.id || null,
                  examId: examData?.id || null,
                  sequence,
                  blob: event.data,
                  mimeType: event.data.type || 'video/webm',
                  capturedAt: new Date().toISOString()
                });
                if (navigator.onLine) {
                  await syncOfflineChunks({ supabase, sessionId, studentId: resolvedStudent?.id || null, examId: examData?.id || null });
                }
              } catch (recordError) {
                console.warn('تعذر حفظ تسجيل المراقبة محليًا:', recordError);
              }
            };
            recorder.start(15000);
          }

          const handleOnline = () => {
            syncOfflineChunks({ supabase, sessionId, studentId: resolvedStudent?.id || null, examId: examData?.id || null }).catch(() => {});
          };
          window.__examMonitoringOnlineHandler = handleOnline;
          window.addEventListener('online', handleOnline);

          setMonitoringActive(true);

        } catch (
          error
        ) {
          console.warn(
            'Camera/microphone unavailable:',
            error
          );

          setMonitoringActive(
            false
          );
        }
      };

    startMonitoring();

    return () => {
      mounted = false;

      if (mediaRecorderRef.current) {
        try { if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch {}
        mediaRecorderRef.current = null;
      }

      if (monitoringSessionRef.current) {
        syncOfflineChunks({
          supabase,
          sessionId: monitoringSessionRef.current,
          studentId: resolvedStudent?.id || null,
          examId: examData?.id || null
        }).catch(() => {});
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (window.__examMonitoringOnlineHandler) { window.removeEventListener('online', window.__examMonitoringOnlineHandler); delete window.__examMonitoringOnlineHandler; }
      setMonitoringActive(false);
    };
  }, [
    loading,
    isSubmitted,
    examData
  ]);

  // =========================================================
  // CHEATING WARNINGS
  // =========================================================

  useEffect(() => {
    if (
      loading ||
      isSubmitted ||
      !examData
    ) {
      return;
    }

    const examStart = getExamStartTime(examData);
    const isExamCurrentlyActive =
      !!examStart && Date.now() >= examStart.getTime();

    if (!isExamCurrentlyActive) {
      return;
    }

    const registerWarning =
      (reason) => {
        if (
          submissionStartedRef.current
        ) {
          return;
        }

        setWarnings(
          (prev) => {
            const next =
              Math.min(
                prev + 1,
                MAX_WARNINGS
              );

            // تسجيل حالة الغش الفعلية في قاعدة البيانات حتى تظهر
            // مباشرة في شاشة حالات الغش والإحصائيات.
            supabase
              .from('cheating_cases')
              .insert({
                student_id:
                  resolvedStudent?.id ?? null,
                exam_id:
                  examData?.id ?? null,
                violation_type:
                  'انتقال خارج شاشة الامتحان',
                occurred_at:
                  new Date().toISOString(),
                case_status:
                  'pending'
              })
              .then(({ error }) => {
                if (error) {
                  console.warn(
                    'تعذر تسجيل حالة الغش:',
                    error
                  );
                }
              });

            setWarningText(
              `${reason} — التحذير ${next} من ${MAX_WARNINGS}`
            );

            setShowWarning(
              true
            );

            // التحذيرات تسجل فقط ولا تؤدي إلى تسليم الامتحان تلقائيًا.
            // التسليم التلقائي يحدث فقط عند انتهاء الوقت.

            return next;
          }
        );
      };

    const handleVisibility =
      () => {
        if (
          document.hidden
        ) {
          registerWarning(
            'تم مغادرة صفحة الامتحان'
          );
        }
      };

    const handleBlur =
      () => {
        registerWarning(
          'تم الانتقال خارج نافذة الامتحان'
        );
      };

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );

    window.addEventListener(
      'blur',
      handleBlur
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );

      window.removeEventListener(
        'blur',
        handleBlur
      );
    };
  }, [
    loading,
    isSubmitted,
    examData,
    getExamStartTime,
    resolvedStudent,
    supabase
  ]);


  // =========================================================
  // EXAM DEVICE / COPY-PASTE PROTECTION (best effort)
  // =========================================================
  useEffect(() => {
    if (loading || isSubmitted || !examData) return;
    const start = getExamStartTime(examData);
    const end = getExamEndTime(examData);
    if (!start || !end) return;

    const active = () => {
      const now = Date.now();
      return now >= start.getTime() && now < end.getTime();
    };

    const preventClipboard = (event) => {
      if (active()) event.preventDefault();
    };
    const preventContext = (event) => {
      if (active()) event.preventDefault();
    };
    const preventSelection = (event) => {
      if (active()) event.preventDefault();
    };
    const preventKeys = (event) => {
      if (!active()) return;
      const key = String(event.key || '').toLowerCase();
      const blocked =
        (event.ctrlKey || event.metaKey) && ['c','v','x','a','s','p'].includes(key) ||
        (event.ctrlKey || event.metaKey) && event.shiftKey && ['i','j','c'].includes(key) ||
        key === 'printscreen' || key === 'f12';
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('copy', preventClipboard, true);
    document.addEventListener('cut', preventClipboard, true);
    document.addEventListener('paste', preventClipboard, true);
    document.addEventListener('contextmenu', preventContext, true);
    document.addEventListener('selectstart', preventSelection, true);
    document.addEventListener('keydown', preventKeys, true);

    return () => {
      document.removeEventListener('copy', preventClipboard, true);
      document.removeEventListener('cut', preventClipboard, true);
      document.removeEventListener('paste', preventClipboard, true);
      document.removeEventListener('contextmenu', preventContext, true);
      document.removeEventListener('selectstart', preventSelection, true);
      document.removeEventListener('keydown', preventKeys, true);
    };
  }, [loading, isSubmitted, examData]);

  // =========================================================
  // ANSWERS
  // =========================================================

  const getAnswerValue =
    (questionId) => {
      return answers[
        String(questionId)
      ];
    };

  const setAnswer = (
    questionId,
    value
  ) => {
    setAnswers(
      (prev) => ({
        ...prev,
        [String(
          questionId
        )]: value
      })
    );
  };

  // =========================================================
  // REVIEW
  // =========================================================

  const toggleReview =
    (questionId) => {
      setReviewQuestions(
        (prev) => {
          const id =
            String(
              questionId
            );

          if (
            prev.includes(id)
          ) {
            return prev.filter(
              (item) =>
                item !== id
            );
          }

          return [
            ...prev,
            id
          ];
        }
      );
    };

  // =========================================================
  // LOGICAL EXAM COUNTS
  // =========================================================
  const parseExamStructure = (value) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  };

  const countLogicalQuestionsInTypes = (types = []) => {
    return types.reduce((count, typeGroup) => {
      const qs = Array.isArray(typeGroup?.questions)
        ? typeGroup.questions
        : [];

      // عدد الأسئلة في الترويسة يجب أن يطابق الأسئلة الفعلية المعروضة والتنقل بينها.
      return count + qs.length;
    }, 0);
  };

  const logicalQuestionCount = useMemo(() => {
    const sections = parseExamStructure(examData?.exam_structure);

    if (sections.length > 0) {
      return sections.reduce((total, section) => {
        const isOptionalSection =
          String(section?.name || '').includes('القسم الاختياري') ||
          String(section?.name || '').toLowerCase().includes('optional');

        if (isOptionalSection && Array.isArray(section?.subQuestions)) {
          // الفرعان بديلان: نأخذ عدد الأسئلة المنطقية في الفرع الأكبر.
          const branchCounts = section.subQuestions.map(branch =>
            countLogicalQuestionsInTypes(branch?.types || [])
          );
          return total + Math.max(0, ...branchCounts);
        }

        return total + countLogicalQuestionsInTypes(section?.types || []);
      }, 0);
    }

    return questions.length;
  }, [examData, questions]);

  const examSectionsCount = useMemo(() => {
    const sections = parseExamStructure(examData?.exam_structure);
    if (sections.length > 0) return sections.length;

    const uniqueSections = new Set(
      questions
        .map(q => q?.section_title)
        .filter(Boolean)
    );

    return uniqueSections.size || 0;
  }, [examData, questions]);

  const getTypeGroupMark = (typeGroup) => {
    const qs = Array.isArray(typeGroup?.questions) ? typeGroup.questions : [];
    return qs.reduce((sum, q) => {
      const mark = Number(q?.custom_mark ?? q?.marks ?? 1);
      return sum + (Number.isFinite(mark) ? mark : 1);
    }, 0);
  };

  const sectionMarks = useMemo(() => {
    const sections = parseExamStructure(examData?.exam_structure);
    return sections.map(section => {
      const isOptional =
        String(section?.name || '').includes('القسم الاختياري') ||
        String(section?.name || '').toLowerCase().includes('optional');

      if (isOptional && Array.isArray(section?.subQuestions)) {
        return Math.max(
          0,
          ...section.subQuestions.map(branch =>
            (branch?.types || []).reduce((sum, type) => sum + getTypeGroupMark(type), 0)
          )
        );
      }

      return (section?.types || []).reduce(
        (sum, type) => sum + getTypeGroupMark(type),
        0
      );
    });
  }, [examData]);

  const countAnsweredInQuestionList = (list = []) => {
    let count = 0;

    list.forEach(q => {
      if (isAnswered(q)) count += 1;
    });

    return count;
  };

  // =========================================================
  // ANSWERED
  // =========================================================

  const isAnswered =
    (question) => {
      if (!question) {
        return false;
      }

      const value =
        getAnswerValue(
          question.id
        );

      if (
        value === null ||
        value === undefined
      ) {
        return false;
      }

      if (
        typeof value ===
          'string' &&
        value.trim() === ''
      ) {
        return false;
      }

      return true;
    };

  const logicalAnsweredCount = useMemo(() => {
    const sections = parseExamStructure(examData?.exam_structure);

    // عدد الإجابات يجب أن يطابق عدد الأسئلة الفعلية، وليس عدد أنواع الأسئلة.
    // مثال: سؤالان من نفس النوع = إجابتان عند الإجابة عنهما معًا.
    if (sections.length > 0 && questions.length > 0) {
      let count = 0;

      sections.forEach((section, sectionIndex) => {
        const isOptionalSection =
          String(section?.name || '').includes('القسم الاختياري') ||
          String(section?.name || '').toLowerCase().includes('optional');

        if (isOptionalSection && Array.isArray(section?.subQuestions)) {
          // الفروع الاختيارية بدائل؛ نحتسب أكبر عدد من الأسئلة المُجابة
          // داخل فرع واحد حتى لا تتضاعف الأسئلة البديلة.
          const branchCounts = section.subQuestions.map((_, branchIndex) =>
            questions.filter(q =>
              Number(q?.section_index) === Number(sectionIndex) &&
              Number(q?.optional_branch_index) === Number(branchIndex)
            ).filter(q => isAnswered(q)).length
          );

          count += Math.max(0, ...branchCounts);
        } else {
          count += questions
            .filter(q =>
              Number(q?.section_index) === Number(sectionIndex) &&
              (q?.optional_branch_index === null ||
                q?.optional_branch_index === undefined)
            )
            .filter(q => isAnswered(q))
            .length;
        }
      });

      return count;
    }

    return questions.reduce(
      (count, q) => count + (isAnswered(q) ? 1 : 0),
      0
    );
  }, [questions, answers, examData]);

  const answeredCount = logicalAnsweredCount;

  const unansweredCount =
    Math.max(0, logicalQuestionCount - answeredCount);

  // =========================================================
  // OPTIONS
  // =========================================================

  const getOptions =
    (question) => {
      if (
        Array.isArray(
          question?.options
        )
      ) {
        return question.options;
      }

      if (
        Array.isArray(
          question?.choices
        )
      ) {
        return question.choices;
      }

      return [];
    };

  // =========================================================
  // QUESTION TYPE
  // =========================================================

  const getQuestionType =
    (question) => {
      return (
        question?.question_type ||
        question?.type ||
        'true_false'
      );
    };

  // =========================================================
  // QUESTION TEXT
  // =========================================================

  const getQuestionText =
    (question) => {
      return (
        question?.question_text ||
        question?.text ||
        question?.body ||
        ''
      );
    };

  // طول موحّد لجميع فراغات أسئلة "أكمل الفراغ".
  // مهما كان عدد النقط/الشرطات في نص السؤال، يظهر فراغ واحد بنفس الطول.
  const COMPLETION_BLANK_WIDTH = '180px';

  const renderCompletionQuestionText = (text) => {
    const value = String(text ?? '');

    // يدعم: ......  -----  _____  ــــــ  ……
    // ويدعم وجود مسافات بين الشرطات مثل: - - - -
    const blankPattern = /(?:[.\-_–—…ـ](?:\s*[.\-_–—…ـ]){1,})/g;
    const parts = value.split(blankPattern);
    const blanks = value.match(blankPattern) || [];

    const rendered = [];
    let blankIndex = 0;

    parts.forEach((part, index) => {
      if (part) {
        rendered.push(
          <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
        );
      }

      if (index < parts.length - 1) {
        rendered.push(
          <span
            key={`blank-${blankIndex++}`}
            aria-label="فراغ للإجابة"
            style={{
              display: 'inline-block',
              width: COMPLETION_BLANK_WIDTH,
              borderBottom: '2px solid #e2e8f0',
              height: '1.05em',
              verticalAlign: 'baseline',
              margin: '0 5px'
            }}
          />
        );
      }
    });

    return rendered;
  };

  // =========================================================
  // OPTION TEXT
  // =========================================================

  const getOptionText =
    (option) => {
      if (
        typeof option ===
        'string'
      ) {
        return option;
      }

      if (
        option &&
        typeof option ===
          'object'
      ) {
        return (
          option.text ||
          option.option_text ||
          option.label ||
          ''
        );
      }

      return '';
    };

  // =========================================================
  // HELPER TO CONVERT NUMBER TO ARABIC TEXT (السؤال الأول، الثاني...)
  // =========================================================
  const getArabicOrdinalQuestionNumber = (num) => {
    const numbers = [
      '', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 
      'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
      'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر',
      'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'
    ];
    if (num >= 1 && num <= 20) {
      return `السؤال ${numbers[num]}`;
    }
    return `السؤال رقم ${num}`;
  };

  // =========================================================
  // QUESTION TYPE HEADER
  // =========================================================

  const getQuestionTypeHeaderTitle =
    (typeVal) => {
      if (
        typeVal ===
          'true_false' ||
        typeVal ===
          'true-false' ||
        typeVal ===
          'boolean'
      ) {
        return 'ضع إشارة صح أو إشارة خطأ أمام كل عبارة من العبارات التالية :-';
      }

      if (
        typeVal ===
          'multiple_choice' ||
        typeVal ===
          'mcq'
      ) {
        return 'اختر الإجابة الصحيحة في كل عبارة من العبارات التالية :-';
      }

      if (
        typeVal ===
          'completion' ||
        typeVal ===
          'complete' ||
        typeVal ===
          'fill_in_blank'
      ) {
        return 'أكمل الفراغ في كل عبارة من العبارات التالية :-';
      }

      if (
        typeVal ===
        'essay'
      ) {
        return 'أجب عن الأسئلة المقالية التالية :-';
      }

      return 'أجب عن العبارات التالية :-';
    };

  // =========================================================
  // HANDLE EXIT EXAM
  // =========================================================
  const handleExitExam = () => {
    if (submitting) return;

    const confirmed = window.confirm(
      'هل أنت متأكد من الخروج من الامتحان؟\\n\\nإذا خرجت قبل التسليم، قد تبقى إجاباتك المحفوظة محليًا.'
    );

    if (!confirmed) return;

    // إيقاف الكاميرا/الميكروفون إن كانا يعملان.
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.warn('Exit media cleanup warning:', error);
    }

    setMonitoringActive(false);
    setShowSubmitModal(false);

    if (typeof onLogout === 'function') {
      onLogout();
      return;
    }

    // احتياط إذا لم يتم تمرير onLogout من الصفحة الأب.
    try {
      window.history.back();
    } catch {
      window.location.href = '/';
    }
  };

  // =========================================================
  // HANDLE SUBMIT EXAM
  // =========================================================

  const handleSubmitExam =
    async (
      automatic = false
    ) => {
      if (
        submitting ||
        isSubmitted
      ) {
        return;
      }

      if (
        !supabase ||
        typeof supabase.from !== 'function'
      ) {
        showMessage(
          'تعذر الاتصال بخدمة حفظ الامتحان. حاول مرة أخرى.'
        );

        submissionStartedRef.current = false;
        return;
      }

      if (
        !examData ||
        !examData.id
      ) {
        showMessage(
          'بيانات الامتحان غير موجودة.'
        );

        submissionStartedRef.current =
          false;

        return;
      }

      if (!seatingNumber) {
        showMessage(
          'رقم الجلوس غير موجود.'
        );

        submissionStartedRef.current =
          false;

        return;
      }

      // لا يمكن التسليم اليدوي أو تنفيذ التسليم التلقائي قبل بداية الامتحان.
      const submitStartTime = getExamStartTime(examData);
      if (submitStartTime && Date.now() < submitStartTime.getTime()) {
        submissionStartedRef.current = false;
        showMessage('لم يبدأ الامتحان بعد. التحقق متاح فقط حتى موعد البداية.');
        return;
      }

      setSubmitting(
        true
      );

      try {
        const currentExamId =
          String(
            examData.id
          );

        const {
          data: existingSubmission,
          error:
            existingSubmissionError
        } = await supabase
          .from('submissions')
          .select(
            'id, seating_number, exam_id, submitted_at'
          )
          .eq(
            'seating_number',
            seatingNumber
          )
          .eq(
            'exam_id',
            currentExamId
          )
          .maybeSingle();

        if (
          existingSubmissionError
        ) {
          console.warn(
            'Submission check warning:',
            existingSubmissionError
          );
        }

        if (
          existingSubmission &&
          existingSubmission.submitted_at
        ) {
          setIsSubmitted(
            true
          );

          localStorage.setItem(
            submittedStorageKey,
            'true'
          );

          showMessage(
            'تم تسجيل هذا الامتحان مسبقًا.',
            'success'
          );

          return;
        }

        // إذا لم يوجد سجل، ننشئ جلسة امتحان غير مُسلّمة.
        // هذا السجل هو المصدر الذي تعتمد عليه لوحة الإحصائيات لمعرفة
        // من دخل الامتحان ولم يسلّمه بعد.
        if (!existingSubmission) {
          const startPayload = {
            seating_number: seatingNumber,
            exam_id: currentExamId,
            submitted_at: null,
            subject_name:
              subjectName ||
              examData?.subject_name ||
              examData?.subjectName ||
              examData?.subject ||
              examData?.title ||
              null
          };

          if (resolvedStudent?.id != null) {
            startPayload.student_id = resolvedStudent.id;
          }

          const { error: startError } = await supabase
            .from('submissions')
            .insert(startPayload);

          if (startError) {
            // لا نمنع الطالب من دخول الامتحان إذا كانت صلاحيات/بنية
            // جدول submissions تمنع إنشاء جلسة البداية.
            console.warn(
              'Exam session start could not be recorded:',
              startError
            );
          }
        }

        let calculatedScore = 0;
        let totalMaxMarks = 0;

        const normalizeValue = value =>
          String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

        const getQuestionMark = q => {
          const value = Number(q?.marks ?? q?.mark ?? q?.points ?? q?.custom_mark ?? 1);
          return Number.isFinite(value) ? value : 1;
        };

        // مهم: أسئلة الاختيار من متعدد في بنك الأسئلة تحفظ correct_answer
        // كرقم الخيار (0/1/2/3)، بينما شاشة الامتحان تحفظ إجابة الطالب كنص
        // الخيار نفسه. لذلك المقارنة النصية المباشرة كانت تجعل علامة الإنجليزي = 0.
        const getOptionTextForGrading = option => {
          if (typeof option === 'string') return option;
          if (option && typeof option === 'object') {
            return option.text ?? option.option_text ?? option.label ?? option.value ?? '';
          }
          return '';
        };

        const answersEqualForGrading = (question, studentAnswer, correctAnswer) => {
          const student = normalizeValue(studentAnswer);
          const correct = normalizeValue(correctAnswer);
          if (!student || !correct) return false;

          // إذا كانت الإجابة الصحيحة رقم الخيار: 0=A، 1=B، 2=C، 3=D.
          if (/^[0-3]$/.test(correct) && Array.isArray(question?.options)) {
            const optionText = normalizeValue(getOptionTextForGrading(question.options[Number(correct)]));
            if (optionText && student === optionText) return true;
          }

          // دعم تخزين الإجابة الصحيحة بالحروف A/B/C/D أو أ/ب/ج/د.
          const letterMap = { a: 0, b: 1, c: 2, d: 3, 'أ': 0, 'ب': 1, 'ج': 2, 'د': 3 };
          if (Object.prototype.hasOwnProperty.call(letterMap, correct) && Array.isArray(question?.options)) {
            const optionText = normalizeValue(getOptionTextForGrading(question.options[letterMap[correct]]));
            if (optionText && student === optionText) return true;
          }

          // دعم أن تكون الإجابة الصحيحة محفوظة كنص الخيار نفسه.
          if (student === correct) return true;

          // وأخيراً دعم حالة أن الطالب/النظام يحفظ حرف الخيار أو رقمه كإجابة.
          if (Array.isArray(question?.options)) {
            const index = question.options.findIndex(option => normalizeValue(getOptionTextForGrading(option)) === student);
            if (index >= 0 && (correct === String(index) || correct === String.fromCharCode(65 + index).toLowerCase())) return true;
          }

          return false;
        };

        const getQuestionObtainedMark = q => {
          const studentAnswer = answers[String(q.id)];
          const correctAnswer =
            q.correct_answer ??
            q.answer ??
            q.right_answer;

          if (
            studentAnswer === undefined ||
            studentAnswer === null ||
            correctAnswer === undefined ||
            correctAnswer === null
          ) {
            return 0;
          }

          return answersEqualForGrading(q, studentAnswer, correctAnswer)
            ? getQuestionMark(q)
            : 0;
        };

        const structure = parseExamStructure(examData?.exam_structure);

        if (structure.length > 0) {
          structure.forEach((section, sectionIndex) => {
            const isOptionalSection =
              String(section?.name || '').includes('القسم الاختياري') ||
              String(section?.name || '').toLowerCase().includes('optional');

            if (isOptionalSection && Array.isArray(section?.subQuestions)) {
              const branchResults = section.subQuestions.map((_, branchIndex) => {
                const branchQuestions = questions.filter(
                  q =>
                    Number(q?.section_index) === Number(sectionIndex) &&
                    Number(q?.optional_branch_index) === Number(branchIndex)
                );

                const branchMax = branchQuestions.reduce(
                  (sum, q) => sum + getQuestionMark(q),
                  0
                );

                const branchScore = branchQuestions.reduce(
                  (sum, q) => sum + getQuestionObtainedMark(q),
                  0
                );

                return {
                  branchMax,
                  branchScore
                };
              });

              // الفرع الذي حصل الطالب فيه على العلامة الأعلى هو المعتمد.
              const bestBranch = branchResults.reduce(
                (best, current) =>
                  current.branchScore > best.branchScore ? current : best,
                { branchMax: 0, branchScore: 0 }
              );

              totalMaxMarks += bestBranch.branchMax;
              calculatedScore += bestBranch.branchScore;
            } else {
              const sectionQuestions = questions.filter(
                q =>
                  Number(q?.section_index) === Number(sectionIndex) &&
                  (q?.optional_branch_index === null ||
                   q?.optional_branch_index === undefined)
              );

              totalMaxMarks += sectionQuestions.reduce(
                (sum, q) => sum + getQuestionMark(q),
                0
              );

              calculatedScore += sectionQuestions.reduce(
                (sum, q) => sum + getQuestionObtainedMark(q),
                0
              );
            }
          });
        } else {
          totalMaxMarks = questions.reduce(
            (sum, q) => sum + getQuestionMark(q),
            0
          );

          calculatedScore = questions.reduce(
            (sum, q) => sum + getQuestionObtainedMark(q),
            0
          );
        }

        const baseOptionalMax = structure.reduce((sum, section) => {
          const name = String(section?.name || '');
          const isOptional = name.includes('القسم الاختياري') || name.toLowerCase().includes('optional');
          if (!isOptional) return sum;
          return sum + Math.max(
            0,
            ...(section?.subQuestions || []).map(branch =>
              (branch?.types || []).reduce((t, type) => t + getTypeGroupMark(type), 0)
            )
          );
        }, 0);

        const basicAndOptionalMax = structure.reduce((sum, section) => {
          const name = String(section?.name || '');
          const isAdditional = name.includes('الإضافي') || name.toLowerCase().includes('additional');
          const isOptional = name.includes('الاختياري') || name.toLowerCase().includes('optional');
          if (isAdditional) return sum;
          if (isOptional && Array.isArray(section?.subQuestions)) {
            return sum + Math.max(
              0,
              ...(section.subQuestions || []).map(branch =>
                (branch?.types || []).reduce((t, type) => t + getTypeGroupMark(type), 0)
              )
            );
          }
          return sum + (section?.types || []).reduce((t, type) => t + getTypeGroupMark(type), 0);
        }, 0);

        // الدرجة النهائية الأساسية = الأساسي + أعلى فرع اختياري.
        // القسم الإضافي يعوض النقص فقط، ولا يسمح بتجاوز السقف النهائي للامتحان.
        const examConfiguredTotal = Number(
          examData.total_mark ?? examData.total_marks ?? examData.max_marks ?? 100
        );
        const examTotal = Number.isFinite(examConfiguredTotal) && examConfiguredTotal > 0
          ? examConfiguredTotal
          : Math.max(100, basicAndOptionalMax);

        let basicScore = 0;
        let optionalScore = 0;
        let additionalScore = 0;

        structure.forEach((section, sectionIndex) => {
          const name = String(section?.name || '');
          const isOptional = name.includes('الاختياري') || name.toLowerCase().includes('optional');
          const isAdditional = name.includes('الإضافي') || name.toLowerCase().includes('additional');

          if (isOptional) {
            const branchScores = (section?.subQuestions || []).map((_, branchIndex) =>
              questions
                .filter(q => Number(q?.section_index) === Number(sectionIndex) && Number(q?.optional_branch_index) === Number(branchIndex))
                .reduce((sum, q) => sum + getQuestionObtainedMark(q), 0)
            );
            optionalScore += Math.max(0, ...branchScores);
          } else {
            const sectionScore = questions
              .filter(q => Number(q?.section_index) === Number(sectionIndex))
              .reduce((sum, q) => sum + getQuestionObtainedMark(q), 0);
            if (isAdditional) additionalScore += sectionScore;
            else basicScore += sectionScore;
          }
        });

        const basicOptionalScore = basicScore + optionalScore;
        const missingFromExam = Math.max(0, examTotal - basicOptionalScore);
        const allowedAdditionalScore = Math.min(additionalScore, missingFromExam);
        const finalScore = Math.min(
          examTotal,
          basicOptionalScore + allowedAdditionalScore
        );

        calculatedScore = finalScore;
        totalMaxMarks = examTotal;

        const safeTotalMarks = examTotal;
        const percentage = safeTotalMarks > 0
          ? (finalScore / safeTotalMarks) * 100
          : 0;

        const finalSubjectName =
          subjectName ||
          examData.subject_name ||
          examData.subjectName ||
          examData.subject ||
          examData.title ||
          null;

        // أي حالة غش معلّقة تمنع اعتماد العلامة حتى يقرر المراقب.
        let hasPendingCheating = false;
        if (resolvedStudent?.id != null && currentExamId != null) {
          const { data: pendingCheatingCases, error: cheatingLookupError } = await supabase
            .from('cheating_cases')
            .select('id')
            .eq('student_id', resolvedStudent.id)
            .eq('exam_id', currentExamId)
            .eq('case_status', 'pending');

          if (cheatingLookupError) {
            console.warn('تعذر التحقق من حالة الغش قبل اعتماد العلامة:', cheatingLookupError);
          } else {
            hasPendingCheating = (pendingCheatingCases || []).length > 0;
          }
        }

        const submissionPayload =
          {
            seating_number:
              seatingNumber,

            exam_id:
              currentExamId,


            submitted_at:
              new Date().toISOString(),

            total_score:
              calculatedScore,

            answers:
              answers,

            subject_name:
              finalSubjectName,

            obtained_marks:
              Math.round(
                calculatedScore
              ),

            total_marks:
              Math.round(
                safeTotalMarks
              ),

            percentage:
              Number(
                percentage.toFixed(
                  2
                )
              ),

            base_score:
              calculatedScore,

            elective_q1:
              0,

            elective_q2:
              0,

            bonus_score:
              0,

            final_score:
              calculatedScore,

            // العلامة الأصلية تُحفظ، لكن لا تُعرض كعلامة معتمدة إذا كانت هناك حالة غش معلّقة.
            is_score_released:
              !hasPendingCheating
          };

        let saveError = null;

        if (existingSubmission?.id) {
          const { error: updateError } = await supabase
            .from('submissions')
            .update(submissionPayload)
            .eq('id', existingSubmission.id);

          saveError = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('submissions')
            .insert(submissionPayload);

          saveError = insertError;
        }

        if (
          saveError
        ) {
          if (
            saveError.code ===
            '23505'
          ) {
            setIsSubmitted(
              true
            );

            localStorage.setItem(
              submittedStorageKey,
              'true'
            );

            showMessage(
              'تم تسجيل الامتحان مسبقًا.',
              'success'
            );

            return;
          }

          throw saveError;
        }

        setIsSubmitted(
          true
        );

        localStorage.setItem(
          submittedStorageKey,
          'true'
        );

        localStorage.removeItem(
          answersStorageKey
        );

        localStorage.removeItem(
          endTimeStorageKey
        );

        endTimestampRef.current =
          null;

        setShowSubmitModal(
          false
        );

        setMessageType(
          'success'
        );

        setMessage(
          automatic
            ? 'انتهى وقت الامتحان وتم تسليم إجاباتك تلقائيًا. سيتم إعلان النتائج في الموعد المحدد من قبل الإدارة.'
            : 'تم تسليم امتحانك بنجاح، وتم حفظ إجاباتك. سيتم إعلان النتائج في الموعد المحدد من قبل الإدارة.'
        );

      } catch (
        error
      ) {
        console.error(
          'Submit exam error:',
          error
        );

        setMessageType(
          'error'
        );

        setMessage(
          error?.message ||
          'حدث خطأ أثناء تسليم الامتحان.'
        );

        submissionStartedRef.current =
          false;

      } finally {
        setSubmitting(
          false
        );
      }
    };

  submitExamRef.current =
    handleSubmitExam;

  const confirmManualSubmit =
    () => {
      if (
        submitting ||
        isSubmitted
      ) {
        return;
      }

      setShowSubmitModal(
        true
      );
    };

  const goToQuestion =
    (index) => {
      if (
        index < 0 ||
        index >=
          questions.length
      ) {
        return;
      }

      setCurrentQuestion(
        index
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

  const examStartForRender = getExamStartTime(examData);
  const examEndForRender = getExamEndTime(examData);
  const nowForRender = Date.now();
  const isVerificationPhase =
    !!examStartForRender &&
    nowForRender >= examStartForRender.getTime() - 10 * 60 * 1000 &&
    nowForRender < examStartForRender.getTime();
  const isExamPhase =
    !!examStartForRender &&
    !!examEndForRender &&
    nowForRender >= examStartForRender.getTime() &&
    nowForRender < examEndForRender.getTime();

  const question =
    questions[
      currentQuestion
    ];

  // =========================================================
  // RENDER QUESTION
  // =========================================================

  const renderQuestion =
    () => {
      if (!question) {
        return (
          <div
            style={{
              padding: '30px',
              textAlign:
                'center',
              color: '#94a3b8'
            }}
          >
            لا توجد أسئلة للعرض.
          </div>
        );
      }

      const questionType =
        getQuestionType(
          question
        );

      const questionText =
        getQuestionText(
          question
        );

      const options =
        getOptions(
          question
        );

      const answer =
        getAnswerValue(
          question.id
        );

      const isReview =
        reviewQuestions.includes(
          String(
            question.id
          )
        );

      return (
        <div
          style={{
            backgroundColor:
              '#1e293b',
            border:
              '1px solid #334155',
            borderRadius:
              '12px',
            padding: '25px',
            direction:
              'rtl'
          }}
        >
          {question.section_title && (
            <div
              style={{
                backgroundColor:
                  '#334155',
                color:
                  '#38bdf8',
                padding:
                  '8px 12px',
                borderRadius:
                  '6px',
                marginBottom:
                  '15px',
                fontWeight:
                  'bold',
                fontSize:
                  '15px'
              }}
            >
              القسم:{' '}
              {question.section_title}
              {Number.isFinite(Number(sectionMarks?.[Number(question.section_index)])) ? (
                <span style={{ marginRight: '10px', color: '#facc15' }}>
                  (علامة القسم: {sectionMarks[Number(question.section_index)]})
                </span>
              ) : null}
            </div>
          )}

          <div
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              gap: '10px',
              marginBottom:
                '20px',
              flexWrap:
                'wrap'
            }}
          >
            <div
              style={{
                color:
                  '#facc15',
                fontWeight:
                  'bold',
                fontSize:
                  '17px'
              }}
            >
              {/* الترقيم بالأرقام العربية قبل صيغة السؤال */}
              {getArabicOrdinalQuestionNumber(currentQuestion + 1)}{' '}
              - {getQuestionTypeHeaderTitle(questionType)}{' '}
              
              {/* العلامة فقط — لا نعرض questions.length على أنه عدد الفروع */}
              {question.logical_question_mark ? (
                <span style={{ color: '#38bdf8', marginRight: '8px' }}>
                  (العلامة: {question.logical_question_mark})
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() =>
                toggleReview(
                  question.id
                )
              }
              style={{
                border:
                  '1px solid #f59e0b',
                backgroundColor:
                  isReview
                    ? '#92400e'
                    : '#0f172a',
                color:
                  '#fbbf24',
                padding:
                  '8px 14px',
                borderRadius:
                  '6px',
                cursor:
                  'pointer',
                fontWeight:
                  'bold'
              }}
            >
              {isReview
                ? '★ تمت المراجعة'
                : '☆ وضع علامة للمراجعة'}
            </button>
          </div>

          <div
            style={{
              backgroundColor:
                '#0f172a',
              border:
                '1px solid #334155',
              borderRadius:
                '8px',
              padding:
                '20px',
              marginBottom:
                '20px',
              color:
                '#e2e8f0',
              fontSize:
                '18px',
              lineHeight:
                '1.8',
              whiteSpace:
                'pre-wrap'
            }}
          >
            {(
              questionType === 'completion' ||
              questionType === 'complete' ||
              questionType === 'fill_in_blank'
            )
              ? renderCompletionQuestionText(questionText)
              : questionText}
          </div>

          {/* TRUE / FALSE */}

          {(
            questionType ===
              'true_false' ||
            questionType ===
              'true-false' ||
            questionType ===
              'boolean'
          ) && (
            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '15px'
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    question.id,
                    'true'
                  )
                }
                style={{
                  padding:
                    '18px',
                  border:
                    answer ===
                    'true'
                      ? '3px solid #3b82f6'
                      : '1px solid #334155',
                  backgroundColor:
                    answer ===
                    'true'
                      ? '#1e3a5f'
                      : '#0f172a',
                  color:
                    '#f8fafc',
                  borderRadius:
                    '8px',
                  cursor:
                    'pointer',
                  fontWeight:
                    'bold',
                  fontSize:
                    '17px'
                }}
              >
                ✓ صح
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    question.id,
                    'false'
                  )
                }
                style={{
                  padding:
                    '18px',
                  border:
                    answer ===
                    'false'
                      ? '3px solid #3b82f6'
                      : '1px solid #334155',
                  backgroundColor:
                    answer ===
                    'false'
                      ? '#1e3a5f'
                      : '#0f172a',
                  color:
                    '#f8fafc',
                  borderRadius:
                    '8px',
                  cursor:
                    'pointer',
                  fontWeight:
                    'bold',
                  fontSize:
                    '17px'
                }}
              >
                ✕ خطأ
              </button>
            </div>
          )}

          {/* MULTIPLE CHOICE */}

          {(
            questionType ===
              'multiple_choice' ||
            questionType ===
              'mcq'
          ) && (
            <div
              style={{
                display:
                  'flex',
                flexDirection:
                  'column',
                gap: '10px'
              }}
            >
              {options.map(
                (
                  option,
                  index
                ) => {
                  const value =
                    getOptionText(
                      option
                    );

                  const optionId =
                    `${question.id}_${index}`;

                  const selected =
                    String(
                      answer
                    ) ===
                    String(
                      value
                    );

                  return (
                    <label
                      key={
                        optionId
                      }
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: '12px',
                        padding:
                          '14px',
                        backgroundColor:
                          selected
                            ? '#1e3a5f'
                            : '#0f172a',
                        border:
                          selected
                            ? '2px solid #3b82f6'
                            : '1px solid #334155',
                        borderRadius:
                          '8px',
                        cursor:
                          'pointer',
                        color:
                          '#f8fafc',
                        fontSize:
                          '16px'
                      }}
                    >
                      <input
                        type="radio"
                        name={`question_${question.id}`}
                        value={
                          value
                        }
                        checked={
                          selected
                        }
                        onChange={() =>
                          setAnswer(
                            question.id,
                            value
                          )
                        }
                      />

                      <span
                        style={{
                          direction:
                            'ltr',
                          minWidth:
                            '25px',
                          fontWeight:
                            'bold',
                          color:
                            '#38bdf8'
                        }}
                      >
                        {String.fromCharCode(
                          65 +
                            index
                        )}
                      </span>

                      <span>
                        {
                          value
                        }
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          )}

          {/* COMPLETION */}

          {(
            questionType ===
              'completion' ||
            questionType ===
              'complete' ||
            questionType ===
              'fill_in_blank'
          ) && (
            <textarea
              value={
                answer || ''
              }
              onChange={(e) =>
                setAnswer(
                  question.id,
                  e.target.value
                )
              }
              placeholder="اكتب إجابتك هنا..."
              rows={5}
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                backgroundColor:
                  '#0f172a',
                color:
                  '#fff',
                border:
                  '2px solid #334155',
                borderRadius:
                  '8px',
                padding:
                  '14px',
                fontSize:
                  '17px',
                resize:
                  'vertical',
                direction:
                  'rtl',
                outline:
                  'none'
              }}
            />
          )}

          {/* ESSAY */}

          {questionType ===
            'essay' && (
            <textarea
              value={
                answer || ''
              }
              onChange={(e) =>
                setAnswer(
                  question.id,
                  e.target.value
                )
              }
              placeholder="اكتب إجابتك هنا..."
              rows={10}
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                backgroundColor:
                  '#0f172a',
                color:
                  '#fff',
                border:
                  '2px solid #334155',
                borderRadius:
                  '8px',
                padding:
                  '14px',
                fontSize:
                  '17px',
                resize:
                  'vertical',
                direction:
                  'rtl',
                lineHeight:
                  '1.8',
                outline:
                  'none'
              }}
            />
          )}
        </div>
      );
    };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div
        style={{
          minHeight:
            '100vh',
          backgroundColor:
            '#0f172a',
          display:
            'flex',
          justifyContent:
            'center',
          alignItems:
            'center',
          color:
            '#60a5fa',
          fontSize:
            '20px',
          fontWeight:
            'bold',
          direction:
            'rtl'
        }}
      >
        جاري تحميل الامتحان...
      </div>
    );
  }

  // =========================================================
  // SUBMITTED
  // =========================================================

  if (isSubmitted) {
    return (
      <div
        style={{
          minHeight:
            '100vh',
          backgroundColor:
            '#0f172a',
          display:
            'flex',
          justifyContent:
            'center',
          alignItems:
            'center',
          padding:
            '20px',
          direction:
            'rtl'
        }}
      >
        <div
          style={{
            width:
              '100%',
            maxWidth:
              '550px',
            backgroundColor:
              '#1e293b',
            border:
              '1px solid #10b981',
            borderRadius:
              '15px',
            padding:
              '40px',
            textAlign:
              'center'
          }}
        >
          <img
            src={successImage}
            alt="تم تسليم الامتحان بنجاح"
            style={{
              width:
                '180px',
              maxWidth:
                '70%',
              height:
                'auto',
              objectFit:
                'contain',
              display:
                'block',
              margin:
                '0 auto 20px'
            }}
          />

          <h2
            style={{
              color:
                '#34d399',
              marginBottom:
                '15px'
            }}
          >
            تم تسليم الامتحان
          </h2>

          <p
            style={{
              color:
                '#cbd5e1',
              lineHeight:
                '1.8'
            }}
          >
            تم تسليم الامتحان بنجاح وحفظ إجاباتك. ✅
            <br />
            سيتم إعلان النتائج في الموعد
            المحدد من قبل الإدارة.
            <br />
            لا يمكن تقديم هذا الامتحان مرة أخرى.
          </p>

          {onLogout && (
            <button
              onClick={
                onLogout
              }
              style={{
                marginTop:
                  '20px',
                padding:
                  '12px 25px',
                backgroundColor:
                  '#2563eb',
                color:
                  '#fff',
                border:
                  'none',
                borderRadius:
                  '7px',
                cursor:
                  'pointer',
                fontWeight:
                  'bold'
              }}
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN
  // =========================================================

  return (
    <div
      style={{
        minHeight:
          '100vh',
        backgroundColor:
          '#0f172a',
        color:
          '#fff',
        direction:
          'rtl',
        fontFamily:
          'Arial, sans-serif'
      }}
    >
      <ExamHeader
        student={resolvedStudent}
        studentName={
          studentName
        }
        seatingNumber={
          seatingNumber
        }
        currentExam={
          examData
        }
        examTitle={
          examData?.title ||
          subjectName ||
          examData?.subject_name ||
          'الامتحان'
        }
        subjectName={
          subjectName
        }
        sectionsCount={
          examSectionsCount
        }
        questionsCount={
          logicalQuestionCount
        }
        answeredCount={
          answeredCount
        }
        unansweredCount={
          unansweredCount
        }
        reviewCount={
          new Set(
            questions
              .filter(q => reviewQuestions.includes(String(q.id)))
              .map(q => `${q.section_index}__${q.optional_branch_index ?? 'normal'}__${q.type_index}`)
          ).size
        }
        warnings={
          warnings
        }
        MAX_WARNINGS={
          MAX_WARNINGS
        }
        handleLogout={
          handleExitExam
        }
        timeLeft={
          timeLeft
        }
        supabase={supabase}
      />

      <main
        style={{
          maxWidth:
            '1200px',
          margin:
            '0 auto',
          padding:
            '20px'
        }}
      >
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
              padding:
                '14px',
              borderRadius:
                '8px',
              marginBottom:
                '15px',
              textAlign:
                'center',
              fontWeight:
                'bold'
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            backgroundColor:
              '#1e293b',
            border:
              '1px solid #334155',
            borderRadius:
              '8px',
            padding:
              '10px 15px',
            marginBottom:
              '15px',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap:
              '10px'
          }}
        >
          <span
            style={{
              color:
                monitoringActive
                  ? '#34d399'
                  : '#fbbf24',
              fontWeight:
                'bold'
            }}
          >
            {monitoringActive
              ? '● المراقبة مفعلة'
              : '● المراقبة غير متاحة'}
          </span>

          <span
            style={{
              color:
                '#94a3b8',
              fontSize:
                '13px'
            }}
          >
            التحذيرات:{' '}

            <strong
              style={{
                color:
                  '#fbbf24',
                direction:
                  'ltr',
                display:
                  'inline-block'
              }}
            >
              {warnings}
              /
              {MAX_WARNINGS}
            </strong>
          </span>
        </div>

        <video
          ref={
            videoRef
          }
          autoPlay
          muted
          playsInline
          style={{
            position:
              'fixed',
            width:
              '1px',
            height:
              '1px',
            opacity:
              0,
            pointerEvents:
              'none'
          }}
        />

        {isVerificationPhase ? (
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '2px solid #f59e0b',
              borderRadius: '14px',
              padding: '45px 30px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(245,158,11,0.12)'
            }}
          >
            <div style={{ fontSize: '58px', marginBottom: '15px' }}>🔐</div>
            <h2 style={{ color: '#facc15', marginBottom: '15px' }}>
              التحقق قبل بدء الامتحان
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '17px', lineHeight: '1.9' }}>
              تم فتح البرنامج للتحقق من هوية الطالب فقط.
              <br />
              الأسئلة وعداد الامتحان لن يبدآ قبل الموعد المحدد.
            </p>
            <div style={{
              margin: '25px auto 10px',
              padding: '16px 24px',
              maxWidth: '360px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '10px',
              color: '#38bdf8',
              fontSize: '28px',
              fontWeight: 'bold',
              direction: 'ltr'
            }}>
              {Math.floor(timeToStart / 60).toString().padStart(2, '0')}:
              {(timeToStart % 60).toString().padStart(2, '0')}
            </div>
            <div style={{ color: '#94a3b8', marginTop: '8px' }}>الوقت المتبقي حتى بداية الامتحان</div>
          </div>
        ) : isExamPhase ? (
          questions.length > 0 ? (
            renderQuestion()
          ) : (
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '30px',
                textAlign: 'center',
                color: '#f87171'
              }}
            >
              لا توجد أسئلة مرتبطة بهذا الامتحان.
            </div>
          )
        ) : (
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #ef4444',
            borderRadius: '10px',
            padding: '30px',
            textAlign: 'center',
            color: '#f87171'
          }}>
            انتهى وقت الامتحان أو لم يعد متاحًا.
          </div>
        )}

        {isExamPhase && questions.length >
          0 && (
          <>
            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                gap:
                  '10px',
                marginTop:
                  '20px'
              }}
            >
              <button
                type="button"
                disabled={
                  currentQuestion ===
                  0
                }
                onClick={() =>
                  goToQuestion(
                    currentQuestion -
                      1
                  )
                }
                style={{
                  padding:
                    '12px 22px',
                  backgroundColor:
                    currentQuestion ===
                    0
                      ? '#334155'
                      : '#2563eb',
                  color:
                    '#fff',
                  border:
                    'none',
                  borderRadius:
                    '7px',
                  cursor:
                    currentQuestion ===
                    0
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight:
                    'bold'
                }}
              >
                ← السؤال السابق
              </button>

              {currentQuestion <
              questions.length -
                1 ? (
                <button
                  type="button"
                  onClick={() =>
                    goToQuestion(
                      currentQuestion +
                        1
                    )
                  }
                  style={{
                    padding:
                      '12px 22px',
                    backgroundColor:
                      '#2563eb',
                    color:
                      '#fff',
                    border:
                      'none',
                    borderRadius:
                      '7px',
                    cursor:
                      'pointer',
                    fontWeight:
                      'bold'
                  }}
                >
                  السؤال التالي →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    confirmManualSubmit
                  }
                  disabled={
                    submitting
                  }
                  style={{
                    padding:
                      '12px 25px',
                    backgroundColor:
                      '#10b981',
                    color:
                      '#fff',
                    border:
                      'none',
                    borderRadius:
                      '7px',
                    cursor:
                      submitting
                        ? 'not-allowed'
                        : 'pointer',
                    fontWeight:
                      'bold'
                  }}
                >
                  {submitting
                    ? 'جاري التسليم...'
                    : 'تسليم الامتحان ✓'}
                </button>
              )}
            </div>

            <div
              style={{
                marginTop:
                  '25px',
                backgroundColor:
                  '#1e293b',
                border:
                  '1px solid #334155',
                borderRadius:
                  '10px',
                padding:
                  '15px'
              }}
            >
              <h3
                style={{
                  color:
                    '#60a5fa',
                  marginTop:
                    0,
                  fontSize:
                    '16px'
                }}
              >
                قائمة الأسئلة
              </h3>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(50px, 1fr))',
                  gap:
                    '8px'
                }}
              >
                {questions.map(
                  (
                    q,
                    index
                  ) => {
                    const answered =
                      isAnswered(
                        q
                      );

                    const review =
                      reviewQuestions.includes(
                        String(
                          q.id
                        )
                      );

                    return (
                      <button
                        key={
                          q.id ||
                          index
                        }
                        type="button"
                        onClick={() =>
                          goToQuestion(
                            index
                          )
                        }
                        style={{
                          padding:
                            '10px',
                          border:
                            review
                              ? '2px solid #f59e0b'
                              : index ===
                                currentQuestion
                              ? '2px solid #60a5fa'
                              : '1px solid #334155',
                          backgroundColor:
                            answered
                              ? '#064e3b'
                              : '#0f172a',
                          color:
                            answered
                              ? '#34d399'
                              : '#cbd5e1',
                          borderRadius:
                            '6px',
                          cursor:
                            'pointer',
                          fontWeight:
                            'bold',
                          direction:
                            'ltr'
                        }}
                      >
                        {index +
                          1}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </>
        )}

        {isExamPhase && questions.length >
          0 && (
          <div
            style={{
              marginTop:
                '25px',
              textAlign:
                'center'
            }}
          >
            <button
              type="button"
              onClick={
                confirmManualSubmit
              }
              disabled={
                submitting
              }
              style={{
                padding:
                  '14px 35px',
                backgroundColor:
                  '#10b981',
                color:
                  '#fff',
                border:
                  'none',
                borderRadius:
                  '8px',
                cursor:
                  submitting
                    ? 'not-allowed'
                    : 'pointer',
                fontSize:
                  '17px',
                fontWeight:
                  'bold'
              }}
            >
              {submitting
                ? 'جاري تسليم الامتحان...'
                : 'تسليم الامتحان ✓'}
            </button>
          </div>
        )}
      </main>

      {showWarning && (
        <div
          style={{
            position:
              'fixed',
            inset:
              0,
            backgroundColor:
              'rgba(0,0,0,0.75)',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex:
              9998,
            padding:
              '20px'
          }}
        >
          <div
            style={{
              width:
                '100%',
              maxWidth:
                '450px',
              backgroundColor:
                '#1e293b',
              border:
                '2px solid #f59e0b',
              borderRadius:
                '12px',
              padding:
                '30px',
              textAlign:
                'center',
              direction:
                'rtl'
            }}
          >
            <div
              style={{
                fontSize:
                  '45px'
              }}
            >
              ⚠️
            </div>

            <h3
              style={{
                color:
                  '#fbbf24'
              }}
            >
              تحذير
            </h3>

            <p
              style={{
                color:
                  '#fff',
                lineHeight:
                  '1.8'
              }}
            >
              {warningText}
            </p>

            <button
              type="button"
              onClick={() =>
                setShowWarning(
                  false
                )
              }
              style={{
                backgroundColor:
                  '#f59e0b',
                color:
                  '#111827',
                border:
                  'none',
                padding:
                  '10px 25px',
                borderRadius:
                  '7px',
                cursor:
                  'pointer',
                fontWeight:
                  'bold'
              }}
            >
              فهمت
            </button>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div
          style={{
            position:
              'fixed',
            inset:
              0,
            backgroundColor:
              'rgba(0,0,0,0.75)',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex:
              9999,
            padding:
              '20px'
          }}
        >
          <div
            style={{
              width:
                '100%',
              maxWidth:
                '500px',
              backgroundColor:
                '#1e293b',
              border:
                '2px solid #3b82f6',
              borderRadius:
                '12px',
              padding:
                '30px',
              textAlign:
                'center',
              direction:
                'rtl'
            }}
          >
            <div
              style={{
                fontSize:
                  '45px'
              }}
            >
              📝
            </div>

            <h3
              style={{
                color:
                  '#60a5fa'
              }}
            >
              تأكيد تسليم الامتحان
            </h3>

            <p
              style={{
                color:
                  '#cbd5e1',
                lineHeight:
                  '1.8'
              }}
            >
              عدد الأسئلة:{' '}

              <strong
                style={{
                  direction:
                    'ltr',
                  display:
                    'inline-block'
                }}
              >
                {questions.length}
              </strong>

              <br />

              تمت الإجابة عن:{' '}

              <strong
                style={{
                  color:
                    '#34d399',
                  direction:
                    'ltr',
                  display:
                    'inline-block'
                }}
              >
                {answeredCount}
              </strong>

              <br />

              الأسئلة غير المجابة:{' '}

              <strong
                style={{
                  color:
                    unansweredCount >
                    0
                      ? '#f87171'
                      : '#34d399',
                  direction:
                    'ltr',
                  display:
                    'inline-block'
                }}
              >
                {unansweredCount}
              </strong>
            </p>

            <p
              style={{
                color:
                  '#fbbf24'
              }}
            >
              هل أنت متأكد من تسليم الامتحان؟
            </p>

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'center',
                gap:
                  '12px',
                marginTop:
                  '20px'
              }}
            >
              <button
                type="button"
                disabled={
                  submitting
                }
                onClick={() => {
                  if (
                    submitting
                  ) {
                    return;
                  }

                  if (submitting || isSubmitted) return;

                  setShowSubmitModal(false);
                  submissionStartedRef.current = true;

                  handleSubmitExam(false);
                }}
                style={{
                  backgroundColor:
                    '#10b981',
                  color:
                    '#fff',
                  border:
                    'none',
                  padding:
                    '11px 25px',
                  borderRadius:
                    '7px',
                  cursor:
                    submitting
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight:
                    'bold'
                }}
              >
                {submitting
                  ? 'جاري التسليم...'
                  : 'نعم، تسليم'}
              </button>

              <button
                type="button"
                disabled={
                  submitting
                }
                onClick={() =>
                  setShowSubmitModal(
                    false
                  )
                }
                style={{
                  backgroundColor:
                    '#64748b',
                  color:
                    '#fff',
                  border:
                    'none',
                  padding:
                    '11px 25px',
                  borderRadius:
                    '7px',
                  cursor:
                    submitting
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight:
                    'bold'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}