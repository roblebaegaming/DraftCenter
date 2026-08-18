const GENERIC_IMPORT_ERROR = "That PokéPaste could not be imported right now. Open the PokéPaste, copy its text, and paste it below.";

function responseError(status, payload) {
  const message = typeof payload?.error === "string" ? payload.error.trim() : "";
  if (message) return message;
  if (status === 401) return "Your sign-in session expired. Sign in again before importing a PokéPaste URL.";
  if (status === 404) return "That PokéPaste could not be found. Check the link and try again.";
  if (status === 413) return "That PokéPaste is too large to import.";
  if (status === 422) return "That PokéPaste is empty.";
  return GENERIC_IMPORT_ERROR;
}

export async function readTeamLabPokePasteResponse(response) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    throw new Error(GENERIC_IMPORT_ERROR);
  }

  let payload = null;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    if (response.ok && body.trim()) return body;
    throw new Error(GENERIC_IMPORT_ERROR);
  }

  if (!response.ok) throw new Error(responseError(response.status, payload));
  if (typeof payload?.text !== "string" || !payload.text.trim()) {
    throw new Error(GENERIC_IMPORT_ERROR);
  }
  return payload.text;
}
