import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleNurtureRequest } from "./handler.ts";

Deno.serve((request) => handleNurtureRequest(request));
