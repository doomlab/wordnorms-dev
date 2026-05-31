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
    select: { email: true, name: true, institution: true, role: true, groqApiKey: true, points: true },
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

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg mb-1">Contributions</h2>
            <p className="text-3xl font-bold text-primary mb-1">{user.points} pts</p>
            {!isAdmin && (
              <>
                <div className="w-full bg-base-300 rounded-full h-2 mb-1">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (user.points / 20) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-base-content/50 mb-3">
                  {user.points >= 20
                    ? "You've reached the threshold for admin consideration."
                    : `${20 - user.points} pts to admin consideration`}
                </p>
              </>
            )}
            <ul className="text-xs text-base-content/50 space-y-0.5">
              <li>+10 pts — article suggestion accepted</li>
              <li>+5 pts — extraction edit applied</li>
            </ul>
          </div>
        </div>

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
