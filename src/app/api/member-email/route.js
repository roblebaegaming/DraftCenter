import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { consumeUserRateLimit } from "../../../lib/apiRateLimit";
import { bearerToken, readBoundedJson, safeFailure, safeStoredFailure } from "../../../lib/apiSecurity";
import {
  MEMBER_EMAIL_MAX_RECIPIENTS,
  memberEmailChunks,
  memberEmailContent,
  normalizeMemberEmailRequest,
} from "../../../lib/memberEmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const DRAFTCENTER_PUBLIC_ORIGIN = "https://www.draftcentral.gg";

async function resolveScope(supabase, userId, scopeType, scopeId) {
  if (scopeType === "league") {
    const [{ data: membership, error: membershipError }, { data: league, error: leagueError }] = await Promise.all([
      supabase.from("league_memberships").select("role").eq("league_id", scopeId).eq("user_id", userId).is("archived_at", null).maybeSingle(),
      supabase.from("leagues").select("id,name,slug").eq("id", scopeId).maybeSingle(),
    ]);
    if (membershipError || leagueError) throw membershipError || leagueError;
    if (!membership || !["commissioner", "co_commissioner"].includes(membership.role)) return { error: "League commissioner access is required.", status: 403 };
    if (!league) return { error: "League not found.", status: 404 };
    return { name: league.name, path: `/?league=${encodeURIComponent(league.slug)}` };
  }

  const [{ data: membership, error: membershipError }, { data: organization, error: organizationError }] = await Promise.all([
    supabase.from("league_organization_memberships").select("role").eq("organization_id", scopeId).eq("user_id", userId).maybeSingle(),
    supabase.from("league_organizations").select("id,name,slug").eq("id", scopeId).maybeSingle(),
  ]);
  if (membershipError || organizationError) throw membershipError || organizationError;
  if (!membership || !["owner", "administrator"].includes(membership.role)) return { error: "Organization commissioner access is required.", status: 403 };
  if (!organization) return { error: "Organization not found.", status: 404 };
  return { name: organization.name, path: `/organizations/${encodeURIComponent(organization.slug)}` };
}

async function updateBroadcast(supabase, requestId, values) {
  const { data, error } = await supabase.from("member_email_broadcasts").update({ ...values, updated_at: new Date().toISOString() }).eq("id", requestId).select("id").maybeSingle();
  if (error || !data) throw error || new Error("The private submission ledger could not be updated.");
}

async function sendResendBatch(messages, idempotencyKey) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Member email delivery is not configured yet.");
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw Object.assign(new Error("The email provider rejected the member email."), { status: response.status });
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readBoundedJson(request, { maxBytes: 8 * 1024, maxDepth: 2, maxEntries: 8, maxArrayLength: 1, maxStringLength: 5000 });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const payload = normalizeMemberEmailRequest(parsed.data);
  if (payload.error) return NextResponse.json({ error: payload.error }, { status: payload.status });

  let supabase;
  let broadcastCreated = false;
  let submittedCount = 0;
  try {
    supabase = createAdminClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing, error: existingError } = await supabase.from("member_email_broadcasts")
      .select("sender_user_id,status,recipient_count,submitted_count")
      .eq("id", payload.requestId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.sender_user_id !== auth.user.id) return NextResponse.json({ error: "That email request is not available." }, { status: 409 });
      if (existing.status === "submitted") return NextResponse.json({ submitted: true, recipient_count: existing.recipient_count, duplicate: true });
      return NextResponse.json({ error: "That email request is already being processed or previously failed. Start a new send only after reviewing the prior submission." }, { status: 409 });
    }

    const scope = await resolveScope(supabase, auth.user.id, payload.scopeType, payload.scopeId);
    if (scope.error) return NextResponse.json({ error: scope.error }, { status: scope.status });
    if (!await consumeUserRateLimit(supabase, "member-email-scope", `${auth.user.id}:${payload.scopeType}:${payload.scopeId}`, 3, 3600)) {
      return NextResponse.json({ error: "This audience has already received several emails recently. Try again later." }, { status: 429 });
    }
    if (!await consumeUserRateLimit(supabase, "member-email-account", auth.user.id, 10, 86400)) {
      return NextResponse.json({ error: "Your daily member-email limit has been reached. Try again tomorrow." }, { status: 429 });
    }

    const [{ data: recipients, error: recipientError }, { data: profile, error: profileError }] = await Promise.all([
      supabase.rpc("resolve_member_email_audience", { p_sender_user_id: auth.user.id, p_scope_type: payload.scopeType, p_scope_id: payload.scopeId }),
      supabase.from("profiles").select("display_name,username").eq("id", auth.user.id).maybeSingle(),
    ]);
    if (recipientError || profileError) throw recipientError || profileError;
    if ((recipients || []).length > MEMBER_EMAIL_MAX_RECIPIENTS) {
      return NextResponse.json({ error: `This audience has more than ${MEMBER_EMAIL_MAX_RECIPIENTS} eligible recipients. Contact DraftCenter support before sending.` }, { status: 400 });
    }

    const senderName = String(profile?.display_name || (profile?.username ? `@${profile.username}` : "A commissioner")).replace(/[\r\n]+/g, " ").trim();
    const scopeName = String(scope.name).replace(/[\r\n]+/g, " ").trim();
    const scopeUrl = new URL(scope.path, DRAFTCENTER_PUBLIC_ORIGIN).toString();
    const profileUrl = new URL("/?profile=open", DRAFTCENTER_PUBLIC_ORIGIN).toString();
    const content = memberEmailContent({ ...payload, scopeName, senderName, scopeUrl, profileUrl });
    const { error: insertError } = await supabase.from("member_email_broadcasts").insert({
      id: payload.requestId,
      sender_user_id: auth.user.id,
      scope_type: payload.scopeType,
      scope_id: payload.scopeId,
      scope_name: scopeName,
      subject: payload.subject,
      recipient_count: (recipients || []).length,
    });
    if (insertError) throw insertError;
    broadcastCreated = true;

    const subject = `[${scopeName}] ${payload.subject}`.slice(0, 240);
    const chunks = memberEmailChunks(recipients || []);
    for (let index = 0; index < chunks.length; index += 1) {
      const messages = chunks[index].map((recipient) => ({
        from: process.env.RESEND_FROM_EMAIL,
        to: [recipient.email],
        subject,
        html: content.html,
        text: content.text,
        tags: [{ name: "audience", value: payload.scopeType }, { name: "broadcast", value: payload.requestId.replaceAll("-", "") }],
      }));
      await sendResendBatch(messages, `member-email/${payload.requestId}/${index}`);
      submittedCount += messages.length;
      await updateBroadcast(supabase, payload.requestId, { submitted_count: submittedCount, provider_batch_count: index + 1 });
    }

    await updateBroadcast(supabase, payload.requestId, { status: "submitted", submitted_count: submittedCount, submitted_at: new Date().toISOString(), failure_summary: null });
    return NextResponse.json({ submitted: true, recipient_count: submittedCount });
  } catch (error) {
    if (broadcastCreated && supabase) {
      try {
        await updateBroadcast(supabase, payload.requestId, {
          status: "failed",
          submitted_count: submittedCount,
          failure_summary: safeStoredFailure(submittedCount ? `Submission stopped after ${submittedCount} recipients.` : "Member email submission failed."),
        });
      } catch {}
    }
    return safeFailure(error, submittedCount
      ? `Email submission stopped after ${submittedCount} recipients. Do not resend until you review the submission record.`
      : "The member email could not be sent.", { context: "member-email" });
  }
}
