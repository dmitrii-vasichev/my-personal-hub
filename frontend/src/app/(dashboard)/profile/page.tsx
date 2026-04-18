"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Save, Key, User, Mail, Phone, Linkedin, Globe, MapPin, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import {
  useUserProfile,
  useUpdateUserProfile,
} from "@/hooks/use-user-profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { SkillsEditor } from "@/components/profile/skills-editor";
import { ExperienceEditor } from "@/components/profile/experience-editor";
import { EducationEditor } from "@/components/profile/education-editor";
import { ProfileImportDialog } from "@/components/profile/profile-import-dialog";
import type { ContactInfo, SkillEntry, ExperienceEntry, EducationEntry } from "@/types/profile";

function RoleBadge({ role }: { role: string }) {
  const config = role === "admin"
    ? { label: "Admin", color: "#4f8ef7" }
    : role === "demo"
    ? { label: "Demo", color: "#f59e0b" }
    : { label: "Member", color: "#2dd4bf" };

  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]"
      style={{
        background: `${config.color}1a`,
        color: config.color,
        border: `1px solid ${config.color}33`,
      }}
    >
      {config.label}
    </span>
  );
}

export default function ProfilePage() {
  const { user, refreshUser, isDemo } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const { data: userProfile } = useUserProfile();
  const updateUserProfile = useUpdateUserProfile();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [nameInitialized, setNameInitialized] = useState(false);

  const [timezone, setTimezone] = useState("UTC");
  const [timezoneInitialized, setTimezoneInitialized] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  // IANA timezone list from the browser. Fallback to a small hand-picked
  // list for environments (older runtimes, some test shims) that don't
  // implement Intl.supportedValuesOf.
  const timezoneOptions = useMemo<string[]>(() => {
    const intl = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof intl.supportedValuesOf === "function") {
      try {
        return intl.supportedValuesOf("timeZone");
      } catch {
        // fall through to fallback list
      }
    }
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Europe/Moscow",
      "Asia/Tokyo",
    ];
  }, []);

  const timezoneLabels = useMemo<Record<string, string>>(
    () => Object.fromEntries(timezoneOptions.map((tz) => [tz, tz])),
    [timezoneOptions]
  );

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  // Professional profile state
  const [contacts, setContacts] = useState<ContactInfo>({});
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [profInitialized, setProfInitialized] = useState(false);

  if (profile && !nameInitialized) {
    setDisplayName(profile.display_name);
    setNameInitialized(true);
  }

  if (profile && !timezoneInitialized) {
    setTimezone(profile.timezone || "UTC");
    setTimezoneInitialized(true);
  }

  useEffect(() => {
    if (userProfile && !profInitialized) {
      setContacts(userProfile.contacts ?? {});
      setSummary(userProfile.summary ?? "");
      setSkills(userProfile.skills ?? []);
      setExperience(userProfile.experience ?? []);
      setEducation(userProfile.education ?? []);
      setProfInitialized(true);
    }
  }, [userProfile, profInitialized]);

  const handleSaveName = async () => {
    try {
      await updateProfile.mutateAsync({ display_name: displayName });
      await refreshUser();
      toast.success("Display name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast.error("Both fields are required");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (currentPwd === newPwd) {
      toast.error("New password must differ from current password");
      return;
    }
    setChangingPwd(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: currentPwd,
        new_password: newPwd,
      });
      setCurrentPwd("");
      setNewPwd("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPwd(false);
    }
  };

  const handleSaveTimezone = async () => {
    if (!timezone) return;
    setSavingTimezone(true);
    try {
      await updateProfile.mutateAsync({ timezone });
      toast.success("Timezone updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update timezone");
    } finally {
      setSavingTimezone(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateUserProfile.mutateAsync({
        contacts,
        summary: summary || undefined,
        skills,
        experience,
        education,
      });
      toast.success("Professional profile saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile"
      );
    }
  };

  const name = profile?.display_name ?? user?.display_name ?? "";

  return (
    <div className="mx-auto max-w-xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Profile</h1>
        {!isDemo && (
          <ProfileImportDialog
            onSuccess={() => setProfInitialized(false)}
          />
        )}
      </div>

      {/* Avatar + identity */}
      <section className="flex items-center gap-5 rounded-[14px] border border-border bg-surface p-5">
        <Avatar name={name} size="lg" />
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{profile?.email ?? user?.email}</div>
          <div className="flex items-center gap-2 pt-0.5">
            <RoleBadge role={profile?.role ?? user?.role ?? "member"} />
          </div>
        </div>
      </section>

      {/* Edit display name */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Display Name</h2>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Email</Label>
          <Input
            value={profile?.email ?? user?.email ?? ""}
            disabled
            className="text-sm opacity-60"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <Button
          size="sm"
          onClick={handleSaveName}
          disabled={updateProfile.isPending || !displayName.trim()}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {updateProfile.isPending ? "Saving…" : "Save name"}
        </Button>
      </section>

      {/* Change password */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Key className="h-4 w-4 text-muted-foreground" />
          Change Password
        </h2>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Current Password</Label>
          <Input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="Enter current password"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">New Password</Label>
          <Input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="At least 8 characters"
            className="text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleChangePassword}
          disabled={changingPwd || !currentPwd || !newPwd}
        >
          {changingPwd ? "Changing…" : "Change password"}
        </Button>
      </section>

      {/* Timezone */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Timezone
        </h2>
        <div className="space-y-1">
          <Label htmlFor="timezone-select" className="text-xs uppercase text-muted-foreground">
            IANA Timezone
          </Label>
          <SelectRoot
            value={timezone}
            onValueChange={setTimezone}
            labels={timezoneLabels}
          >
            <SelectTrigger id="timezone-select" aria-label="Timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {timezoneOptions.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectRoot>
          <p className="text-[11px] text-muted-foreground">
            Used for Pulse digest scheduling and other time-based features.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSaveTimezone}
          disabled={savingTimezone || !timezone || timezone === (profile?.timezone || "UTC")}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {savingTimezone ? "Saving…" : "Save timezone"}
        </Button>
      </section>

      {/* Contact Info */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4 text-muted-foreground" />
          Contact Info
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              <Mail className="mr-1 inline h-3 w-3" />
              Email
            </Label>
            <Input
              value={contacts.email ?? ""}
              onChange={(e) =>
                setContacts((c) => ({ ...c, email: e.target.value }))
              }
              placeholder="professional@email.com"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              <Phone className="mr-1 inline h-3 w-3" />
              Phone
            </Label>
            <Input
              value={contacts.phone ?? ""}
              onChange={(e) =>
                setContacts((c) => ({ ...c, phone: e.target.value }))
              }
              placeholder="+1 (555) 123-4567"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              <Linkedin className="mr-1 inline h-3 w-3" />
              LinkedIn
            </Label>
            <Input
              value={contacts.linkedin ?? ""}
              onChange={(e) =>
                setContacts((c) => ({ ...c, linkedin: e.target.value }))
              }
              placeholder="https://linkedin.com/in/..."
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              <Globe className="mr-1 inline h-3 w-3" />
              Website
            </Label>
            <Input
              value={contacts.website ?? ""}
              onChange={(e) =>
                setContacts((c) => ({ ...c, website: e.target.value }))
              }
              placeholder="https://yoursite.com"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              <MapPin className="mr-1 inline h-3 w-3" />
              Location
            </Label>
            <Input
              value={contacts.location ?? ""}
              onChange={(e) =>
                setContacts((c) => ({ ...c, location: e.target.value }))
              }
              placeholder="City, Country"
              className="text-sm"
            />
          </div>
        </div>
      </section>

      {/* Professional Summary */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Professional Summary</h2>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief professional summary — your background, expertise, and career goals..."
          rows={4}
          className="text-sm"
        />
      </section>

      {/* Skills */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Skills</h2>
        <SkillsEditor skills={skills} onChange={setSkills} />
      </section>

      {/* Experience */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Experience</h2>
        <ExperienceEditor experience={experience} onChange={setExperience} />
      </section>

      {/* Education */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Education</h2>
        <EducationEditor education={education} onChange={setEducation} />
      </section>

      {/* Save professional profile button */}
      <Button
        onClick={handleSaveProfile}
        disabled={updateUserProfile.isPending}
      >
        <Save className="mr-1.5 h-3.5 w-3.5" />
        {updateUserProfile.isPending
          ? "Saving…"
          : "Save professional profile"}
      </Button>
    </div>
  );
}
