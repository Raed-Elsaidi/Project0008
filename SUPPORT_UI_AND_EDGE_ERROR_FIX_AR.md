.# إصلاح بطاقات الصفحة الرئيسية وخطأ إرسال طلب الدعم

## تعديلات الواجهة
- عنوان كل بطاقة في سطر مستقل.
- وصف البطاقة في السطر التالي، مع السماح بالتفاف النص على الهواتف.

## لماذا يظهر Failed to send a request to the Edge Function؟
هذه الرسالة غالباً تعني أن المتصفح لم يتمكن من الوصول إلى دالة Supabase، وليس بالضرورة أن بيانات الطلب خاطئة. يجب نشر الدالة على مشروع Supabase الذي يستخدمه الموقع.

## خطوات النشر
1. افتح مجلد `student_work` في الطرفية.
2. تأكد من تثبيت Supabase CLI ثم سجّل الدخول:
   `supabase login`
3. اربط المشروع الصحيح باستخدام Project Ref الموجود في عنوان Supabase:
   `supabase link --project-ref YOUR_PROJECT_REF`
4. اضبط أسرار الخادم (استبدل القيم الفعلية، ولا تضع مفتاح service role في الواجهة الأمامية):
   `supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`
5. انشر الدالة:
   `supabase functions deploy submit-unregistered-support-request --no-verify-jwt`
6. من لوحة Supabase افتح Edge Functions ثم `submit-unregistered-support-request` ثم Logs، وأعد تجربة الإرسال. ستعرض الواجهة الآن تفاصيل أوضح عند توفر استجابة HTTP من الدالة.
7. تأكد من تشغيل ملفات migrations الخاصة بجدول `student_support_messages` وإنشاء Storage bucket الخاص باسم `student-support-messages`.

## تنبيه
تم تعديل الملفات داخل الأرشيف وفحص سلامة ZIP فقط. لم يتم النشر إلى Vercel أو Supabase من هنا، ولم يتم إجراء اختبار حي على قاعدة بياناتك. نشر واجهة Vercel وحده لا ينشر Supabase Edge Functions تلقائياً.
