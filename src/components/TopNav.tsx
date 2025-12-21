import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

export const TopNav = () => {
  return (
    <header className="h-16 bg-gold border-b border-gold flex items-center justify-between px-6 relative">
      <div className="flex-1" />

      <div className="absolute left-1/2 transform -translate-x-1/2">
        <img src={veissLogo} alt="Veiss" className="h-8" />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-navy-dark hover:text-navy-medium hover:bg-white/20">
          <Settings className="h-5 w-5" />
        </Button>
        <ProfileMenu />
      </div>
    </header>
  );
};
