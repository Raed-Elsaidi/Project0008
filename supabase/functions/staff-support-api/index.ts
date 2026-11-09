import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const unb64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4)), c=>c.charCodeAt(0));
async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
}
async function issueToken(payload: Record<string,unknown>, secret: string) {
  const body = b64url(encoder.encode(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+8*60*60})));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(body)));
  return `${body}.${b64url(sig)}`;
}
async function readToken(token: string, secret: string) {
  const parts=token.split(".");
  if(parts.length!==2) return null;
  const valid=await crypto.subtle.verify("HMAC",await signingKey(secret),unb64url(parts[1]),encoder.encode(parts[0]));
  if(!valid) return null;
  const data=JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
  if(!data.exp || data.exp < Math.floor(Date.now()/1000)) return null;
  return data;
}
const cleanName=(v:unknown)=>String(v??"attachment").replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g,"_").slice(0,120);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return reply({ok:false,error:"Method not allowed"},405);
 let uploadedPath:string|null=null;
 try {
  const url=Deno.env.get("SUPABASE_URL"), serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), tokenSecret=Deno.env.get("SUPPORT_STAFF_TOKEN_SECRET");
  if(!url||!serviceKey||!tokenSecret) return reply({ok:false,error:"إعدادات الخادم غير مكتملة: SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY وSUPPORT_STAFF_TOKEN_SECRET."},500);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const p=await req.json(); const action=String(p.action??"");
  if(action==="login"){
    const username=String(p.username??"").trim(), password=String(p.password??"");
    if(!username||!password||password.length>200) return reply({ok:false,error:"أدخل اسم المستخدم وكلمة المرور."},400);
    const {data: valid,error:verifyError}=await admin.rpc("verify_employee_password",{p_username:username,p_password:password});
    if(verifyError||valid!==true) return reply({ok:false,error:"بيانات الموظف غير صحيحة أو تعذر التحقق منها."},403);
    const {data: employee,error:empError}=await admin.from("employees").select("id,username,full_name,role,job_id,is_active").eq("username",username).maybeSingle();
    if(empError||!employee||employee.is_active===false) return reply({ok:false,error:"حساب الموظف غير نشط أو غير موجود."},403);
    const token=await issueToken({sub:Number(employee.id),username:employee.username,role:employee.role??"",job_id:employee.job_id??null},tokenSecret);
    return reply({ok:true,token,employee_id:employee.id});
  }
  const auth=String(req.headers.get("authorization")??"");
  const bearer=auth.startsWith("Bearer ")?auth.slice(7):String(p.staff_token??"");
  const session=await readToken(bearer,tokenSecret);
  if(!session?.sub) return reply({ok:false,error:"جلسة موظف الدعم غير صالحة. سجّل الخروج ثم الدخول مجددًا."},401);
  const {data:employee,error:employeeError}=await admin.from("employees").select("id,username,is_active").eq("id",Number(session.sub)).maybeSingle();
  if(employeeError||!employee||employee.is_active===false) return reply({ok:false,error:"حساب الموظف غير نشط."},403);
  const employeeId=Number(employee.id);
  if(action==="list"){
    const {data,error}=await admin.from("student_support_messages").select("*").order("created_at",{ascending:false}).limit(500);
    if(error) return reply({ok:false,error:"تعذر تحميل المراسلات. تحقق من migrations."},500);
    return reply({ok:true,messages:data??[]});
  }
  if(action==="send"){
    const subject=String(p.subject??"").trim().slice(0,200), message=String(p.message??"").trim();
    if(!subject||(!message&&!p.attachment)) return reply({ok:false,error:"أدخل عنوان الرسالة والتفاصيل."},400);
    if(message.length>5000) return reply({ok:false,error:"الرسالة أطول من الحد المسموح."},400);
    let path:string|null=null,name:string|null=null,mime:string|null=null,size:number|null=null;
    if(p.attachment){
      const a=p.attachment, encoded=String(a.base64??"");
      if(!encoded||encoded.length>35_000_000) return reply({ok:false,error:"المرفق غير صالح أو كبير جدًا."},400);
      let binary:string; try{binary=atob(encoded)}catch{return reply({ok:false,error:"ملف المرفق غير صالح."},400)}
      if(binary.length>25*1024*1024) return reply({ok:false,error:"الحد الأقصى للمرفق 25 ميجابايت."},400);
      const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      name=cleanName(a.name);mime=String(a.mime??"application/octet-stream").slice(0,120);size=bytes.length;
      path=`support/${employeeId}/${crypto.randomUUID()}_${name}`;
      const {error}=await admin.storage.from("student-support-messages").upload(path,bytes,{contentType:mime,upsert:false});
      if(error)return reply({ok:false,error:"تعذر رفع المرفق. تحقق من private bucket student-support-messages."},500);
      uploadedPath=path;
    }
    const rows:any[]=[];
    if(p.reply_to_id!=null){
      const targetId=Number(p.reply_to_id);
      const {data:original,error}=await admin.from("student_support_messages").select("id,student_id,national_id,audience,subject").eq("id",targetId).maybeSingle();
      if(error||!original)return reply({ok:false,error:"الرسالة الأصلية غير موجودة."},404);
      rows.push({student_id:original.student_id,national_id:original.national_id,audience:original.audience??(original.student_id?"registered":"unregistered"),sender_type:"support",sender_employee_id:employeeId,subject:subject||`رد: ${original.subject||"طلب دعم"}`,message,attachment_path:path,attachment_name:name,attachment_mime:mime,attachment_size:size,delivered_at:new Date().toISOString(),is_read:false,read_at:null,sender_deleted_at:null,recipient_deleted_at:null});
    } else {
      const ids=Array.isArray(p.student_ids)?p.student_ids.map(Number).filter(Number.isFinite):[];
      if(!ids.length)return reply({ok:false,error:"اختر طالبًا أو استخدم الرد على رسالة واردة."},400);
      for(const id of ids) rows.push({student_id:id,national_id:null,audience:"registered",sender_type:"support",sender_employee_id:employeeId,subject,message,attachment_path:path,attachment_name:name,attachment_mime:mime,attachment_size:size,delivered_at:new Date().toISOString(),is_read:false,read_at:null,sender_deleted_at:null,recipient_deleted_at:null});
    }
    const {data,error}=await admin.from("student_support_messages").insert(rows).select("*");
    if(error){if(uploadedPath)await admin.storage.from("student-support-messages").remove([uploadedPath]);return reply({ok:false,error:"تعذر حفظ الرسالة. تحقق من أعمدة جدول المراسلات."},500)}
    return reply({ok:true,messages:data??[]});
  }
  const id=Number(p.message_id);
  if(!Number.isSafeInteger(id)||id<=0)return reply({ok:false,error:"رقم الرسالة غير صالح."},400);
  const {data:m,error:msgError}=await admin.from("student_support_messages").select("*").eq("id",id).maybeSingle();
  if(msgError||!m)return reply({ok:false,error:"الرسالة غير موجودة."},404);
  if(action==="mark-read"){
    const {error}=await admin.from("student_support_messages").update({is_read:true,read_at:new Date().toISOString()}).eq("id",id);
    if(error)return reply({ok:false,error:"تعذر تحديث القراءة."},500);return reply({ok:true});
  }
  if(action==="delete"||action==="restore"){
    const isOwnSent=m.sender_type==="support"&&Number(m.sender_employee_id)===employeeId;
    const field=action==="restore"
      ? (m.sender_deleted_at ? "sender_deleted_at" : "recipient_deleted_at")
      : (isOwnSent ? "sender_deleted_at" : "recipient_deleted_at");
    const value=action==="delete"?new Date().toISOString():null;
    const {error}=await admin.from("student_support_messages").update({[field]:value}).eq("id",id);
    if(error)return reply({ok:false,error:"تعذر تحديث سلة المحذوفات."},500);return reply({ok:true,[field]:value});
  }
  if(action==="attachment-url"){
    if(!m.attachment_path)return reply({ok:false,error:"لا يوجد مرفق."},404);
    const {data,error}=await admin.storage.from("student-support-messages").createSignedUrl(m.attachment_path,300);
    if(error||!data?.signedUrl)return reply({ok:false,error:"تعذر إنشاء رابط المرفق."},500);
    return reply({ok:true,signed_url:data.signedUrl});
  }
  return reply({ok:false,error:"العملية غير مدعومة."},400);
 }catch(_){if(uploadedPath){}return reply({ok:false,error:"حدث خطأ غير متوقع في مراسلات الدعم."},500)}
});
