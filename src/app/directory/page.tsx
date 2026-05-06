import { auth } from "@/auth";
import prisma from "@/lib/prisma";


export default async function DirectoryPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  if (!session || !sessionUser) {
    return <div>Unauthorized</div>;
  }

  // Fetch all active users, ordered by name
  const users = await prisma.user.findMany({
    orderBy: {
      name: 'asc'
    },
    include: {
      manager: true,
    }
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-foreground">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/60 border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Name</th>
                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Role & Dept</th>
                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Manager</th>
                <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Contact Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-foreground">{user.position || "-"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.department || user.role}</div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {user.manager?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-foreground">{user.contactNumber || "-"}</div>
                  </td>
                </tr>
              ))}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No team members found in the directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
