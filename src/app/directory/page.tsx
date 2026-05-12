import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DirectoryClientPage } from "@/app/directory/components/directory-client-page";


export default async function DirectoryPage() {
  const session = await auth();

  if (!session || !session.user) {
    return <div>Unauthorized</div>;
  }

  const users = await prisma.user.findMany({
    orderBy: {
      name: 'asc'
    },
    include: {
      manager: true,
    }
  });

  return (
    <DirectoryClientPage
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        department: user.department,
        contactNumber: user.contactNumber,
        managerName: user.manager?.name ?? null,
      }))}
    />
  );
}
