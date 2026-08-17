import BracketChallengeOperations from "../../../components/BracketChallengeOperations";
import "../operations.css";
import "./publisher.css";

export const metadata = { title: "Prediction Bracket Publisher", robots: { index: false, follow: false } };

export default function PredictionPublisherPage() {
  return <main className="operations-shell prediction-publisher-shell">
    <a className="quiet-button" href="/operations">← Operations</a>
    <BracketChallengeOperations />
  </main>;
}
