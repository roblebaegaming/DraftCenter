export function calculateTeamLabDamageEstimate({
  level,
  power,
  attack,
  defense,
  defenderHp,
  stab = 1,
  typeEffectiveness = 1,
  otherModifier = 1,
}) {
  const inputs = [level, power, attack, defense, defenderHp, stab, typeEffectiveness, otherModifier].map(Number);
  if (inputs.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const [safeLevel, safePower, safeAttack, safeDefense, safeHp, safeStab, safeEffectiveness, safeOther] = inputs;
  if (safeLevel > 100 || safePower > 500 || safeAttack > 9999 || safeDefense > 9999 || safeHp > 9999 || safeOther > 10) return null;
  const levelFactor = Math.floor((2 * safeLevel) / 5) + 2;
  const baseDamage = Math.floor(Math.floor((levelFactor * safePower * safeAttack) / safeDefense) / 50) + 2;
  const maximum = Math.max(1, Math.floor(baseDamage * safeStab * safeEffectiveness * safeOther));
  const minimum = Math.max(1, Math.floor(baseDamage * 0.85 * safeStab * safeEffectiveness * safeOther));
  return {
    minimum,
    maximum,
    minimumPercent: Math.round((minimum / safeHp) * 1000) / 10,
    maximumPercent: Math.round((maximum / safeHp) * 1000) / 10,
    baseDamage,
    assumptions: {
      level: safeLevel,
      power: safePower,
      attack: safeAttack,
      defense: safeDefense,
      defenderHp: safeHp,
      stab: safeStab,
      typeEffectiveness: safeEffectiveness,
      otherModifier: safeOther,
      randomRange: "85%–100%",
    },
  };
}
