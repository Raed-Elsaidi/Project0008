import React, { useState } from 'react';
import { FaArrowRight, FaArrowLeft, FaHouse, FaBookOpen } from 'react-icons/fa6';

const pages = [
  { src: '/cover1.png', alt: 'غلاف دفتر الملاحظات', label: 'الغلاف' },
  { src: '/cover2.png', alt: 'فهرس دفتر الملاحظات', label: 'الفهرس' },
  { src: '/page3.png', alt: 'صفحة الملاحظات', label: 'ملاحظاتي' },
  { src: '/page4.png', alt: 'الخطة الأسبوعية', label: 'خطة هذا الأسبوع' },
];

export default function NotesBook({ onBack }) {
  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState(false);
  const [direction, setDirection] = useState('next');

  const go = (nextPage, dir) => {
    if (turning || nextPage < 0 || nextPage >= pages.length) return;
    setDirection(dir);
    setTurning(true);
    window.setTimeout(() => {
      setPage(nextPage);
      setTurning(false);
    }, 430);
  };

  return (
    <div className="notes-book-page" dir="rtl">
      <style>{`
        .notes-book-page{min-height:100vh;background:radial-gradient(circle at 50% 20%,#ffe8f5 0,#f8d9ea 34%,#d9ecff 100%);display:flex;flex-direction:column;align-items:center;padding:20px 16px 28px;color:#172554;font-family:"Noto Kufi Arabic",sans-serif;overflow:hidden}
        .notes-book-top{width:min(1100px,100%);display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
        .notes-back,.notes-home{border:0;border-radius:14px;padding:10px 15px;background:#fff7;border:1px solid #ffffffaa;color:#172554;font:inherit;font-weight:800;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 5px 18px #6b4a7a22}
        .notes-title{text-align:center;font-weight:900;font-size:clamp(18px,3vw,28px);margin:0}
        .notes-book-wrap{width:min(760px,96vw);perspective:2200px;display:flex;justify-content:center;align-items:center;flex:1}
        .notes-book{position:relative;width:min(690px,92vw);aspect-ratio:3/4;filter:drop-shadow(0 24px 28px #5b315333)}
        .notes-book::before{content:"";position:absolute;inset:0 -18px 0 18px;border-radius:18px;background:#6f355c;transform:translateZ(-35px);opacity:.22;filter:blur(2px)}
        .notes-page{position:absolute;inset:0;background:#fff;border-radius:18px;overflow:hidden;backface-visibility:hidden;transform-style:preserve-3d;box-shadow:inset 0 0 0 1px #ffffffcc,0 5px 14px #4b254522;transition:transform .43s cubic-bezier(.2,.75,.2,1),opacity .43s ease;transform-origin:right center}
        .notes-page img{width:100%;height:100%;display:block;object-fit:cover;user-select:none;-webkit-user-drag:none}
        .notes-page.next{transform:rotateY(0deg);opacity:1;z-index:2}
        .notes-page.next.turn{transform:rotateY(-180deg);opacity:0;z-index:3}
        .notes-page.prev{transform:rotateY(0deg);opacity:1;z-index:2}
        .notes-page.prev.turn{transform:rotateY(180deg);opacity:0;z-index:3}
        .notes-book-spine{position:absolute;right:-2px;top:2%;bottom:2%;width:12px;border-radius:0 14px 14px 0;background:linear-gradient(90deg,#3f1d3b,#d28ab6 48%,#5b254e);z-index:5;box-shadow:-2px 0 6px #351a3522}
        .notes-controls{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:15px;flex-wrap:wrap}
        .notes-control{border:0;border-radius:14px;padding:11px 17px;background:#172554;color:white;font:inherit;font-weight:800;cursor:pointer;box-shadow:0 8px 18px #17255422}
        .notes-control:disabled{opacity:.35;cursor:not-allowed}
        .notes-counter{background:#ffffffaa;border:1px solid #fff;padding:8px 14px;border-radius:999px;font-weight:900;min-width:125px;text-align:center}
        .notes-hint{margin:8px 0 0;color:#59405b;font-size:12px;font-weight:700;text-align:center}
        @media(max-width:600px){.notes-book-page{padding:12px 8px 20px}.notes-book-top{align-items:flex-start}.notes-title{font-size:16px}.notes-back,.notes-home{padding:8px 10px;font-size:11px}.notes-book{width:94vw}.notes-control{padding:9px 12px;font-size:12px}}
      `}</style>

      <div className="notes-book-top">
        <button className="notes-home" type="button" onClick={onBack}><FaHouse /> الرئيسية</button>
        <h1 className="notes-title"><FaBookOpen /> دفتر الملاحظات</h1>
        <button className="notes-back" type="button" onClick={onBack}><FaArrowRight /> رجوع</button>
      </div>

      <div className="notes-book-wrap">
        <div className="notes-book" aria-label="دفتر الملاحظات">
          <div className={`notes-page ${direction} ${turning ? 'turn' : ''}`}>
            <img src={pages[page].src} alt={pages[page].alt} draggable="false" />
          </div>
          <div className="notes-book-spine" aria-hidden="true" />
        </div>
      </div>

      <div className="notes-controls">
        <button className="notes-control" disabled={page >= pages.length - 1 || turning} onClick={() => go(page + 1, 'next')} type="button"><FaArrowRight /> الصفحة التالية</button>
        <div className="notes-counter">{page + 1} / {pages.length} — {pages[page].label}</div>
        <button className="notes-control" disabled={page <= 0 || turning} onClick={() => go(page - 1, 'prev')} type="button"><FaArrowLeft /> الصفحة السابقة</button>
      </div>
      <p className="notes-hint">استخدم أزرار التقليب لفتح الدفتر صفحةً صفحةً 📖</p>
    </div>
  );
}
