// ============================================================
// lib/db/trades.ts
//
// Changes vs original:
//   - deleteTrade removed (hard deletes blocked by RLS)
//   - updateOwnTrade added (calls update_own_trade RPC —
//     enforces allowed fields: quantity, stop_loss, target, notes)
//   - Trade interface updated with soft-delete fields
//   - OPTIMISED: getTrades now paginated (page/pageSize params)
//   - OPTIMISED: getTrades selects only columns rendered in the
//     collapsed row; expanded detail still has all fields it needs
//     because they are included in the column list below
//   - OPTIMISED: getActiveTrades fetches only OPEN/QUEUED rows
//     for the polling monitor — no pagination needed here
// ============================================================

import { supabase } from "../supabase";

export interface Trade {
  id:            string;
  user_id:       string;
  ticker:        string;
  currency:      "INR" | "USD";
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
  currency?:     "INR" | "USD";
  entry_price:   number;
  entry_target?: number;
  stop_loss:     number;
  target?:       number;
  quantity:      number;
  risk_amount?:  number;
  capital?:      number;
  notes?:        string;
}

// Columns needed for the collapsed ledger row + detail panel.
// Heavy fields not rendered anywhere (notes, delete_reason, deleted_by)
// are excluded to keep payloads small.
const TRADE_COLUMNS = [
  "id",
  "user_id",
  "ticker",
  "currency",
  "entry_price",
  "entry_target",
  "stop_loss",
  "target",
  "quantity",
  "risk_amount",
  "capital",
  "exit_price",
  "realised_pnl",
  "status",
  "created_at",
  "deleted_at",
].join(",");

// Columns needed only for the active-trades poll (price monitoring).
const ACTIVE_TRADE_COLUMNS = [
  "id",
  "ticker",
  "currency",
  "entry_price",
  "entry_target",
  "stop_loss",
  "target",
  "quantity",
  "status",
].join(",");

export async function saveTrade(trade: NewTrade): Promise<Trade> {
  const { data, error } = await supabase
    .from("trades")
    .insert(trade)
    .select()
    .single();
  if (error) throw new Error(`Failed to save trade: ${error.message}`);
  return data as Trade;
}

/**
 * Paginated trade fetch — only loads `pageSize` rows at a time.
 *
 * SQL indexes required in Supabase (run once):
 *
 *   CREATE INDEX idx_trades_user_id ON trades(user_id);
 *
 *   CREATE INDEX idx_trades_user_active ON trades(user_id, deleted_at)
 *     WHERE deleted_at IS NULL;
 *
 *   CREATE INDEX idx_trades_user_status ON trades(user_id, status);
 */
export async function getTrades(
  userId:   string,
  page      = 0,
  pageSize  = 50
): Promise<Trade[]> {
  const from = page * pageSize;
  const { data, error } = await supabase
    .from("trades")
    .select(TRADE_COLUMNS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(`Failed to fetch trades: ${error.message}`);
  return (data ?? []) as unknown as Trade[];
}

/**
 * Fetches only OPEN/QUEUED trades for the 15-min price monitor.
 * Much cheaper than re-fetching the full paginated history on every poll.
 */
export async function getActiveTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(ACTIVE_TRADE_COLUMNS)
    .eq("user_id", userId)
    .in("status", ["OPEN", "QUEUED"])
    .is("deleted_at", null);
  if (error) throw new Error(`Failed to fetch active trades: ${error.message}`);
  return (data ?? []) as unknown as Trade[];
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
