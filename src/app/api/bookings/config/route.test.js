// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

describe("booking config route", () => {
  beforeEach(() => { vi.resetModules(); getSupabaseAdmin.mockReset(); });
  it("returns readiness and public booking types", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: {
      system_config: { data: { master_enabled: true, native_booking_enabled: true }, error: null },
      booking_settings: { data: { enabled: true, owner_timezone: "UTC", calendar_connection_status: "connected", zoom_connection_status: "connected", minimum_notice_minutes: 60 }, error: null },
      booking_types: { data: [{ slug: "intro" }], error: null },
    } }));
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true, ownerTimezone: "UTC", bookingTypes: [{ slug: "intro" }] });
  });
  it("fails closed when configuration cannot be read", async () => {
    getSupabaseAdmin.mockImplementation(() => { throw new Error("down"); });
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ready: false, bookingTypes: [] });
  });
});
