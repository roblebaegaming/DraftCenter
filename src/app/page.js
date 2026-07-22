import AuthGate from "../components/AuthGate";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <AuthGate />;
}
