import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Upload, Camera, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Validators } from "@/lib/validators";
import { supabase } from "@/lib/supabase";

// Derive up to 2 initials from a full name
const getInitials = (name: string) => {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('') || '?';
};

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
  });

  // Modal states
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Photo states
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "settings") {
      document.getElementById("account-settings")?.scrollIntoView({ behavior: "smooth" });
    }

    if (profile) {
      setFormData({
        fullName: profile.full_name || "",
      });
    }

    // Load saved avatar from user metadata
    const avatarUrl = user?.user_metadata?.avatar_url ?? null;
    setProfilePhoto(avatarUrl);
  }, [profile, user, searchParams]);

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    const name = formData.fullName.trim();
    if (!name) { toast.error("Name cannot be empty"); return; }
    if (!user?.id) { toast.error("Not authenticated"); return; }

    try {
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: name,
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Failed to update profile:', profileError);
        toast.error('Failed to update profile. Please try again.');
        return;
      }

      // Sync name to coaches table (non-fatal)
      const { error: coachError } = await (supabase as any)
        .from('coaches')
        .update({ full_name: name })
        .eq('user_id', user.id);

      if (coachError) {
        console.error('Failed to sync name to coaches table:', coachError);
      }

      // Both writes have committed at this point, so the save has succeeded no
      // matter what happens next. Refreshing AuthContext (so TopNav and the avatar
      // update immediately) is a separate read that can fail on its own; it used to
      // sit unguarded here, so a failed refresh threw to the catch below and showed
      // "Failed to update profile" for a save that had actually worked (§5.3).
      setIsEditing(false);
      if (!coachError) {
        toast.success("Profile updated successfully");
      } else {
        toast.success("Profile updated");
      }

      try {
        await refreshProfile();
      } catch (refreshError) {
        console.error('Profile saved, but refreshing it in the app failed:', refreshError);
      }

    } catch (err: any) {
      console.error('Profile update error:', err);
      toast.error(err?.message || "Failed to update profile");
    }
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreviewPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!previewPhoto || !user?.id) return;
    setUploading(true);
    // Each step is handled separately so the message names the step that actually
    // failed. Previously one bare catch wrapped all three and always blamed a
    // missing storage bucket — equally shown for a size-limit rejection, a storage
    // RLS denial, or an auth metadata failure (§4.5).
    try {
      const storagePath = `${user.id}/avatar`;

      // 1. Convert data URL → Blob
      let blob: Blob;
      try {
        const res = await fetch(previewPhoto);
        blob = await res.blob();
      } catch (error) {
        console.error('[Profile photo] Failed to read the selected image:', error);
        toast.error("Couldn't read that image. Please pick a different file.");
        return;
      }

      // 2. Upload (overwrite) to the `avatars` bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, { upsert: true, contentType: blob.type });

      if (uploadError) {
        console.error('[Profile photo] Upload failed:', uploadError);
        const message = uploadError.message ?? '';
        if (/bucket not found/i.test(message)) {
          toast.error("Photo storage isn't set up (missing 'avatars' bucket). This is a bug — please report it.");
        } else if (/exceeded|too large|maximum size/i.test(message)) {
          toast.error("That image is too large. Please choose a smaller file.");
        } else if (/policy|permission|unauthorized/i.test(message)) {
          toast.error("You don't have permission to upload a photo.");
        } else {
          toast.error(`Couldn't upload the photo: ${message || 'unknown error'}`);
        }
        return;
      }

      // 3. Public URL with cache-buster
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);
      const urlWithCacheBust = `${publicUrl}?v=${Date.now()}`;

      // 4. Persist URL in user metadata (no DB migration required)
      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: urlWithCacheBust }
      });
      if (metaError) {
        // The image did upload; only the profile link failed.
        console.error('[Profile photo] Saving avatar_url to user metadata failed:', metaError);
        toast.error("Photo uploaded, but we couldn't attach it to your profile. Please try again.");
        return;
      }

      setProfilePhoto(urlWithCacheBust);
      toast.success("Profile photo updated");
      setPhotoModalOpen(false);
      setPreviewPhoto(null);
    } catch (error) {
      console.error('[Profile photo] Unexpected failure:', error);
      toast.error("Something went wrong updating your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    try {
      if (user?.id) {
        await supabase.storage.from('avatars').remove([`${user.id}/avatar`]);
        await supabase.auth.updateUser({ data: { avatar_url: null } });
      }
      setProfilePhoto(null);
      setPreviewPhoto(null);
      toast.success("Profile photo removed");
      setPhotoModalOpen(false);
    } catch (error) {
      console.error('[Profile photo] Remove failed:', error);
      toast.error("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoModalClose = (open: boolean) => {
    if (!open) setPreviewPhoto(null);
    setPhotoModalOpen(open);
  };

  // ── Other handlers ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    const passwordError = Validators.password(newPassword);
    if (passwordError) { toast.error(passwordError); return; }
    const confirmError = Validators.passwordConfirm(newPassword, confirmPassword);
    if (confirmError) { toast.error(confirmError); return; }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { toast.error(error.message || "Failed to change password"); return; }
      toast.success("Password changed successfully");
      setPasswordModalOpen(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch {
      toast.error("An error occurred while changing password");
    }
  };

  const initials = getInitials(formData.fullName);

  return (
    <div className="v-app">
      <TopNav />

      <div style={{ padding: "20px 28px 40px", maxWidth: 1060, margin: "0 auto", width: "100%" }} className="space-y-6">
        <div className="flex items-end justify-between" style={{ paddingBottom: 4 }}>
          <div>
            <h1 className="v-h1">Profile</h1>
            <p className="v-meta" style={{ marginTop: 4, fontSize: 13 }}>Manage your account information.</p>
          </div>
          <button className="v-btn" style={{ height: 36, fontSize: 13, padding: "0 16px" }} onClick={() => navigate("/")}>
            Back to dashboard
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Profile picture card ── */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src={profilePhoto ?? ""} />
                <AvatarFallback className="bg-navy-dark text-white text-3xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{formData.fullName || "Coach"}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setPhotoModalOpen(true)}>
                <Camera className="h-4 w-4 mr-2" />
                Change Photo
              </Button>
            </CardContent>
          </Card>

          {/* ── Personal information card ── */}
          <Card>
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
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  <User className="inline mr-2 h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline mr-2 h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed directly.</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Account settings card ── */}
          <Card className="md:col-span-2" id="account-settings">
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Change Password</Label>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(true)}>
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Photo upload modal ── */}
      <Dialog open={photoModalOpen} onOpenChange={handlePhotoModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Profile Photo</DialogTitle>
            <DialogDescription>
              Upload a new profile picture. Supported: JPG, PNG up to 5 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarImage src={previewPhoto ?? profilePhoto ?? ""} />
                <AvatarFallback className="bg-navy-dark text-white text-3xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* Remove button — only visible when there's an existing saved photo */}
              {profilePhoto && !previewPhoto && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  title="Delete photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Clear preview button */}
              {previewPhoto && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                  onClick={() => setPreviewPhoto(null)}
                  disabled={uploading}
                  title="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
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
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <p className="text-xs text-muted-foreground">
              Supported formats: JPG, PNG. Max size: 5 MB.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePhotoModalClose(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handlePhotoUpload} disabled={!previewPhoto || uploading}>
              {uploading ? "Saving…" : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change password modal ── */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Password must be at least 8 characters long.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
