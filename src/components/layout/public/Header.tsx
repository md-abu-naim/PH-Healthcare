import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Header() {
  const routes = [
    { name: "Home", url: "/" },
    { name: "About us", url: "/about-us" },
  ];

  return (
    <header className="w-full h-16 border border-b">
      <div className="flex justify-between items-center h-full max-w-7xl mx-auto">
        <div>PH Healthcare</div>
        <nav className="flex gap-5">
          {routes.map((route) => (
            <Link key={route.url} href={route.url}>
              {route.name}
            </Link>
          ))}
        </nav>
        <div>
          <Button
            variant="outline"
            render={<Link href="/login">Login</Link>}
            nativeButton={false}
          >
            login
          </Button>
        </div>
      </div>
    </header>
  );
}