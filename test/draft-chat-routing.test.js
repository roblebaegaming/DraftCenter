import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const league = fs.readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");

test("home routes League Board and direct-message unread notices separately", () => {
  assert.match(league, /unreadDirectMessages=\{unreadDirectCount\}/);
  assert.match(league, /unreadBoardMessages=\{unreadBoardCount\}/);
  assert.match(league, /onClick=\{\(\) => onGoToLeague\("activity"\)\}/);
  assert.match(league, /onClick=\{onOpenMessages\}/);
  assert.doesNotMatch(league, /unreadMessages=\{unreadDirectCount \+ unreadBoardCount\}/);
});

test("the live draft embeds the existing League Board conversation", () => {
  assert.match(league, /function DraftChatPanel\(/);
  assert.match(league, /This is the League Board conversation/);
  assert.match(league, /board=\{state\.messages\?\.board \|\| \[\]\}/);
  assert.match(league, /postToBoard=\{postToBoard\} markBoardRead=\{markBoardRead\}/);
});

test("draft chat marks visible posts read and only clears after a successful send", () => {
  assert.match(league, /if \(canPost && typeof markBoardRead === "function"\) markBoardRead\(\)/);
  assert.match(league, /const posted = await postToBoard\(message\)/);
  assert.match(league, /if \(posted !== false\) setText\(""\)/);
  assert.match(league, /maxLength=\{1000\}/);
});

test("spectator and role-preview chat stays read-only", () => {
  const occurrences = league.match(/canPostChat=\{!displayIsSpectator && !previewReadOnly\}/g) || [];
  assert.equal(occurrences.length, 2);
  assert.match(league, /Read-only while viewing as a spectator/);
});
