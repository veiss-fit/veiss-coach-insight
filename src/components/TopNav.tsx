import { NavLink } from "react-router-dom";
import { Megaphone, LayoutTemplate } from "lucide-react";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

interface TopNavProps {
  /** Legacy dialog triggers — rendered as extra actions until the Messages (Stage 2)
      and Programming-templates (Stage 3) pages replace them. */
  onAnnouncementsClick?: () => void;
  onCreateTemplateClick?: () => void;
  announcementsOpen?: boolean;
}

const NAV_LINKS = [
  { label: "Athletes", to: "/", end: true },
  { label: "Programming", to: "/send-programming", end: false },
  { label: "History", to: "/history", end: false },
];

export const TopNav = ({ onAnnouncementsClick, onCreateTemplateClick }: TopNavProps) => {
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
        {onAnnouncementsClick && (
          <button type="button" className="v-btn ghost" onClick={onAnnouncementsClick}>
            <Megaphone size={12} strokeWidth={1.5} />
            Announcements
          </button>
        )}
        {onCreateTemplateClick && (
          <button type="button" className="v-btn ghost" onClick={onCreateTemplateClick}>
            <LayoutTemplate size={12} strokeWidth={1.5} />
            Templates
          </button>
        )}
        <span className="v-meta mono nowrap" style={{ fontSize: 11.5 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <ProfileMenu />
      </div>
    </header>
  );
};
