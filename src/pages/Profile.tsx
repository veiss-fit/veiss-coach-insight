import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Shield, Calendar, Users, Upload, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Validators } from "@/lib/validators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

const Profile = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  
  // State for editable fields
  const [formData, setFormData] = useState({
    fullName: "",
    teamId: "",
    jobTitle: ""
  });
  const [teams, setTeams] = useState<any[]>([]);

  // Modal states
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  
  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [performanceAlerts, setPerformanceAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Photo upload states
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial data and available teams
  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "notifications") {
      setNotificationsModalOpen(true);
    } else if (section === "settings") {
      document.getElementById("account-settings")?.scrollIntoView({ behavior: "smooth" });
    }

    if (profile) {
      setFormData({
        fullName: profile.full_name || "",
        // If no team is assigned (null), we treat it as "all" in the UI
        // Prefer the canonical team_id field; fallback to joined teams relation
        teamId: profile.coach?.team_id || profile.coach?.teams?.id || "all",
        jobTitle: "Head Coach - Strength & Conditioning" 
      });
      setProfilePhoto(null); 
    }
    fetchTeams();
  }, [profile, searchParams]);

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name');
    setTeams(data || []);
  };

 const handleSaveChanges = async () => {
    try {
      // 1. Update Profile (Name)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: formData.fullName })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // 2. Update Coach Details (Team)
      if (profile?.coach?.id) {
        // Convert "all" back to null for the database
        const teamIdToSave = formData.teamId === "all" ? null : formData.teamId;
        console.log('Profile: saving coach.team_id ->', teamIdToSave, 'coachId=', profile.coach.id)

        const { data: updatedCoach, error: coachError } = await supabase
          .from('coaches')
          .update({
            team_id: teamIdToSave,
          })
          .eq('id', profile.coach.id)
          .select('*');

        console.log('Supabase update returned:', { updatedCoach, coachError });

        if (coachError) {
          console.error('Failed to update coach record:', coachError);
          throw coachError;
        }

        if (!updatedCoach || (Array.isArray(updatedCoach) && updatedCoach.length === 0)) {
          console.warn('No coach rows were updated. This may be due to RLS policies blocking the update.');
          toast.error('Could not save team assignment due to backend permissions.');
          return;
        }
      }

      toast.success("Profile updated successfully");
      setIsEditing(false);
      // Reload to refresh AuthContext/profile from backend
      //window.location.reload();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to update profile");
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = () => {
    if (previewPhoto) {
      setProfilePhoto(previewPhoto);
      toast.success("Profile photo updated successfully");
    }
    setPhotoModalOpen(false);
    setPreviewPhoto(null);
  };

  const handlePhotoModalClose = (open: boolean) => {
    if (!open) {
      setPreviewPhoto(null);
    }
    setPhotoModalOpen(open);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    setPreviewPhoto(null);
    toast.success("Profile photo removed");
    setPhotoModalOpen(false);
  };

  const handleSaveNotifications = () => {
    toast.success("Notification preferences saved");
    setNotificationsModalOpen(false);
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    const passwordError = Validators.password(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    const confirmError = Validators.passwordConfirm(newPassword, confirmPassword);
    if (confirmError) {
      toast.error(confirmError);
      return;
    }
    
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        toast.error(error.message || "Failed to change password");
        return;
      }
      
      toast.success("Password changed successfully");
      setPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("An error occurred while changing password");
    }
  };

  const handleToggleTwoFactor = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    toast.success(twoFactorEnabled ? "Two-factor authentication disabled" : "Two-factor authentication enabled");
    setTwoFactorModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground">Manage your account information</p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Overview Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src={profilePhoto || ""} />
                <AvatarFallback className="bg-navy-dark text-white text-3xl font-bold">
                  CM
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{profile?.full_name || "Coach"}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="mt-2 bg-gold text-navy-dark">
                  {profile?.coach?.teams?.name || "Coach"}
                </Badge>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setPhotoModalOpen(true)}>
                <Camera className="h-4 w-4 mr-2" />
                Change Photo
              </Button>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
              <Button 
                variant={isEditing ? "default" : "outline"}
                onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)}
              >
                {isEditing ? "Save Changes" : "Edit Profile"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    <User className="inline mr-2 h-4 w-4" />
                    Full Name
                  </Label>
                  <Input 
                    id="fullName" 
                    value={formData.fullName} 
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                <Label htmlFor="team">Team Assignment</Label>
                <Select 
                  disabled={!isEditing} 
                  value={formData.teamId} 
                  onValueChange={(val) => setFormData({...formData, teamId: val})}
                >
                  <SelectTrigger id="team" className="bg-background">
                    <SelectValue placeholder="Select a Team" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ADDED: Option for All Teams */}
                    <SelectItem value="all" className="font-semibold">
                      All Teams (Head Coach)
                    </SelectItem>
                    
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline mr-2 h-4 w-4" />
                  Email Address
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  defaultValue={user?.email} 
                  disabled
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed directly.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  <Shield className="inline mr-2 h-4 w-4" />
                  Role / Job Title
                </Label>
                <Input 
                  id="role" 
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                  disabled={!isEditing}
                  placeholder="e.g. Head Coach"
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    <Calendar className="inline mr-2 h-4 w-4" />
                    Member Since
                  </Label>
                  <p className="text-sm text-muted-foreground">January 2024</p>
                </div>
                <div className="space-y-2">
                  <Label>
                    <Users className="inline mr-2 h-4 w-4" />
                    Athletes Managed
                  </Label>
                  <p className="text-sm text-muted-foreground">150+ Athletes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings Card */}
          <Card className="md:col-span-3" id="account-settings">
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about athlete performance
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setNotificationsModalOpen(true)}>
                  Configure
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Change Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(true)}>
                  Update
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    {twoFactorEnabled ? "Currently enabled" : "Add an extra layer of security"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTwoFactorModalOpen(true)}>
                  {twoFactorEnabled ? "Manage" : "Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo Upload Modal */}
      <Dialog open={photoModalOpen} onOpenChange={handlePhotoModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Profile Photo</DialogTitle>
            <DialogDescription>
              Upload a new profile picture. Recommended size: 200x200px.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarImage src={previewPhoto || profilePhoto || ""} />
                <AvatarFallback className="bg-navy-dark text-white text-3xl font-bold">
                  CM
                </AvatarFallback>
              </Avatar>
              {(previewPhoto || profilePhoto) && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: JPG, PNG. Max size: 5MB
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePhotoModalClose(false)}>
              Cancel
            </Button>
            <Button onClick={handlePhotoUpload} disabled={!previewPhoto}>
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Modal */}
      <Dialog open={notificationsModalOpen} onOpenChange={setNotificationsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Preferences</DialogTitle>
            <DialogDescription>
              Configure how you receive notifications about athlete performance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email updates
                </p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Performance Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about significant changes
                </p>
              </div>
              <Switch checked={performanceAlerts} onCheckedChange={setPerformanceAlerts} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Summary of weekly activity
                </p>
              </div>
              <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotificationsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotifications}>Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters long.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-Factor Authentication Modal */}
      <Dialog open={twoFactorModalOpen} onOpenChange={setTwoFactorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {twoFactorEnabled 
                ? "Two-factor authentication is currently enabled on your account."
                : "Add an extra layer of security to your account by enabling two-factor authentication."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {twoFactorEnabled ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-center">
                    Your account is protected with two-factor authentication.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Disabling 2FA will make your account less secure.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    When enabled, you'll need to enter a verification code from your authenticator app each time you sign in.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleToggleTwoFactor}
              variant={twoFactorEnabled ? "destructive" : "default"}
            >
              {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;