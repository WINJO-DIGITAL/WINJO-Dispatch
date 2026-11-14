// The signed-in user's business's booking-reference prefix (e.g. "ACM"),
// read from their own tenants row. Any failure (no login, the column missing,
// a network error) gives "WJD", which is always a valid reference.

export async function fetchRefPrefix(supabase) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return "WJD";
    const { data: roles } = await supabase.from("tenant_users").select("tenant_id").eq("user_id", userId);
    const own = (roles || []).find((r) => r.tenant_id);
    if (!own) return "WJD";
    const { data } = await supabase.from("tenants").select("ref_prefix").eq("id", own.tenant_id).maybeSingle();
    return /^[A-Z]{2,5}$/.test(data?.ref_prefix || "") ? data.ref_prefix : "WJD";
  } catch {
    return "WJD";
  }
}
