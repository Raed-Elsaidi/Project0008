// Shared secure Edge Function for registered and unregistered student support.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,"Content-Type":"application/json"}});
const allowedIssues = new Set(["عدم التسجيل", "نسيت رقم الجلوس"]);
const safeName = (value: unknown) => String(value ?? "attachment").replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g,"_").slice(0,120);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:corsHeaders});
  if (req.method !== "POST") return json({ok:false,error:"Method not allowed"},405);
  let uploadedPath: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ok:false,error:"إعدادات الخادم غير مكتملة."},500);
    const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const payload = await req.json();
    const audience = String(payload.audience ?? "unregistered");
    const message = String(payload.message ?? "").trim();
    const subject = String(payload.subject ?? "").trim().slice(0,200);
    if (message.length < 1 || message.length > 5000) return json({ok:false,error:"اكتب تفاصيل الرسالة (حتى 5000 حرف)."},400);
    let studentId: number | null = null;
    let nationalId: string | null = null;
    let issue: string | null = null;
    let folder = "";
    if (audience === "registered") {
      const seat = String(payload.seating_number ?? "").trim();
      const password = String(payload.password ?? "");
      if (!seat || !password || password.length > 200) return json({ok:false,error:"أدخل رقم الجلوس وكلمة المرور."},400);
      const {data:student,error:studentError} = await admin.from("students").select("id,seating_number,is_active").eq("seating_number",seat).maybeSingle();
      if (studentError) return json({ok:false,error:"تعذر التحقق من بيانات الطالب."},500);
      if (!student || student.is_active === false) return json({ok:false,error:"رقم الجلوس أو كلمة المرور غير صحيحة."},403);
      const {data:valid,error:verifyError} = await admin.rpc("verify_student_password",{p_seating_number:seat,p_password:password});
      if (verifyError) return json({ok:false,error:"تعذر التحقق من كلمة المرور. تأكد من تشغيل دالة verify_student_password."},500);
      if (valid !== true) return json({ok:false,error:"رقم الجلوس أو كلمة المرور غير صحيحة."},403);
      studentId = Number(student.id);
      folder = `registered/${studentId}`;
    } else if (audience === "unregistered") {
      nationalId = String(payload.national_id ?? "").replace(/\s/g,"");
      issue = String(payload.issue_type ?? "");
      if (!/^\d{9}$/.test(nationalId)) return json({ok:false,error:"رقم الهوية يجب أن يتكون من 9 أرقام."},400);
      if (!allowedIssues.has(issue)) return json({ok:false,error:"نوع المشكلة غير صالح."},400);
      const {data:allowed,error:allowError} = await admin.from("allow_student").select("national_id").eq("national_id",nationalId).maybeSingle();
      if (allowError) return json({ok:false,error:"تعذر التحقق من الهوية في قاعدة البيانات."},500);
      if (!allowed) return json({ok:false,error:"رقم الهوية غير موجود ضمن قائمة السماح."},403);
      folder = `unregistered/${nationalId}`;
    } else return json({ok:false,error:"نوع الطالب غير صالح."},400);
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;
    const attachment = payload.attachment;
    if (attachment != null) {
      const name = safeName(attachment.name);
      const mime = String(attachment.mime ?? "application/octet-stream").slice(0,120);
      const encoded = String(attachment.base64 ?? "");
      if (!encoded || encoded.length > 7_000_000) return json({ok:false,error:"حجم المرفق يتجاوز 5 ميجابايت."},400);
      const binary = atob(encoded);
      if (binary.length > 5*1024*1024) return json({ok:false,error:"حجم المرفق يتجاوز 5 ميجابايت."},400);
      const bytes = new Uint8Array(binary.length); for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      attachmentPath = `${folder}/${crypto.randomUUID()}_${name}`;
      const {error:uploadError} = await admin.storage.from("student-support-messages").upload(attachmentPath,bytes,{contentType:mime,upsert:false});
      if (uploadError) return json({ok:false,error:"تعذر رفع المرفق. تأكد من إنشاء bucket خاص باسم student-support-messages."},500);
      uploadedPath = attachmentPath; attachmentName=name; attachmentMime=mime; attachmentSize=bytes.length;
    }
    const row = audience === "registered" ? {
      student_id:studentId,national_id:null,audience:"registered",issue_type:null,sender_type:"student",sender_employee_id:null,
      subject:subject || "طلب دعم فني",message,attachment_path:attachmentPath,attachment_name:attachmentName,attachment_mime:attachmentMime,attachment_size:attachmentSize,
      delivered_at:new Date().toISOString(),is_read:false,read_at:null,sender_deleted_at:null,recipient_deleted_at:null
    } : {
      student_id:null,national_id:nationalId,audience:"unregistered",issue_type:issue,sender_type:"student",sender_employee_id:null,
      subject:issue,message,attachment_path:attachmentPath,attachment_name:attachmentName,attachment_mime:attachmentMime,attachment_size:attachmentSize,
      delivered_at:new Date().toISOString(),is_read:false,read_at:null,sender_deleted_at:null,recipient_deleted_at:null
    };
    const {data:inserted,error:insertError} = await admin.from("student_support_messages").insert(row).select("id").single();
    if (insertError) {
      if (uploadedPath) await admin.storage.from("student-support-messages").remove([uploadedPath]);
      return json({ok:false,error:"تعذر حفظ الرسالة. تأكد من تشغيل migrations الخاصة بجدول المراسلات."},500);
    }
    return json({ok:true,request_id:inserted.id});
  } catch (_error) { return json({ok:false,error:"حدث خطأ غير متوقع أثناء إرسال الرسالة."},500); }
});
