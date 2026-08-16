import BracketChallengeOperations from "../../../components/BracketChallengeOperations";
import "../operations.css";
import "./publisher.css";

export const metadata = { title: "Prediction Event Publisher", robots: { index: false, follow: false } };

export default function PredictionEventPublisherPage() {
  return <main className="operations-shell prediction-publisher-page">
    <a className="quiet-button" href="/operations">← Operations</a>
    <BracketChallengeOperations />
  </main>;
}
