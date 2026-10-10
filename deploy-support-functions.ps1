$ErrorActionPreference = "Stop"
supabase functions deploy submit-unregistered-support-request --no-verify-jwt
supabase functions deploy staff-support-api --no-verify-jwt
Write-Host "Functions deployed. Ensure secrets are configured in Supabase Dashboard."
