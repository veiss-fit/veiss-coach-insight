import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Bell, Users } from "lucide-react";
import { TeamSportManager } from "./TeamSportManager";

export const ProfileMenu = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return "C";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none focus:ring-2 focus:ring-gold rounded-full">
          <Avatar className="cursor-pointer hover:ring-2 hover:ring-gold transition-all">
            <AvatarImage src={user?.user_metadata?.avatar_url ?? ""} />
            <AvatarFallback className="bg-navy-dark text-white font-semibold">
              {getInitials(profile?.full_name || null)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-white border-border z-50" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile?.full_name || "Coach"}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email || ""}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile?section=notifications")}>
          <Bell className="mr-2 h-4 w-4" />
          <span>Notifications</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => setGroupManagerOpen(true)}>
          <Users className="mr-2 h-4 w-4" />
          <span>Manage groups</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <TeamSportManager open={groupManagerOpen} onClose={() => setGroupManagerOpen(false)} />
    </DropdownMenu>
  );
};
