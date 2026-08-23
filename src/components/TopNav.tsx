import { NavLink } from "react-router-dom";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

const NAV_LINKS = [
  { label: "Athletes", to: "/", end: true },
  { label: "Programming", to: "/send-programming", end: false },
  { label: "Messages", to: "/messages", end: false },
];

export const TopNav = () => {
  return (
    <header className="v-topnav">
      <div className="brand">
        <img src={veissLogo} alt="Veiss" style={{ height: 28 }} />
        <div style={{ width: 1, height: 24, background: "var(--line-1)" }} />
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
