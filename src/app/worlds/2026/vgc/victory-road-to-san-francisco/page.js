import BracketChallenge from "../../../../../components/BracketChallenge";

const title = "Victory Road to San Francisco Bracket Challenge";
const description = "Advance your picks through the full Victory Road to San Francisco elimination bracket and earn points for correct winners.";
const canonical = "https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco";

export const metadata = {
  title,
  description,
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: { title: `${title} | DraftCenter`, description, url: canonical, type: "website", images: ["/draftcenter-logo.png"] },
  twitter: { card: "summary", title: `${title} | DraftCenter`, description, images: ["/draftcenter-logo.png"] },
};

export default function VictoryRoadSanFranciscoBracketPage() {
  return <BracketChallenge eventId="victory-road-san-francisco-2026" infoUrl="https://victoryroad.pro/vrtsf26/" />;
}
