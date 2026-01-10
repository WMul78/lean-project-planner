// app/page.tsx
import HomeClient from "./HomeClient";

export default function HomePage() {
  // Server component wrapper → client component doet session check + UI
  return <HomeClient />;
}
