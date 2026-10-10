# تكامل مراسلات الطلاب — نشر واختبار

## الدالة
المسار: `supabase/functions/submit-unregistered-support-request/index.ts`
تتعامل مع الطالب المسجل وغير المسجل، وتوفّر عمليات list/send/mark-read/delete/restore/attachment-url. لا تعتمد على ملف `_shared/cors.ts`.

## إعداد Supabase
من Edge Functions > Secrets أضف/تحقق من:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (سر خادم فقط، لا يوضع في Vercel أو ملفات الواجهة)
ثم انشر:
`supabase functions deploy submit-unregistered-support-request --no-verify-jwt`

## SQL
شغّل migrations بالترتيب: 009 ثم 010 ثم 011 ثم 012. تحقق من أن bucket `student-support-messages` موجود وPrivate.
لا تضف سياسات RLS عامة لجدول `student_support_messages`.

## ملاحظة الهوية
الطالب المسجل يعاد التحقق من رقم جلوسه وكلمة مروره عند كل عملية. الطالب غير المسجل يُتحقق من رقم الهوية مقابل `allow_student`؛ هذا لا يعادل مصادقة قوية إذا كانت أرقام الهوية معروفة للغير، لذا لا تعتبره تحققًا عالي الضمان دون إضافة رمز تحقق منفصل.
