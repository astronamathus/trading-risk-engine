// ============================================================
// lib/db/trades.ts
// All database operations for trades.
// ============================================================

import { supabase } from "../supabase";

export interface Trade {
  id:           string;
  user_id:      string;
  ticker:       string;
  entry_price:  number;
  stop_loss:    number;
  target:       number | null;
  quantity:     number;
  risk_amount:  number | null;
  capital:      number | null;
  exit_price:   number | null;  // live price fetched at close
  realised_pnl: number | null;  // (exit - entry) × qty
  notes:        string | null;
  status:       "OPEN" | "CLOSED" | "STOPPED";
  created_at:   string;
}

export interface NewTrade {
  user_id:      string;
  ticker:       string;
  entry_price:  number;
  stop_loss:    number;
  target?:      number;
  quantity:     number;
  risk_amount?: number;
  capital?:     number;
  notes?:       string;
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
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch trades: ${error.message}`);
  return (data ?? []) as Trade[];
}

/**
 * Closes a trade with exit price + realised PnL stored.
 * Called when user confirms Close or SL Hit — we fetch live
 * price at that moment and write it alongside the status.
 */
export async function closeTrade(
  tradeId:    string,
  status:     "CLOSED" | "STOPPED",
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

/**
 * Fallback status-only update — used if price fetch fails during close.
 */
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

export async function deleteTrade(tradeId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to delete trade: ${error.message}`);
}