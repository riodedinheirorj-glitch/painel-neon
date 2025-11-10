import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// Helper functions para queries com tipos forçados
export const supabaseTyped = supabase as any;

export async function getUserRole(userId: string) {
  const { data } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  
  return data;
}

export async function getProfiles() {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, email, full_name, credits");
  
  return { data, error };
}

export async function getDownloads(userId: string) {
  const { data } = await (supabase as any)
    .from("downloads")
    .select("id", { count: "exact" })
    .eq("user_id", userId);
  
  return data;
}

export async function insertDownload(userId: string, fileName: string) {
  await (supabase as any).from("downloads").insert({
    user_id: userId,
    file_name: fileName,
  });
}

export async function getUserCredits(userId: string) {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  
  return data?.credits || 0;
}

export async function deductCredit(userId: string) {
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  
  if (!profile || profile.credits < 1) {
    return { success: false, error: "Créditos insuficientes" };
  }
  
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ credits: profile.credits - 1 })
    .eq("id", userId);
  
  if (error) return { success: false, error: error.message };
  
  // Register transaction
  await (supabase as any).from("transactions").insert({
    user_id: userId,
    type: "download",
    amount: -1,
    description: "Download de planilha"
  });
  
  return { success: true };
}

export async function createCreditPurchase(userId: string, credits: number, amountBrl: number) {
  const { data, error } = await (supabase as any)
    .from("credit_purchases")
    .insert({
      user_id: userId,
      credits,
      amount_brl: amountBrl
    })
    .select()
    .single();
  
  return { data, error };
}

export async function getPendingPurchases() {
  const { data, error } = await (supabase as any)
    .from("credit_purchases")
    .select(`
      *,
      profiles:user_id (email, full_name)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  
  return { data, error };
}

export async function approvePurchase(purchaseId: string, adminId: string) {
  const { data: purchase } = await (supabase as any)
    .from("credit_purchases")
    .select("user_id, credits")
    .eq("id", purchaseId)
    .single();
  
  if (!purchase) return { success: false, error: "Pedido não encontrado" };
  
  // Update purchase status
  const { error: updateError } = await (supabase as any)
    .from("credit_purchases")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: adminId
    })
    .eq("id", purchaseId);
  
  if (updateError) return { success: false, error: updateError.message };
  
  // Add credits to user
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("credits")
    .eq("id", purchase.user_id)
    .single();
  
  const { error: creditsError } = await (supabase as any)
    .from("profiles")
    .update({ credits: (profile?.credits || 0) + purchase.credits })
    .eq("id", purchase.user_id);
  
  if (creditsError) return { success: false, error: creditsError.message };
  
  // Register transaction
  await (supabase as any).from("transactions").insert({
    user_id: purchase.user_id,
    type: "purchase",
    amount: purchase.credits,
    description: `Compra de ${purchase.credits} créditos aprovada`
  });
  
  return { success: true };
}

export async function updateUserCredits(userId: string, amount: number, adminId: string) {
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  
  const newCredits = Math.max(0, (profile?.credits || 0) + amount);
  
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", userId);
  
  if (error) return { success: false, error: error.message };
  
  // Register transaction
  await (supabase as any).from("transactions").insert({
    user_id: userId,
    type: amount > 0 ? "admin_add" : "admin_remove",
    amount,
    description: `Ajuste manual de créditos pelo admin`
  });
  
  return { success: true };
}

export async function getTransactions(userId?: string) {
  let query = (supabase as any)
    .from("transactions")
    .select(`
      *,
      profiles:user_id (email, full_name)
    `)
    .order("created_at", { ascending: false });
  
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data, error } = await query;
  return { data, error };
}
