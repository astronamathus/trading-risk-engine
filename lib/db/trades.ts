// ============================================================
// lib/db/trades.ts
// All database operations for trades.
// Isolated here so components never import supabase directly.
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
  capital:      number | null;   // ← new: total capital at time of trade
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
  capital?:     number;          // ← new
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

export async function deleteTrade(tradeId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to delete trade: ${error.message}`);
}