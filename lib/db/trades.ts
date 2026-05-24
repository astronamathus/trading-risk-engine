// ============================================================
// lib/db/trades.ts
// All database operations for trades.
// Isolated here so components never import supabase directly.
// ============================================================

import { supabase } from "../supabase";

// TypeScript shape of a trade row from the DB
export interface Trade {
  id:           string;
  user_id:      string;
  ticker:       string;
  entry_price:  number;
  stop_loss:    number;
  target:       number | null;
  quantity:     number;
  risk_amount:  number | null;
  notes:        string | null;
  status:       "OPEN" | "CLOSED" | "STOPPED";
  created_at:   string;
}

// Shape of data needed to save a new trade
export interface NewTrade {
  user_id:      string;
  ticker:       string;
  entry_price:  number;
  stop_loss:    number;
  target?:      number;
  quantity:     number;
  risk_amount?: number;
  notes?:       string;
}

/**
 * Saves a new trade to the database.
 * Returns the saved trade row.
 */
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
 * Fetches all trades for a user, newest first.
 */
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
 * Updates a trade's status (e.g. OPEN → CLOSED or STOPPED).
 */
export async function updateTradeStatus(
  tradeId: string,
  status: Trade["status"]
): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .update({ status })
    .eq("id", tradeId);

  if (error) throw new Error(`Failed to update trade: ${error.message}`);
}

/**
 * Deletes a trade permanently.
 */
export async function deleteTrade(tradeId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId);

  if (error) throw new Error(`Failed to delete trade: ${error.message}`);
}