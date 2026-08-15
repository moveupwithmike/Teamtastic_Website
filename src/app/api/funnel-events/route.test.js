// @vitest-environment node
import { beforeEach,describe,expect,it,vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
const getSupabaseAdmin=vi.fn();
vi.mock("@/lib/server/supabase-admin",()=>({ getSupabaseAdmin:()=>getSupabaseAdmin() }));
const valid={ event:"landing_page_viewed",sessionId:"11111111-1111-4111-8111-111111111111",landingPage:"/virtual-holiday-party",properties:{ source:"holiday",email:"must-not-store@example.com" } };
async function post(body){ const { POST }=await import("./route.js"); return POST(new Request("https://teamtastic.events/api/funnel-events",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":"203.0.113.21"},body:JSON.stringify(body)})); }
describe("first-party funnel events",()=>{ beforeEach(()=>{vi.resetModules();getSupabaseAdmin.mockReset();});
  it("accepts allowlisted anonymous events and strips unknown properties",async()=>{const db=createSupabaseAdminMock({tables:{funnel_events:()=>({data:null,error:null})}});getSupabaseAdmin.mockReturnValue(db);const response=await post(valid);expect(response.status).toBe(202);const builder=db.from.mock.results[0].value;expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({event_name:"landing_page_viewed",properties:{source:"holiday"}}));});
  it("rejects unknown events",async()=>{expect((await post({...valid,event:"typed_every_key"})).status).toBe(400);});
  it("rejects invalid session identifiers",async()=>{expect((await post({...valid,sessionId:"visitor@example.com"})).status).toBe(400);});
});
