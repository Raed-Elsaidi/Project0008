import React, { useEffect, useState } from 'react';
import {
  FaUserPlus, FaDesktop, FaHeadset, FaBookOpen, FaArrowLeft,
  FaWhatsapp, FaLinkedinIn, FaFacebookF, FaEnvelope
} from 'react-icons/fa6';
import ministryLogo from './logo.png';
import raedLogo from './raed-logo1.jpg';
import { supabase } from './supabaseClient';

const alertSound = new Audio('/sound/icon-alert.m4a');
const playAlertSound = () => { alertSound.currentTime = 0; alertSound.play().catch(() => {}); };

const cards = [
  { key: 'register', title: 'تسجيل طالب جديد', desc: 'إنشاء حساب طالب جديد وإتمام التسجيل.', icon: FaUserPlus, color: '#08d9ff', glow: 'rgba(0,217,255,.55)', action: 'onNavigateRegister' },
  { key: 'examPortal', title: 'بوابة الامتحانات', desc: 'الدخول إلى خدمات الامتحانات الإلكترونية.', icon: FaDesktop, color: '#9b35ff', glow: 'rgba(155,53,255,.58)', action: 'onNavigateExamPortal' },
  { key: 'support', title: 'الدعم الفني', desc: 'الاستفسارات والشكاوى والتواصل مع فريق الدعم.', icon: FaHeadset, color: '#ff1493', glow: 'rgba(255,20,147,.55)', action: 'onNavigateSupport' },
  { key: 'guides', title: 'إرشادات وتعليمات', desc: 'تعليمات التسجيل والامتحانات وإرشادات الاستخدام.', icon: FaBookOpen, color: '#ffb000', glow: 'rgba(255,176,0,.55)', action: 'onNavigateGuides' },
];

export default function WelcomeScreen({
  onNavigateExamPortal, onNavigateRegister, onNavigateSupport, onNavigateGuides,
  institutionId: institutionIdProp,
}) {
  const [institution, setInstitution] = useState({ logo_url: '', name_line_1: '', name_line_2: '', name_line_3: '', name: '', official_name: '' });
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
        const query = supabase.from('institutions').select('id, name, official_name, name_line_1, name_line_2, name_line_3, logo_url, is_active');
        const result = Number.isFinite(resolvedId) && resolvedId > 0
          ? await query.eq('id', resolvedId).maybeSingle()
          : await query.eq('institution_code', '01').maybeSingle();
        if (cancelled || result.error || !result.data) return;
        const d = result.data;
        window.localStorage.setItem('currentInstitutionId', String(d.id));
        setInstitution({ logo_url: d.logo_url || '', name_line_1: d.name_line_1 || d.name || d.official_name || '', name_line_2: d.name_line_2 || '', name_line_3: d.name_line_3 || '', name: d.name || '', official_name: d.official_name || '' });
      } catch { /* retain default branding if the institution query is unavailable */ }
    }
    loadInstitution();
    return () => { cancelled = true; };
  }, [institutionIdProp]);
  const actions = { onNavigateRegister, onNavigateExamPortal, onNavigateSupport, onNavigateGuides };
  const institutionName = institution.name_line_1 || institution.name || institution.official_name || 'وزارة التربية والتعليم العالي';

  return <div className="student-portal-home" dir="rtl">
    <style>{`
      .student-portal-home, .student-portal-home * { box-sizing: border-box; }
      .student-portal-home { min-height:100vh; position:relative; overflow:hidden; color:#fff; background:#020d2b url('/student-portal-bg.png') center center/cover fixed no-repeat; font-family:'Noto Kufi Arabic',Tahoma,sans-serif; }
      .student-portal-home::before { content:''; position:absolute; inset:0; z-index:0; pointer-events:none; background:linear-gradient(180deg,rgba(0,24,77,.28),rgba(0,14,53,.48) 48%,rgba(0,5,29,.88)); }
      .home-content { position:relative; z-index:1; width:min(1120px,96vw); margin:0 auto; padding:22px 0 18px; }
      .home-head { text-align:center; margin:0 auto 26px; padding:0 14px; }
      .home-bismillah { margin:0 0 12px; color:#fff; font-family:Amiri,'Traditional Arabic',serif; font-weight:800; font-size:clamp(26px,3.2vw,42px); text-shadow:0 0 20px rgba(255,255,255,.38); }
      .home-logo { display:block; width:clamp(86px,10vw,126px); height:clamp(86px,10vw,126px); margin:0 auto 8px; object-fit:contain; border-radius:50%; background:#fff; padding:4px; border:3px solid rgba(255,255,255,.9); box-shadow:0 0 24px rgba(0,207,255,.55); }
      .home-state { color:#fff; font-weight:950; font-size:clamp(25px,3vw,38px); text-shadow:0 3px 14px #001337; }
      .home-ministry { color:#ffd04f; font-weight:900; font-size:clamp(17px,2vw,27px); margin-top:3px; }
      .home-welcome { color:#76eaff; font-size:clamp(34px,5vw,60px); font-weight:950; line-height:1.35; margin:26px 0 0; text-shadow:0 0 22px rgba(0,191,255,.3); }
      .home-title { margin:4px 0 0; color:#fff; font-size:clamp(21px,2.8vw,35px); font-weight:900; text-shadow:0 3px 14px #001337; }
      .home-tagline { margin:10px 0 0; color:#e0e9f8; font-size:clamp(14px,1.6vw,20px); }
      .home-cards { display:grid; direction:ltr; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; margin-top:34px; }
      .home-card { direction:rtl; --card-color:#08d9ff; --card-glow:rgba(0,217,255,.5); min-width:0; min-height:194px; position:relative; display:grid; grid-template-columns:minmax(0,1fr) 96px; grid-template-rows:auto 1fr; align-items:center; gap:8px 14px; padding:20px 20px 17px; text-align:right; color:#fff; cursor:pointer; overflow:hidden; border:2px solid var(--card-color); border-radius:26px; background:linear-gradient(125deg,color-mix(in srgb,var(--card-color) 27%,rgba(1,14,47,.97)),rgba(2,8,37,.91)); box-shadow:0 10px 28px var(--card-glow),inset 0 0 26px rgba(255,255,255,.025); transition:transform .32s ease,box-shadow .32s ease,filter .32s ease; appearance:none; font:inherit; }
      .home-card::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(110deg,transparent 20%,rgba(255,255,255,.13) 48%,transparent 72%); transform:translateX(120%); transition:transform .65s ease; }
      .home-card:hover,.home-card.is-hovered,.home-card:focus-visible { transform:translateY(-7px) scale(1.012); box-shadow:0 18px 42px var(--card-glow),inset 0 0 30px rgba(255,255,255,.055); filter:saturate(1.14); outline:none; }
      .home-card:hover::after,.home-card.is-hovered::after { transform:translateX(-120%); }
      .home-card:focus-visible { outline:3px solid #fff; outline-offset:4px; }
      /* Icon is intentionally rendered directly on the card: no translucent tile behind it. */
      .home-card-icon { grid-column:2; grid-row:1 / span 2; display:flex; align-items:center; justify-content:center; color:var(--card-color); font-size:clamp(48px,5vw,70px); filter:drop-shadow(0 0 12px var(--card-glow)); transition:transform .32s ease,filter .32s ease; }
      .home-card:hover .home-card-icon,.home-card.is-hovered .home-card-icon { transform:scale(1.12) translateY(-3px); filter:drop-shadow(0 0 20px var(--card-color)); }
      .home-card-copy { grid-column:1; grid-row:1 / span 2; position:relative; z-index:1; }
      .home-card-title { display:block; white-space:nowrap; font-size:clamp(15px,1.55vw,23px); font-weight:950; margin-bottom:7px; line-height:1.45; }
      .home-card-desc { color:#e2eaf6; font-size:clamp(12px,1.15vw,16px); line-height:1.9; }
      .home-card-arrow { position:absolute; bottom:13px; left:13px; width:42px; height:42px; display:grid; place-items:center; border:2px solid var(--card-color); border-radius:50%; color:#fff; font-size:20px; transition:transform .32s ease,background .32s ease,box-shadow .32s ease; }
      .home-card:hover .home-card-arrow,.home-card.is-hovered .home-card-arrow { background:var(--card-color); transform:translateX(-4px); box-shadow:0 0 18px var(--card-glow); }
      .home-footer { position:relative; z-index:1; width:min(1050px,94vw); margin:22px auto 0; padding:12px 18px; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap; color:#fff; background:rgba(1,12,44,.78); border:1px solid rgba(0,153,255,.65); border-radius:24px; }
      .home-footer img { width:42px; height:42px; object-fit:contain; border-radius:7px; }
      .home-footer a { display:inline-flex; color:#fff; font-size:22px; transition:color .2s ease,transform .2s ease; }
      .home-footer a:hover { color:#76eaff; transform:translateY(-2px); }
      .home-footer .developer { letter-spacing:1.5px; }
      .home-copyright { position:relative; z-index:1; text-align:center; color:#e8efff; margin:12px 0 18px; font-size:13px; }
      @media(min-width:1000px) { .home-cards { grid-template-columns:repeat(4,minmax(0,1fr)); } .home-card { grid-template-columns:1fr; grid-template-rows:auto auto 1fr; text-align:center; padding:18px 12px 18px; } .home-card-icon { grid-column:1; grid-row:1; font-size:48px; margin:0 auto; } .home-card-copy { grid-column:1; grid-row:2; } .home-card-title { font-size:17px; } .home-card-desc { font-size:12px; } }
      @media(max-width:600px) { .student-portal-home { background-attachment:scroll; background-position:center top; } .home-content { padding:16px 0 10px; } .home-head { margin-bottom:18px; } .home-bismillah { font-size:clamp(23px,6vw,32px); } .home-logo { width:82px;height:82px; } .home-state { font-size:27px; } .home-ministry { font-size:17px; } .home-welcome { margin-top:18px; font-size:clamp(34px,9vw,48px); } .home-title { font-size:clamp(20px,5.5vw,27px); } .home-tagline { font-size:14px; } .home-cards { gap:14px; margin:24px 14px 0; grid-template-columns:minmax(0,1fr); direction:ltr; } .home-card { min-height:132px; grid-template-columns:76px minmax(0,1fr); grid-template-rows:auto; text-align:right; padding:16px 14px 16px; border-radius:22px; gap:12px; } .home-card-icon { grid-column:1;grid-row:1;font-size:43px; margin:auto; } .home-card-copy { grid-column:2;grid-row:1; direction:rtl; align-self:center; } .home-card-title { font-size:clamp(13px,3.7vw,17px); line-height:1.5; white-space:nowrap; } .home-card-desc { font-size:12px; line-height:1.7; } .home-card-arrow { width:30px;height:30px;left:8px;bottom:7px;font-size:15px; } .home-footer { gap:14px; padding:12px 10px; width:94vw; } .home-footer .developer { letter-spacing:.6px;font-size:10px; } .home-footer img { width:34px;height:34px; } }
      @media(max-width:360px) { .home-cards { grid-template-columns:minmax(0,1fr); } .home-card { min-height:126px; grid-template-columns:58px minmax(0,1fr); grid-template-rows:auto; text-align:right; padding:14px 10px; } .home-card-icon { grid-column:1;grid-row:1;font-size:36px; } .home-card-copy { grid-column:2;grid-row:1; } .home-card-title { font-size:12px; } .home-card-desc { font-size:11px; } }
      @media(prefers-reduced-motion:reduce) { .home-card,.home-card::after,.home-card-icon,.home-card-arrow,.home-footer a { transition:none!important; } }
    `}</style>
    <main className="home-content">
      <header className="home-head">
        <div className="home-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <img className="home-logo" src={institution.logo_url || ministryLogo} alt="شعار برنامج الامتحانات الإلكترونية" />
        <div className="home-state">دولة فلسطين</div>
        <div className="home-ministry">{institution.name_line_2 || institutionName}</div>
        <h1 className="home-welcome">أهلاً وسهلاً بكم</h1>
        <div className="home-title">في برنامج الامتحانات الإلكترونية</div>
        <p className="home-tagline">معاً نحو مستقبل أفضل ..</p>
      </header>
      <section className="home-cards" aria-label="الخدمات الرئيسية">
        {cards.map((card, index) => { const Icon = card.icon; return <button key={card.key} type="button" className={`home-card ${hoveredCard === index ? 'is-hovered' : ''}`} style={{'--card-color':card.color,'--card-glow':card.glow}} onClick={() => actions[card.action]?.()} onMouseEnter={() => {setHoveredCard(index);playAlertSound();}} onMouseLeave={() => setHoveredCard(null)} onFocus={() => setHoveredCard(index)} onBlur={() => setHoveredCard(null)} aria-label={card.title}>
          <span className="home-card-icon"><Icon /></span><span className="home-card-copy"><span className="home-card-title">{card.title}</span><span className="home-card-desc">{card.desc}</span></span><span className="home-card-arrow"><FaArrowLeft /></span>
        </button>; })}
      </section>
    </main>
    <footer className="home-footer">
      <img src={raedLogo} alt="RE" /><strong className="developer">ENG. RAED ELSAIDI</strong>
      <a href="mailto:elsaidiraed@gmail.com" aria-label="البريد الإلكتروني"><FaEnvelope /></a><a href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF /></a><a href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" aria-label="LinkedIn"><FaLinkedinIn /></a><a href="https://wa.me/970599242087" target="_blank" rel="noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a>
    </footer><div className="home-copyright">© 2026 حقوق النسخ محفوظة</div>
  </div>;
}
