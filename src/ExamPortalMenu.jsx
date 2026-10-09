import React, { useState } from 'react';
import {
  FaFileLines,
  FaChartColumn,
  FaKey,
  FaDesktop,
  FaArrowRight,
} from 'react-icons/fa6';

const cards = [
  {
    key: 'exam',
    title: 'دخول الامتحان',
    desc: 'الدخول إلى الامتحان المتاح حسب بيانات الطالب ووقت الامتحان',
    icon: FaFileLines,
    action: 'onNavigateExam',
  },
  {
    key: 'result',
    title: 'النتائج',
    desc: 'عرض نتائج الامتحانات والنتيجة النهائية للطالب',
    icon: FaChartColumn,
    action: 'onNavigateResult',
  },
  {
    key: 'password',
    title: 'تغيير كلمة المرور',
    desc: 'تحديث كلمة المرور الخاصة بحساب الطالب',
    icon: FaKey,
    action: 'onNavigatePassword',
  },
  {
    key: 'readiness',
    title: 'فحص الجهاز',
    desc: 'فحص الكاميرا والميكروفون والمتصفح والاتصال قبل الامتحان',
    icon: FaDesktop,
    action: 'onNavigateReadiness',
  },
];

export default function ExamPortalMenu({
  onNavigateExam,
  onNavigateResult,
  onNavigatePassword,
  onNavigateReadiness,
  onBack,
}) {
  const actions = {
    onNavigateExam,
    onNavigateResult,
    onNavigatePassword,
    onNavigateReadiness,
  };
  const [hovered, setHovered] = useState(null);

  return (
    <div className="exam-portal-menu" dir="rtl">
      <style>{`
        .exam-portal-menu {
          --navy: #092b4c;
          --navy-2: #123f67;
          --blue: #1677c8;
          --blue-soft: #eaf5ff;
          --paper: #fbfcfd;
          min-height: 100vh;
          padding: 32px 18px 110px;
          background:
            linear-gradient(rgba(5,28,49,.70), rgba(5,28,49,.80)),
            url('/student-portal-bg.png') center top / cover fixed;
          font-family: "Noto Kufi Arabic", "Tahoma", sans-serif;
          color: var(--navy);
        }
        .exam-portal-shell {
          width: min(980px, 96vw);
          margin: 0 auto;
          padding: clamp(22px, 4vw, 40px);
          border-radius: 28px;
          background: rgba(251,252,253,.96);
          box-shadow: 0 28px 70px rgba(0,20,40,.34);
        }
        .exam-portal-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d5e2ed;
          background: #fff;
          color: var(--navy);
          border-radius: 11px;
          padding: 9px 14px;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
        }
        .exam-portal-head { text-align: center; margin: 10px auto 28px; }
        .exam-portal-head h1 {
          margin: 8px 0 5px;
          color: var(--navy);
          font-size: clamp(25px, 3vw, 38px);
          font-weight: 950;
        }
        .exam-portal-head p {
          margin: 0;
          color: #52697d;
          font-size: 13px;
          line-height: 1.8;
        }
        .exam-portal-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 16px;
        }
        .exam-service-card {
          min-height: 220px;
          padding: 22px 14px 16px;
          border: 1px solid #dbe7f0;
          border-top: 4px solid var(--blue);
          border-radius: 18px;
          background: linear-gradient(145deg,#fff,#f3f8fc);
          color: var(--navy);
          cursor: pointer;
          font: inherit;
          box-shadow: 0 10px 26px rgba(9,43,76,.10);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .exam-service-card:hover {
          transform: translateY(-7px);
          border-color: rgba(22,119,200,.42);
          box-shadow: 0 18px 36px rgba(9,43,76,.16);
        }
        .exam-service-icon {
          width: 68px;
          height: 68px;
          margin: 0 auto;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: var(--blue-soft);
          color: var(--blue);
          border: 1px solid #cfe6f8;
        }
        .exam-service-icon svg { font-size: 31px; }
        .exam-service-card h2 {
          margin: 15px 0 6px;
          font-size: 17px;
          font-weight: 900;
          text-align: center;
        }
        .exam-service-card p {
          min-height: 60px;
          margin: 0;
          color: #5b7083;
          font-size: 11px;
          line-height: 1.8;
          text-align: center;
        }
        .exam-service-arrow {
          width: 34px;
          height: 34px;
          margin: 12px auto 0;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid #b9d9ef;
          color: var(--blue);
          background: #fff;
        }
        @media (max-width: 900px) {
          .exam-portal-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
        @media (max-width: 560px) {
          .exam-portal-menu {
            padding: 14px 10px 95px;
            background-attachment: scroll;
          }
          .exam-portal-shell { width: 100%; padding: 18px 12px; border-radius: 20px; }
          .exam-portal-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .exam-service-card { min-height: 190px; padding: 17px 8px 12px; border-radius: 15px; }
          .exam-service-icon { width: 55px; height: 55px; border-radius: 14px; }
          .exam-service-icon svg { font-size: 26px; }
          .exam-service-card h2 { font-size: 14px; margin-top: 11px; }
          .exam-service-card p { font-size: 9px; min-height: 52px; }
          .exam-service-arrow { width: 30px; height: 30px; margin-top: 8px; }
        }
        @media (max-width: 370px) {
          .exam-portal-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="exam-portal-shell">
        <button type="button" className="exam-portal-back" onClick={onBack}>
          <FaArrowRight /> الرئيسية
        </button>

        <header className="exam-portal-head">
          <h1>بوابة الامتحانات</h1>
          <p>اختر الخدمة المطلوبة من خدمات الامتحانات الإلكترونية.</p>
        </header>

        <section className="exam-portal-grid" aria-label="خدمات بوابة الامتحانات">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                className="exam-service-card"
                onClick={actions[card.action]}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
              >
                <div className="exam-service-icon"><Icon /></div>
                <h2>{card.title}</h2>
                <p>{card.desc}</p>
                <div className="exam-service-arrow">
                  <FaArrowRight style={{ transform: hovered === index ? 'translateX(2px)' : 'none' }} />
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
