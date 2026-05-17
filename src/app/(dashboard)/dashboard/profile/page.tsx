import { redirect } from "next/navigation"
import { getBlitzContext } from "../../../blitz-server"
import db from "db"
import { ProfileForm } from "./ProfileForm"
import { ChangePasswordForm } from "./ChangePasswordForm"
import { GroqKeyForm } from "./GroqKeyForm"
import { RequestAdminForm } from "./RequestAdminForm"

export const metadata = { title: "Profile" }

export default async function ProfilePage() {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  const user = await db.user.findUniqueOrThrow({
    where: { id: ctx.session.userId },
    select: { email: true, name: true, institution: true, role: true, groqApiKey: true },
  })

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN"

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg mb-1">Account info</h2>
            <p className="text-base-content/50 text-sm mb-4">{user.email}</p>
            <ProfileForm name={user.name} institution={user.institution} />
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">Change password</h2>
            <ChangePasswordForm />
          </div>
        </div>

        {isAdmin && (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg mb-1">Groq API key</h2>
              <GroqKeyForm hasKey={!!user.groqApiKey} />
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg mb-1">Request admin access</h2>
              <RequestAdminForm />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
