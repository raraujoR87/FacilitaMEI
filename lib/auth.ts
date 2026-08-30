import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Toda Server Action é um endpoint POST público — o `proxy.ts` protege a
 * navegação, não a ação. Por isso cada mutação revalida a sessão aqui.
 */
export async function exigirUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
