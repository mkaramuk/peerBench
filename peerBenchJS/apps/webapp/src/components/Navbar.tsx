import Link from "next/link";
import { NavItems } from "./NavItems";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import ThemeSwitcher from "./ThemeSwitcher";
import { getUser } from "@/app/actions/auth";

export default async function Navbar() {
  const user = await getUser();

  return (
    <nav className="bg-blue-50 dark:bg-gray-900 shadow-md sticky top-0 z-50">
      <div className="max-w-screen px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-black dark:text-white text-[30px]"
            >
              peerBench
            </Link>
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              <NavItems user={user} />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeSwitcher />
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <MobileMenu user={user} />
    </nav>
  );
}
