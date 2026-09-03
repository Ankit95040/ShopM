"use client";

import { useState } from "react";
import { Ticket, Copy, Check, Loader2, Shield } from "lucide-react";
import { createShopInvitationAction, revokeShopInvitationAction } from "@/server/actions/invitation.actions";
import { useToast } from "@/components/shared/ToastContext";

interface Invitation {
  id: string;
  code: string;
  role: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | Date;
  isActive: boolean;
}

export function InviteMemberView({ initialInvitations, shopCode }: { initialInvitations: Invitation[]; shopCode: string }) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    const res = await createShopInvitationAction({ role: "EMPLOYEE", maxUses: 1 });
    setIsCreating(false);
    if (res.success && res.invitation) {
      setInvitations([res.invitation as Invitation, ...invitations]);
      toast.success("Invitation created");
    } else {
      toast.error(res.error || "Failed to create invitation");
    }
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
    toast.success("Invitation code copied");
  };

  const handleRevoke = async (id: string) => {
    const res = await revokeShopInvitationAction(id);
    if (res.success) {
      setInvitations(invitations.map((inv) => (inv.id === id ? { ...inv, isActive: false } : inv)));
      toast.success("Invitation revoked");
    } else {
      toast.error(res.error || "Failed to revoke");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Ticket className="h-4 w-4 text-sky-600" /> Invite New Member</h2>
        <button onClick={handleCreate} disabled={isCreating} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 min-h-[36px]">
          {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />} New Invitation
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Share the Shop ID <span className="font-mono font-bold text-slate-700">{shopCode}</span> and an invitation code. Codes expire in 7 days and are single-use by default.
      </p>

      {invitations.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center text-xs text-slate-500">No invitations yet. Create one to invite a teammate.</div>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-3">
                <code className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black tracking-wider text-white">{inv.code}</code>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${inv.isActive && new Date(inv.expiresAt) > new Date() && inv.usedCount < inv.maxUses ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {inv.isActive && new Date(inv.expiresAt) > new Date() && inv.usedCount < inv.maxUses ? "Active" : "Used/Expired"}
                </span>
                <span className="text-[11px] text-slate-500">{inv.role} • {inv.usedCount}/{inv.maxUses} used</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleCopy(inv.code)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  {copiedCode === inv.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} Copy
                </button>
                {inv.isActive && <button onClick={() => handleRevoke(inv.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Revoke</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
