export default function TestPage() {
  return (
    <main style={{ padding: 24 }}>
      <div>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</div>
      <div>KEY loaded: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "yes" : "no"}</div>
    </main>
  );
}
