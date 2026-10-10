# إعداد إرسال طلبات الدعم للطلاب غير المسجلين

1. في Supabase SQL Editor شغّل `database_migrations/010_unregistered_support_requests.sql` بعد ترحيل إنشاء `student_support_messages`.
2. أنشئ Storage bucket باسم `student-support-messages` واجعله **Private** (لا تفعّل القراءة العامة).
3. من مجلد المشروع شغّل: `supabase functions deploy submit-unregistered-support-request --no-verify-jwt` لأن الطالب غير المسجل لا يملك جلسة Auth.
4. اضبط الأسرار في مشروع Supabase: `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` (مفتاح الخدمة على الخادم فقط، لا تضعه في React أو Vercel client env). عادةً تكون هذه المتغيرات متاحة تلقائيًا داخل Edge Functions؛ إن لم تكن متاحة، اضبطها عبر Supabase secrets.
5. لا تفتح سياسات SELECT/INSERT العامة على `student_support_messages`. الدالة وحدها تستخدم service role وتتحقق من `allow_student` على الخادم.
6. اختبر رقم هوية موجودًا ثم تحقق من وصول صف جديد في `student_support_messages`، واختبر رقمًا غير موجود للتأكد من رفضه.

ملاحظة: هذا المسار يرسل طلبات الطلاب غير المسجلين. المراسلات الخاصة للطلاب المسجلين ما زالت تحتاج آلية جلسة/تفويض آمنة مستقلة لأن تسجيل دخولهم الحالي مخصص وليس Supabase Auth.
