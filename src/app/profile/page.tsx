import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { updateProfile } from "@/app/actions/profile";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordForm } from "./components/password-form";


export default async function ProfilePage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  if (!session || !sessionUser) {
    return <div>Unauthorized</div>;
  }

  // Fetch full user details
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      manager: true,
    }
  });

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Read-Only Employment Information */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">Employment Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Full Name</label>
              <div className="text-foreground mt-1">{user.name}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Email Address</label>
              <div className="text-muted-foreground mt-1">{user.email}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Role / Access Level</label>
              <div className="text-muted-foreground mt-1">{user.role}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Department</label>
                <div className="text-muted-foreground mt-1">{user.department || "-"}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Position</label>
                <div className="text-muted-foreground mt-1">{user.position || "-"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">IC ID</label>
                <div className="text-muted-foreground mt-1">{user.icId || "-"}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Manager</label>
                <div className="text-muted-foreground mt-1">{user.manager?.name || "-"}</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Contact HR if any of your employment information is incorrect.
          </p>
        </div>

        <div className="space-y-8">
          {/* Editable Personal Information */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground mb-4">Personal Information</h2>
            <form action={updateProfile} className="space-y-4">
              <div>
                 <label htmlFor="contactNumber" className="block text-sm font-medium text-foreground mb-1">
                   Contact Number
                 </label>
                 <input 
                   type="text" 
                   id="contactNumber" 
                   name="contactNumber" 
                   defaultValue={user.contactNumber || ""}
                   className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                   placeholder="+1 (555) 000-0000"
                 />
              </div>
              
              <div>
                 <label htmlFor="emergencyContact" className="block text-sm font-medium text-foreground mb-1">
                   Emergency Contact
                 </label>
                 <input 
                   type="text" 
                   id="emergencyContact" 
                   name="emergencyContact" 
                   defaultValue={user.emergencyContact || ""}
                   className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                   placeholder="Name & Number"
                 />
              </div>

              <div>
                 <label htmlFor="address" className="block text-sm font-medium text-foreground mb-1">
                   Home Address
                 </label>
                 <textarea 
                   id="address" 
                   name="address" 
                   defaultValue={user.address || ""}
                   rows={3}
                   className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                   placeholder="123 Example St, City, Country"
                 />
              </div>

              <div className="pt-4">
                <SubmitButton className="w-full">
                  Save Changes
                </SubmitButton>
              </div>
            </form>
          </div>

          {/* Security Settings (Change Password) */}
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
