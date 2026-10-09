import React, { useEffect, useState } from 'react';
import {
  FaUserPlus,
  FaClipboardList,
  FaArrowLeft,
  FaWhatsapp,
  FaLinkedinIn,
  FaFacebookF,
  FaEnvelope,
  FaShieldHalved,
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

const cards = [
  {
    key: 'register',
    title: 'تسجيل طالب جديد',
    desc: 'إنشاء حساب طالب جديد وإتمام إجراءات التسجيل',
    icon: FaUserPlus,
    action: 'onNavigateRegister',
  },
  {
    key: 'examPortal',
    title: 'بوابة الامتحانات',
    desc: 'الدخول إلى الامتحانات والنتائج وخدمات الامتحان',
    icon: FaClipboardList,
    action: 'onNavigateExamPortal',
  },
  {
    key: 'support',
    title: 'الدعم الفني',
    desc: 'التواصل مع فريق الدعم وطرح الاستفسارات والمشكلات',
    icon: FaHeadset,
    action: 'onNavigateSupport',
  },
];

export default function WelcomeScreen({
  onNavigateExamPortal,
  onNavigateRegister,
  onNavigateSupport,
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

  const actions = { onNavigateExamPortal, onNavigateRegister, onNavigateSupport };
  const institutionName = institution.name_line_1 || institution.name || institution.official_name || 'اسم المؤسسة';

  return (
    <div className="student-portal-home" dir="rtl">
      <style>{`
        * { box-sizing: border-box; }

        .student-portal-home {
          --portal-navy: #092b4c;
          --portal-navy-2: #123f67;
          --portal-blue: #1677c8;
          --portal-blue-soft: #eaf5ff;
          --portal-paper: #fbfcfd;
          --portal-gold: #9b6a32;
          min-height: 100vh;
          color: var(--portal-navy);
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
          background:
            linear-gradient(180deg, rgba(8,43,76,.08), rgba(4,30,53,.38) 72%, rgba(4,24,43,.55));
        }

        .student-portal-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(92px, 12vh, 145px) 18px 145px;
        }

        .portal-panel {
          width: min(1080px, 96vw);
          border-radius: 28px;
          padding: clamp(24px, 4vw, 44px);
          background: rgba(251,252,253,.93);
          border: 1px solid rgba(255,255,255,.95);
          box-shadow: 0 28px 70px rgba(0,35,75,.30), inset 0 1px 0 rgba(255,255,255,.95);
          backdrop-filter: blur(10px);
        }

        .portal-head {
          text-align: center;
          margin-bottom: 28px;
        }

        .portal-logo {
          width: 76px;
          height: 76px;
          object-fit: contain;
          border-radius: 50%;
          background: #fff;
          padding: 5px;
          border: 2px solid rgba(9,43,76,.10);
          box-shadow: 0 10px 28px rgba(11,68,126,.20);
        }

        .portal-institution {
          margin-top: 10px;
          color: var(--portal-navy);
          font-size: clamp(18px, 2vw, 25px);
          font-weight: 900;
        }

        .portal-program {
          margin-top: 4px;
          color: var(--portal-gold);
          font-size: clamp(12px, 1.4vw, 16px);
          font-weight: 800;
        }

        .portal-title {
          margin: 14px 0 4px;
          color: var(--portal-navy-2);
          font-size: clamp(27px, 3.4vw, 44px);
          font-weight: 950;
        }

        .portal-subtitle {
          margin: 0 auto;
          max-width: 700px;
          color: #40566c;
          font-size: clamp(12px, 1.2vw, 15px);
          line-height: 1.9;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          margin-top: 30px;
          max-width: 940px;
          margin-left: auto;
          margin-right: auto;
        }

        .portal-card {
          min-height: 238px;
          border: 1px solid rgba(9,43,76,.14);
          border-top: 4px solid var(--portal-blue);
          border-radius: 20px;
          padding: 24px 18px 18px;
          color: var(--portal-navy);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, #ffffff, #f3f8fc);
          box-shadow: 0 12px 32px rgba(9,43,76,.12), inset 0 0 0 1px rgba(255,255,255,.75);
          transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease;
          appearance: none;
          font: inherit;
        }

        .portal-card::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          left: -65px;
          bottom: -70px;
          border-radius: 50%;
          background: rgba(22,119,200,.07);
          pointer-events: none;
        }

        .portal-card:hover {
          transform: translateY(-8px);
          border-color: rgba(22,119,200,.42);
          box-shadow: 0 20px 42px rgba(9,43,76,.18);
        }

        .icon-orbit {
          width: 78px;
          height: 78px;
          margin: 0 auto;
          border-radius: 20px;
          display: grid;
          place-items: center;
          color: var(--portal-navy);
          background: var(--portal-blue-soft);
          border: 1px solid rgba(22,119,200,.18);
          box-shadow: 0 8px 22px rgba(22,119,200,.14);
        }

        .icon-orbit svg {
          font-size: 38px;
          color: var(--portal-blue);
        }

        .portal-card-title {
          margin-top: 18px;
          text-align: center;
          font-size: clamp(16px, 1.35vw, 20px);
          font-weight: 900;
          color: var(--portal-navy);
        }

        .portal-card-desc {
          min-height: 42px;
          margin-top: 8px;
          text-align: center;
          color: #52697d;
          font-size: 12px;
          line-height: 1.8;
        }

        .portal-arrow {
          width: 38px;
          height: 38px;
          margin: 13px auto 0;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1px solid rgba(22,119,200,.35);
          color: var(--portal-blue);
          background: #fff;
          transition: transform .28s ease, background .28s ease, color .28s ease;
        }

        .portal-card:hover .portal-arrow {
          transform: translateX(-4px);
          background: var(--portal-blue);
          color: #fff;
        }

        .notice {
          margin: 20px auto 0;
          max-width: 850px;
          padding: 13px 16px;
          border-radius: 13px;
          background: rgba(22,119,200,.06);
          border: 1px solid rgba(22,119,200,.15);
          color: #425b70;
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
          color: var(--portal-navy);
          font-size: 12px;
          font-weight: 800;
        }

        .security svg { color: #168a68; }

        @media (max-width: 850px) {
          .cards { grid-template-columns: 1fr; max-width: 500px; }
        }

        @media (max-width: 600px) {
          .student-portal-home { background-attachment: scroll; background-position: center top; }
          .student-portal-content { padding: 56px 10px 110px; }
          .portal-panel { padding: 20px 13px; border-radius: 20px; }
          .portal-logo { width: 66px; height: 66px; }
          .cards { gap: 11px; margin-top: 22px; }
          .portal-card { min-height: 170px; padding: 18px 12px 13px; border-radius: 16px; }
          .icon-orbit { width: 60px; height: 60px; border-radius: 15px; }
          .icon-orbit svg { font-size: 29px; }
          .portal-card-title { margin-top: 11px; font-size: 15px; }
          .portal-card-desc { font-size: 10px; min-height: 34px; }
          .portal-arrow { width: 32px; height: 32px; margin-top: 9px; }
        }
      `}</style>

      <main className="student-portal-content">
        <section className="portal-panel" aria-label="بوابة الطالب">
          <div className="portal-head">
            <img className="portal-logo" src={institution.logo_url || ministryLogo} alt={institutionName} />
            <div className="portal-institution">{institutionName}</div>
            <div className="portal-program">برنامج الامتحانات الإلكترونية</div>
            <h1 className="portal-title">بوابة الطالب</h1>
            <p className="portal-subtitle">
              اختر الخدمة المطلوبة للوصول إلى خدمات التسجيل والامتحانات والدعم الفني.
            </p>
          </div>

          <section className="cards" aria-label="الخدمات الرئيسية">
            {cards.map((card, index) => {
              const Icon = card.icon;
              const action = actions[card.action];
              return (
                <button
                  key={card.key}
                  type="button"
                  className="portal-card"
                  onClick={action}
                  onMouseEnter={() => { setHoveredCard(index); playAlertSound(); }}
                  onMouseLeave={() => setHoveredCard(null)}
                  onFocus={() => setHoveredCard(index)}
                  onBlur={() => setHoveredCard(null)}
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

          <div className="notice">
            <strong>تنبيه:</strong> قبل دخول الامتحان تأكد من قراءة التعليمات وتجهيز الجهاز والبيئة المناسبة.
          </div>
          <div className="security"><FaShieldHalved /> بيئة امتحان إلكترونية آمنة ومراقبة</div>
        </section>
      </main>

      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
        padding: '8px 14px', background: 'rgba(7,36,62,.90)',
        borderTop: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(10px)',
        color: '#fff', fontSize: 11, flexWrap: 'wrap'
      }}>
        <img src={raedLogo} alt="RE" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 7 }} />
        <strong style={{ letterSpacing: 1.5 }}>ENG. RAED ELSAIDI</strong>
        <a href="mailto:elsaidiraed@gmail.com" aria-label="البريد الإلكتروني" style={{ color: '#fff' }}><FaEnvelope /></a>
        <a href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" aria-label="Facebook" style={{ color: '#fff' }}><FaFacebookF /></a>
        <a href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" aria-label="LinkedIn" style={{ color: '#fff' }}><FaLinkedinIn /></a>
        <a href="https://wa.me/970599242087" target="_blank" rel="noreferrer" aria-label="WhatsApp" style={{ color: '#fff' }}><FaWhatsapp /></a>
        <span>© حقوق النسخ محفوظة 2026</span>
      </footer>
    </div>
  );
}
