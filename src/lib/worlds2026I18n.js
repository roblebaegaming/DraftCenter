import {
  ADDITIONAL_WORLDS_COPY,
  ADDITIONAL_WORLDS_REGIONS,
  additionalWorldsQualificationPart,
} from "./worlds2026AdditionalLocales.js";
import { SITE_LANGUAGES } from "./siteLanguages.js";

export const WORLDS_LANGUAGES = Object.fromEntries(SITE_LANGUAGES.map((language) => [language.code, {
  nativeLabel: language.nativeLabel,
  documentLanguage: language.documentLanguage,
  locale: language.locale,
  href: language.code === "en" ? "/worlds/2026/vgc" : `${language.pathPrefix}/worlds/2026`,
}]));

export function worldsLanguage(locale = "en") {
  const language = String(locale || "en").toLowerCase().split("-")[0];
  return WORLDS_LANGUAGES[language] ? language : "en";
}

const ENGLISH_COPY = {
  locale: "en-US",
  documentLanguage: "en",
  languageSwitch: { label: "Language", current: "English" },
  languageOffer: {
    label: "Worlds predictions in your language",
    body: (language) => `Would you like to make your predictions in ${language}?`,
    action: (language) => `Switch to ${language}`,
    dismiss: "Continue in English",
  },
  guide: {
    eyebrow: "TWO WAYS TO PREDICT",
    title: "Pick the players and the Champion’s Pokémon below.",
    body: "Choose 10 real VGC players in the player competition, then rank six Pokémon for the World Champion’s team in the separate Meta competition. Each has its own leaderboard.",
    players: "Pick players ↓",
    pokemon: "Pick Pokémon ↓",
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
  serverErrors: {
    notFound: "La competizione dei Mondiali non è stata trovata.",
    duplicate: "Ogni giocatore può essere scelto una sola volta.",
    unavailablePick: "Una o più scelte non fanno parte dell’elenco attualmente selezionabile.",
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
    body: "Scegli 10 veri giocatori dall’elenco VGC verificato e ordina sei Pokémon per la squadra del Campione del Mondo. Entrambe le aree di pronostico sono qui sotto e hanno classifiche separate.",
    signIn: "Accedi per partecipare",
    browse: "Consulta l’elenco verificato",
    build: "Crea la mia Pick 10",
    meta: "Pronostica il meta vincente",
    bracket: "Tabellone Top Cut",
    victoryRoad: "Tabellone Victory Road",
    all: "Tutte le competizioni dei Mondiali",
    invitees: (count) => `Vedi tutti i ${count} giocatori`,
  },
  guide: {
    eyebrow: "DUE MODI PER PRONOSTICARE",
    title: "Pronostica i giocatori e i Pokémon del Campione.",
    body: "Scegli 10 veri giocatori VGC nella competizione giocatori, poi ordina sei Pokémon per la squadra del Campione del Mondo nella competizione Meta separata. Ognuna ha una propria classifica.",
    players: "Scegli i giocatori ↓",
    pokemon: "Scegli i Pokémon ↓",
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

const SPANISH_COPY = {
  locale: "es-ES",
  documentLanguage: "es",
  languageSwitch: { label: "Idioma", current: "Español" },
  errors: {
    mastersOnly: "El grupo de pronósticos del Mundial debe incluir únicamente jugadores de la categoría Máster.",
    unavailableDivision: "Esta competición no está disponible porque la lista no pertenece a la categoría Máster verificada.",
    signIn: "Inicia sesión desde la página principal de DraftCenter antes de guardar tu pronóstico.",
    notConnected: "La competición Pick 10 todavía no está conectada. Mientras tanto, puedes consultar la lista verificada.",
    locked: "Los pronósticos del Mundial están cerrados.",
    chooseExactly: (count) => "Elige exactamente " + count + " jugadores antes de guardar.",
    chooseChampion: (count) => "Elige a tu Campeón entre los " + count + " jugadores seleccionados antes de guardar.",
    save: "No se ha podido guardar tu pronóstico.",
    spotsFull: (count) => "Ya has ocupado los " + count + " puestos. Quita a un jugador antes de añadir otro.",
  },
  serverErrors: {
    notFound: "No se ha encontrado la competición del Mundial.",
    duplicate: "Cada jugador solo puede elegirse una vez.",
    unavailablePick: "Una o más selecciones no forman parte de la lista disponible.",
  },
  saved: "Tu Pick 10 y tu Campeón se han guardado. Puedes modificarlos hasta el cierre de los pronósticos.",
  status: {
    invite_earned: "Invitación obtenida",
    confirmed: "Participación confirmada",
    withdrawn: "Retirado",
    declined: "Invitación rechazada",
  },
  hero: {
    eyebrow: "MUNDIAL POKÉMON · SAN FRANCISCO",
    title: "Pronósticos de VGC para el Mundial Pokémon 2026",
    body: "Elige a 10 jugadores reales de la lista VGC verificada y ordena seis Pokémon para el equipo del Campeón Mundial. Las dos áreas de pronóstico están más abajo y tienen clasificaciones separadas.",
    signIn: "Inicia sesión para participar",
    browse: "Consulta la lista verificada",
    build: "Crea mi Pick 10",
    meta: "Pronostica el meta ganador",
    bracket: "Cuadro del Top Cut",
    victoryRoad: "Cuadro de Victory Road",
    all: "Todas las competiciones del Mundial",
    invitees: (count) => "Ver los " + count + " jugadores",
  },
  guide: {
    eyebrow: "DOS FORMAS DE PRONOSTICAR",
    title: "Pronostica los jugadores y los Pokémon del Campeón.",
    body: "Elige a 10 jugadores reales de VGC en la competición de jugadores y después ordena seis Pokémon para el equipo del Campeón Mundial en la competición del Meta. Cada una tiene su propia clasificación.",
    players: "Elegir jugadores ↓",
    pokemon: "Elegir Pokémon ↓",
  },
  event: {
    title: "CAMPEONATO MUNDIAL 2026",
    dates: "28–30 de agosto",
    location: "Moscone Center · Domingo de finales en el Chase Center",
    competitionLabel: "Competición",
    competition: "VGC Máster",
    lock: "Cierre de pronósticos",
    checked: "Lista verificada",
  },
  trust: {
    eyebrow: "SOLO LISTA VERIFICADA",
    title: (count) => count + " jugadores en el grupo de pronósticos",
    body: "Solo categoría Máster: se excluyen los clasificados de las categorías Júnior y Sénior.",
    source: "Fuente de la lista ↗",
    official: "Sitio oficial del Mundial ↗",
  },
  pick: {
    eyebrow: "COMPETICIÓN DE DRAFTCENTER",
    title: "Tu Pick 10",
    body: "Tus selecciones permanecen privadas hasta el cierre. Elige a tu Campeón: sus puntos por posición valen el doble.",
    checking: "Comprobando tu cuenta de DraftCenter…",
    accountRequired: "SE REQUIERE UNA CUENTA DE DRAFTCENTER",
    signInTitle: "Inicia sesión para crear tu pronóstico del Mundial.",
    signInBody: "Como en los Daily Games de DraftCenter, necesitas una cuenta gratuita para enviar una Pick 10. Tus selecciones permanecen privadas hasta el cierre y puedes modificarlas antes de la fecha límite.",
    signInAction: "Inicia sesión o crea una cuenta",
    remove: (countryCode) => countryCode + " · quitar",
    champion: "Tu Campeón ×2",
    open: "Puesto libre",
  },
  save: {
    connecting: "Conectando con la competición de la comunidad…",
    staged: "La competición está en preparación. Los pronósticos permanecerán cerrados hasta que se publiquen juntos la lista verificada y el periodo de apertura.",
    locked: "Los pronósticos están cerrados. Las alineaciones guardadas ya son públicas en la clasificación.",
    signInLink: "Inicia sesión",
    signInSuffix: "para guardar y modificar tu pronóstico.",
    savedAsPrefix: "Guardado como",
    savedAsSuffix: "Puedes hacer cambios hasta la fecha límite.",
    finish: "Elige a los 10 jugadores y a tu Campeón para guardar el pronóstico.",
    saving: "Guardando…",
    update: "Actualizar pronóstico",
    create: "Guardar pronóstico",
  },
  scoring: {
    eyebrow: "CÓMO FUNCIONA LA PUNTUACIÓN",
    body: "Cada jugador seleccionado obtiene los puntos de su posición final. Tu Campeón suma el doble; después se agregan los resultados de los 10 jugadores.",
    points: (points) => points + " pts",
    tieTitle: "Si hay empate en los puntos totales",
    tieOne: "1. Menor posición media entre tus seis selecciones mejor clasificadas.",
    tieTwo: "2. Menor posición media entre las 10 selecciones.",
    tieNote: "Estos desempates se aplican después de confirmar los resultados. Si ambas medias también coinciden, los pronósticos comparten posición.",
    note: "La escala recompensa cada selección del Top 64 y da un valor importante al campeón. La clasificación en directo sigue siendo provisional hasta que el propietario verifique un resultado oficial publicado y confirme la puntuación.",
    placements: ["Campeón del mundo", "Finalista", "Top 4", "Top 8", "Top 16", "Top 32", "Top 64"],
  },
  roster: {
    eyebrow: "VGC MÁSTER 2026",
    title: "Lista de invitados VGC Máster al Mundial Pokémon",
    body: "Consulta los jugadores verificados por nombre, código de país, región o vía de clasificación.",
    shown: (count) => count + " " + (count === 1 ? "mostrado" : "mostrados"),
    sourceEyebrow: "FUENTE DE LA LISTA",
    sourceTitle: "De dónde procede esta lista",
    sourceBody: "El registro de invitados al Campeonato Mundial 2026 de Victory Road reúne a los jugadores VGC Máster que obtuvieron una invitación mediante la clasificación de Championship Points y los resultados de eventos clasificatorios.",
    sourceNote: "Es una lista de invitaciones obtenidas, no una confirmación de asistencia o inscripción.",
    sourceAction: "Ver el registro de Victory Road ↗",
    find: "Buscar jugador",
    placeholder: "Prueba Giovanni Cischke, Luca Ceribelli o Wolfe Glick…",
    region: "Región de clasificación",
    all: "Todas las regiones",
    selected: "Seleccionado ✓",
    unavailable: "No disponible",
    signIn: "Inicia sesión para elegir",
    closed: "Pronósticos cerrados",
    add: "Añadir a los 10",
    noResults: "Ningún jugador coincide con esos filtros.",
    clear: "Borrar filtros",
  },
  leaderboard: {
    eyebrow: "CLASIFICACIÓN VGC DE LA COMUNIDAD",
    entries: (count) => count + " " + (count === 1 ? "pronóstico" : "pronósticos"),
    rank: (rank) => "Tu posición: " + rank,
    final: "Final",
    provisional: "En directo · provisional",
    delayed: "En directo · provisional · actualizaciones retrasadas",
    waiting: "Esperando resultados en directo",
    finalBody: "El propietario ha verificado y bloqueado el resultado oficial.",
    provisionalBody: "Las clasificaciones importadas en directo no son oficiales. Si falla una actualización, se mantienen visibles las últimas puntuaciones aceptadas.",
    waitingBody: "Los pronósticos guardados puntuarán cuando estén disponibles las clasificaciones VGC verificadas.",
    updated: "Actualizado",
    resultSource: "Fuente de resultados",
    points: (points) => points + " pts",
    tiebreakers: "Desempates finales:",
    topSix: "media del Top 6",
    allTen: "media de los 10",
    champion: "Tu Campeón ×2",
    private: "La alineación permanece privada hasta el cierre de los pronósticos.",
    empty: "Guarda el primer pronóstico Pick 10 de la comunidad de DraftCenter.",
  },
  bracket: {
    eyebrow: "SEGUNDA FASE",
    title: "La sala de pronósticos del Top Cut está lista.",
    body: "DraftCenter podrá abrir el reto completo de eliminación cuando el propietario verifique el cuadro Máster oficial, los emparejamientos y la primera fecha límite. No se inventan cabezas de serie ni enfrentamientos por adelantado.",
    action: "Abrir el estado del cuadro Top Cut →",
  },
  share: {
    title: "Comparte tus selecciones",
    incomplete: (count) => "Elige a tus " + count + " jugadores y después a tu Campeón.",
    note: "Compartir es público y no guarda el pronóstico.",
    downloading: "Descargando…",
    download: "Descargar",
    downloaded: "Imagen descargada.",
    error: "No se ha podido descargar la imagen de tus selecciones.",
  },
  meta: {
    priority: "Prioridad 1",
    eyebrow: "COMPETICIÓN DE META INDEPENDIENTE",
    title: "Crea el equipo del Campeón del mundo",
    intro: "Es independiente del pronóstico de jugadores. La Pick 10 y las selecciones del Meta tienen sus propias clasificaciones: cualquiera de tus conocimientos de Pokémon puede darte la victoria.",
    poolReview: "Revisión del grupo",
    locked: "Pronósticos cerrados",
    open: "Pronósticos abiertos",
    notOpen: "Aún no abiertos",
    scoring: "Cómo funciona la puntuación",
    scoringSummary: "Ordena seis selecciones · máximo 100 puntos",
    scoringBody: "Ordena seis Pokémon de mayor a menor confianza. Cada selección obtiene los puntos de su posición si aparece en el equipo registrado del Campeón del mundo.",
    pick: (index) => "Selección " + index,
    perfect: "Acierta los seis integrantes del equipo para recibir 8 puntos extra y alcanzar un total perfecto de 100.",
    order: "El orden expresa tu nivel de confianza y no tiene que coincidir con el orden de la hoja de equipo.",
    forms: "El grupo oficial utiliza las especies y formas registradas. Las megaevoluciones no aparecen como opciones independientes.",
    separate: "Competición independiente:",
    separateBody: "los puntos del Meta nunca se suman a la Pick 10. La clasificación general del Meta se abrirá cuando al menos dos disciplinas tengan resultados definitivos.",
    stagedEyebrow: "INFRAESTRUCTURA LISTA · CERRADA DE FORMA SEGURA",
    reviewTitle: "Revisión de la lista de Pokémon en curso",
    waitingCopy: "La estructura y la puntuación están listas, pero las opciones siguen cerradas hasta que se publique el grupo oficial verificado.",
    noPlaceholders: "Ningún Pokémon o mazo provisional se trata como opción verificada del evento.",
    gameScoring: "Juego y puntuación",
    ready: "Listo",
    reviewedPool: "Grupo de opciones verificado",
    reviewRequired: "Revisión necesaria",
    entries: "Pronósticos",
    closedDefault: "Cerrados de forma predeterminada",
    reviewSource: "Consultar la fuente ↗",
    picksEyebrow: "TUS SELECCIONES DEL META",
    selected: (selected, required) => selected + " / " + required + " seleccionados",
    confidence: "El orden importa · mayor confianza primero",
    checking: "Comprobando tu cuenta de DraftCenter…",
    signInTitle: "Inicia sesión para crear tus selecciones del Meta.",
    signInBody: "Tus selecciones permanecen privadas hasta el cierre de los pronósticos.",
    signInAction: "Inicia sesión o crea una cuenta",
    moveUp: (name) => "Subir " + name,
    moveDown: (name) => "Bajar " + name,
    remove: (name) => "Quitar " + name,
    removeLabel: "Quitar",
    openSpot: "Puesto libre",
    trending: "Tendencias",
    allReviewed: "Todas las opciones verificadas",
    browseLabel: "Consultar los Pokémon verificados",
    trendLead: "Las tendencias son un punto de partida, no un pronóstico.",
    trendBody: "Reflejan hojas de equipo anónimas de 10 eventos no oficiales de la comunidad en Limitless, con 737 equipos en total. Nunca determinan la elegibilidad ni las probabilidades oficiales del Mundial.",
    find: "Buscar Pokémon",
    search: (count) => "Buscar entre las " + count + " opciones VGC verificadas…",
    selectedLabel: "Seleccionado ✓",
    add: "Añadir Pokémon",
    noResults: "Ninguna opción verificada coincide con la búsqueda.",
    savedAs: "Guardado como",
    edits: "Puedes hacer cambios hasta el cierre.",
    complete: "Completa todos los puestos por orden de confianza para guardar.",
    saving: "Guardando…",
    update: "Actualizar selecciones del Meta",
    save: "Guardar selecciones del Meta",
    leaderboard: "CLASIFICACIÓN DEL META VGC",
    entriesCount: (count) => count + " " + (count === 1 ? "pronóstico" : "pronósticos"),
    private: "Las selecciones permanecen privadas hasta el cierre.",
    empty: "Todavía no hay pronósticos del Meta. Los guardados aparecerán aquí.",
    safety: ["🔒 Selecciones privadas hasta el cierre", "✓ Grupo verificado obligatorio", "✓ Resultados finales verificados por el propietario", "Automatización desactivada"],
    errors: {
      signIn: "Inicia sesión desde la página principal de DraftCenter antes de guardar.",
      reviewing: "El grupo de opciones todavía está en revisión. Los pronósticos aún no están abiertos.",
      locked: "Los pronósticos de esta competición del Meta están cerrados.",
      chooseExactly: (count) => "Elige exactamente " + count + " Pokémon.",
      spotsFull: (count) => "Ya has elegido " + count + " Pokémon. Quita uno antes de añadir otro.",
      save: "No se han podido guardar tus selecciones del Meta.",
    },
    saved: "Tus selecciones del Meta se han guardado. Puedes modificarlas hasta el cierre.",
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

const SPANISH_REGIONS = {
  "North America": "Norteamérica",
  Europe: "Europa",
  "Latin America": "Latinoamérica",
  Oceania: "Oceanía",
  "Middle East & South Africa": "Oriente Medio y Sudáfrica",
  Japan: "Japón",
  "South Korea": "Corea del Sur",
  "Asia-Pacific": "Asia-Pacífico",
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

const SPANISH_QUALIFICATION_LABELS = {
  "2025 World Champion": "Campeón del mundo 2025",
  "2025 Worlds Finalist": "Finalista del Mundial 2025",
  "2025 Worlds Semifinalist": "Semifinalista del Mundial 2025",
  "International Champion": "Campeón Internacional",
  "International Finalist": "Finalista Internacional",
  "International Semifinalist": "Semifinalista Internacional",
  "Regional Champion": "Campeón Regional",
  "SC Champion": "Campeón de SC",
  "Trainers Cup Champion": "Campeón de la Trainers Cup",
  "Trainers Cup Finalist": "Finalista de la Trainers Cup",
  "JCS Champion": "Campeón de JCS",
  "JCS Finalist": "Finalista de JCS",
  "JCS Semifinalist": "Semifinalista de JCS",
  "MBL Champion": "Campeón de MBL",
  "MBL Finalist": "Finalista de MBL",
  "Taiwan MBL Semifinalist": "Semifinalista de MBL Taiwán",
  "Travel Award": "Premio de viaje",
  "Travel Award (A)": "Premio de viaje (A)",
  "Travel Award (F)": "Premio de viaje (F)",
  "Travel Award (F+A)": "Premio de viaje (F+A)",
  "Travel Stipend": "Ayuda de viaje",
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

function spanishQualificationPart(value) {
  if (SPANISH_QUALIFICATION_LABELS[value]) return SPANISH_QUALIFICATION_LABELS[value];
  let match = value.match(/^CP leaderboard (\d+)(?:st|nd|rd|th)(\*)$/);
  if (match) return match[1] + ".º en la clasificación de CP" + match[2];
  match = value.match(/^CP leaderboard Top (\d+)$/);
  if (match) return "Top " + match[1] + " de la clasificación de CP";
  match = value.match(/^JCS (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return "JCS del " + match[1] + ".º al " + match[2] + ".º puesto";
  match = value.match(/^MBL (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return "MBL del " + match[1] + ".º al " + match[2] + ".º puesto";
  match = value.match(/^Taiwan MBL (\d+)(?:st|nd|rd|th) to (\d+)(?:st|nd|rd|th)$/);
  if (match) return "MBL Taiwán del " + match[1] + ".º al " + match[2] + ".º puesto";
  match = value.match(/^Trainers Cup Top (\d+)$/);
  if (match) return "Top " + match[1] + " de la Trainers Cup";
  return value;
}

export function worldsCopy(locale = "en") {
  const language = worldsLanguage(locale);
  if (language === "it") return ITALIAN_COPY;
  if (language === "es") return SPANISH_COPY;
  if (ADDITIONAL_WORLDS_COPY[language]) return ADDITIONAL_WORLDS_COPY[language];
  return ENGLISH_COPY;
}

export function worldsRegionLabel(value, locale = "en") {
  const language = worldsLanguage(locale);
  if (language === "it") return ITALIAN_REGIONS[value] || value;
  if (language === "es") return SPANISH_REGIONS[value] || value;
  if (ADDITIONAL_WORLDS_REGIONS[language]) return ADDITIONAL_WORLDS_REGIONS[language][value] || value;
  return value;
}

export function worldsQualificationLabel(value, locale = "en") {
  const language = worldsLanguage(locale);
  if (language === "it") return String(value || "").split(" / ").map(italianQualificationPart).join(" / ");
  if (language === "es") return String(value || "").split(" / ").map(spanishQualificationPart).join(" / ");
  if (ADDITIONAL_WORLDS_COPY[language]) return String(value || "").split(" / ").map((part) => additionalWorldsQualificationPart(part, language)).join(" / ");
  return value;
}

export function worldsServerError(message, locale = "en", pickCount = 10) {
  const value = String(message || "").trim();
  const language = worldsLanguage(locale);
  if (language === "en") return value || "Your entry could not be saved.";
  const copy = worldsCopy(language);
  if (/Sign in to save a Worlds entry/i.test(value)) return copy.errors.signIn;
  if (/competition was not found/i.test(value)) return copy.serverErrors.notFound;
  if (/entries for this Worlds competition are locked/i.test(value)) return copy.errors.locked;
  if (/Only Masters Division Worlds entries are supported/i.test(value)) return copy.errors.mastersOnly;
  const exactCount = value.match(/Choose exactly (\d+) competitors/i);
  if (exactCount) return copy.errors.chooseExactly(Number(exactCount[1]));
  if (/Each competitor can be chosen only once/i.test(value)) return copy.serverErrors.duplicate;
  if (/Choose Your Champion|Choose one Ace Pick/i.test(value)) return copy.errors.chooseChampion(pickCount);
  if (/not in the current selectable roster/i.test(value)) return copy.serverErrors.unavailablePick;
  return copy.errors.save;
}
