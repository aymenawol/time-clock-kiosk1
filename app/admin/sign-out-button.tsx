"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"

export default function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
    >
      Sign out
    </button>
  )
}
