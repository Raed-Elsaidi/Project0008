import React,{useEffect,useState} from 'react';
import {
  FaArrowRight, FaUserPlus, FaGraduationCap, FaKey, FaChartColumn,
  FaHeadset, FaBookOpen, FaLaptopFile, FaShieldHalved,
  FaFileCircleCheck, FaCircleInfo
} from 'react-icons/fa6';
import {supabase} from './supabaseClient';

// Filled icons are selected by the guide's subject, not by its position in the list.
const guideIconRules = [
  {match: /(تسجيل|حساب جديد|انشاء حساب|إنشاء حساب|طالب جديد|register|sign.?up|account)/i, Icon: FaUserPlus, color:'#6d28d9'},
  {match: /(امتحان|اختبار|استعداد|الدخول|تقديم|exam|test|assessment)/i, Icon: FaGraduationCap, color:'#0369a1'},
  {match: /(كلمة المرور|كلمه المرور|مرور|password|login|تسجيل الدخول)/i, Icon: FaKey, color:'#be185d'},
  {match: /(نتيجة|نتائج|درجات|علامات|شهادة|result|grade|score)/i, Icon: FaChartColumn, color:'#a16207'},
  {match: /(دعم فني|تواصل|مساعدة|شكوى|support|contact|help)/i, Icon: FaHeadset, color:'#047857'},
  {match: /(تعليمات|إرشاد|ارشاد|دليل|guideline|instruction)/i, Icon: FaBookOpen, color:'#0f766e'},
  {match: /(جهاز|جاهزية|متصفح|كاميرا|ميكروفون|device|readiness)/i, Icon: FaLaptopFile, color:'#1d4ed8'},
  {match: /(تحقق|هوية|أمان|امان|حماية|verification|security)/i, Icon: FaShieldHalved, color:'#475569'},
  {match: /(طلب|مستند|وثيقة|نموذج|document|form)/i, Icon: FaFileCircleCheck, color:'#7c3aed'}
];
const fallbackGuide = {Icon:FaCircleInfo,color:'#2563eb'};
const getGuideVisual = (title='') => guideIconRules.find(rule=>rule.match.test(String(title))) || fallbackGuide;
export default function StudentGuides({onBack}){const [guides,setGuides]=useState([]);const [selected,setSelected]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
useEffect(()=>{let live=true;(async()=>{try{const {data,error}=await supabase.from('student_guides').select('id,title,details,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true});if(error)throw error;if(live)setGuides(Array.isArray(data)?data:[]);}catch{if(live){setGuides([]);setError('تعذر تحميل الإرشادات المنشورة حاليًا.');}}finally{if(live)setLoading(false)}})();return()=>{live=false}},[]);
return <main dir="rtl" style={{minHeight:'100vh',padding:'24px 16px',background:'radial-gradient(circle at top,#173b69,#071326 70%)',fontFamily:'Tahoma,Arial',color:'#f8fafc'}}><div style={{maxWidth:1000,margin:'0 auto'}}><button onClick={onBack} style={{border:'1px solid #526b8a',background:'#142b48',color:'white',borderRadius:12,padding:'10px 16px',cursor:'pointer'}}><FaArrowRight/> الرئيسية</button><header style={{textAlign:'center',padding:'20px 0'}}><FaBookOpen size={38} color="#67e8f9"/><h1 style={{margin:'12px 0 6px'}}>الإرشادات والتعليمات</h1><p style={{color:'#cbd5e1'}}>اختر موضوعاً لعرض التعليمات الخاصة به</p></header>{error&&<p role="status" style={{color:'#fde68a',textAlign:'center',fontSize:13}}>{error}</p>}{loading&&<p style={{textAlign:'center'}}>جارٍ تحميل الإرشادات…</p>}{selected? <section style={{background:'#10233d',border:'1px solid #3a5678',borderRadius:18,padding:24,whiteSpace:'pre-wrap',lineHeight:2}}><button onClick={()=>setSelected(null)} style={{float:'left',background:'#1e4267',color:'white',border:0,borderRadius:9,padding:'8px 12px',cursor:'pointer'}}>رجوع للقائمة</button><h2 style={{color:'#67e8f9',marginTop:0}}>{selected.title}</h2><p>{selected.details||'لا توجد تفاصيل مضافة لهذا الموضوع بعد.'}</p></section>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:14}}>{guides.length===0&&!loading&&!error&&<p role="status" style={{gridColumn:'1 / -1',textAlign:'center',color:'#cbd5e1',padding:28}}>لا توجد إرشادات متاحة حاليًا.</p>}{guides.map((g)=>{const {Icon,color}=getGuideVisual(g.title);return <button key={g.id||g.title} onClick={()=>setSelected(g)} style={{textAlign:'right',display:'flex',alignItems:'center',gap:14,minHeight:105,padding:18,borderRadius:17,border:'1px solid #365779',background:'linear-gradient(135deg,#132b49,#0e1e34)',color:'white',cursor:'pointer',boxShadow:'0 8px 24px #0003'}}><span style={{display:'grid',placeItems:'center',minWidth:52,height:52,borderRadius:15,background:color,fontSize:23}}><Icon/></span><span><b style={{display:'block',fontSize:16,marginBottom:7}}>{g.title}</b><small style={{color:'#cbd5e1'}}>اضغط لعرض التفاصيل ←</small></span></button>})}</div>}</div></main>}
