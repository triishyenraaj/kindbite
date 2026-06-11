import { useEffect, useState, useMemo } from "react";
// --- MODIFIED IMPORT: Added useNavigate ---
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { getAllUsers, updateUserProfile } from "@/features/users/userService"; 

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; 
import { Users, Search, MoreVertical, Loader2, ShieldAlert, Ban, UserCheck, Eye, ShieldCheck } from "lucide-react";

export default function UserDirectoryTab() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate(); // --- ADDED: Navigation hook ---
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await getAllUsers();
        setUsersList(data);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return usersList.filter(u => 
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [usersList, searchQuery]);

  const handleToggleRole = async (targetUserId, currentRole) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!window.confirm(`Are you sure you want to change this user's role?`)) return;
    try {
      await updateUserProfile(targetUserId, { role: newRole });
      setUsersList(usersList.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
    } catch (error) { alert("Failed to update user role."); }
  };

  const handleToggleStatus = async (targetUserId, currentStatus) => {
    const newStatus = (currentStatus === "suspended") ? "active" : "suspended";
    if (!window.confirm(`Are you sure you want to ${newStatus === "suspended" ? "SUSPEND" : "ACTIVATE"} this account?`)) return;
    try {
      await updateUserProfile(targetUserId, { status: newStatus });
      setUsersList(usersList.map(u => u.id === targetUserId ? { ...u, status: newStatus } : u));
    } catch (error) { alert("Failed to update user status."); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">User Directory</CardTitle>
            <p className="text-xs text-slate-500 font-medium mt-1">Manage and monitor all registered accounts.</p>
          </div>
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-violet-500 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600 mb-4" />
              <p className="text-sm font-bold">Loading user database...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-bold">No users found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-black">User Profile</th>
                    <th className="px-6 py-4 font-black">Contact Info</th>
                    <th className="px-6 py-4 font-black">Platform Status</th>
                    <th className="px-6 py-4 text-right font-black">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className={`transition-colors group ${u.status === 'suspended' ? 'bg-red-50/20' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img 
                              src={u.photoURL} 
                              alt={u.fullName || "User"} 
                              className={`w-10 h-10 rounded-full object-cover shrink-0 shadow-sm ${u.status === 'suspended' ? 'grayscale opacity-60 border-2 border-red-200' : ''}`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${u.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700'}`}>
                              {u.fullName ? u.fullName.charAt(0).toUpperCase() : "U"}
                            </div>
                          )}
                          <div>
                            <p className={`font-bold ${u.status === 'suspended' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                              {u.fullName || "Incomplete Profile"}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {u.id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">{u.email}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{u.phone || "No phone provided"}</p>
                      </td>
                      <td className="px-6 py-4 flex flex-col items-start gap-1.5">
                        {u.role === "admin" ? (
                          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-200 border-none shadow-none px-2 py-0.5">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 px-2 py-0.5">
                            Standard User
                          </Badge>
                        )}
                        {u.status === "suspended" && (
                          <Badge className="bg-red-50 text-red-600 border border-red-200 shadow-none hover:bg-red-50 px-2 py-0.5">
                            <Ban className="w-3 h-3 mr-1" /> Suspended
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-violet-500">
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-lg border-slate-100 p-1.5">
                            <DropdownMenuLabel className="text-[10px] text-slate-400 font-black uppercase tracking-widest px-2">Manage User</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            {/* --- MODIFIED: Changes alert() to dynamic router route --- */}
                            <DropdownMenuItem 
                              className="text-slate-700 text-xs font-bold focus:bg-slate-50 focus:text-violet-600 rounded-lg cursor-pointer py-2" 
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" /> View Profile Data
                            </DropdownMenuItem>
                            {u.id !== currentUser?.uid && (
                              <>
                                <DropdownMenuItem className="text-slate-700 text-xs font-bold focus:bg-slate-50 focus:text-violet-600 rounded-lg cursor-pointer py-2" onClick={() => handleToggleRole(u.id, u.role)}>
                                  <ShieldAlert className="w-4 h-4 mr-2" /> {u.role === "admin" ? "Revoke Admin Access" : "Grant Admin Access"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-100 my-1" />
                                <DropdownMenuItem className={`text-xs font-bold rounded-lg cursor-pointer py-2 ${u.status === 'suspended' ? 'text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700' : 'text-red-600 focus:bg-red-50 focus:text-red-700'}`} onClick={() => handleToggleStatus(u.id, u.status)}>
                                  {u.status === "suspended" ? <><UserCheck className="w-4 h-4 mr-2" /> Lift Suspension</> : <><Ban className="w-4 h-4 mr-2" /> Suspend Account</>}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}