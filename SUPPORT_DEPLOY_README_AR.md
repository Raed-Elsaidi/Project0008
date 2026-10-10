# إعداد ونشر طلبات الدعم للطلاب غير المسجلين

## 1) إنشاء Storage bucket خاص
1. افتح Supabase Dashboard للمشروع الصحيح.
2. ادخل إلى SQL Editor.
3. افتح `database_migrations/011_create_private_support_bucket.sql` وانسخ محتواه.
4. نفّذ SQL. ينشئ bucket باسم `student-support-messages` ويجبره على أن يكون Private، وحدّ الملف 5 MiB وأنواع الملفات المسموحة PDF/JPEG/PNG/WebP/TXT.

## 2) تشغيل migration الخاصة بجدول الطلبات
شغّل `database_migrations/010_unregistered_support_requests.sql` بعد إنشاء جدول `student_support_messages` الأساسي. إذا كنت قد شغّلت الملف من قبل وظهرت مشكلة بسبب constraint موجود مسبقًا، لا تعِد تشغيله عشوائيًا؛ راجع أسماء القيود في قاعدة البيانات أولًا.

## 3) نشر Edge Function من Windows / PowerShell
- افتح PowerShell في مجلد `student_work` (المجلد الذي يحتوي على مجلد `supabase`).
- ثبّت Supabase CLI إن لم يكن مثبتًا.
- نفّذ:

```powershell
.\scripts\deploy-support-function.ps1
```

- سجّل الدخول عند الطلب، وأدخل Project Reference الصحيح من إعدادات مشروع Supabase.

## ملاحظات أمان
- لا تضع `SUPABASE_SERVICE_ROLE_KEY` في React أو `.env` الخاص بالواجهة أو GitHub.
- بيئة Supabase Edge Functions توفر `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` كمتغيرات نظام افتراضية. لا حاجة لإضافتهما يدويًا إلا إذا كانت بيئتك مختلفة.
- الخيار `--no-verify-jwt` مطلوب لأن نموذج غير المسجلين لا يملك جلسة Supabase Auth؛ لذلك يجب أن تتحقق الدالة من كل المدخلات على الخادم. قبل الإنتاج، أضف rate limiting / CAPTCHA لمنع إساءة استخدام endpoint العام.
- نشر الدالة لا يثبت نجاحها وحده؛ اختبر طلبًا حقيقيًا وتحقق من ظهور الصف في `student_support_messages` ومن رفع المرفق إلى bucket الخاص.
