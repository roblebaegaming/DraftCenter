# DraftCenter Supabase registration email

The version-controlled confirmation template is:

`supabase/email-templates/confirm-signup.html`

## Install in Supabase

1. Open the production Supabase project.
2. Go to **Authentication → Email Templates → Confirm signup**.
3. Set the subject to **Confirm your DraftCenter account**.
4. Replace the message body with the complete HTML template from this
   repository.
5. Save the template.
6. Confirm the Auth **Site URL** is `https://www.draftcentral.gg` and review the
   allowed redirect URLs before testing.

The template uses Supabase's `{{ .ConfirmationURL }}` variable for both the
button and its fallback link. Do not replace it with a hard-coded token or URL.

## Test safely

1. Register a new test address that you can access.
2. Confirm the sender name, subject, logo, button, fallback URL, mobile layout,
   and spam-folder placement.
3. Follow the button and confirm it returns to DraftCenter with a valid session
   or sign-in path.
4. Test in at least Gmail and one other major mailbox provider.
5. Remove the test account through the approved account-deletion workflow when
   finished.

## Deliverability notes

- Keep Supabase custom SMTP configured with the verified DraftCenter sending
  domain used by Resend.
- Ensure SPF and DKIM remain valid for that domain; add DMARC when the sending
  policy is ready.
- Use a monitored reply-to address even when replies are not the primary
  support path.
- Avoid adding large images, attachments, tracking-heavy content, or marketing
  language to this transactional message.
