// ============================================================
// lib/db/trades.ts
// All database operations for trades.
// ============================================================

import { supabase } from "../supabase";

export interface Trade {
  id:            string;
  user_id:       string;
  ticker:        string;
  entry_price:   number;        // user's intended entry
  entry_target:  number | null; // if set, trade is QUEUED until LTP hits this
  stop_loss:     number;
  target:        number | null;
  quantity:      number;
  risk_amount:   number | null;
  capital:       number | null;
  exit_price:    number | null;
  realised_pnl:  number | null;
  notes:         string | null;
  status:        "QUEUED" | "OPEN" | "CLOSED" | "STOPPED";
  created_at:    string;
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
  status?:       "QUEUED" | "OPEN";
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

export async function deleteTrade(tradeId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId);
  if (error) throw new Error(`Failed to delete trade: ${error.message}`);
}