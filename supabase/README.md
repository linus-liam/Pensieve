# Supabase Auth Email Hook

Pensieve uses Supabase Auth magic links. Supabase's built-in email sender is
rate-limited and is not intended for production traffic, so this project
includes a Send Email Auth Hook backed by Resend.

## Setup

1. Create a Resend API key and verify the sending domain.
2. Install and authenticate the Supabase CLI.
3. Link this folder to the Supabase project:

   ```sh
   supabase link --project-ref <project-ref>
   ```

4. Deploy the hook function:

   ```sh
   supabase functions deploy send-email
   ```

5. In Supabase Dashboard -> Authentication -> Hooks, create a Send Email hook:

   - Hook type: HTTPS
   - URL: `https://<project-ref>.supabase.co/functions/v1/send-email`
   - Secret: generate one in the dashboard and copy it

6. Copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill in
   the Resend values, and paste the generated hook secret into
   `SEND_EMAIL_HOOK_SECRET`.

7. Push the function secrets:

   ```sh
   supabase secrets set --env-file supabase/functions/.env
   ```

8. Keep the Email provider enabled under Authentication -> Providers -> Email.
   When the Send Email hook is enabled, Supabase Auth will call the hook instead
   of sending through its built-in SMTP service.

The function verifies Supabase's signed webhook payload before sending with
Resend. It intentionally has JWT verification disabled in `supabase/config.toml`
because Supabase Auth does not call hooks with an end-user JWT.
