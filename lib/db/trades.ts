// ============================================================
// lib/db/trades.ts
//
// Changes vs original:
//   - deleteTrade removed (hard deletes blocked by RLS)
//   - updateOwnTrade added (calls update_own_trade RPC —
//     enforces allowed fields: quantity, stop_loss, target, notes)
//   - Trade interface updated with soft-delete fields
// ============================================================

import { supabase } from "../supabase";

export interface Trade {
  id:            string;
  user_id:       string;
  ticker:        string;
  entry_price:   number;
  entry_target:  number | null;
  stop_loss:     number;
  target:        number | null;
  quantity:      number;
  risk_amount:   number | null;
  capital:       number | null;
  exit_price:    number | null;
  realised_pnl:  number | null;
  notes:         string | null;
  status:        "QUEUED" | "OPEN" | "CLOSED" | "STOPPED" | "TARGET_HIT";
  created_at:    string;
  // Soft-delete fields (present after migration; null for normal trades)
  deleted_at:    string | null;
  deleted_by:    string | null;
  delete_reason: string | null;
}

export interface NewTrade {
  user_id:       string;
  ticker:        string;
  entry_price:   number;
  entry_target?: number;
  stop_loss:     number;
  target?:       number;
  quantity:      number;
  risk_amount?:  number;
  capital?:      number;
  notes?:        string;
}

export async function saveTrade(trade: NewTrade): Promise<Trade> {
  const { data, error } = await supabase
    .from("trades")
    .insert(trade)
    .select()
    .single();
  if (error) throw new Error(`Failed to save trade: ${error.message}`);
  return data as Trade;
}

export async function getTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)          // exclude soft-deleted
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch trades: ${error.message}`);
  return (data ?? []) as Trade[];
}

export async function closeTrade(
  tradeId:    string,
  status:     "CLOSED" | "STOPPED" | "TARGET_HIT",
  exitPrice:  number,
  quantity:   number,
  entryPrice: number
): Promise<void> {
  const realisedPnl = parseFloat(((exitPrice - entryPrice) * quantity).toFixed(2));
  const { error } = await supabase
    .from("trades")
    .update({ status, exit_price: exitPrice, realised_pnl: realisedPnl })
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to close trade: ${error.message}`);
}

export async function activateTrade(tradeId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .update({ status: "OPEN" })
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to activate trade: ${error.message}`);
}

export async function updateTradeStatus(
  tradeId: string,
  status:  Trade["status"]
): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .update({ status })
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to update trade: ${error.message}`);
}

/**
 * Updates allowed user-editable fields on a trade.
 * Goes through the update_own_trade RPC which enforces:
 *   - ownership check
 *   - only quantity / stop_loss / target / notes can change
 *   - each change is recorded in trade_audit_log
 */
export async function updateOwnTrade(
  tradeId:  string,
  fields: {
    quantity?:  number;
    stop_loss?: number;
    target?:    number;
    notes?:     string;
  }
): Promise<void> {
  const { data, error } = await supabase.rpc("update_own_trade", {
    p_trade_id:  tradeId,
    p_quantity:  fields.quantity  ?? null,
    p_stop_loss: fields.stop_loss ?? null,
    p_target:    fields.target    ?? null,
    p_notes:     fields.notes     ?? null,
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to update trade");
}

// deleteTrade intentionally removed.
// - Normal users: hard deletes blocked by "no_hard_delete_trades" RLS policy.
// - Org admins:   use adminSoftDeleteTrade() from lib/db/org.ts instead.