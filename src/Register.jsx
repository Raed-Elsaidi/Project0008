import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Tesseract from 'tesseract.js';
import ministryLogo from './logo.png';
import { generateStrongPassword, PASSWORD_POLICY_MESSAGE } from './passwordPolicy';
import { useInstitution } from './institution';
import { descriptorFromImage } from './BiometricUtils';

const toEnglishDigits = (value) =>
  String(value ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

export default function Register({ supabase, onRegisterSuccess, onBack }) {
  const institution = useInstitution(supabase);
  const [nationalId, setNationalId] = useState('');
  const [verificationReview, setVerificationReview] = useState(null);
  const [student, setStudent] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [registrationCycle, setRegistrationCycle] = useState(null);
  const [branchIdNum, setBranchIdNum] = useState(null);
  const [branchesList, setBranchesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [directoratesList, setDirectoratesList] = useState([]);
  const [schoolsList, setSchoolsList] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copiedField, setCopiedField] = useState('');

  // دالة مساعدة لتعيين رسالة مع خاصية الاختفاء التلقائي بعد ثانيتين للأخطاء
  const messageTimerRef = useRef(null);

  const showAlert = (text, type = 'error') => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage({ text, type });
    messageTimerRef.current = setTimeout(() => {
      setMessage({ text: '', type: '' });
      messageTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  // بيانات التسجيل المطلوبة من الطالب
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [lookupResultModal, setLookupResultModal] = useState(null);
  const [identityImage, setIdentityImage] = useState(null);
  const [personalImage, setPersonalImage] = useState(null);
  const [identityDocumentType, setIdentityDocumentType] = useState('id');
  const [registering, setRegistering] = useState(false);
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [faceModelsLoading, setFaceModelsLoading] = useState(true);
  const [faceModelsError, setFaceModelsError] = useState('');

  // ملفات نماذج اكتشاف الوجه توضع داخل public/models
  const FACE_MODELS_URL = '/models';

  // ملاحظة: لا تُستخدم مطابقة الوجه البيومترية لاتخاذ قرار قبول آلي.

  useEffect(() => {
    let cancelled = false;

    const loadFaceModels = async () => {
      try {
        setFaceModelsLoading(true);
        setFaceModelsError('');

        try {
          await faceapi.tf.setBackend('webgl');
        } catch (backendError) {
          console.warn('WebGL backend unavailable, using the default backend.', backendError);
        }
        await faceapi.tf.ready();

        await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);

        if (!cancelled) {
          setFaceModelsReady(true);
        }
      } catch (error) {
        console.error('Failed to load face detection model:', error);
        if (!cancelled) {
          setFaceModelsReady(false);
          setFaceModelsError(
            'تعذر تحميل نموذج فحص الوجه. تأكد من وجود ملفات TinyFaceDetector داخل public/models ثم أعد تشغيل الموقع.'
          );
        }
      } finally {
        if (!cancelled) setFaceModelsLoading(false);
      }
    };

    loadFaceModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const STUDENT_FILES_BUCKET = 'student-documents';
  const currentServerYear = new Date().getFullYear();

  const CYCLE_LABELS = {
    1: 'الأولى',
    2: 'الثانية',
    3: 'الثالثة'
  };

  // مواعيد الدورات تُقرأ مباشرة من جدول registration_cycles في Supabase.
  // لا توجد مواعيد ثابتة داخل شاشة التسجيل.
  const [cycleDates, setCycleDates] = useState({});
  const [cycleDatesLoading, setCycleDatesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCycleDates = async () => {
      try {
        setCycleDatesLoading(true);
        const { data, error } = await supabase
          .from('registration_cycles')
          .select('cycle_number, start_date, end_date')
          .in('cycle_number', [1, 2, 3])
          .order('cycle_number', { ascending: true });

        if (error) throw error;

        const mapped = {};
        (data || []).forEach((row) => {
          mapped[Number(row.cycle_number)] = {
            startDate: row.start_date,
            endDate: row.end_date
          };
        });

        if (!cancelled) setCycleDates(mapped);
      } catch (error) {
        console.error('Error loading registration cycle dates:', error);
        if (!cancelled) setCycleDates({});
      } finally {
        if (!cancelled) setCycleDatesLoading(false);
      }
    };

    loadCycleDates();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const parseDateOnly = (value, endOfDay = false) => {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  };

  const isCycleOpen = (cycle, date = new Date()) => {
    const info = cycleDates[cycle];
    if (!info?.startDate || !info?.endDate) return false;
    const start = parseDateOnly(info.startDate);
    const end = parseDateOnly(info.endDate, true);
    if (!start || !end) return false;
    return date >= start && date <= end;
  };

  const formatCycleDate = (value) => {
    if (!value) return '';
    const [year, month, day] = String(value).split('-');
    if (!year || !month || !day) return String(value);
    return `${day}/${month}/${year}`;
  };

  const getCycleLabel = (cycle) => CYCLE_LABELS[cycle] || '';

  const getCycleDateText = (cycle) => {
    const info = cycleDates[cycle];
    if (!info?.startDate || !info?.endDate) return 'الموعد غير محدد';
    return `${formatCycleDate(info.startDate)} – ${formatCycleDate(info.endDate)}`;
  };

  const getDirectorateCode = (name) => {
    const value = String(name || '').trim().replace(/أ|إ|آ/g, 'ا');
    if (value.includes('شمال غزة')) return '01';
    if (value.includes('شرق غزة')) return '02';
    if (value.includes('غرب غزة')) return '03';
    if (value.includes('الوسطى') || value.includes('وسطى')) return '04';
    if (value.includes('شرق خانيونس') || value.includes('شرق خان يونس')) return '05';
    if (value.includes('غرب خانيونس') || value.includes('غرب خان يونس')) return '06';
    if (value.includes('رفح')) return '07';
    return '';
  };

  // رقم الفرع يؤخذ مباشرة من جدول branches.branch_number.
  // لا يوجد أي ترميز ثابت لأسماء الفروع داخل ملف التسجيل.
  const getBranchCodeFromDatabase = async () => {
    let branchData = null;
    let branchError = null;

    if (branchIdNum) {
      const result = await supabase
        .from('branches')
        .select('id, branch_name, branch_number')
        .eq('id', branchIdNum)
        .maybeSingle();
      branchData = result.data;
      branchError = result.error;
    }

    if (!branchData && (branchName || student?.branch || student?.branch_name)) {
      const name = branchName || student?.branch || student?.branch_name;
      const result = await supabase
        .from('branches')
        .select('id, branch_name, branch_number')
        .eq('branch_name', name)
        .maybeSingle();
      branchData = result.data;
      branchError = result.error;
    }

    if (branchError) throw branchError;
    if (!branchData) throw new Error('تعذر العثور على الفرع في قاعدة البيانات.');

    const code = Number(branchData.branch_number);
    if (!Number.isInteger(code) || code < 1 || code > 9) {
      throw new Error('رقم الفرع غير صحيح أو غير مُدخل في إدارة الفروع. يجب أن يكون من 1 إلى 9.');
    }

    return String(code);
  };

  const generateSeatNumber = async (cycle) => {
    const yearCode = String(currentServerYear).slice(-2);
    const cycleCode = String(cycle);
    const directorateCode = getDirectorateCode(student?.directorate_name);
    const branchCode = await getBranchCodeFromDatabase();

    if (!directorateCode) throw new Error('تعذر تحديد رقم المديرية. تأكد من اسم المديرية.');

    const prefix = `${yearCode}${cycleCode}${directorateCode}${branchCode}`;
    const { data, error } = await supabase
      .from('students')
      .select('seating_number')
      .like('seating_number', `${prefix}%`)
      .order('seating_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextSequence = 1;
    const last = data?.[0]?.seating_number;
    if (last && String(last).length === 10 && String(last).startsWith(prefix)) {
      const lastSequence = Number(String(last).slice(-4));
      if (Number.isInteger(lastSequence) && lastSequence >= 0 && lastSequence < 9999) {
        nextSequence = lastSequence + 1;
      }
    }

    if (nextSequence > 9999) {
      throw new Error('تم استنفاد الأرقام التسلسلية لهذا الفرع والمديرية والدورة.');
    }

    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  };

  const handleCheck = async (e) => {
    e.preventDefault();

    setMessage({ text: '', type: '' });
    setLookupResultModal(null);
    setStudent(null);
    setBranchName('');
    setBranchIdNum(null);
    setSubjectsList([]);
    setSelectedSubjectIds([]);
    setRegistrationCompleted(false);
    setDataConfirmed(false);
    setEditingStudent(false);
    setShowRegistrationModal(false);

    const enteredNationalId = toEnglishDigits(nationalId).trim();

    if (!/^\d{9}$/.test(enteredNationalId)) {
      showAlert('رقم هوية الطالب يجب أن يتكون من 9 خانات فقط.', 'error');
      return;
    }

    try {
      // 1) أولاً: البحث في جدول students.
      // نتحقق من الدورة المختارة حتى يستطيع الطالب التسجيل في دورة جديدة
      // إذا كان قد سجل في دورة سابقة.
      if (!registrationCycle || !isCycleOpen(registrationCycle)) {
        showAlert('يرجى اختيار دورة تسجيل متاحة حاليًا قبل البحث عن الطالب.', 'error');
        return;
      }

      const { data: existingCycle, error: existingCycleError } = await supabase
        .from('students')
        .select('id, national_id, seating_number, full_name_ar, academic_year, registration_cycle')
        .eq('national_id', enteredNationalId)
        .eq('academic_year', currentServerYear)
        .eq('registration_cycle', registrationCycle)
        .maybeSingle();

      if (existingCycleError) throw existingCycleError;

      if (existingCycle) {
        // مسجل مسبقاً في الدورة الحالية: لا نبحث في allow_student ولا نطلب صوراً.
        setLookupResultModal({
          type: 'registered',
          title: 'تم تسجيلك مسبقًا في النظام',
          text: `عزيزي الطالب: ${existingCycle.full_name_ar || ''}`,
          seatNumber: existingCycle.seating_number,
          password: ''
        });
        return;
      }

      // 2) إذا لم يوجد في students: البحث في allow_student.
      const { data: studentData, error: studentError } = await supabase
        .from('allow_student')
        .select('*')
        .eq('national_id', enteredNationalId)
        .maybeSingle();

      if (studentError) throw studentError;

      // 3) إذا لم يوجد في allow_student: رسالة واضحة وإغلاق النموذج عند الضغط على إغلاق.
      if (!studentData) {
        setLookupResultModal({
          type: 'not-found',
          title: 'لا يوجد لك بيانات بالنظام',
          text: 'يرجى مراجعة أقرب مديرية تربية وتعليم.'
        });
        return;
      }

      // الطالب موجود في allow_student وغير مسجل في الدورة الحالية: نكمل معه التسجيل.
      setStudent(studentData);
      setDataConfirmed(false);

      const { data: allBranches, error: allBranchesError } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });

      if (!allBranchesError) {
        setBranchesList(allBranches || []);
      } else {
        console.error('Error loading branches:', allBranchesError);
      }

      await loadDirectorates();

      let resolvedBranchId = studentData.branch_id || null;
      let resolvedBranchName =
        studentData.branch ||
        studentData.branch_name ||
        '';

      if (resolvedBranchId) {
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('*')
          .eq('id', resolvedBranchId)
          .maybeSingle();

        if (!branchError && branchData) {
          resolvedBranchName =
            branchData.branch_name ||
            branchData.name ||
            branchData.title ||
            resolvedBranchName;
        }
      } else if (resolvedBranchName) {
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('*')
          .eq('branch_name', resolvedBranchName)
          .maybeSingle();

        if (!branchError && branchData) {
          resolvedBranchId = branchData.id;
          resolvedBranchName =
            branchData.branch_name ||
            branchData.name ||
            branchData.title ||
            resolvedBranchName;
        }
      }

      setBranchIdNum(resolvedBranchId);
      setBranchName(resolvedBranchName);

      const resolvedDirectorateId = studentData.directorate_id || getDirectorateId(studentData.directorate_name);
      if (resolvedDirectorateId) {
        await loadSchools(resolvedDirectorateId);
      } else {
        await loadSchools();
      }

      if (resolvedBranchId) {
        const { data: subsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('*')
          .eq('branch_id', resolvedBranchId)
          .order('subject_name', { ascending: true });

        if (!subjectsError) {
          const loadedSubjects = subsData || [];
          setSubjectsList(loadedSubjects);
          // الدورة الأولى: جميع مباحث الفرع.
          // الدورة الثانية والثالثة: الطالب يختار من 1 إلى 4 مباحث.
          setSelectedSubjectIds(
            Number(registrationCycle) === 1
              ? loadedSubjects.map((sub) => sub.id ?? sub.subject_id).filter(Boolean)
              : []
          );
        } else {
          console.error('Error loading subjects for branch:', subjectsError);
          setSubjectsList([]);
          setSelectedSubjectIds([]);
        }
      } else {
        setSubjectsList([]);
        setSelectedSubjectIds([]);
      }
    } catch (err) {
      console.error('Registration lookup error:', err);
      showAlert('حدث خطأ أثناء الاتصال بقاعدة البيانات.', 'error');
    }
  };

  const getDirectorateLabel = (d) => String(
    d?.directorate_name ??
    d?.directorateName ??
    d?.name ??
    d?.title ??
    d?.directorate ??
    d?.directorate_label ??
    d?.label ??
    ''
  ).trim();

  const getSchoolLabel = (school) => String(school?.school_name || school?.name || school?.title || school?.school || school?.schoolName || '').trim();

  const loadDirectorates = async () => {
    const { data, error } = await supabase
      .from('directorates')
      .select('*');

    if (error) {
      console.error('Error loading directorates:', error);
      setDirectoratesList([]);
      showAlert('تعذر تحميل أسماء المديريات من جدول المديريات.', 'error');
      return;
    }

    const sorted = (data || [])
      .filter((d) => d?.id != null && getDirectorateLabel(d))
      .sort((a, b) => getDirectorateLabel(a).localeCompare(getDirectorateLabel(b), 'ar'));

    setDirectoratesList(sorted);
  };

  const loadSchools = async (directorateId = null) => {
    let query = supabase.from('schools').select('*');
    if (directorateId) query = query.eq('directorate_id', directorateId);
    const { data, error } = await query;
    if (!error) {
      const sorted = (data || []).slice().sort((a, b) => getSchoolLabel(a).localeCompare(getSchoolLabel(b), 'ar'));
      setSchoolsList(sorted);
    } else {
      console.error('Error loading schools:', error);
      setSchoolsList([]);
    }
  };

  const getDirectorateId = (value) => {
    if (!value) return null;
    const match = directoratesList.find((d) =>
      String(d.id) === String(value) ||
      getDirectorateLabel(d) === String(value).trim()
    );
    return match?.id || null;
  };

  const handleDirectorateSelection = async (e) => {
    const selectedId = e.target.value ? Number(e.target.value) : null;
    const selected = directoratesList.find((d) => String(d.id) === String(selectedId));
    const selectedName = selected
      ? getDirectorateLabel(selected)
      : '';

    setStudent((prev) => ({
      ...prev,
      directorate_id: selectedId,
      directorate_name: selectedName,
      school_id: null,
      school_name: ''
    }));

    await loadSchools(selectedId);
  };

  const handleSchoolSelection = (e) => {
    const selectedId = e.target.value ? Number(e.target.value) : null;
    const selected = schoolsList.find((school) => String(school.id) === String(selectedId));
    const selectedName = selected
      ? getSchoolLabel(selected)
      : '';

    setStudent((prev) => ({
      ...prev,
      school_id: selectedId,
      school_name: selectedName
    }));
  };

  const editableStudentFields = [
    ['full_name_ar', 'الاسم الكامل بالعربية', 'text'],
    ['full_name_en', 'الاسم بالإنجليزية', 'text'],
    ['national_id', 'رقم الهوية', 'text'],
    ['gender', 'الجنس', 'text'],
    ['birth_date', 'تاريخ الميلاد', 'date'],
    ['birth_place', 'مكان الميلاد', 'text'],
    ['nationality', 'الجنسية', 'text'],
    ['address', 'العنوان', 'text'],
    ['phone_number', 'رقم الهاتف', 'text'],
    ['whatsapp_number', 'رقم الواتساب', 'text']
  ];

  const displayStudentFields = [
    ['full_name_ar', 'الاسم الكامل بالعربية'],
    ['full_name_en', 'الاسم بالإنجليزية'],
    ['national_id', 'رقم الهوية'],
    ['gender', 'الجنس'],
    ['birth_date', 'تاريخ الميلاد'],
    ['birth_place', 'مكان الميلاد'],
    ['nationality', 'الجنسية'],
    ['address', 'العنوان'],
    ['phone_number', 'رقم الهاتف'],
    ['whatsapp_number', 'رقم الواتساب'],
  ];


  const updateStudentField = (field, value) => {
    // الاسم بالعربية ورقم الهوية بيانات تعريفية ثابتة ولا يسمح للطالب بتعديلهما.
    if (field === 'full_name_ar' || field === 'national_id') return;

    let nextValue = value;

    if (field === 'phone_number') {
      nextValue = String(value || '').replace(/\D/g, '').slice(0, 10);
    } else if (field === 'whatsapp_number') {
      nextValue = String(value || '').replace(/\D/g, '').slice(0, 14);
    }

    setStudent(prev => ({ ...prev, [field]: nextValue }));
  };

  const handleBranchSelection = async (e) => {
    const selectedId = e.target.value ? Number(e.target.value) : null;
    const selectedBranch = branchesList.find((b) => String(b.id) === String(selectedId));

    const selectedName = selectedBranch
      ? (selectedBranch.branch_name || selectedBranch.name || selectedBranch.title || '')
      : '';

    setBranchIdNum(selectedId);
    setBranchName(selectedName);
    setStudent(prev => ({
      ...prev,
      branch_id: selectedId,
      branch: selectedName
    }));

    if (selectedId) {
      const { data: subsData, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('branch_id', selectedId)
        .order('subject_name', { ascending: true });

      const loadedSubjects = error ? [] : (subsData || []);
      setSubjectsList(loadedSubjects);
      setSelectedSubjectIds(
        Number(registrationCycle) === 1
          ? loadedSubjects.map((sub) => sub.id ?? sub.subject_id).filter(Boolean)
          : []
      );
    } else {
      setSubjectsList([]);
      setSelectedSubjectIds([]);
    }
  };

  const saveStudentEdits = async () => {
    if (!student) return;

    if (!/^\d{9}$/.test(String(student.national_id || '').trim())) {
      showAlert('رقم هوية الطالب يجب أن يتكون من 9 خانات فقط.', 'error');
      return;
    }

    if (!branchIdNum) {
      showAlert('يرجى اختيار الفرع من القائمة المنسدلة قبل حفظ التعديلات.', 'error');
      return;
    }

    if (String(student.phone_number || '').trim() && !/^\d{10}$/.test(String(student.phone_number).trim())) {
      showAlert('رقم الهاتف يجب أن يتكون من 10 خانات فقط.', 'error');
      return;
    }

    if (String(student.whatsapp_number || '').trim() && !/^\d{14}$/.test(String(student.whatsapp_number).trim())) {
      showAlert('رقم الواتس يجب أن يتكون من 14 خانة فقط.', 'error');
      return;
    }

    setStudent(prev => ({
      ...prev,
      branch_id: branchIdNum,
      branch: branchName
    }));

    setEditingStudent(false);
    setMessage({ text: '', type: '' });
  };

  const handleRegister = () => {
    if (!student) return;

    if (!registrationCycle || !isCycleOpen(registrationCycle)) {
      showAlert('يرجى اختيار دورة تسجيل متاحة حاليًا.', 'error');
      return;
    }
    setIdentityImage(null);
    setPersonalImage(null);
    setIdentityDocumentType('id');
    setShowRegistrationModal(true);
    setMessage({ text: '', type: '' });
  };

  const closeRegistrationModal = () => {
    if (registering) return;
    setShowRegistrationModal(false);
  };

  const validateImageFile = (file, rules) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error(rules.missingMessage || 'الملف المطلوب غير موجود'));

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return reject(new Error('يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP فقط.'));
    }

    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.'));
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const ratio = width / height;

      if (width < rules.minWidth || height < rules.minHeight) {
        return reject(new Error(rules.dimensionMessage));
      }

      if (rules.minRatio && (ratio < rules.minRatio || ratio > rules.maxRatio)) {
        return reject(new Error(rules.ratioMessage));
      }

      resolve({ width, height, ratio });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر قراءة الصورة. يرجى رفع صورة واضحة وسليمة.'));
    };

    image.src = objectUrl;
  });

  const validatePersonalPhotoQuality = async (file) => {
    const info = await validateImageFile(file, {
      minWidth: 600,
      minHeight: 600,
      minRatio: 0.65,
      maxRatio: 1.5,
      dimensionMessage: 'الصورة الشخصية يجب ألا تقل عن 600 × 600 بكسل.',
      ratioMessage: 'الصورة الشخصية يجب أن تكون بصورة وجه واضحة ومناسبة، وليست صورة عريضة أو طويلة جداً.'
    });

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('تعذر قراءة الصورة الشخصية.'));
      image.src = objectUrl;
    });

    try {
      const canvas = document.createElement('canvas');
      const size = 160;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;

      let sum = 0;
      let sumSq = 0;
      const gray = [];

      for (let i = 0; i < pixels.length; i += 4) {
        const g = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        gray.push(g);
        sum += g;
        sumSq += g * g;
      }

      const mean = sum / gray.length;
      const variance = Math.max(0, sumSq / gray.length - mean * mean);

      if (mean < 35 || mean > 225) {
        throw new Error('الصورة الشخصية مظلمة أو شديدة الإضاءة. يرجى رفع صورة واضحة بإضاءة مناسبة.');
      }

      if (variance < 80) {
        throw new Error('الصورة الشخصية غير واضحة بما يكفي. يرجى رفع صورة حديثة وواضحة.');
      }

      if (!faceModelsReady) {
        throw new Error(
          faceModelsError ||
          'لم يجهز نظام فحص الوجه بعد. انتظر لحظات ثم حاول اختيار الصورة مرة أخرى.'
        );
      }

      try {
        const detections = await faceapi.detectAllFaces(
          image,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5
          })
        );

        if (!detections || detections.length === 0) {
          throw new Error('تم رفض الصورة: لم يتم العثور على وجه واضح. ارفع صورة شخصية حديثة وواضحة يظهر فيها الوجه كاملًا.');
        }

        if (detections.length > 1) {
          throw new Error('تم رفض الصورة: يجب أن تحتوي الصورة الشخصية على وجه واحد فقط.');
        }

        const faceBox = detections[0].box;
        const faceAreaRatio = (faceBox.width * faceBox.height) / (info.width * info.height);

        if (faceAreaRatio < 0.08) {
          throw new Error('تم رفض الصورة: الوجه صغير جدًا داخل الصورة. استخدم صورة شخصية يظهر فيها الوجه بوضوح.');
        }
      } catch (faceError) {
        if (faceError?.message?.startsWith('تم رفض الصورة:')) {
          throw faceError;
        }
        console.error('Face detection error:', faceError);
        throw new Error('تعذر فحص الوجه في الصورة. تأكد من تحميل نماذج face-api ثم حاول مرة أخرى.');
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    return info;
  };

  const extractFaceDescriptor = async (file, options = {}) => {
    if (!file) throw new Error(options.missingMessage || 'الصورة المطلوبة غير موجودة.');
    if (!faceModelsReady) {
      throw new Error(
        faceModelsError ||
        'لم يجهز نظام فحص الوجه بعد. انتظر لحظات ثم حاول مرة أخرى.'
      );
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
        image.src = objectUrl;
      });

      const result = await faceapi
        .detectSingleFace(
          image,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: options.inputSize || 416,
            scoreThreshold: options.scoreThreshold ?? 0.35
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result || !result.descriptor) {
        throw new Error(
          options.faceMissingMessage ||
          'تعذر العثور على وجه واضح في الصورة. يرجى رفع صورة واضحة يظهر فيها الوجه.'
        );
      }

      const descriptor = Array.from(result.descriptor, Number);

      if (
        descriptor.length !== 128 ||
        descriptor.some((value) => !Number.isFinite(value))
      ) {
        throw new Error('البصمة الرقمية للوجه غير صالحة. يرجى اختيار صورة أخرى.');
      }

      return {
        descriptor,
        detectionScore: Number(result.detection.score || 0),
        box: result.detection.box
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  // دالة تقنية موجودة للتوافق مع الإصدارات السابقة؛ لا تُستخدم لاتخاذ قرار قبول آلي.
  // Face descriptor من face-api متجه بطول 128، ونتيجة التشابه محصورة بين 0 و 1.
  const calculateFaceSimilarity = (descriptorA, descriptorB) => {
    if (
      !Array.isArray(descriptorA) ||
      !Array.isArray(descriptorB) ||
      descriptorA.length !== descriptorB.length ||
      descriptorA.length !== 128
    ) {
      throw new Error('تعذر حساب درجة تشابه الوجه بسبب بصمات غير صالحة.');
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < descriptorA.length; i += 1) {
      const a = Number(descriptorA[i]);
      const b = Number(descriptorB[i]);

      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error('توجد قيمة غير صالحة داخل بصمة الوجه.');
      }

      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      throw new Error('تعذر حساب تشابه الوجه.');
    }

    // نطبّع النتيجة إلى نطاق 0..1 للاستخدام كدرجة تشابه.
    const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1, cosine));
  };

  const validateIdentityDocument = async (file) => {
    if (identityDocumentType === 'id') {
      return validateImageFile(file, {
        minWidth: 700,
        minHeight: 400,
        minRatio: 1.25,
        maxRatio: 1.9,
        dimensionMessage: 'صورة الهوية يجب أن تكون واضحة وبأبعاد لا تقل عن 700 × 400 بكسل.',
        ratioMessage: 'صيغة صورة الهوية غير مناسبة. ارفع صورة واضحة للهوية الشخصية كاملة.'
      });
    }

    return validateImageFile(file, {
      minWidth: 600,
      minHeight: 400,
      minRatio: 1.1,
      maxRatio: 1.9,
      dimensionMessage: 'صورة جواز السفر يجب أن تكون واضحة وبأبعاد لا تقل عن 600 × 400 بكسل.',
      ratioMessage: 'صيغة صورة جواز السفر غير مناسبة. ارفع صفحة البيانات كاملة وبشكل واضح.'
    });
  };

  const uploadStudentFile = async (file, folder) => {
    const safeNationalId = String(student.national_id || nationalId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `students/${safeNationalId}/${folder}_${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STUDENT_FILES_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(STUDENT_FILES_BUCKET)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('تعذر الحصول على رابط الصورة');
    }

    return publicUrlData.publicUrl;
  };


  // OCR: استخراج النص من وثيقة الهوية/الجواز.
  // يعتمد على tesseract.js ويستخدم العربية والإنجليزية.
  const normalizeOcrText = (value) => {
    return String(value || '')
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getNameTokens = (value) => {
    const normalized = normalizeOcrText(value);
    return normalized.split(' ').map((token) => token.trim()).filter(Boolean);
  };

  const extractDocumentText = async (file) => {
    if (!file) throw new Error('صورة الوثيقة غير موجودة.');

    const result = await Tesseract.recognize(file, 'ara+eng', {
      logger: (info) => {
        if (info?.status) {
          console.log(`OCR: ${info.status}`, info.progress ?? '');
        }
      }
    });

    return String(result?.data?.text || '').trim();
  };

  const verifyStudentNameInDocument = async (file) => {
    const expectedName = student?.full_name_ar || '';
    const expectedTokens = getNameTokens(expectedName);

    if (!expectedTokens.length) {
      throw new Error('اسم الطالب غير موجود في بيانات التسجيل، لذلك لا يمكن التحقق من اسم الوثيقة.');
    }

    const documentText = await extractDocumentText(file);
    const normalizedDocumentText = normalizeOcrText(documentText);

    if (!normalizedDocumentText) {
      throw new Error(
        'تعذر قراءة اسم الطالب من الوثيقة آليًا. يرجى رفع صورة هوية/جواز أوضح.'
      );
    }

    const missingTokens = expectedTokens.filter(
      (token) => !normalizedDocumentText.includes(token)
    );

    if (missingTokens.length > 0) {
      throw new Error(
        'لم يتم العثور على اسم الطالب بشكل كافٍ داخل الوثيقة. يرجى رفع صورة وثيقة واضحة يظهر فيها الاسم كاملًا.'
      );
    }

    return {
      matched: true,
      documentText
    };
  };

  // فحص وجود وجه واضح واحد في الوثيقة فقط.
  // لا يتم استخدام بصمة الوجه لاتخاذ قرار قبول آلي.
  const validateIdentityDocumentFace = async (file) => {
    if (!faceModelsReady) {
      throw new Error(
        faceModelsError ||
        'لم يجهز نظام فحص الوجه بعد. انتظر لحظات ثم حاول مرة أخرى.'
      );
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('تعذر قراءة صورة الوثيقة.'));
        image.src = objectUrl;
      });

      const detections = await faceapi.detectAllFaces(
        image,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.25
        })
      );

      if (!detections || detections.length === 0) {
        throw new Error(
          identityDocumentType === 'id'
            ? 'لم يتم العثور على صورة وجه واضحة داخل الهوية. يرجى رفع صورة الهوية كاملة وواضحة.'
            : 'لم يتم العثور على صورة وجه واضحة داخل صفحة بيانات الجواز. يرجى رفع صورة واضحة.'
        );
      }

      // نسمح بأكثر من عنصر/وجه في الوثيقة لأن بعض الوثائق قد تحتوي صورًا صغيرة،
      // لكن يجب وجود وجه قابل للكشف على الأقل.
      return {
        detected: true,
        count: detections.length,
        score: Number(detections[0]?.score || 0)
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const confirmRegistration = async (e) => {
    e.preventDefault();

    if (!registrationCycle || !isCycleOpen(registrationCycle)) {
      showAlert('دورة التسجيل المختارة غير متاحة حاليًا.', 'error');
      return;
    }

    const normalizedSelectedSubjectIds = selectedSubjectIds
      .map((id) => String(id))
      .filter(Boolean);

    if (Number(registrationCycle) === 1) {
      if (subjectsList.length === 0) {
        showAlert('لا توجد مواد دراسية مرتبطة بالفرع المختار.', 'error');
        return;
      }
    } else {
      if (normalizedSelectedSubjectIds.length < 1 || normalizedSelectedSubjectIds.length > 4) {
        showAlert('في الدورة الثانية والثالثة يجب اختيار امتحان واحد أو امتحانين أو 3 امتحانات أو 4 امتحانات فقط.', 'error');
        return;
      }
    }

    if (!identityImage) {
      showAlert('يرجى إرفاق صورة الهوية أو جواز السفر.', 'error');
      return;
    }

    if (!personalImage) {
      showAlert('يرجى إرفاق الصورة الشخصية.', 'error');
      return;
    }

    if (!branchIdNum) {
      showAlert('يرجى اختيار الفرع من القائمة المنسدلة قبل إتمام التسجيل.', 'error');
      return;
    }

    if (String(student.phone_number || '').trim() && !/^\d{10}$/.test(String(student.phone_number).trim())) {
      showAlert('رقم الهاتف يجب أن يتكون من 10 خانات فقط.', 'error');
      return;
    }

    if (String(student.whatsapp_number || '').trim() && !/^\d{14}$/.test(String(student.whatsapp_number).trim())) {
      showAlert('رقم الواتس يجب أن يتكون من 14 خانة فقط.', 'error');
      return;
    }

    try {
      await validateIdentityDocument(identityImage);
      await validatePersonalPhotoQuality(personalImage);
    } catch (validationError) {
      showAlert(
        validationError?.message || 'الصور المرفوعة لا تطابق المواصفات المطلوبة.',
        'error'
      );
      return;
    }

    setRegistering(true);
    setMessage({ text: '', type: '' });

    try {
      const { data: existingCycle, error: existingError } = await supabase
        .from('students')
        .select('*')
        .eq('national_id', student.national_id)
        .eq('academic_year', currentServerYear)
        .eq('registration_cycle', registrationCycle)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingCycle) {
        setRegistrationCompleted(true);
        setEditingStudent(false);
        setDataConfirmed(false);
        setShowRegistrationModal(false);
        setLookupResultModal({
          type: 'registered',
          title: 'تم تسجيلك مسبقًا في النظام',
          text: `عزيزي الطالب: ${student.full_name_ar || ''}`,
          seatNumber: existingCycle.seating_number,
          password: ''
        });
        return;
      }

      // التحقق الآلي الآمن من الوثيقة:
      // 1) OCR للاسم ومقارنته مع اسم الطالب.
      // 2) التأكد من وجود وجه واضح داخل الوثيقة.
      // 3) التأكد من وجود وجه واضح في الصورة الشخصية.
      // لا يتم اتخاذ قرار قبول/رفض تعليمي اعتمادًا على مطابقة الوجه البيومترية.
      const nameVerification = await verifyStudentNameInDocument(identityImage);
      const documentFaceVerification = await validateIdentityDocumentFace(identityImage);
      const personalPhotoVerification = await validatePersonalPhotoQuality(personalImage);

      setVerificationReview({
        nameMatched: !!nameVerification?.matched,
        documentFaceDetected: !!documentFaceVerification?.detected,
        personalFaceDetected: !!personalPhotoVerification,
        status: 'pending_supervisor_approval'
      });

      // إتمام التسجيل بعد نجاح فحوص البيانات والصور غير البيومترية.
      // أي تحقق بيومتري يبقى للمراجعة والاعتماد من المشرف.
      const identityImageUrl = await uploadStudentFile(identityImage, 'identity');
      const personalImageUrl = await uploadStudentFile(personalImage, 'personal');

      const newSeatNumber = await generateSeatNumber(registrationCycle);
      const newPassword = generateStrongPassword(10);

      const studentRecord = {
        national_id: student.national_id,
        academic_year: currentServerYear,
        registration_cycle: registrationCycle,
        full_name_ar: student.full_name_ar || '',
        full_name_en: student.full_name_en || '',
        gender: student.gender || '',
        nationality: student.nationality || '',
        birth_date: student.birth_date || null,
        birth_place: student.birth_place || '',
        phone_number: student.phone_number || '',
        whatsapp_number: student.whatsapp_number || '',
        address: student.address || '',
        directorate_name: student.directorate_name || '',
        school_name: student.school_name || '',
        branch: branchName || student.branch || student.branch_name || '',
        branch_id: branchIdNum || student.branch_id || null,
        subjects: subjectsList
          .filter((sub) => Number(registrationCycle) === 1 || selectedSubjectIds.includes(sub.id ?? sub.subject_id))
          .map((sub) => ({
            id: sub.id ?? sub.subject_id,
            subject_name: sub.subject_name || sub.name || sub.title || '',
            branch_id: sub.branch_id ?? branchIdNum
          })),
        seating_number: newSeatNumber,
        password_hash: newPassword,
        personal_image_url: personalImageUrl,
        id_card_image_url: identityImageUrl,
        face_descriptor: await descriptorFromImage(personalImage),
        id_face_descriptor: await descriptorFromImage(identityImage),
        biometric_enrolled_at: new Date().toISOString(),
        biometric_status: 'enrolled',
        is_active: true,
        is_online: false
      };

      let insertError = null;
      let seatToUse = newSeatNumber;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const payload = { ...studentRecord, seating_number: seatToUse };
        const result = await supabase.from('students').insert([payload]);
        insertError = result.error;

        if (!insertError) break;

        const errorText = String(insertError.message || insertError.code || '').toLowerCase();
        const duplicateSeat = errorText.includes('seating_number') || errorText.includes('duplicate key') || String(insertError.code || '') === '23505';
        if (!duplicateSeat) break;

        seatToUse = await generateSeatNumber(registrationCycle);
      }

      if (insertError) throw insertError;

      const savedSeatNumber = seatToUse;

      setRegistrationCompleted(true);
      setEditingStudent(false);
      setDataConfirmed(false);
      setShowRegistrationModal(false);

      setLookupResultModal({
        type: 'success',
        title: 'تم تسجيلك بنجاح في النظام',
        text: `عزيزي الطالب: ${student.full_name_ar || ''}`,
        seatNumber: savedSeatNumber,
        password: newPassword
      });

    } catch (err) {
      console.error("Registration Error:", err);
      const errorText = err?.message || 'حدث خطأ أثناء عملية التسجيل';

      if (errorText.includes('PASSWORD_POLICY')) {
        showAlert('كلمة المرور التي أنشأها النظام لا تطابق سياسة الأمان. أعد المحاولة.', 'error');
      } else if (errorText.toLowerCase().includes('bucket') || errorText.toLowerCase().includes('storage')) {
        showAlert(`تعذر رفع الصور. تأكد من إنشاء Storage Bucket باسم "${STUDENT_FILES_BUCKET}" في Supabase والسماح برفع الصور.`, 'error');
      } else {
        showAlert(`حدث خطأ أثناء عملية التسجيل: ${errorText}`, 'error');
      }
    } finally {
      setRegistering(false);
    }
  };

  const closeLookupResultModal = () => {
    if (registering) return;
    setLookupResultModal(null);
    setShowRegistrationModal(false);
    setStudent(null);
    setIdentityImage(null);
    setPersonalImage(null);
    setRegistrationCompleted(false);
    setEditingStudent(false);
    setDataConfirmed(false);
    setBranchName('');
    setBranchIdNum(null);
    setSubjectsList([]);
    setSelectedSubjectIds([]);
    setNationalId('');
  };

  const copyText = (text, fieldKey) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(''), 2500);
  };

  const handleIdentityImageChange = async (file) => {
    setIdentityImage(null);
    if (!file) return;

    try {
      await validateIdentityDocument(file);
      setIdentityImage(file);
      setMessage({ text: '', type: '' });
    } catch (err) {
      showAlert(err?.message || 'صورة الوثيقة لا تطابق المواصفات المطلوبة.', 'error');
    }
  };

  const handlePersonalImageChange = async (file) => {
    setPersonalImage(null);
    if (!file) return;

    try {
      await validatePersonalPhotoQuality(file);
      setPersonalImage(file);
      setMessage({ text: '', type: '' });
    } catch (err) {
      showAlert(err?.message || 'الصورة الشخصية لا تطابق المواصفات المطلوبة.', 'error');
    }
  };

  return (
    <div style={{ color: '#fff', fontFamily: 'Noto Kufi Arabic, sans-serif', backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
      
      {/* سطر البسملة في أعلى منتصف الشاشة */}
      <div style={{ width: '100%', textAlign: 'center', padding: '12px 0 5px 0', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', fontSize: '18px', fontWeight: 'bold', color: '#fbbf24', letterSpacing: '1px' }}>
        بسم الله الرحمن الرحيم
      </div>

      {/* رأس الصفحة والترويسة */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid #334155', padding: '15px 25px', backgroundColor: '#1e293b', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img
            src={institution?.logo_url || ministryLogo}
            alt="شعار المؤسسة"
            style={{
              width: '45px',
              height: '45px',
              objectFit: 'contain',
              borderRadius: '50%',
              overflow: 'hidden'
            }}
          />
          <div>
            <h4 style={{ margin: '0', color: '#f8fafc', fontSize: '13px', fontWeight: 'bold' }}>{institution?.name || institution?.name_line_1 || institution?.official_name || 'اسم المؤسسة'}</h4>
            <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}>
              قسم القياس والتقويم والامتحانات - امتحان إتمام شهادة الدراسة الثانوية العامة - {currentServerYear}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>طلب تسجيل اشتراك بامتحانات الثانوية العامة</div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px' }}>الدورة: {registrationCycle ? getCycleLabel(registrationCycle) : 'اختر الدورة'} | لسنة: {currentServerYear}</div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {onBack && (
            <>
              <button 
                onClick={onBack} 
                style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)' }}
              >
                🏠 الرئيسية
              </button>
              
              <button 
                onClick={onBack} 
                style={{ padding: '8px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                تسجيل الخروج
              </button>
            </>
          )}
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <div style={{ maxWidth: '1000px', width: '100%', margin: '30px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
        
        {/* رسالة وسط الشاشة، تختفي تلقائياً بعد ثانيتين */}
        {message.text && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              minWidth: '280px',
              maxWidth: '90vw',
              background:
                message.type === 'success'
                  ? 'linear-gradient(135deg, #064e3b, #047857)'
                  : message.type === 'warning'
                    ? 'linear-gradient(135deg, #713f12, #a16207)'
                    : message.type === 'info'
                      ? 'linear-gradient(135deg, #1e3a8a, #0369a1)'
                      : 'linear-gradient(135deg, #7f1d1d, #b91c1c)',
              color: '#fff',
              padding: '18px 26px',
              borderRadius: '16px',
              fontWeight: 'bold',
              fontSize: '15px',
              lineHeight: 1.8,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,.35)',
              boxShadow: '0 18px 55px rgba(0,0,0,.55), 0 0 30px rgba(59,130,246,.18)',
              backdropFilter: 'blur(12px)',
              animation: 'fadeIn 0.25s ease'
            }}>
              {message.type === 'success' ? '✓ ' : message.type === 'warning' ? '⚠️ ' : message.type === 'info' ? 'ℹ️ ' : '⚠️ '}
              {message.text}
            </div>
          </div>
        )}

        {!student && (
          <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '15px', borderBottom: '2px solid #334155', paddingBottom: '10px', textAlign: 'right' }}>
              استعلام عن بيانات الطالب برقم الهوية
            </h3>
            <form onSubmit={handleCheck} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '18px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px' }}>
                <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', textAlign: 'right' }}>اختر دورة التسجيل:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', direction: 'rtl' }}>
                  {[1, 2, 3].map((cycle) => {
                    const open = isCycleOpen(cycle);
                    return (
                      <button
                        key={cycle}
                        type="button"
                        disabled={cycleDatesLoading || !open}
                        onClick={() => {
                          setRegistrationCycle(cycle);
                          setSelectedSubjectIds(cycle === 1 ? subjectsList.map((sub) => sub.id ?? sub.subject_id).filter(Boolean) : []);
                        }}
                        style={{
                          padding: '10px 6px',
                          borderRadius: '8px',
                          border: registrationCycle === cycle ? '2px solid #22c55e' : '1px solid #475569',
                          backgroundColor: registrationCycle === cycle ? '#14532d' : open ? '#1e293b' : '#334155',
                          color: open ? '#f8fafc' : '#94a3b8',
                          cursor: open ? 'pointer' : 'not-allowed',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          opacity: open ? 1 : 0.6
                        }}
                      >
                        {getCycleLabel(cycle)}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '9px', color: '#94a3b8', fontSize: '11px', textAlign: 'center', lineHeight: 1.8 }}>
                  {cycleDatesLoading
                    ? 'جاري تحميل مواعيد الدورات من النظام...'
                    : [1, 2, 3].map((cycle) => `${getCycleLabel(cycle)}: ${getCycleDateText(cycle)}`).join(' | ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="أدخل رقم الهوية"
                  value={nationalId}
                  maxLength={9}
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  style={{ flex: 1, padding: '12px 15px', borderRadius: '8px', border: '1.5px solid #475569', backgroundColor: '#0f172a', fontSize: '15px', outline: 'none', fontWeight: '600', color: '#fff' }}
                  required
                />
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0 28px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', whiteSpace: 'nowrap' }}>بحث</button>
              </div>
            </form>
          </div>
        )}

        {student && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #334155' }}>
              <h2>بيانات الطالب المرشح للاشتراك</h2>
              <button onClick={() => { setStudent(null); setDataConfirmed(false); setEditingStudent(false); setRegistrationCompleted(false); }} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>بحث عن طالب آخر ↺</button>
            </div>
            
            <div style={{ padding: '25px' }}>
              {!registrationCompleted && !editingStudent ? (
                <>
                  <div style={{ border: '2px solid #38bdf8', borderRadius: '14px', padding: '14px 12px 12px', marginBottom: '14px', backgroundColor: 'rgba(56,189,248,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 0.9fr 0.8fr', gap: '12px', alignItems: 'end' }}>
                      {displayStudentFields.slice(0, 4).map(([key, label]) => (
                        <div key={key} style={{ minWidth: 0 }}>
                          <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>{label}:</div>
                          <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '2px solid #38bdf8', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: key === 'full_name_en' ? 'flex-start' : 'flex-end', direction: key === 'full_name_en' ? 'ltr' : 'rtl', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {toEnglishDigits(student[key] || 'غير متوفر')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ border: '2px solid #22c55e', borderRadius: '14px', padding: '14px 12px 12px', marginBottom: '14px', backgroundColor: 'rgba(34,197,94,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', alignItems: 'end' }}>
                      {displayStudentFields.slice(4, 9).map(([key, label]) => (
                        <div key={key} style={{ minWidth: 0 }}>
                          <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>{label}:</div>
                          <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '2px solid #22c55e', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', direction: 'rtl', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {toEnglishDigits(student[key] || 'غير متوفر')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ border: '2px solid #a78bfa', borderRadius: '14px', padding: '14px 12px 12px', marginBottom: '20px', backgroundColor: 'rgba(167,139,250,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.0fr 1.55fr 1.75fr 1.0fr', gap: '12px', alignItems: 'end' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>رقم الواتس:</div>
                        <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 10px', borderRadius: '8px', border: '2px solid #a78bfa', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', direction: 'ltr', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {toEnglishDigits(student.whatsapp_number || 'غير متوفر')}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>المديرية:</div>
                        <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 10px', borderRadius: '8px', border: '2px solid #a78bfa', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', direction: 'rtl', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {student.directorate_name || 'غير متوفر'}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>اسم المدرسة:</div>
                        <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 10px', borderRadius: '8px', border: '2px solid #a78bfa', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', direction: 'rtl', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {student.school_name || 'غير متوفر'}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right' }}>الفرع:</div>
                        <div style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '10px 10px', borderRadius: '8px', border: '2px solid #a78bfa', backgroundColor: '#0f172a', color: '#60a5fa', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', direction: 'rtl', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {branchName || student.branch || 'غير محدد'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!registrationCompleted) setEditingStudent(true);
                      }}
                      disabled={registrationCompleted}
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ تعديل بيانات الطالب
                    </button>
                  </div>
                </>
              ) : !registrationCompleted && editingStudent ? (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ backgroundColor: '#172554', border: '1px solid #2563eb', borderRadius: '9px', padding: '10px 14px', marginBottom: '15px', color: '#bfdbfe', fontSize: '13px', textAlign: 'center' }}>
                    عدّل البيانات المطلوبة قبل إتمام التسجيل، ثم اضغط «حفظ التعديلات».
                  </div>

                  {/* الصف الأول: إطار طويل سماوي — العناوين خارج إطار الخانات */}
                  <div style={{ border: '2px solid #38bdf8', borderRadius: '12px', padding: '14px 12px 12px', marginBottom: '14px', backgroundColor: 'rgba(56,189,248,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 0.8fr 0.8fr', gap: '12px' }}>
                    {editableStudentFields.slice(0, 4).map(([key, label, type]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>{label}:</label>
                        <input
                          type={type}
                          value={student[key] ?? ''}
                          onChange={(e) => updateStudentField(key, e.target.value)}
                          maxLength={key === 'national_id' ? 9 : undefined}
                          inputMode={key === 'national_id' ? 'numeric' : undefined}
                          pattern={key === 'national_id' ? '[0-9]{9}' : undefined}
                          disabled={registering || key === 'national_id' || key === 'full_name_ar'}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '2px solid #38bdf8',
                            backgroundColor: (key === 'national_id' || key === 'full_name_ar') ? '#334155' : '#0f172a',
                            color: '#fff',
                            fontSize: '14px',
                            cursor: (key === 'national_id' || key === 'full_name_ar') ? 'not-allowed' : 'text',
                            textAlign: key === 'full_name_en' ? 'left' : 'right',
                            direction: key === 'full_name_en' ? 'ltr' : 'rtl'
                          }}
                        />
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* الصف الثاني: إطار طويل أخضر — العناوين خارج إطار الخانات */}
                  <div style={{ border: '2px solid #22c55e', borderRadius: '12px', padding: '14px 12px 12px', marginBottom: '14px', backgroundColor: 'rgba(34,197,94,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>
                    {editableStudentFields.slice(4, 9).map(([key, label, type]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>{label}:</label>
                        <input
                          type={type}
                          value={student[key] ?? ''}
                          onChange={(e) => updateStudentField(key, e.target.value)}
                          maxLength={key === 'phone_number' ? 10 : undefined}
                          inputMode={key === 'phone_number' ? 'numeric' : undefined}
                          pattern={key === 'phone_number' ? '[0-9]{10}' : undefined}
                          disabled={registering}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '2px solid #22c55e', backgroundColor: '#0f172a', color: '#fff', fontSize: '14px', textAlign: 'right', direction: 'rtl' }}
                        />
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* الصف الثالث: إطار طويل بنفسجي — العناوين خارج إطار الخانات */}
                  <div style={{ border: '1px solid rgba(167,139,250,0.65)', borderRadius: '12px', padding: '14px 12px 12px', marginBottom: '4px', backgroundColor: 'rgba(167,139,250,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1.35fr 1.8fr 1.0fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>رقم الواتس:</label>
                      <input type="text" value={student.whatsapp_number ?? ''} onChange={(e) => updateStudentField('whatsapp_number', e.target.value)} maxLength={14} inputMode="numeric" pattern="[0-9]{14}" disabled={registering} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 8px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.65)', backgroundColor: '#0f172a', color: '#fff', fontSize: '13px', textAlign: 'right', direction: 'rtl' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>المديرية:</label>
                      <select value={student.directorate_id || getDirectorateId(student.directorate_name) || ''} onChange={handleDirectorateSelection} disabled={registering} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 8px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.65)', backgroundColor: '#0f172a', color: '#fff', fontSize: '13px', textAlign: 'right', direction: 'rtl' }}>
                        <option value="">-- اختر المديرية --</option>
                        {directoratesList.map((d) => <option key={d.id} value={d.id}>{getDirectorateLabel(d)}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>اسم المدرسة:</label>
                      <select value={student.school_id || ''} onChange={handleSchoolSelection} disabled={registering || !student.directorate_id} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.65)', backgroundColor: '#0f172a', color: '#fff', fontSize: '14px', textAlign: 'right', direction: 'rtl' }}>
                        <option value="">-- اختر المدرسة --</option>
                        {schoolsList.map((school) => <option key={school.id} value={school.id}>{getSchoolLabel(school)}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}>الفرع:</label>
                      <select value={branchIdNum || ''} onChange={handleBranchSelection} disabled={registering} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.65)', backgroundColor: '#0f172a', color: '#fff', fontSize: '14px', textAlign: 'right', direction: 'rtl' }}>
                        <option value="">-- اختر الفرع --</option>
                        {branchesList.map((b) => <option key={b.id} value={b.id}>{b.branch_name || b.name || b.title}</option>)}
                      </select>
                    </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={saveStudentEdits}
                      disabled={registering}
                      style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStudent(false)}
                      disabled={registering}
                      style={{ backgroundColor: '#475569', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '15px', textAlign: 'right' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '10px' }}>المواد الدراسية (المباحث) المقررة للفرع:</h4>
                {subjectsList.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>لا توجد مواد مسجلة لهذا الفرع أو لم يتم ربطها بالشكل الصحيح في قاعدة البيانات.</p>
                ) : Number(registrationCycle) === 1 ? (
                  <div>
                    <div style={{ color: '#86efac', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                      الدورة الأولى: يتم الاشتراك في جميع مباحث الفرع.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {subjectsList.map((sub) => (
                        <span key={sub.id || sub.subject_id} style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #3b82f6' }}>
                          {sub.subject_name || sub.name || sub.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>
                      اختر المواد التي تريد التقدم لامتحاناتها في هذه الدورة (من 1 إلى 4 امتحانات):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      {subjectsList.map((sub) => {
                        const subjectId = sub.id ?? sub.subject_id;
                        const checked = selectedSubjectIds.some((id) => String(id) === String(subjectId));
                        const disabled = !checked && selectedSubjectIds.length >= 4;
                        return (
                          <label
                            key={subjectId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '9px 11px',
                              borderRadius: '9px',
                              border: checked ? '2px solid #22c55e' : '1px solid #3b82f6',
                              backgroundColor: checked ? 'rgba(34,197,94,.16)' : '#0f172a',
                              color: '#fff',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              opacity: disabled ? 0.5 : 1,
                              direction: 'rtl'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled || registering}
                              onChange={() => {
                                setSelectedSubjectIds((prev) => {
                                  const exists = prev.some((id) => String(id) === String(subjectId));
                                  if (exists) return prev.filter((id) => String(id) !== String(subjectId));
                                  if (prev.length >= 4) return prev;
                                  return [...prev, subjectId];
                                });
                              }}
                              style={{ width: '18px', height: '18px', accentColor: '#22c55e', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                              {sub.subject_name || sub.name || sub.title}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: '10px', textAlign: 'center', color: selectedSubjectIds.length >= 1 && selectedSubjectIds.length <= 4 ? '#86efac' : '#fca5a5', fontSize: '12px', fontWeight: 'bold' }}>
                      عدد الامتحانات المختارة: {selectedSubjectIds.length} / 4
                    </div>
                  </div>
                )}
              </div>

              {!message.text && (
                <>
                  <div style={{
                    marginTop: '25px',
                    marginBottom: '12px',
                    backgroundColor: 'rgba(245,158,11,0.10)',
                    border: '2px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    direction: 'rtl',
                    textAlign: 'right'
                  }}>
                    <div style={{ color: '#fbbf24', fontSize: '15px', fontWeight: 'bold', marginBottom: '6px' }}>⚠️ تنويه مهم قبل إتمام التسجيل</div>
                    <div style={{ color: '#f8fafc', fontSize: '13px', lineHeight: 1.9 }}>
                      قبل الضغط على «التسجيل والاشتراك بالامتحانات»، يرجى التأكد من صحة جميع بياناتك.
                      <br />
                      بعد إتمام التسجيل يمكنك تعديل <strong style={{ color: '#fde68a' }}>البيانات الشخصية المسموح بها مرة واحدة فقط</strong>.
                      <br />
                      <strong style={{ color: '#fca5a5' }}>الاسم الكامل بالعربية ورقم الهوية لا يمكن للطالب تعديلهما إطلاقًا</strong>، سواء قبل التسجيل النهائي أو بعده.
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '9px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    direction: 'rtl'
                  }}>
                    <input
                      id="student-data-confirmation"
                      type="checkbox"
                      checked={dataConfirmed}
                      onChange={(e) => setDataConfirmed(e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }}
                    />
                    <label
                      htmlFor="student-data-confirmation"
                      style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', lineHeight: 1.7, textAlign: 'right' }}
                    >
                      أقرّ بأنني قرأت التنويه أعلاه، وأوافق على صحة بياناتي وأتحمل مسؤولية صحتها.
                      <br />
                      أنا الطالب: <span style={{ color: '#60a5fa' }}>{student?.full_name_ar || ''}</span>
                    </label>
                  </div>

                  <div style={{ marginTop: '0', textAlign: 'center' }}>
                    <button
                      onClick={handleRegister}
                      disabled={!dataConfirmed}
                      style={{
                        backgroundColor: dataConfirmed ? '#16a34a' : '#64748b',
                        color: '#fff',
                        border: 'none',
                        padding: '14px 30px',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: dataConfirmed ? 'pointer' : 'not-allowed',
                        width: '100%',
                        boxShadow: dataConfirmed ? '0 4px 6px rgba(22, 163, 74, 0.2)' : 'none',
                        opacity: dataConfirmed ? 1 : 0.75
                      }}
                    >
                      التسجيل والاشتراك بالامتحانات
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {message.text && message.type === 'success' && (
          <div style={{ backgroundColor: '#064e3b', border: '2px solid #059669', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6ee7b7' }}>
                {message.isRegisteredBefore ? 'تنبيه النظام: الطالب مسجل مسبقاً' : 'تمت عملية التسجيل بنجاح'}
              </div>
              <button onClick={() => setMessage({ text: '', type: '' })} style={{ backgroundColor: 'transparent', border: 'none', fontSize: '18px', fontWeight: 'bold', color: '#6ee7b7', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #059669', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'right' }}>
              <p style={{ fontSize: '15px', color: '#f8fafc', margin: 0 }}>عزيزي الطالب: <strong style={{ color: '#60a5fa' }}>{student?.full_name_ar}</strong></p>
              <p style={{ fontSize: '15px', color: '#cbd5e1', margin: 0 }}>
                {message.isRegisteredBefore
                  ? 'أنت مسجل مسبقاً في هذه الدورة.'
                  : 'تم تسجيلك الآن في النظام'}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', color: '#f8fafc', backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
                <span>رقم الجلوس: <strong style={{ color: '#38bdf8' }}>{message.seatNumber}</strong></span>
                <button onClick={() => copyText(message.seatNumber, 'seat')} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {copiedField === 'seat' ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', color: '#f8fafc', backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
                <span>كلمة المرور : <strong style={{ color: '#38bdf8' }}>{message.password}</strong></span>
                <button onClick={() => copyText(message.password, 'pass')} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {copiedField === 'pass' ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 'bold', margin: '5px 0 0 0', textAlign: 'center' }}>احتفظ بهما للدخول للامتحان</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, textAlign: 'center' }}>{PASSWORD_POLICY_MESSAGE}</p>
            </div>
          </div>
        )}

        {lookupResultModal && (
          <div
            onClick={closeLookupResultModal}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(520px, 94vw)',
                backgroundColor: '#1e293b',
                border: `2px solid ${lookupResultModal.type === 'not-found' ? '#ef4444' : '#22c55e'}`,
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 60px rgba(0,0,0,.6)',
                textAlign: 'center',
                direction: 'rtl'
              }}
            >
              <div style={{ fontSize: '38px', marginBottom: '8px' }}>
                {lookupResultModal.type === 'not-found' ? '⚠️' : '✓'}
              </div>
              <h3 style={{
                margin: '0 0 12px',
                color: lookupResultModal.type === 'not-found' ? '#fca5a5' : '#86efac',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                {lookupResultModal.title}
              </h3>
              <p style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: 1.9, margin: '0 0 16px', whiteSpace: 'pre-line' }}>
                {lookupResultModal.text}
              </p>

              {lookupResultModal.seatNumber && (
                <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>رقم الجلوس</div>
                    <div style={{ color: '#60a5fa', fontSize: '22px', fontWeight: 'bold', direction: 'ltr' }}>
                      {lookupResultModal.seatNumber}
                    </div>
                  </div>
                  {lookupResultModal.password ? (
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>كلمة المرور</div>
                      <div style={{ color: '#fbbf24', fontSize: '22px', fontWeight: 'bold', direction: 'ltr' }}>
                        {lookupResultModal.password}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.8 }}>
                      تم تسجيل الطالب مسبقًا. كلمة المرور محفوظة بشكل مشفّر ولا يمكن عرضها من النظام.
                    </div>
                  )}
                </div>
              )}

              {lookupResultModal.type !== 'not-found' && lookupResultModal.seatNumber && (
                <p style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 'bold', margin: '0 0 16px' }}>
                  {lookupResultModal.password ? 'احتفظ برقم الجلوس وكلمة المرور للدخول للامتحان.' : 'استخدم بيانات الدخول التي استلمتها سابقًا.'}
                </p>
              )}

              <button
                type="button"
                onClick={closeLookupResultModal}
                style={{
                  width: '100%',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '9px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {showRegistrationModal && (
          <div
            onClick={closeRegistrationModal}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(560px, 96vw)',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '14px',
                padding: '25px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                direction: 'rtl'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '20px' }}>
                  استكمال بيانات التسجيل
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '8px 0 0' }}>
                  يرجى إرفاق الصور المطلوبة لإتمام التسجيل
                </p>
              </div>

              <form onSubmit={confirmRegistration}>

                <div style={{
                  marginBottom: '16px',
                  backgroundColor: '#0f172a',
                  padding: '14px',
                  borderRadius: '9px',
                  border: '1px solid #334155'
                }}>
                  <label style={{ display: 'block', marginBottom: '7px', color: '#f8fafc', fontWeight: 'bold' }}>
                    نوع الوثيقة:
                  </label>
                  <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <label style={{ color: '#f8fafc', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="identityDocumentType"
                        value="id"
                        checked={identityDocumentType === 'id'}
                        onChange={(e) => { setIdentityDocumentType(e.target.value); setIdentityImage(null); }}
                        disabled={registering}
                      />{' '}
                      هوية شخصية
                    </label>
                    <label style={{ color: '#f8fafc', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="identityDocumentType"
                        value="passport"
                        checked={identityDocumentType === 'passport'}
                        onChange={(e) => { setIdentityDocumentType(e.target.value); setIdentityImage(null); }}
                        disabled={registering}
                      />{' '}
                      جواز سفر
                    </label>
                  </div>
                  <div style={{ color: '#93c5fd', fontSize: '11px', lineHeight: 1.7, marginBottom: '9px' }}>
                    {identityDocumentType === 'id'
                      ? 'المواصفات: صورة كاملة وواضحة للهوية، JPG/PNG/WEBP، بحد أقصى 5MB، وأبعاد لا تقل عن 700×400 بكسل.'
                      : 'المواصفات: صورة واضحة وكاملة لصفحة بيانات جواز السفر، JPG/PNG/WEBP، بحد أقصى 5MB، وأبعاد لا تقل عن 600×400 بكسل.'}
                  </div>
                  <label style={{ display: 'block', marginBottom: '7px', color: '#f8fafc', fontWeight: 'bold' }}>
                    صورة {identityDocumentType === 'id' ? 'الهوية الشخصية' : 'جواز السفر'}:
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleIdentityImageChange(e.target.files?.[0] || null)}
                    required
                    disabled={registering}
                    style={{ width: '100%', color: '#cbd5e1', fontSize: '13px' }}
                  />
                  {identityImage && (
                    <div style={{ color: '#6ee7b7', fontSize: '12px', marginTop: '6px' }}>
                      ✓ تم اختيار: {identityImage.name}
                    </div>
                  )}
                </div>

                <div style={{
                  marginBottom: '20px',
                  backgroundColor: '#0f172a',
                  padding: '14px',
                  borderRadius: '9px',
                  border: '1px solid #334155'
                }}>
                  <label style={{ display: 'block', marginBottom: '7px', color: '#f8fafc', fontWeight: 'bold' }}>
                    الصورة الشخصية:
                  </label>
                  <div style={{ color: '#93c5fd', fontSize: '11px', lineHeight: 1.7, marginBottom: '9px' }}>
                    المواصفات: صورة حديثة وواضحة للوجه، إضاءة مناسبة، JPG/PNG/WEBP، بحد أقصى 5MB، وأبعاد لا تقل عن 600×600 بكسل.
                    يحق للنظام رفض الصورة إذا كانت منخفضة الجودة أو شديدة الظلام/الإضاءة أو أبعادها غير مناسبة. وإذا كان المتصفح يدعم كشف الوجه، يجب أن تحتوي على وجه واحد واضح فقط.
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePersonalImageChange(e.target.files?.[0] || null)}
                    required
                    disabled={registering}
                    style={{ width: '100%', color: '#cbd5e1', fontSize: '13px' }}
                  />
                  {personalImage && (
                    <div style={{ color: '#6ee7b7', fontSize: '12px', marginTop: '6px' }}>
                      ✓ تم اختيار: {personalImage.name}
                    </div>
                  )}
                </div>

                <div style={{
                  backgroundColor: '#172554',
                  border: '1px solid #2563eb',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '18px',
                  color: '#bfdbfe',
                  fontSize: '12px',
                  lineHeight: 1.7
                }}>
                  سيتم حفظ الصور مع ملف الطالب، وبعد إتمام التسجيل سيظهر لك رقم جلوس خاص بهذه الدورة وكلمة المرور.
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    type="submit"
                    disabled={registering}
                    style={{
                      flex: 1,
                      backgroundColor: registering ? '#64748b' : '#16a34a',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: registering ? 'not-allowed' : 'pointer',
                      fontSize: '15px'
                    }}
                  >
                    {registering ? 'جاري التسجيل ورفع الصور...' : 'تأكيد التسجيل'}
                  </button>

                  <button
                    type="button"
                    onClick={closeRegistrationModal}
                    disabled={registering}
                    style={{
                      backgroundColor: '#475569',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: registering ? 'not-allowed' : 'pointer',
                      fontSize: '15px'
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}