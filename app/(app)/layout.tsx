
// import "./globals.css";
import TopNav from "@/app/components/TopNav";
import AuthBoundary from "@/app/components/AuthBoundary";



export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthBoundary />
      <TopNav />
      <div className="pt-[72px]">{children}</div>
    </>
  );
}
