$ErrorActionPreference = 'Stop'

Write-Host 'StudentPortal - نشر دالة طلبات الدعم' -ForegroundColor Cyan

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host 'Supabase CLI غير مثبت. ثبّته أولاً من: https://supabase.com/docs/guides/cli' -ForegroundColor Red
  exit 1
}

$projectRef = Read-Host 'أدخل Project Reference من Supabase (ليس كلمة المرور ولا Service Role Key)'
if ([string]::IsNullOrWhiteSpace($projectRef)) {
  Write-Host 'Project Reference مطلوب.' -ForegroundColor Red
  exit 1
}

supabase login
if ($LASTEXITCODE -ne 0) { throw 'فشل تسجيل الدخول إلى Supabase CLI.' }

supabase link --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw 'فشل ربط مجلد المشروع بمشروع Supabase.' }

supabase functions deploy submit-unregistered-support-request --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw 'فشل نشر الدالة.' }

Write-Host ''
Write-Host 'تم إرسال أمر النشر بنجاح. اختبر الدالة من الموقع وتأكد من حفظ الطلب في student_support_messages.' -ForegroundColor Green
Write-Host 'تستخدم الدالة متغيرات SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY الافتراضية في بيئة Supabase Edge Functions؛ لا تضع مفتاح الخدمة في ملفات React أو Git.' -ForegroundColor Yellow
