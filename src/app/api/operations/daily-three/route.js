import { NextResponse } from "next/server";
import { requireOwner } from "../../../../lib/ownerOperations";
import { safeFailure } from "../../../../lib/apiSecurity";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const supabase = access.supabase; const today = new Date().toISOString().slice(0, 10); const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const futureThrough = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const results = await Promise.all([
    supabase.from("profiles").select("id,username,display_name"), supabase.from("daily_polls").select("id,poll_date"), supabase.from("daily_poll_answers").select("poll_id,user_id,answered_at"), supabase.from("daily_draft_brackets").select("id,game_date"), supabase.from("daily_bracket_matchups").select("bracket_id,user_id,created_at").eq("round_number", 3), supabase.from("daily_quizzes").select("id,quiz_date"), supabase.from("daily_quiz_answers").select("quiz_id,user_id,answered_at"), supabase.from("daily_three_completions").select("user_id,activity_date,completed_at").order("activity_date", { ascending: false }),
    supabase.from("daily_polls").select("id,poll_date,question,answer_type,options").gte("poll_date", today).lte("poll_date", futureThrough).order("poll_date"),
    supabase.from("daily_quizzes").select("id,quiz_date,prompt,hint,difficulty,accepted_answers").gte("quiz_date", today).lte("quiz_date", futureThrough).order("quiz_date"),
    supabase.from("community_questions_of_the_day").select("question_date,question,topic").gte("question_date", today).lte("question_date", futureThrough).order("question_date"),
  ]);
  const failure = results.find((result) => result.error); if (failure) return safeFailure(failure.error, "Daily Games operations data could not be loaded.", { context: "operations-daily-games" });
  const [profiles, polls, pollAnswers, brackets, bracketAnswers, quizzes, quizAnswers, completions, futurePolls, futureQuizzes, futureQuestions] = results.map((result) => result.data || []);
  const pollDates = new Map(polls.map((row) => [row.id, row.poll_date])); const bracketDates = new Map(brackets.map((row) => [row.id, row.game_date])); const quizDates = new Map(quizzes.map((row) => [row.id, row.quiz_date]));
  const users = new Map(profiles.map((profile) => [profile.id, { user_id: profile.id, username: profile.username, display_name: profile.display_name, last_activity_at: null, last_activity_date: null, last_completed_date: null, completed_days_total: 0, completed_days_30: 0, today: { poll: false, bracket: false, quiz: false, complete: false } }]));
  function activity(userId, date, timestamp, kind) { const user = users.get(userId); if (!user || !date) return; if (!user.last_activity_at || new Date(timestamp) > new Date(user.last_activity_at)) { user.last_activity_at = timestamp; user.last_activity_date = date; } if (date === today) user.today[kind] = true; }
  for (const row of pollAnswers) activity(row.user_id, pollDates.get(row.poll_id), row.answered_at, "poll"); for (const row of bracketAnswers) activity(row.user_id, bracketDates.get(row.bracket_id), row.created_at, "bracket"); for (const row of quizAnswers) activity(row.user_id, quizDates.get(row.quiz_id), row.answered_at, "quiz");
  for (const row of completions) { const user = users.get(row.user_id); if (!user) continue; user.completed_days_total += 1; if (row.activity_date >= since) user.completed_days_30 += 1; if (!user.last_completed_date || row.activity_date > user.last_completed_date) user.last_completed_date = row.activity_date; if (row.activity_date === today) user.today.complete = true; }
  const list = [...users.values()].sort((a, b) => !a.last_activity_at ? 1 : !b.last_activity_at ? -1 : new Date(b.last_activity_at) - new Date(a.last_activity_at)); const participants = list.filter((user) => user.last_activity_at);
  return NextResponse.json({ generated_at: new Date().toISOString(), today, editorial: { polls: futurePolls, quizzes: futureQuizzes, questions: futureQuestions }, totals: { registered_users: users.size, participants: participants.length, participated_today: participants.filter((user) => user.last_activity_date === today).length, completed_today: participants.filter((user) => user.today.complete).length, completed_last_30_days: participants.filter((user) => user.completed_days_30 > 0).length }, users: list });
}

export async function PUT(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json(); const today = new Date().toISOString().slice(0, 10); const date = String(body.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today) return NextResponse.json({ error: "Choose a future date. Live and past activities cannot be changed." }, { status: 400 });
    let result;
    if (body.kind === "poll") {
      const question = String(body.question || "").trim(); const labels = (body.options || []).map((value) => String(value).trim()).filter(Boolean);
      if (question.length < 5 || labels.length < 2 || labels.length > 8) return NextResponse.json({ error: "Polls need a question and 2–8 choices." }, { status: 400 });
      result = await access.supabase.from("daily_polls").upsert({ poll_date: date, question, answer_type: "pokemon", options: labels.map((label, index) => ({ key: String.fromCharCode(97 + index), label })) }, { onConflict: "poll_date" });
    } else if (body.kind === "quiz") {
      const prompt = String(body.prompt || "").trim(); const answers = (body.accepted_answers || []).map((value) => String(value).trim()).filter(Boolean);
      if (prompt.length < 5 || !answers.length || !["easy","medium","hard","expert"].includes(body.difficulty)) return NextResponse.json({ error: "Quiz details are incomplete." }, { status: 400 });
      result = await access.supabase.from("daily_quizzes").upsert({ quiz_date: date, prompt, hint: String(body.hint || "").trim() || null, difficulty: body.difficulty, accepted_answers: answers }, { onConflict: "quiz_date" });
    } else if (body.kind === "question") {
      const question = String(body.question || "").trim(); if (question.length < 5 || question.length > 300) return NextResponse.json({ error: "Question of the Day must be 5–300 characters." }, { status: 400 });
      result = await access.supabase.from("community_questions_of_the_day").upsert({ question_date: date, question, topic: body.topic === "pokemon" ? "pokemon" : "human", updated_at: new Date().toISOString() }, { onConflict: "question_date" });
    } else return NextResponse.json({ error: "Unknown editorial item." }, { status: 400 });
    if (result.error) throw result.error; return NextResponse.json({ saved: true });
  } catch (error) { return safeFailure(error, "The editorial calendar could not be saved.", { context: "operations-daily-three-save" }); }
}
