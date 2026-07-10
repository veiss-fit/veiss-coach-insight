import { NavLink } from "react-router-dom";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

const NAV_LINKS = [
  { label: "Athletes", to: "/", end: true },
  { label: "Programming", to: "/send-programming", end: false },
  { label: "Messages", to: "/messages", end: false },
  { label: "History", to: "/history", end: false },
];

export const TopNav = () => {
  return (
    <header className="v-topnav">
      <div className="brand">
        <img src={veissLogo} alt="Veiss" style={{ height: 28 }} />
        <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· coach</span>
      </div>

      <nav className="navlinks">
        {NAV_LINKS.map(({ label, to, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="right">
        <span className="v-meta mono nowrap" style={{ fontSize: 11.5 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <ProfileMenu />
      </div>
    </header>
  );
};
