import React, { useEffect, useState } from 'react';
import {
  FaUserPlus,
  FaFileLines,
  FaDesktop,
  FaChartColumn,
  FaKey,
  FaBookOpen,
  FaArrowLeft,
  FaWhatsapp,
  FaLinkedinIn,
  FaFacebookF,
  FaEnvelope,
  FaHeadset,
} from 'react-icons/fa6';
import ministryLogo from './logo.png';
import raedLogo from './raed-logo1.jpg';
import { supabase } from './supabaseClient';

const alertSound = new Audio('/sound/icon-alert.m4a');
const playAlertSound = () => {
  alertSound.currentTime = 0;
  alertSound.play().catch(() => {});
};

// نفس الأيقونات والعناوين المستخدمة في تصميم البوابة المعتمد،
// مع استبعاد «دخول المشرف» و«دفتر الملاحظات» من بوابة الطالب.
const cards = [
  // في واجهة RTL تظهر البطاقة الأولى في أقصى اليمين.
  { key: 'exam', title: 'دخول الامتحان', desc: 'الدخول إلى الامتحانات الإلكترونية المتاحة حسب الجدول المحدد', icon: FaFileLines, color: '#08d9ff', glow: 'rgba(0,217,255,.58)', action: 'onNavigateExam' },
  { key: 'result', title: 'النتائج', desc: 'عرض نتائج الامتحانات والشهادات المدرسية', icon: FaChartColumn, color: '#9b35ff', glow: 'rgba(155,53,255,.60)', action: 'onNavigateResult' },
  { key: 'password', title: 'تغيير كلمة المرور', desc: 'تحديث كلمة المرور الخاصة بحسابك', icon: FaKey, color: '#ffb000', glow: 'rgba(255,176,0,.60)', action: 'onNavigatePassword' },
  { key: 'readiness', title: 'فحص الجهاز', desc: 'التأكد من جاهزية جهازك قبل دخول الامتحان', icon: FaDesktop, color: '#00e6a0', glow: 'rgba(0,230,160,.60)', action: 'onNavigateReadiness' },
];

export default function WelcomeScreen({
  onNavigateExam,
  onNavigateResult,
  onNavigateRegister,
  onNavigatePassword,
  onNavigateSupport,
  onNavigateNotes,
  onNavigateGuides,
  onNavigateNotifications,
  onNavigateReadiness,
  institutionId: institutionIdProp,
}) {
  const [institution, setInstitution] = useState({
    logo_url: '',
    name_line_1: '',
    name_line_2: '',
    name_line_3: '',
    name: '',
    official_name: '',
  });
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInstitution() {
      try {
        let resolvedId = Number(institutionIdProp);
        if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
          const storedId = Number(window.localStorage.getItem('currentInstitutionId'));
          if (Number.isFinite(storedId) && storedId > 0) resolvedId = storedId;
        }

        let query = supabase
          .from('institutions')
          .select('id, name, official_name, name_line_1, name_line_2, name_line_3, logo_url, is_active');

        const result = Number.isFinite(resolvedId) && resolvedId > 0
          ? await query.eq('id', resolvedId).maybeSingle()
          : await query.eq('institution_code', '01').maybeSingle();

        if (cancelled || result.error || !result.data) return;
        const data = result.data;
        window.localStorage.setItem('currentInstitutionId', String(data.id));
        setInstitution({
          logo_url: data.logo_url || '',
          name_line_1: data.name_line_1 || data.name || data.official_name || '',
          name_line_2: data.name_line_2 || '',
          name_line_3: data.name_line_3 || '',
          name: data.name || '',
          official_name: data.official_name || '',
        });
      } catch {
        // إبقاء القيم الافتراضية إذا تعذر الاتصال بالمؤسسة.
      }
    }

    loadInstitution();
    return () => { cancelled = true; };
  }, [institutionIdProp]);

  const actions = {
    onNavigateExam,
    onNavigateResult,
    onNavigateRegister,
    onNavigatePassword,
    onNavigateSupport,
    onNavigateGuides,
    onNavigateNotifications,
    onNavigateReadiness,
  };

  const institutionName = institution.name_line_1 || institution.name || institution.official_name || 'اسم المؤسسة';

  return (
    <div className="student-portal-home" dir="rtl">
      <style>{`
        * { box-sizing: border-box; }
        .student-portal-home {
          min-height: 100vh;
          color: #10233f;
          position: relative;
          overflow-x: hidden;
          background-image: url('/student-portal-bg.png');
          background-size: cover;
          background-position: center top;
          background-attachment: fixed;
          font-family: "Noto Kufi Arabic", "Tahoma", sans-serif;
        }
        .student-portal-home::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(0,28,86,.08), rgba(0,18,66,.48) 55%, rgba(0,7,35,.82));
        }
        .student-portal-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 28px 18px 30px;
        }
        .portal-panel {
          width: min(1120px, 96vw);
          border-radius: 28px;
          padding: clamp(24px, 4vw, 44px);
          background: rgba(255,255,255,.90);
          border: 1px solid rgba(255,255,255,.95);
          box-shadow: 0 28px 70px rgba(0,35,75,.30), inset 0 1px 0 rgba(255,255,255,.9);
          backdrop-filter: blur(9px);
        }
        .portal-head {
          text-align: center;
          margin-bottom: 28px;
        }
        .portal-bismillah { font-family: "Amiri", "Traditional Arabic", serif; font-size: clamp(25px, 3vw, 38px); color: #fff; font-weight: 800; margin: 0 0 18px; text-shadow: 0 0 18px rgba(255,255,255,.35); }
        .portal-state { color: #fff; font-size: clamp(27px, 3vw, 39px); font-weight: 950; margin-top: 8px; text-shadow: 0 3px 15px #00163f; }
        .portal-ministry { color: #ffce4b; font-size: clamp(17px, 2vw, 26px); font-weight: 900; margin-top: 3px; }
        .portal-welcome { color: #72e4ff; font-size: clamp(34px, 5vw, 60px); font-weight: 950; margin: 26px 0 4px; text-shadow: 0 0 22px rgba(0,191,255,.28); }
        .portal-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          border-radius: 50%;
          background: #fff;
          padding: 4px;
          box-shadow: 0 10px 28px rgba(11,68,126,.20);
        }
        .portal-institution {
          margin-top: 10px;
          color: #173b64;
          font-size: clamp(18px, 2vw, 25px);
          font-weight: 900;
        }
        .portal-program {
          margin-top: 4px;
          color: #7a532d;
          font-size: clamp(12px, 1.4vw, 16px);
          font-weight: 800;
        }
        .portal-title {
          margin: 14px 0 4px;
          color: #123b67;
          font-size: clamp(27px, 3.4vw, 44px);
          font-weight: 950;
        }
        .portal-subtitle {
          margin: 0 auto;
          max-width: 700px;
          color: #42566f;
          font-size: clamp(12px, 1.2vw, 15px);
          line-height: 1.9;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 28px;
        }
        .portal-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          --card-color: #0ea5ff;
          --card-glow: rgba(14,165,255,.35);
          min-height: 215px;
          border: 2px solid var(--card-color);
          border-radius: 24px;
          padding: 20px 18px 15px;
          color: #fff;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, color-mix(in srgb, var(--card-color) 28%, rgba(4,12,42,.96)), rgba(3,10,38,.88));
          box-shadow: 0 12px 32px var(--card-glow), inset 0 0 28px rgba(255,255,255,.025);
          transition: transform .42s cubic-bezier(.22,1,.36,1), box-shadow .35s ease;
          appearance: none;
          font: inherit;
        }
        .portal-card::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,.16) 45deg, transparent 85deg);
          opacity: 0;
          transition: opacity .25s ease;
        }
        .portal-card:hover, .portal-card.is-hovered, .portal-card:focus-visible {
          transform: translateY(-12px) scale(1.025);
          box-shadow: 0 20px 48px var(--card-glow), inset 0 0 35px rgba(255,255,255,.08);
          outline: none;
        }
        .portal-card:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
        .portal-card:hover .portal-card-title, .portal-card.is-hovered .portal-card-title { text-shadow: 0 0 14px var(--card-color); }
        .portal-card:hover .icon-orbit, .portal-card.is-hovered .icon-orbit { transform: translateY(-4px) scale(1.06); box-shadow: 0 0 38px var(--card-glow), inset 0 0 18px rgba(255,255,255,.08); }
        .icon-orbit { transition: transform .35s ease, box-shadow .35s ease; }
        .portal-card:hover::after { opacity: 1; animation: cardSweep 1.3s linear infinite; }
        @keyframes cardSweep { to { transform: rotate(360deg); } }
        .icon-orbit {
          width: 76px;
          height: 76px;
          margin: 0 auto;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: var(--card-color);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 0 28px var(--card-glow), inset 0 0 18px rgba(255,255,255,.035);
        }
        .icon-orbit svg {
          font-size: 39px;
          filter: drop-shadow(0 0 10px var(--card-color));
        }
        .portal-card:hover .icon-orbit svg {
          animation: counterClockwiseOrbit 1.05s ease-in-out infinite;
        }
        @keyframes counterClockwiseOrbit {
          0% { transform: translate(0,0) rotate(0deg); }
          25% { transform: translate(-9px,-6px) rotate(-90deg); }
          50% { transform: translate(0,-10px) rotate(-180deg); }
          75% { transform: translate(9px,-6px) rotate(-270deg); }
          100% { transform: translate(0,0) rotate(-360deg); }
        }
        .portal-card-title {
          margin-top: 18px;
          text-align: center;
          font-size: clamp(16px, 1.35vw, 20px);
          font-weight: 900;
        }
        .portal-card-desc {
          min-height: 40px;
          margin-top: 7px;
          text-align: center;
          color: #c8d9ea;
          font-size: 12px;
          line-height: 1.75;
        }
        .portal-arrow {
          width: 38px;
          height: 38px;
          margin: 12px auto 0;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1px solid var(--card-color);
          color: #fff;
          background: rgba(255,255,255,.06);
          transition: transform .35s ease, background .35s ease;
        }
        .portal-card:hover .portal-arrow {
          transform: rotate(-360deg);
          background: var(--card-color);
        }
        .notice {
          margin-top: 20px;
          padding: 13px 16px;
          border-radius: 13px;
          background: rgba(15,72,128,.08);
          border: 1px solid rgba(15,88,151,.18);
          color: #38556f;
          text-align: center;
          font-size: 12px;
          line-height: 1.8;
        }
        .security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 15px;
          color: #0b5d8f;
          font-size: 12px;
          font-weight: 800;
        }
        .security svg { color: #0a9b70; }
        .mobile-note { display: none; }
        @media (max-width: 1000px) {
          .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .student-portal-home { background-attachment: scroll; background-position: center top; }
          .student-portal-content { padding: 18px 10px 18px; }
          .portal-panel { padding: 17px 12px; border-radius: 20px; background: linear-gradient(145deg, rgba(2,19,62,.42), rgba(1,8,35,.52)); }
          .cards { grid-template-columns: 1fr; gap: 14px; }
          .portal-card { min-height: 165px; padding: 14px 8px 10px; border-radius: 18px; }
          .icon-orbit { width: 61px; height: 61px; border-radius: 14px; }
          .icon-orbit svg { font-size: 30px; }
          .portal-card-title { margin-top: 12px; font-size: 14px; }
          .portal-card-desc { font-size: 10px; min-height: 34px; }
          .portal-arrow { width: 32px; height: 32px; }
          .mobile-note { display: block; margin-top: 10px; color: #61778e; font-size: 10px; text-align: center; }
        }
        @media (max-width: 390px) {
          .cards { grid-template-columns: 1fr; }
          .portal-card { min-height: 150px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .portal-card, .portal-card::after, .portal-arrow, .icon-orbit svg { animation: none !important; transition: none !important; }
        }
      `}</style>

      <main className="student-portal-content">
        <section className="portal-panel" aria-label="بوابة الطالب">
          <div className="portal-head">
            <div className="portal-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            <img className="portal-logo" src={institution.logo_url || ministryLogo} alt="شعار برنامج الامتحانات الإلكترونية" />
            <div className="portal-state">دولة فلسطين</div>
            <div className="portal-ministry">وزارة التربية والتعليم العالي</div>
            <h1 className="portal-welcome">أهلاً وسهلاً بكم</h1>
            <div className="portal-title">في برنامج الامتحانات الإلكترونية</div>
            <p className="portal-subtitle">معاً نحو مستقبل أفضل</p>
          </div>

          <section className="cards" aria-label="الخدمات الرئيسية">
            {cards.map((card, index) => {
              const Icon = card.icon;
              const action = actions[card.action];
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`portal-card ${hoveredCard === index ? 'is-hovered' : ''}`}
                  onClick={() => action?.()}
                  onMouseEnter={() => { setHoveredCard(index); playAlertSound(); }}
                  onMouseLeave={() => setHoveredCard(null)}
                  onFocus={() => setHoveredCard(index)}
                  onBlur={() => setHoveredCard(null)}
                  style={{ '--card-color': card.color, '--card-glow': card.glow }}
                  aria-label={card.title}
                >
                  <div className="icon-orbit"><Icon /></div>
                  <div className="portal-card-title">{card.title}</div>
                  <div className="portal-card-desc">{card.desc}</div>
                  <div className="portal-arrow"><FaArrowLeft /></div>
                </button>
              );
            })}
          </section>


        </section>
      </main>

      {/* بيانات المطور محفوظة داخل التصميم الحالي، مع إبقاء الروابط قابلة للنقر */}
      <footer style={{
        position: 'relative', bottom: 'auto', left: 'auto', right: 'auto', zIndex: 3, margin: '18px auto 0', width: 'min(1120px, 96vw)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
        padding: '14px 18px', background: 'rgba(1,12,44,.84)', border: '1px solid rgba(0,153,255,.65)', borderRadius: 22,
        borderTop: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(10px)',
        color: '#fff', fontSize: 11, flexWrap: 'wrap'
      }}>
        <img src={raedLogo} alt="RE" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 7 }} />
        <strong style={{ letterSpacing: 1.5 }}>ENG. RAED ELSAIDI</strong>
        <a href="mailto:elsaidiraed@gmail.com" aria-label="البريد الإلكتروني" style={{ color: '#fff' }}><FaEnvelope /></a>
        <a href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" aria-label="Facebook" style={{ color: '#fff' }}><FaFacebookF /></a>
        <a href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" aria-label="LinkedIn" style={{ color: '#fff' }}><FaLinkedinIn /></a>
        <a href="https://wa.me/970599242087" target="_blank" rel="noreferrer" aria-label="WhatsApp" style={{ color: '#fff' }}><FaWhatsapp /></a>
        <span>© 2026 حقوق النسخ محفوظة</span>
      </footer>
    </div>
  );
}
