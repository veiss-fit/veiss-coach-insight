import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Calendar, Award, Users } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveChanges = () => {
    toast.success("Profile updated successfully");
    setIsEditing(false);
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
                <AvatarImage src="" />
                <AvatarFallback className="bg-navy-dark text-white text-3xl font-bold">
                  CM
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="mt-2 bg-gold text-navy-dark">Head Coach</Badge>
              </div>
              <Button variant="outline" className="w-full" disabled>
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
                  <Label htmlFor="firstName">
                    <User className="inline mr-2 h-4 w-4" />
                    First Name
                  </Label>
                  <Input 
                    id="firstName" 
                    defaultValue="Coach" 
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    defaultValue="Martin" 
                    disabled={!isEditing}
                  />
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
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  <Shield className="inline mr-2 h-4 w-4" />
                  Role
                </Label>
                <Input 
                  id="role" 
                  defaultValue="Head Coach - Strength & Conditioning" 
                  disabled
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

          {/* Coaching Stats Card */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>
                <Award className="inline mr-2 h-5 w-5" />
                Coaching Statistics
              </CardTitle>
              <CardDescription>Your impact and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-gold">150+</div>
                  <div className="text-sm text-muted-foreground">Total Athletes</div>
                </div>
                <div className="space-y-2 text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-gold">4</div>
                  <div className="text-sm text-muted-foreground">Sports Teams</div>
                </div>
                <div className="space-y-2 text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-gold">1,250+</div>
                  <div className="text-sm text-muted-foreground">Sessions Completed</div>
                </div>
                <div className="space-y-2 text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-gold">92%</div>
                  <div className="text-sm text-muted-foreground">Target Achievement</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings Card */}
          <Card className="md:col-span-3">
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
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Change Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
