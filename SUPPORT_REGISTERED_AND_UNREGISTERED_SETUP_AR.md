# إعداد مراسلات الطلاب المسجلين وغير المسجلين

تستخدم الدالة `submit-unregistered-support-request` الآن مسارًا مشتركًا.

- الطالب المسجل: يرسل `audience: registered` مع رقم الجلوس وكلمة المرور وعنوان الرسالة والنص. تتحقق الدالة على الخادم من `students.is_active` وتستدعي `verify_student_password` قبل الحفظ.
- الطالب غير المسجل: يرسل `audience: unregistered` مع رقم الهوية ونوع المشكلة والنص؛ تتحقق الدالة من `allow_student`.
- كلا المسارين يحفظان الرسائل في `student_support_messages` ويرفعان المرفقات إلى bucket خاص `student-support-messages` (حد 5MB).

## تفعيل واختبار
1. شغّل migrations الخاصة بجدول الرسائل (`009` ثم `010`) وملف إنشاء bucket (`011`).
2. انشر الدالة: `supabase functions deploy submit-unregistered-support-request --no-verify-jwt`.
3. تأكد أن أسرار `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` موجودة في بيئة الدالة فقط.
4. اختبر رسالة لطالب مسجل وآخرى لهوية موجودة في `allow_student`، وتأكد من صفوف الجدول.

ملاحظة أمنية: كلمة المرور محفوظة مؤقتًا في حالة React فقط لإعادة التحقق من جهة الخادم عند الإرسال، ولا تُخزن في قاعدة الرسائل. امسح حالة التحقق عند الخروج من نموذج الدعم. لا تضع مفتاح service role في الواجهة.
