import { worldsLanguage } from "./worlds2026I18n.js";

const COPY = {
  en: {
    eyebrow: "WORLDS COMMUNITY",
    title: "English Worlds chat",
    description: "Talk predictions with other DraftCenter members in this language room. Everyone still competes in the same Worlds prediction competition.",
    loadingAccount: "Checking your DraftCenter account…",
    signInTitle: "Sign in to read and join the Worlds chat.",
    signInBody: "Chat messages are kept inside the member community. A free DraftCenter account is required to read or post.",
    signInAction: "Sign in or create an account",
    loading: "Loading the latest messages…",
    empty: "No messages yet. Start the conversation about your Worlds picks.",
    loadEarlier: "Load earlier messages",
    refresh: "Refresh",
    placeholder: "Share a prediction or ask the room a question…",
    characters: (count) => `${count}/500 characters`,
    post: "Post message",
    posting: "Posting…",
    remove: "Remove",
    removeConfirm: "Remove your message from the Worlds chat?",
    report: "Report",
    reported: "Reported",
    rules: "Keep it welcoming and prediction-focused. Do not share private information or target another person.",
    loadError: "The Worlds chat could not be loaded. Try refreshing it.",
    postError: "Your message could not be posted.",
    removeError: "Your message could not be removed.",
    reportError: "The message could not be reported.",
    rateLimit: "Please wait a moment before posting again.",
  },
  it: {
    eyebrow: "COMMUNITY DEI MONDIALI", title: "Chat dei Mondiali in italiano", description: "Parla dei pronostici con gli altri membri di DraftCenter in questa chat. Tutti partecipano comunque alla stessa competizione dei Mondiali.", loadingAccount: "Verifica del tuo account DraftCenter…", signInTitle: "Accedi per leggere e partecipare alla chat dei Mondiali.", signInBody: "I messaggi restano all'interno della community. Per leggere o pubblicare serve un account DraftCenter gratuito.", signInAction: "Accedi o crea un account", loading: "Caricamento degli ultimi messaggi…", empty: "Non ci sono ancora messaggi. Inizia la conversazione sui tuoi pronostici.", loadEarlier: "Carica messaggi precedenti", refresh: "Aggiorna", placeholder: "Condividi un pronostico o fai una domanda…", characters: (count) => `${count}/500 caratteri`, post: "Pubblica", posting: "Pubblicazione…", remove: "Rimuovi", removeConfirm: "Rimuovere il tuo messaggio dalla chat dei Mondiali?", report: "Segnala", reported: "Segnalato", rules: "Mantieni un tono accogliente e parla di pronostici. Non condividere dati privati e non attaccare altre persone.", loadError: "Non è stato possibile caricare la chat. Prova ad aggiornarla.", postError: "Non è stato possibile pubblicare il messaggio.", removeError: "Non è stato possibile rimuovere il messaggio.", reportError: "Non è stato possibile segnalare il messaggio.", rateLimit: "Attendi un momento prima di pubblicare di nuovo.",
  },
  es: {
    eyebrow: "COMUNIDAD DE WORLDS", title: "Chat de Worlds en español", description: "Habla de tus predicciones con otros miembros de DraftCenter en esta sala. Todos siguen participando en la misma competición de Worlds.", loadingAccount: "Comprobando tu cuenta de DraftCenter…", signInTitle: "Inicia sesión para leer y participar en el chat de Worlds.", signInBody: "Los mensajes se mantienen dentro de la comunidad. Necesitas una cuenta gratuita de DraftCenter para leer o publicar.", signInAction: "Iniciar sesión o crear una cuenta", loading: "Cargando los mensajes más recientes…", empty: "Todavía no hay mensajes. Empieza la conversación sobre tus predicciones.", loadEarlier: "Cargar mensajes anteriores", refresh: "Actualizar", placeholder: "Comparte una predicción o haz una pregunta…", characters: (count) => `${count}/500 caracteres`, post: "Publicar", posting: "Publicando…", remove: "Eliminar", removeConfirm: "¿Eliminar tu mensaje del chat de Worlds?", report: "Denunciar", reported: "Denunciado", rules: "Sé amable y céntrate en las predicciones. No compartas información privada ni ataques a otras personas.", loadError: "No se pudo cargar el chat de Worlds. Prueba a actualizarlo.", postError: "No se pudo publicar tu mensaje.", removeError: "No se pudo eliminar tu mensaje.", reportError: "No se pudo denunciar el mensaje.", rateLimit: "Espera un momento antes de volver a publicar.",
  },
  de: {
    eyebrow: "WORLDS-COMMUNITY", title: "Deutscher Worlds-Chat", description: "Sprich in diesem Sprachraum mit anderen DraftCenter-Mitgliedern über deine Tipps. Alle nehmen weiterhin am selben Worlds-Tippwettbewerb teil.", loadingAccount: "Dein DraftCenter-Konto wird geprüft…", signInTitle: "Melde dich an, um den Worlds-Chat zu lesen und mitzuschreiben.", signInBody: "Chatnachrichten bleiben innerhalb der Mitglieder-Community. Zum Lesen und Schreiben ist ein kostenloses DraftCenter-Konto erforderlich.", signInAction: "Anmelden oder Konto erstellen", loading: "Die neuesten Nachrichten werden geladen…", empty: "Noch keine Nachrichten. Starte ein Gespräch über deine Worlds-Tipps.", loadEarlier: "Ältere Nachrichten laden", refresh: "Aktualisieren", placeholder: "Teile einen Tipp oder stelle dem Raum eine Frage…", characters: (count) => `${count}/500 Zeichen`, post: "Nachricht senden", posting: "Wird gesendet…", remove: "Entfernen", removeConfirm: "Deine Nachricht aus dem Worlds-Chat entfernen?", report: "Melden", reported: "Gemeldet", rules: "Bleib freundlich und beim Thema Tipps. Teile keine privaten Informationen und greife niemanden persönlich an.", loadError: "Der Worlds-Chat konnte nicht geladen werden. Versuche ihn zu aktualisieren.", postError: "Deine Nachricht konnte nicht gesendet werden.", removeError: "Deine Nachricht konnte nicht entfernt werden.", reportError: "Die Nachricht konnte nicht gemeldet werden.", rateLimit: "Bitte warte einen Moment, bevor du erneut schreibst.",
  },
  ja: {
    eyebrow: "WORLDSコミュニティ", title: "日本語のWorldsチャット", description: "この言語ルームでDraftCenterメンバーと予想について話せます。参加するWorlds予想大会は全言語で同じです。", loadingAccount: "DraftCenterアカウントを確認中…", signInTitle: "Worldsチャットの閲覧・参加にはログインしてください。", signInBody: "チャットはメンバーコミュニティ内だけで表示されます。閲覧と投稿には無料のDraftCenterアカウントが必要です。", signInAction: "ログインまたはアカウント作成", loading: "最新メッセージを読み込み中…", empty: "まだメッセージはありません。Worlds予想について話してみましょう。", loadEarlier: "以前のメッセージを読み込む", refresh: "更新", placeholder: "予想を共有したり、ルームに質問したりできます…", characters: (count) => `${count}/500文字`, post: "投稿する", posting: "投稿中…", remove: "削除", removeConfirm: "このメッセージをWorldsチャットから削除しますか？", report: "報告", reported: "報告済み", rules: "相手を尊重し、予想を中心に話しましょう。個人情報の共有や他人への攻撃は禁止です。", loadError: "Worldsチャットを読み込めませんでした。更新してください。", postError: "メッセージを投稿できませんでした。", removeError: "メッセージを削除できませんでした。", reportError: "メッセージを報告できませんでした。", rateLimit: "少し待ってからもう一度投稿してください。",
  },
  ko: {
    eyebrow: "WORLDS 커뮤니티", title: "한국어 Worlds 채팅", description: "이 언어 채팅방에서 다른 DraftCenter 회원들과 예측 이야기를 나눠 보세요. 모든 언어의 참가자는 같은 Worlds 예측 대회에서 경쟁합니다.", loadingAccount: "DraftCenter 계정을 확인하는 중…", signInTitle: "Worlds 채팅을 읽고 참여하려면 로그인하세요.", signInBody: "채팅 메시지는 회원 커뮤니티 안에서만 공개됩니다. 읽거나 글을 쓰려면 무료 DraftCenter 계정이 필요합니다.", signInAction: "로그인 또는 계정 만들기", loading: "최신 메시지를 불러오는 중…", empty: "아직 메시지가 없습니다. Worlds 예측 이야기를 시작해 보세요.", loadEarlier: "이전 메시지 불러오기", refresh: "새로고침", placeholder: "예측을 공유하거나 채팅방에 질문해 보세요…", characters: (count) => `${count}/500자`, post: "메시지 올리기", posting: "게시 중…", remove: "삭제", removeConfirm: "Worlds 채팅에서 내 메시지를 삭제할까요?", report: "신고", reported: "신고됨", rules: "서로를 존중하며 예측 이야기에 집중해 주세요. 개인정보 공유와 다른 사람을 향한 공격은 금지됩니다.", loadError: "Worlds 채팅을 불러오지 못했습니다. 새로고침해 주세요.", postError: "메시지를 올리지 못했습니다.", removeError: "메시지를 삭제하지 못했습니다.", reportError: "메시지를 신고하지 못했습니다.", rateLimit: "잠시 기다린 뒤 다시 게시해 주세요.",
  },
};

export function worldsChatCopy(locale = "en") {
  return COPY[worldsLanguage(locale)] || COPY.en;
}

