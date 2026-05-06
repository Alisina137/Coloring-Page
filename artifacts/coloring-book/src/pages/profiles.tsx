import { useState } from "react";
import {
  useGetProfiles,
  useCreateProfile,
  useUpdateProfile,
  useDeleteProfile,
  getGetProfilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, UserCircle2, Star, Pencil } from "lucide-react";

const AVATARS = ["🎨", "🦁", "🐸", "🦊", "🐼", "🐶", "🐱", "🦄", "🐯", "🐙", "🦋", "🐻"];

type Profile = {
  id: number;
  name: string;
  ageGroup: string;
  avatarEmoji: string;
  totalPages: number;
  totalMinutes: number;
  currentDifficulty: number;
};

export function Profiles() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useGetProfiles();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetProfilesQueryKey() });

  const createMutation = useCreateProfile({
    mutation: {
      onSuccess: () => {
        invalidate();
        setAddOpen(false);
        setName("");
        setAgeGroup("6-8");
        setAvatarEmoji("🎨");
      },
    },
  });

  const updateMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditProfile(null);
      },
    },
  });

  const deleteMutation = useDeleteProfile({
    mutation: { onSuccess: invalidate },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [avatarEmoji, setAvatarEmoji] = useState("🎨");

  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState<"3-5" | "6-8" | "9+">("6-8");
  const [editAvatar, setEditAvatar] = useState("🎨");

  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.name);
    setEditAge(p.ageGroup as "3-5" | "6-8" | "9+");
    setEditAvatar(p.avatarEmoji);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({ data: { name: name.trim(), ageGroup, avatarEmoji } });
  };

  const handleUpdate = () => {
    if (!editProfile || !editName.trim()) return;
    updateMutation.mutate({
      id: editProfile.id,
      data: { name: editName.trim(), ageGroup: editAge, avatarEmoji: editAvatar },
    });
  };

  const ProfileForm = ({
    formName, setFormName,
    formAge, setFormAge,
    formAvatar, setFormAvatar,
    onSubmit, isPending, submitLabel,
  }: {
    formName: string; setFormName: (v: string) => void;
    formAge: "3-5" | "6-8" | "9+"; setFormAge: (v: "3-5" | "6-8" | "9+") => void;
    formAvatar: string; setFormAvatar: (v: string) => void;
    onSubmit: () => void; isPending: boolean; submitLabel: string;
  }) => (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={formName}
          onChange={e => setFormName(e.target.value)}
          placeholder="Child's name"
          className="rounded-xl"
          onKeyDown={e => e.key === "Enter" && onSubmit()}
        />
      </div>
      <div className="space-y-2">
        <Label>Age group</Label>
        <RadioGroup value={formAge} onValueChange={v => setFormAge(v as "3-5" | "6-8" | "9+")} className="flex gap-4">
          {(["3-5", "6-8", "9+"] as const).map(age => (
            <div key={age} className="flex items-center space-x-2">
              <RadioGroupItem value={age} id={`form-age-${age}`} />
              <Label htmlFor={`form-age-${age}`} className="cursor-pointer">{age}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label>Pick an avatar</Label>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setFormAvatar(emoji)}
              className={`text-2xl p-2 rounded-xl border-2 transition-all ${formAvatar === emoji ? "border-primary bg-primary/10" : "border-transparent hover:border-primary/30"}`}
            >{emoji}</button>
          ))}
        </div>
      </div>
      <Button
        className="w-full rounded-xl font-bold"
        onClick={onSubmit}
        disabled={isPending || !formName.trim()}
      >
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Child Profiles</h1>
          <p className="text-muted-foreground mt-1">Each child has their own progress and history</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold">
              <Plus className="mr-2 h-4 w-4" />Add Child
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Add a Child Profile</DialogTitle>
            </DialogHeader>
            <ProfileForm
              formName={name} setFormName={setName}
              formAge={ageGroup} setFormAge={setAgeGroup}
              formAvatar={avatarEmoji} setFormAvatar={setAvatarEmoji}
              onSubmit={handleCreate}
              isPending={createMutation.isPending}
              submitLabel="Create Profile"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editProfile} onOpenChange={open => { if (!open) setEditProfile(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Profile</DialogTitle>
          </DialogHeader>
          <ProfileForm
            formName={editName} setFormName={setEditName}
            formAge={editAge} setFormAge={setEditAge}
            formAvatar={editAvatar} setFormAvatar={setEditAvatar}
            onSubmit={handleUpdate}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-card rounded-3xl border-2 border-dashed border-border p-16 text-center space-y-3 opacity-60">
          <UserCircle2 className="h-16 w-16 mx-auto text-muted-foreground" />
          <p className="font-display text-lg font-medium text-muted-foreground">No profiles yet</p>
          <p className="text-sm text-muted-foreground">Create one for each child to track their progress</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {(profiles as Profile[]).map(profile => (
            <div key={profile.id} className="bg-card rounded-2xl border-2 border-border p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{profile.avatarEmoji}</span>
                  <div>
                    <p className="font-display font-bold text-lg">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">Age group: {profile.ageGroup}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(profile)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: profile.id })}
                    disabled={deleteMutation.isPending && (deleteMutation.variables as any)?.id === profile.id}
                  >
                    {deleteMutation.isPending && (deleteMutation.variables as any)?.id === profile.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{profile.totalPages}</p>
                  <p className="text-xs text-muted-foreground">Pages Created</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-secondary-foreground">{profile.totalMinutes}m</p>
                  <p className="text-xs text-muted-foreground">Time Spent</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium">Difficulty level {profile.currentDifficulty}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
