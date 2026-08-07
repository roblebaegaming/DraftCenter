const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const projectUrl = new URL(required("TOURNAMENT_TEST_SUPABASE_URL"));
const publishableKey = required("TOURNAMENT_TEST_SUPABASE_PUBLISHABLE_KEY");
const expectedHost = required("TOURNAMENT_TEST_EXPECTED_PROJECT_HOST").toLowerCase();

if (process.env.TOURNAMENT_TEST_CONFIRM_ISOLATED !== "yes") {
  throw new Error("Set TOURNAMENT_TEST_CONFIRM_ISOLATED=yes only after verifying the disposable project.");
}
if (projectUrl.protocol !== "https:" || projectUrl.hostname.toLowerCase() !== expectedHost) {
  throw new Error("The tournament test URL does not match the explicitly verified isolated project host.");
}

const headers = {
  apikey: publishableKey,
  authorization: `Bearer ${publishableKey}`,
  "content-type": "application/json",
};

async function probe(functionName, body) {
  const response = await fetch(`${projectUrl.origin}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`The isolated tournament fixture failed the ${functionName} readiness probe (${response.status}).`);
  }
  return response.json();
}

const directory = await probe("list_tournaments", {});
if (!Array.isArray(directory)) {
  throw new Error("The isolated tournament directory returned an unexpected projection.");
}

const missingWorkspace = await probe("get_tournament_workspace", {
  p_slug: `fixture-readiness-${crypto.randomUUID()}`,
  p_access_code: null,
});
if (missingWorkspace !== null) {
  throw new Error("The missing-tournament privacy probe returned unexpected data.");
}

console.log("Isolated tournament fixture is ready for lifecycle testing.");
