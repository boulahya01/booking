This project previously included OTP-based password reset functions, but that flow
has been removed because the project does not have an external transactional
email provider configured. The application now uses Supabase's built-in recovery
emails and the `{{ .ConfirmationURL }}` template variable.

If you need the OTP flow later, re-introduce the functions and secure the
service role key via Supabase secrets. For now, this README is a placeholder.
