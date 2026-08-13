const ENGLISH_COPY = {
  locale: "en-US",
  documentLanguage: "en",
  languageOffer: {
    label: "Italiano disponibile",
    body: "Preferisci completare il pronostico in italiano?",
    action: "Passa all’italiano",
    dismiss: "Continua in inglese",
  },
};

const ITALIAN_COPY = {
  locale: "it-IT",
  documentLanguage: "it",
  languageSwitch: { label: "Lingua", current: "Italiano", action: "Visualizza in inglese" },
  errors: {
    mastersOnly: "Il gruppo del pronostico dei Mondiali deve includere soltanto giocatori della categoria Master.",
    unavailableDivision: "Questa competizione non è disponibile perché l’elenco non appartiene alla categoria Master verificata.",
    signIn: "Accedi dalla pagina principale di DraftCenter prima di salvare il tuo pronostico.",
    notConnected: "La competizione Pick 10 non è ancora collegata. Puoi comunque consultare l’elenco verificato qui sotto.",
    locked: "I pronostici per i Mondiali sono chiusi.",
    chooseExactly: (count) => `Scegli esattamente ${count} giocatori prima di salvare.`,
    chooseChampion: (count) => `Scegli il tuo Campione tra i ${count} giocatori selezionati prima di salvare.`,
    save: "Non è stato possibile salvare il tuo pronostico.",
    spotsFull: (count) => `Hai già occupato tutti i ${count} posti. Rimuovi un giocatore prima di aggiungerne un altro.`,
  },
  saved: "La tua Pick 10 e il tuo Campione sono stati salvati. Puoi modificarli fino alla chiusura dei pronostici.",
  status: {
    invite_earned: "Invito ottenuto",
    confirmed: "Partecipazione confermata",
    withdrawn: "Ritirato",
    declined: "Invito rifiutato",
  },
  hero: {
    eyebrow: "MONDIALI POKÉMON · SAN FRANCISCO",
    title: "Pronostici VGC per i Mondiali Pokémon 2026",
    body: "Scegli i 10 giocatori su cui vuoi puntare dall’elenco VGC verificato. Al termine dei Mondiali, il pronostico con i migliori risultati complessivi vincerà la classifica della community di DraftCenter.",
    signIn: "Accedi per partecipare",
    browse: "Consulta l’elenco verificato",
    build: "Crea la mia Pick 10",
    meta: "Pronostica il meta vincente",
    bracket: "Tabellone Top Cut",
    all: "Tutte le competizioni dei Mondiali",
    invitees: (count) => `Vedi tutti i ${count} giocatori`,
  },
  event: {
    title: "CAMPIONATI MONDIALI 2026",
    dates: "28–30 agosto",
    location: "Moscone Center · Domenica delle finali al Chase Center",
    competitionLabel: "Competizione",
    competition: "VGC Master",
    lock: "Chiusura pronostici",
    checked: "Elenco verificato",
  },
  trust: {
    eyebrow: "SOLO ELENCO VERIFICATO",
    title: (count) => `${count} giocatori nel gruppo del pronostico`,
    body: "Solo categoria Master: i qualificati delle categorie Senior e Junior sono esclusi.",
    source: "Fonte dell’elenco ↗",
    official: "Sito ufficiale dei Mondiali ↗",
  },
  pick: {
    eyebrow: "COMPETIZIONE DI DRAFTCENTER",
    title: "La tua Pick 10",
    body: "Le tue scelte restano private fino alla chiusura dei pronostici. Scegli il tuo Campione: i suoi punti piazzamento valgono il doppio.",
    checking: "Verifica del tuo account DraftCenter…",
    accountRequired: "ACCOUNT DRAFTCENTER RICHIESTO",
    signInTitle: "Accedi per creare il tuo pronostico dei Mondiali.",
    signInBody: "Come per i Daily Games di DraftCenter, per inviare una Pick 10 serve un account gratuito. Le scelte restano private fino alla chiusura e puoi modificarle prima della scadenza.",
    signInAction: "Accedi o crea un account",
    remove: (countryCode) => `${countryCode} · rimuovi`,
    champion: "Il tuo Campione ×2",
    open: "Posto libero",
  },
  save: {
    connecting: "Collegamento alla competizione della community…",
    staged: "La competizione è in preparazione. I pronostici resteranno chiusi finché l’elenco verificato e la data di apertura non saranno pubblicati insieme.",
    locked: "I pronostici sono chiusi. Le formazioni salvate sono ora visibili nella classifica.",
    signInLink: "Accedi",
    signInSuffix: "per salvare e modificare il tuo pronostico.",
    savedAsPrefix: "Salvato come",
    savedAsSuffix: "Puoi apportare modifiche fino alla scadenza.",
    finish: "Scegli tutti e 10 i giocatori e il tuo Campione per salvare il pronostico.",
    saving: "Salvataggio…",
    update: "Aggiorna pronostico",
    create: "Salva pronostico",
  },
  scoring: {
    eyebrow: "COME FUNZIONA IL PUNTEGGIO",
    body: "Ogni giocatore scelto ottiene i punti previsti per il suo piazzamento finale. Il tuo Campione ottiene il doppio dei punti; il totale è la somma dei risultati di tutti e 10 i giocatori.",
    points: (points) => `${points} pt`,
    tieTitle: "In caso di parità nel punteggio totale",
    tieOne: "1. Migliore piazzamento medio tra le sei scelte meglio classificate.",
    tieTwo: "2. Migliore piazzamento medio tra tutte e 10 le scelte.",
    tieNote: "Questi criteri si applicano dopo la conferma dei risultati. Se anche le due medie sono uguali, i pronostici condividono la posizione.",
    note: "La scala premia ogni scelta in Top 64 e attribuisce un valore importante al campione. La classifica live resta provvisoria finché il proprietario non verifica un risultato ufficiale pubblicato e conferma il punteggio.",
    placements: ["Campione del mondo", "Finalista", "Top 4", "Top 8", "Top 16", "Top 32", "Top 64"],
  },
  roster: {
    eyebrow: "VGC MASTER 2026",
    title: "Elenco degli invitati VGC Master ai Mondiali Pokémon",
    body: "Consulta i giocatori verificati per nome, codice del Paese, regione o percorso di qualificazione.",
    shown: (count) => `${count} ${count === 1 ? "mostrato" : "mostrati"}`,
    sourceEyebrow: "FONTE DELL’ELENCO",
    sourceTitle: "Da dove proviene questo elenco",
    sourceBody: "L’elenco degli invitati ai Campionati Mondiali 2026 di Victory Road riunisce i giocatori VGC Master che hanno ottenuto l’invito tramite la classifica Championship Point e i risultati degli eventi di qualificazione.",
    sourceNote: "È un elenco di inviti ottenuti, non una conferma di partecipazione o registrazione.",
    sourceAction: "Vedi l’elenco di Victory Road ↗",
    find: "Trova un giocatore",
    placeholder: "Prova Giovanni Cischke, Luca Ceribelli o Wolfe Glick…",
    region: "Regione di qualificazione",
    all: "Tutte le regioni",
    selected: "Selezionato ✓",
    unavailable: "Non disponibile",
    signIn: "Accedi per scegliere",
    closed: "Pronostici chiusi",
    add: "Aggiungi ai 10",
    noResults: "Nessun giocatore corrisponde ai filtri selezionati.",
    clear: "Azzera filtri",
  },
  leaderboard: {
    eyebrow: "CLASSIFICA VGC DELLA COMMUNITY",
    entries: (count) => `${count} ${count === 1 ? "pronostico" : "pronostici"}`,
    rank: (rank) => `La tua posizione: ${rank}`,
    final: "Finale",
    provisional: "Live · provvisoria",
    delayed: "Live · provvisoria · aggiornamenti in ritardo",
    waiting: "In attesa dei risultati live",
    finalBody: "Il proprietario ha verificato e bloccato il risultato ufficiale.",
    provisionalBody: "Le classifiche live importate non sono ufficiali. Se un aggiornamento non riesce, restano visibili gli ultimi punteggi accettati.",
    waitingBody: "I pronostici salvati otterranno punti quando saranno disponibili le classifiche VGC verificate.",
    updated: "Aggiornato",
    resultSource: "Fonte dei risultati",
    points: (points) => `${points} pt`,
    tiebreakers: "Criteri finali:",
    topSix: "media Top 6",
    allTen: "media di tutte e 10",
    champion: "Il tuo Campione ×2",
    private: "La formazione resta privata fino alla chiusura dei pronostici.",
    empty: "Salva il primo pronostico Pick 10 della community di DraftCenter.",
  },
  bracket: {
    eyebrow: "SECONDA FASE",
    title: "La sala pronostici Top Cut è pronta.",
    body: "DraftCenter potrà aprire la sfida completa a eliminazione diretta non appena il proprietario avrà verificato il tabellone Master ufficiale, gli abbinamenti e la prima scadenza. Non vengono inventate teste di serie o partite in anticipo.",
    action: "Apri lo stato del tabellone Top Cut →",
  },
  share: {
    title: "Condividi le tue scelte",
    incomplete: (count) => `Scegli i tuoi ${count} giocatori, poi indica il tuo Campione.`,
    note: "La condivisione è pubblica e non salva il pronostico.",
    downloading: "Download…",
    download: "Scarica",
    downloaded: "Immagine scaricata.",
    error: "Non è stato possibile scaricare l’immagine delle tue scelte.",
  },
  meta: {
    priority: "Priorità 1",
    eyebrow: "COMPETIZIONE META SEPARATA",
    title: "Crea la squadra del Campione del mondo",
    intro: "È separata dal pronostico sui giocatori. La Pick 10 e le scelte Meta hanno classifiche proprie: puoi vincere con entrambi i tipi di conoscenza Pokémon.",
    poolReview: "Verifica del gruppo",
    locked: "Pronostici chiusi",
    open: "Pronostici aperti",
    notOpen: "Non ancora aperti",
    scoring: "Come funziona il punteggio",
    scoringSummary: "Classifica sei scelte · massimo 100 punti",
    scoringBody: "Ordina sei Pokémon dal livello di fiducia più alto al più basso. Una scelta ottiene i punti della sua posizione se appare nella squadra registrata del Campione del mondo.",
    pick: (index) => `Scelta ${index}`,
    perfect: "Pronostica tutti e sei i componenti della squadra per un bonus di 8 punti e un totale perfetto di 100.",
    order: "L’ordine esprime il tuo livello di fiducia e non deve corrispondere all’ordine del team sheet.",
    forms: "Il gruppo ufficiale usa le specie e le forme registrate. Le megaevoluzioni non sono opzioni separate.",
    separate: "Competizione separata:",
    separateBody: "i punteggi Meta non si sommano mai alla Pick 10. La classifica Meta generale si aprirà quando almeno due discipline Meta avranno risultati definitivi.",
    stagedEyebrow: "INFRASTRUTTURA PRONTA · CHIUSA IN SICUREZZA",
    reviewTitle: "Verifica dell’elenco Pokémon in corso",
    waitingCopy: "La struttura e il punteggio sono pronti, ma le opzioni restano chiuse finché il gruppo ufficiale verificato non viene pubblicato.",
    noPlaceholders: "Nessun Pokémon o mazzo provvisorio viene trattato come opzione verificata dell’evento.",
    gameScoring: "Gioco e punteggio",
    ready: "Pronto",
    reviewedPool: "Gruppo di opzioni verificato",
    reviewRequired: "Verifica necessaria",
    entries: "Pronostici",
    closedDefault: "Chiusi per impostazione predefinita",
    reviewSource: "Consulta la fonte ↗",
    picksEyebrow: "LE TUE SCELTE META",
    selected: (selected, required) => `${selected} / ${required} selezionati`,
    confidence: "L’ordine conta · prima la fiducia più alta",
    checking: "Verifica del tuo account DraftCenter…",
    signInTitle: "Accedi per creare le tue scelte Meta.",
    signInBody: "Le tue scelte restano private fino alla chiusura dei pronostici.",
    signInAction: "Accedi o crea un account",
    moveUp: (name) => `Sposta ${name} in alto`,
    moveDown: (name) => `Sposta ${name} in basso`,
    remove: (name) => `Rimuovi ${name}`,
    removeLabel: "Rimuovi",
    openSpot: "Posto libero",
    trending: "In tendenza",
    allReviewed: "Tutte le opzioni verificate",
    browseLabel: "Consulta i Pokémon verificati",
    trendLead: "Le tendenze sono un punto di partenza, non un pronostico.",
    trendBody: "Riflettono team sheet anonimi provenienti da 10 eventi non ufficiali della community su Limitless, per un totale di 737 squadre. Non determinano mai l’idoneità o le probabilità ufficiali dei Mondiali.",
    find: "Trova Pokémon",
    search: (count) => `Cerca tra tutte le ${count} opzioni VGC verificate…`,
    selectedLabel: "Selezionato ✓",
    add: "Aggiungi Pokémon",
    noResults: "Nessuna opzione verificata corrisponde alla ricerca.",
    savedAs: "Salvato come",
    edits: "Puoi apportare modifiche fino alla chiusura.",
    complete: "Completa tutti i posti nell’ordine di fiducia per salvare.",
    saving: "Salvataggio…",
    update: "Aggiorna scelte Meta",
    save: "Salva scelte Meta",
    leaderboard: "CLASSIFICA META VGC",
    entriesCount: (count) => `${count} ${count === 1 ? "pronostico" : "pronostici"}`,
    private: "Le scelte restano private fino alla chiusura.",
    empty: "Non ci sono ancora pronostici Meta. Quelli salvati appariranno qui.",
    safety: ["🔒 Scelte private fino alla chiusura", "✓ Gruppo verificato obbligatorio", "✓ Risultati finali verificati dal proprietario", "Automazione disattivata"],
    errors: {
      signIn: "Accedi dalla pagina principale di DraftCenter prima di salvare.",
      reviewing: "Il gruppo di opzioni è ancora in verifica. I pronostici non sono ancora aperti.",
      locked: "I pronostici per questa competizione Meta sono chiusi.",
      chooseExactly: (count) => `Scegli esattamente ${count} Pokémon.`,
      spotsFull: (count) => `Hai già selezionato ${count} Pokémon. Rimuovine uno prima di aggiungerne un altro.`,
      save: "Non è stato possibile salvare le tue scelte Meta.",
    },
    saved: "Le tue scelte Meta sono state salvate. Puoi modificarle fino alla chiusura.",
  },
};

const ITALIAN_REGIONS = {
  "North America": "Nord America",
  Europe: "Europa",
  "Latin America": "America Latina",
  Oceania: "Oceania",
  "Middle East & South Africa": "Medio Oriente e Sudafrica",
  Japan: "Giappone",
  "South Korea": "Corea del Sud",
  "Asia-Pacific": "Asia-Pacifico",
};

const ITALIAN_QUALIFICATION_LABELS = {
  "2025 World Champion": "Campione del mondo 2025",
  "2025 Worlds Finalist": "Finalista ai Mondiali 2025",
  "2025 Worlds Semifinalist": "Semifinalista ai Mondiali 2025",
  "International Champion": "Campione Internazionale",
  "International Finalist": "Finalista Internazionale",
  "International Semifinalist": "Semifinalista Internazionale",
  "Regional Champion": "Campione Regionale",
  "SC Champion": "Campione SC",
  "Trainers Cup Champion": "Campione della Trainers Cup",
  "Trainers Cup Finalist": "Finalista della Trainers Cup",
  "JCS Champion": "Campione JCS",
  "JCS Finalist": "Finalista JCS",
  "JCS Semifinalist": "Semifinalista JCS",
  "MBL Champion": "Campione MBL",
  "MBL Finalist": "Finalista MBL",
  "Taiwan MBL Semifinalist": "Semifinalista MBL Taiwan",
  "Travel Award": "Premio viaggio",
  "Travel Award (A)": "Premio viaggio (A)",
  "Travel Award (F)": "Premio viaggio (F)",
  "Travel Award (F+A)": "Premio viaggio (F+A)",
  "Travel Stipend": "Contributo di viaggio",
};

function italianQualificationPart(value) {
  if (ITALIAN_QUALIFICATION_LABELS[value]) return ITALIAN_QUALIFICATION_LABELS[value];
  let match = value.match(/^CP leaderboard (\d+)(?:st|nd|rd|th)(\*)$/);
  if (match) return `${match[1]}º nella classifica CP${match[2]}`;
  match = value.match(/^CP leaderboard Top (\d+)$/);
  if (match) return `Top ${match[1]} della classifica CP`;
  match = value.match(/^JCS (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return `JCS dal ${match[1]}º al ${match[2]}º posto`;
  match = value.match(/^MBL (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return `MBL dal ${match[1]}º al ${match[2]}º posto`;
  match = value.match(/^Taiwan MBL (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return `MBL Taiwan dal ${match[1]}º al ${match[2]}º posto`;
  match = value.match(/^Trainers Cup Top (\d+)$/);
  if (match) return `Top ${match[1]} della Trainers Cup`;
  return value;
}

export function worldsCopy(locale = "en") {
  return locale === "it" ? ITALIAN_COPY : ENGLISH_COPY;
}

export function worldsRegionLabel(value, locale = "en") {
  return locale === "it" ? ITALIAN_REGIONS[value] || value : value;
}

export function worldsQualificationLabel(value, locale = "en") {
  if (locale !== "it") return value;
  return String(value || "").split(" / ").map(italianQualificationPart).join(" / ");
}

export function worldsServerError(message, locale = "en", pickCount = 10) {
  const value = String(message || "").trim();
  if (locale !== "it") return value || "Your entry could not be saved.";
  const copy = ITALIAN_COPY;
  if (/Sign in to save a Worlds entry/i.test(value)) return copy.errors.signIn;
  if (/competition was not found/i.test(value)) return "La competizione dei Mondiali non è stata trovata.";
  if (/entries for this Worlds competition are locked/i.test(value)) return copy.errors.locked;
  if (/Only Masters Division Worlds entries are supported/i.test(value)) return copy.errors.mastersOnly;
  const exactCount = value.match(/Choose exactly (\d+) competitors/i);
  if (exactCount) return copy.errors.chooseExactly(Number(exactCount[1]));
  if (/Each competitor can be chosen only once/i.test(value)) return "Ogni giocatore può essere scelto una sola volta.";
  if (/Choose Your Champion|Choose one Ace Pick/i.test(value)) return copy.errors.chooseChampion(pickCount);
  if (/not in the current selectable roster/i.test(value)) return "Una o più scelte non fanno parte dell’elenco attualmente selezionabile.";
  return copy.errors.save;
}
