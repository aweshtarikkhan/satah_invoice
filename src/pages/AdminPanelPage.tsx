import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import {
  useFeatureStore,
  ADMIN_FEATURE_GROUPS,
  DEFAULT_FEATURE_GROUPS,
} from "@/store/feature-store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Shield, Check, X, ArrowLeft, Plus, Trash2, Building2,
  FileText, Package, ShoppingCart, Calculator,
  UserCog, Users, Send, BarChart3, Loader2, AlertCircle, ChevronDown
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  FileText, Package, ShoppingCart, Calculator,
  UserCog, Users, Send, BarChart3,
};

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    isAdmin,
    isSuperAdmin,
    adminEmails,
    addAdmin,
    removeAdmin,
    enabledGroups,
    toggleGroup,
    teamMembers,
    addTeamMember,
    removeTeamMember,
  } = useFeatureStore();

  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Staff");
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);
  
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const addMyOrganization = useAppStore((s) => s.addMyOrganization);
  const myOrganizations = useAppStore((s) => s.myOrganizations);
  const currentOrg = useAppStore((s) => s.organization);

  const currentUserEmail = session?.user?.email;
  const hasAccess = isAdmin(currentUserEmail);
  const isSuper = isSuperAdmin(currentUserEmail);

  // Logic for global team members limit across ALL businesses
  const totalGlobalUsers = myOrganizations.reduce((sum, org) => {
    return sum + (teamMembers[org.id]?.length || 0);
  }, 0);
  
  const currentOrgId = currentOrg?.id || "default";
  const orgTeamMembers = teamMembers[currentOrgId] || [];
  const globalLimitReached = totalGlobalUsers >= 5;

  const handleAddAdmin = () => {
    if (newAdminEmail && newAdminEmail.includes("@")) {
      addAdmin(newAdminEmail);
      setNewAdminEmail("");
    }
  };

  const handleAddTeamMember = () => {
    if (newUserEmail && newUserEmail.includes("@") && !globalLimitReached && currentOrgId) {
      addTeamMember(currentOrgId, {
        email: newUserEmail,
        role: newUserRole,
        permissions: newUserPermissions
      });
      setNewUserEmail("");
      setNewUserRole("Staff");
      setNewUserPermissions([]);
    }
  };

  const togglePermission = (groupKey: string) => {
    setNewUserPermissions((prev) => 
      prev.includes(groupKey) 
        ? prev.filter((k) => k !== groupKey) 
        : [...prev, groupKey]
    );
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) return;
    
    setIsCreatingBusiness(true);
    try {
      // Create organization in Supabase
      const { data, error } = await supabase
        .from("organizations")
        .insert([{ name: newBusinessName.trim() }])
        .select()
        .single();
        
      if (error) throw error;
      
      // Update our local tracking
      if (data) {
        addMyOrganization({ id: data.id, name: data.name });
        setNewBusinessName("");
        
        // Let's also automatically switch the user to the new business
        if (currentUserEmail) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ org_id: data.id })
            .eq("id", session?.user?.id);
            
          if (!profileError) {
            window.location.href = "/dashboard";
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to create business:", err.message);
      alert("Failed to create business: " + err.message);
    } finally {
      setIsCreatingBusiness(false);
    }
  };

  // Access Denied screen
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
        <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white">Access Denied</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Aapke paas admin rights nahi hain. Agar aapko access chahiye to apne administrator se contact karein.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full h-12 text-base font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all duration-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard pe wapas jayein
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin panel
  const totalAdminFeatures = ADMIN_FEATURE_GROUPS.length;
  const enabledCount = ADMIN_FEATURE_GROUPS.filter((g) =>
    enabledGroups.includes(g.key)
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/70 border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-slate-400">Manage Features & Users</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-800/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* Organization Users (Team) Section - Visible to all Admins */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              Organization Users (Team)
            </h2>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${globalLimitReached ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                Total Users Used: {totalGlobalUsers} / 5 (Across all businesses)
              </span>
            </div>
          </div>
          <Card className="bg-slate-800/40 backdrop-blur border-slate-700/30">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-5 border-r border-slate-700/30 pr-8">
                  <div>
                    <h3 className="text-white font-medium mb-1">Invite Employee</h3>
                    <p className="text-xs text-slate-400">Add a new user to {currentOrg?.name || "this business"}.</p>
                  </div>
                  
                  {globalLimitReached ? (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-red-400 text-sm font-medium">Global Plan Limit Reached</h4>
                        <p className="text-xs text-red-400/80 mt-1">Aapne apne sabhi businesses ko mila kar maximum 5 users add kar liye hain. Aur users add karne ke liye limit extend karwayein.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300">Email Address</label>
                        <Input
                          placeholder="employee@company.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 h-10 focus:border-emerald-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300">User Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-600/50 text-white h-10 rounded-md px-3 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Manager">Manager</option>
                          <option value="Accountant">Accountant</option>
                          <option value="Sales Executive">Sales Executive</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300">Feature Permissions</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {[...DEFAULT_FEATURE_GROUPS, ...ADMIN_FEATURE_GROUPS.filter(g => enabledGroups.includes(g.key))].map(group => (
                            <label key={group.key} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900/30 p-2 rounded border border-slate-700/30 cursor-pointer hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={newUserPermissions.includes(group.key)}
                                onChange={() => togglePermission(group.key)}
                                className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="truncate">{group.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleAddTeamMember}
                        disabled={!newUserEmail || !newUserEmail.includes("@")}
                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 transition-colors mt-2"
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add User
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-4">Current Team Members in {currentOrg?.name || "this business"}</h3>
                  {orgTeamMembers.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Koi user add nahi kiya gaya hai.</p>
                  ) : (
                    <div className="space-y-3">
                      {orgTeamMembers.map((member) => (
                        <div key={member.email} className="flex flex-col p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <UserCog className="h-5 w-5 text-emerald-400" />
                              </div>
                              <div>
                                <h4 className="text-sm text-white font-medium leading-none">{member.email}</h4>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mt-1.5 inline-block bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                  {member.role}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeTeamMember(currentOrgId, member.email)}
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                              title="Remove user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {member.permissions && member.permissions.length > 0 && (
                            <div className="pt-2 border-t border-slate-700/30">
                              <p className="text-[10px] text-slate-400 mb-1.5 font-medium">ACCESS GRANTED:</p>
                              <div className="flex flex-wrap gap-1">
                                {member.permissions.map(p => {
                                  const group = [...DEFAULT_FEATURE_GROUPS, ...ADMIN_FEATURE_GROUPS].find(g => g.key === p);
                                  return (
                                    <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      {group?.label || p}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Business Management Section - Moved outside Super Admin to allow Regular Admins */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            Manage Businesses
          </h2>
          <Card className="bg-slate-800/40 backdrop-blur border-slate-700/30">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-white font-medium mb-1">Create New Business</h3>
                    <p className="text-xs text-slate-400">Naya company ya business account banayein.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Business Name (e.g. ABC Pvt Ltd)"
                      value={newBusinessName}
                      onChange={(e) => setNewBusinessName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateBusiness()}
                      disabled={isCreatingBusiness}
                      className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 h-10 focus:border-emerald-500"
                    />
                    <Button
                      onClick={handleCreateBusiness}
                      disabled={!newBusinessName.trim() || isCreatingBusiness}
                      className="h-10 bg-emerald-600 hover:bg-emerald-500 transition-colors"
                    >
                      {isCreatingBusiness ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                      Create
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <h4 className="text-emerald-400 font-medium text-sm mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Multi-Business Feature
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Naya business create karne ke baad aap automatic us business me switch ho jayenge. 
                      Aap kisi bhi waqt sidebar me top-left dropdown se apne businesses switch kar sakte hain.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* --- SUPER ADMIN ONLY SECTIONS --- */}
        {isSuper && (
          <>
        {/* Admin Management Section */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-400" />
            Admin Management
          </h2>
          <Card className="bg-slate-800/40 backdrop-blur border-slate-700/30">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-white font-medium mb-1">Add New Admin</h3>
                    <p className="text-xs text-slate-400">Naya admin user banayein jo features manage kar sake.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email address (e.g. user@example.com)"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()}
                      className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 h-10 focus:border-purple-500"
                    />
                    <Button
                      onClick={handleAddAdmin}
                      disabled={!newAdminEmail || !newAdminEmail.includes("@")}
                      className="h-10 bg-purple-600 hover:bg-purple-500 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-4">Current Admins</h3>
                  <div className="space-y-2">
                    {adminEmails.map((email) => (
                      <div key={email} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-purple-400" />
                          </div>
                          <span className="text-sm text-white font-medium">{email}</span>
                          {email === "awesh.etpl@gmail.com" && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                              Super Admin
                            </span>
                          )}
                        </div>
                        {email !== "awesh.etpl@gmail.com" && email !== currentUserEmail && (
                          <button
                            onClick={() => removeAdmin(email)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                            title="Remove admin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>



        {/* Feature Management Section */}
        <section>
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl bg-slate-800/40 backdrop-blur border border-slate-700/30 p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Default Features</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{DEFAULT_FEATURE_GROUPS.reduce((a, g) => a + g.items.length, 0)}</p>
              <p className="text-xs text-slate-500 mt-1">Hamesha active — Invoice & Inventory</p>
            </div>
            <div className="rounded-2xl bg-slate-800/40 backdrop-blur border border-slate-700/30 p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Enabled Modules</p>
              <p className="text-3xl font-bold text-indigo-400 mt-1">{enabledCount} <span className="text-lg text-slate-500">/ {totalAdminFeatures}</span></p>
              <p className="text-xs text-slate-500 mt-1">Admin controlled feature groups</p>
            </div>
            <div className="rounded-2xl bg-slate-800/40 backdrop-blur border border-slate-700/30 p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Features</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">
                {DEFAULT_FEATURE_GROUPS.reduce((a, g) => a + g.items.length, 0) + ADMIN_FEATURE_GROUPS.filter((g) => enabledGroups.includes(g.key)).reduce((a, g) => a + g.items.length, 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">User ko visible features</p>
            </div>
          </div>

          {/* Admin-controlled features */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              Admin Controlled Features — Toggle ON/OFF
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {ADMIN_FEATURE_GROUPS.map((group) => {
                const isEnabled = enabledGroups.includes(group.key);
                const Icon = ICON_MAP[group.icon] || Package;
                return (
                  <div
                    key={group.key}
                    className={`rounded-2xl border p-5 relative overflow-hidden transition-all duration-500 ${
                      isEnabled
                        ? "bg-indigo-500/5 border-indigo-500/30 shadow-lg shadow-indigo-500/5"
                        : "bg-slate-800/20 border-slate-700/30 opacity-75"
                    }`}
                  >
                    <div
                      className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${
                        isEnabled ? "bg-indigo-500/10" : "bg-slate-700/10"
                      }`}
                    />
                    <div className="flex items-start gap-3 relative">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                          isEnabled ? "bg-indigo-500/15" : "bg-slate-700/30"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 transition-colors duration-300 ${
                            isEnabled ? "text-indigo-400" : "text-slate-500"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold transition-colors duration-300 ${isEnabled ? "text-white" : "text-slate-400"}`}>
                            {group.label}
                          </h3>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => toggleGroup(group.key)}
                            className="data-[state=checked]:bg-indigo-600"
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{group.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {group.items.map((item) => (
                            <span
                              key={item.key}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-300 ${
                                isEnabled
                                  ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                                  : "bg-slate-800/40 text-slate-500 border-slate-700/30"
                              }`}
                            >
                              {item.title}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] mt-2 text-slate-500">
                          {group.items.length} features • {isEnabled ? "✅ User ko visible" : "❌ User se hidden"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
