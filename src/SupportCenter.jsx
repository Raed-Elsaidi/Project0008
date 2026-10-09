import React from 'react';
import { FaArrowRight, FaMessage } from 'react-icons/fa6';

export default function SupportCenter({ onBack }) {
  return (
    <div dir="rtl" style={{
      minHeight:'100vh',
      padding:20,
      background:'#f8fafc',
      fontFamily:'Tahoma,Arial'
    }}>
      <div style={{
        maxWidth:760,
        margin:'40px auto',
        background:'#fff',
        padding:25,
        borderRadius:20,
        boxShadow:'0 15px 45px rgba(9,43,76,.10)',
        border:'1px solid #e4edf4'
      }}>
        <button
          onClick={onBack}
          style={{
            display:'inline-flex',
            alignItems:'center',
            gap:8,
            padding:'9px 14px',
            border:'1px solid #d8e3ec',
            borderRadius:10,
            background:'#fff',
            color:'#092b4c',
            fontWeight:700,
            cursor:'pointer'
          }}
        >
          <FaArrowRight/> الرئيسية
        </button>

        <h2 style={{textAlign:'center',color:'#092b4c',margin:'24px 0 8px'}}>
          🛠️ الدعم الفني
        </h2>
        <p style={{textAlign:'center',color:'#64748b',lineHeight:1.8,marginBottom:22}}>
          تواصل مع فريق الدعم الفني للاستفسارات والمشكلات المتعلقة بالبوابة والامتحانات.
        </p>

        <div style={{display:'grid',gap:14}}>
          <button style={{
            display:'flex',
            alignItems:'center',
            gap:15,
            textAlign:'right',
            padding:20,
            border:'1px solid #dbeafe',
            borderRadius:16,
            background:'#f8fbff',
            color:'#123b67',
            cursor:'pointer'
          }}>
            <FaMessage size={28}/>
            <span>
              <b style={{display:'block',marginBottom:5}}>الاستفسارات والشكاوى</b>
              <small style={{color:'#64748b'}}>التواصل مع فريق الدعم الفني وطرح المشكلة أو الاستفسار.</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
