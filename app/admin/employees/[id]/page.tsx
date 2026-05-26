import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { notFound } from "next/navigation"
import EmployeeEditClient from "./employee-edit-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EmployeeProfilePage({ params }: Props) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: employee, error } = await admin
    .from("employees")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !employee) notFound()

  return <EmployeeEditClient employee={employee} />
}
