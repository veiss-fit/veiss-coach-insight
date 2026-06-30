import { useNavigate } from "react-router-dom";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";
import { Button } from "@/components/ui/button";
import { Megaphone, Layers, Send } from "lucide-react";

interface TopNavProps {
  onAnnouncementsClick: () => void;
  onCreateTemplateClick: () => void;
}

export const TopNav = ({ onAnnouncementsClick, onCreateTemplateClick }: TopNavProps) => {
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-3">
        {/*
          Logo was previously white-on-gold. If it appears invisible on the white bar,
          add className="h-8 brightness-0" (Tailwind filter) to render it pure black.
        */}
        <img src={veissLogo} alt="Veiss" className="h-8" />
      </div>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onAnnouncementsClick}>
          <Megaphone className="h-4 w-4 mr-2" />
          Announcements
        </Button>
        <Button variant="outline" onClick={onCreateTemplateClick}>
          <Layers className="h-4 w-4 mr-2" />
          Create Template
        </Button>
        <Button
          onClick={() => navigate('/send-programming')}
          className="bg-primary text-navy-dark hover:bg-primary/90"
        >
          <Send className="h-4 w-4 mr-2" />
          Send Programming
        </Button>
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
