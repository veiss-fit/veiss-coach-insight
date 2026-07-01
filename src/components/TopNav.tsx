import { useNavigate, useLocation } from "react-router-dom";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

interface TopNavProps {
  onAnnouncementsClick: () => void;
  onCreateTemplateClick: () => void;
  announcementsOpen?: boolean;
}

export const TopNav = ({ onAnnouncementsClick, onCreateTemplateClick, announcementsOpen = false }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const onProgramming = location.pathname === '/send-programming';

  const btnStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    fontWeight: 500,
    color: active ? '#07101f' : '#5b6577',
    backgroundColor: active ? '#f1f2f5' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  });

  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
    if (!active) e.currentTarget.style.backgroundColor = '#FFC300';
    e.currentTarget.style.color = '#07101f';
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
    e.currentTarget.style.backgroundColor = active ? '#f1f2f5' : 'transparent';
    e.currentTarget.style.color = active ? '#07101f' : '#5b6577';
  };

  return (
    <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-3">
        <img src={veissLogo} alt="Veiss" className="h-8" />
      </div>

      <div className="h-8 w-px bg-border" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          type="button"
          style={btnStyle(announcementsOpen)}
          onMouseEnter={e => handleEnter(e, announcementsOpen)}
          onMouseLeave={e => handleLeave(e, announcementsOpen)}
          onMouseDown={e => { e.currentTarget.style.backgroundColor = '#f1f2f5' }}
          onMouseUp={e => { e.currentTarget.style.backgroundColor = announcementsOpen ? '#f1f2f5' : '#FFC300' }}
          onClick={onAnnouncementsClick}
        >
          Announcements
        </button>
        <button
          type="button"
          style={btnStyle(false)}
          onMouseEnter={e => handleEnter(e, false)}
          onMouseLeave={e => handleLeave(e, false)}
          onMouseDown={e => { e.currentTarget.style.backgroundColor = '#f1f2f5' }}
          onMouseUp={e => { e.currentTarget.style.backgroundColor = '#FFC300' }}
          onClick={onCreateTemplateClick}
        >
          Templates
        </button>
        <button
          type="button"
          style={btnStyle(onProgramming)}
          onMouseEnter={e => handleEnter(e, onProgramming)}
          onMouseLeave={e => handleLeave(e, onProgramming)}
          onMouseDown={e => { e.currentTarget.style.backgroundColor = '#f1f2f5' }}
          onMouseUp={e => { e.currentTarget.style.backgroundColor = onProgramming ? '#f1f2f5' : '#FFC300' }}
          onClick={() => navigate('/send-programming')}
        >
          Programming
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
        <ProfileMenu />
      </div>
    </header>
  );
};
