// Retired 2026-11-15: replaced by the `assistant` function. Kept as a stub so old links get a clear answer
// and no AI key can be reached through it. Safe to delete in Supabase > Edge Functions.
Deno.serve(() => new Response(JSON.stringify({ error: "This feature moved. Please refresh the app." }), {
  status: 410,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
}));
