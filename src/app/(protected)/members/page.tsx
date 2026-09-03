import { requireAuthStrict } from "@/server/auth";
import { db } from "@/server/db";
import { InviteMemberView } from "@/components/members/InviteMemberView";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = await requireAuthStrict();

  const [members, invitations] = await Promise.all([
    db.shopMember.findMany({
      where: { shopId: session.shopId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.shopInvitation.findMany({
      where: { shopId: session.shopId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const isOwnerOrManager = session.role === "OWNER" || session.role === "MANAGER";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Members</h1>
        <p className="text-xs text-slate-500 mt-1">Manage who can access {session.shopName} ({session.shopCode})</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Current Members ({members.length})</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{m.user.name} <span className="text-xs font-normal text-slate-500">({m.loginId})</span></div>
                <div className="text-xs text-slate-500">{m.user.email}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">{m.role}</span>
            </div>
          ))}
        </div>
      </div>

      {isOwnerOrManager ? (
        <InviteMemberView initialInvitations={invitations} shopCode={session.shopCode} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Only owners or managers can invite new members. Ask your shop owner for an invitation code.
        </div>
      )}
    </div>
  );
}
