// Coverage for the read-only marketing platform sync
// (_shared/marketing-performance.ts), extracted from
// sync-marketing-performance so each platform's sync path -- including
// missing-credentials and provider-error failure modes -- can be exercised
// here with a stubbed fetch, no network access, and no real platform
// credentials. Mirrors the fetch-stubbing style already established in
// gmail-classification-llm-failure-modes-test.ts.
//
// The requirement under test (see docs/technical/architecture/14-Lifecycle-
// Emails-and-Deliverability.md's sync-marketing-performance section): a
// platform with no credentials configured must be silently skipped (return
// null, not throw), and a platform whose API call fails must throw with a
// message identifying which platform/status failed, never return fabricated
// data. Every request made by these functions must be read-only (GET or a
// query/search/report-style POST), never a create/update/delete call.

import {
  GOOGLE_ADS_API_VERSION,
  getGoogleMarketingAccessToken,
  syncGoogleAds,
  syncGoogleAnalytics,
  syncMetaAds,
  syncSearchConsole,
} from "../functions/_shared/marketing-performance.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const GOOGLE_ENV_KEYS = [
  "GOOGLE_MARKETING_CLIENT_ID",
  "GOOGLE_MARKETING_CLIENT_SECRET",
  "GOOGLE_MARKETING_REFRESH_TOKEN",
  "GOOGLE_ANALYTICS_PROPERTY_ID",
  "GOOGLE_SEARCH_CONSOLE_SITE_URL",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
  "META_AD_ACCOUNT_ID",
  "META_MARKETING_ACCESS_TOKEN",
];

async function withEnv(vars: Record<string, string>, run: () => Promise<void>) {
  const originals = new Map(GOOGLE_ENV_KEYS.map((key) => [key, Deno.env.get(key)]));
  for (const key of GOOGLE_ENV_KEYS) Deno.env.delete(key);
  for (const [key, value] of Object.entries(vars)) Deno.env.set(key, value);
  try {
    await run();
  } finally {
    for (const key of GOOGLE_ENV_KEYS) {
      const original = originals.get(key);
      if (original === undefined) Deno.env.delete(key);
      else Deno.env.set(key, original);
    }
  }
}

function withStubbedFetch(stub: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const GOOGLE_CREDS = {
  GOOGLE_MARKETING_CLIENT_ID: "client-id",
  GOOGLE_MARKETING_CLIENT_SECRET: "client-secret",
  GOOGLE_MARKETING_REFRESH_TOKEN: "refresh-token",
};

function tokenThenApi(apiResponse: () => Response | Promise<Response>): typeof fetch {
  let call = 0;
  return (input: RequestInfo | URL) => {
    call += 1;
    if (call === 1) {
      assert(String(input).includes("oauth2.googleapis.com/token"), "first call must be the token exchange");
      return Promise.resolve(new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }));
    }
    return Promise.resolve(apiResponse());
  };
}

// -- Google Analytics --------------------------------------------------

Deno.test("syncGoogleAnalytics returns null (not connected) when GOOGLE_ANALYTICS_PROPERTY_ID is unset", async () => {
  await withEnv({ ...GOOGLE_CREDS }, async () => {
    const result = await syncGoogleAnalytics();
    assert(result === null, "must return null, not throw, when this platform simply isn't connected");
  });
});

Deno.test("syncGoogleAnalytics returns shaped channel metrics on a well-formed response", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_ANALYTICS_PROPERTY_ID: "properties/123" }, async () => {
    await withStubbedFetch(
      tokenThenApi(() =>
        new Response(JSON.stringify({
          rows: [{ dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "42" }, { value: "3" }, { value: "40" }] }],
        }), { status: 200 })
      ),
      async () => {
        const result = await syncGoogleAnalytics();
        assert(result !== null, "expected metrics, got null");
        const channels = result!.channels as { channel: string; sessions: number; conversions: number; total_users: number }[];
        assert(channels[0].channel === "Organic Search", `unexpected channel: ${JSON.stringify(channels[0])}`);
        assert(channels[0].sessions === 42, `unexpected sessions: ${channels[0].sessions}`);
      },
    );
  });
});

Deno.test("syncGoogleAnalytics throws (never returns fabricated data) on a non-2xx report response", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_ANALYTICS_PROPERTY_ID: "properties/123" }, async () => {
    await withStubbedFetch(
      tokenThenApi(() => new Response("quota exceeded", { status: 429 })),
      async () => {
        let threw = false;
        try {
          await syncGoogleAnalytics();
        } catch (error) {
          threw = true;
          assert(String((error as Error).message).startsWith("ga4_report_429"), `unexpected message: ${(error as Error).message}`);
        }
        assert(threw, "must throw on a provider error, never fabricate data");
      },
    );
  });
});

// -- Search Console -----------------------------------------------------

Deno.test("syncSearchConsole returns null when GOOGLE_SEARCH_CONSOLE_SITE_URL is unset", async () => {
  await withEnv({ ...GOOGLE_CREDS }, async () => {
    const result = await syncSearchConsole();
    assert(result === null, "must return null when this platform isn't connected");
  });
});

Deno.test("syncSearchConsole returns shaped query metrics on a well-formed response", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_SEARCH_CONSOLE_SITE_URL: "https://www.teamtastic.events/" }, async () => {
    await withStubbedFetch(
      tokenThenApi(() =>
        new Response(JSON.stringify({
          rows: [{ keys: ["team building games"], clicks: 10, impressions: 200, ctr: 0.05, position: 4.2 }],
        }), { status: 200 })
      ),
      async () => {
        const result = await syncSearchConsole();
        assert(result !== null, "expected metrics, got null");
        const queries = result!.top_queries as { query: string; clicks: number }[];
        assert(queries[0].query === "team building games", `unexpected query row: ${JSON.stringify(queries[0])}`);
      },
    );
  });
});

Deno.test("syncSearchConsole throws on a non-2xx query response", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_SEARCH_CONSOLE_SITE_URL: "https://www.teamtastic.events/" }, async () => {
    await withStubbedFetch(
      tokenThenApi(() => new Response("forbidden", { status: 403 })),
      async () => {
        let threw = false;
        try {
          await syncSearchConsole();
        } catch (error) {
          threw = true;
          assert(String((error as Error).message).startsWith("search_console_query_403"), `unexpected message: ${(error as Error).message}`);
        }
        assert(threw, "must throw on a provider error");
      },
    );
  });
});

// -- Google Ads -----------------------------------------------------------

Deno.test("syncGoogleAds returns null when customer id or developer token is unset", async () => {
  await withEnv({ ...GOOGLE_CREDS }, async () => {
    const result = await syncGoogleAds();
    assert(result === null, "must return null when Google Ads isn't connected");
  });
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_ADS_CUSTOMER_ID: "1234567890" }, async () => {
    const result = await syncGoogleAds();
    assert(result === null, "must still return null with only the customer id set and no developer token");
  });
});

Deno.test("syncGoogleAds sends the developer token and current API version, returns shaped campaign metrics", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_ADS_CUSTOMER_ID: "1234567890", GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token" }, async () => {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;
    await withStubbedFetch(
      (() => {
        let call = 0;
        return (input: RequestInfo | URL, init?: RequestInit) => {
          call += 1;
          if (call === 1) return Promise.resolve(new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }));
          capturedUrl = String(input);
          capturedHeaders = init?.headers;
          return Promise.resolve(new Response(JSON.stringify({
            results: [{ campaign: { name: "Holiday Push" }, metrics: { costMicros: "5000000", clicks: "12", conversions: 2, impressions: "300" } }],
          }), { status: 200 }));
        };
      })(),
      async () => {
        const result = await syncGoogleAds();
        assert(result !== null, "expected metrics, got null");
        assert(capturedUrl.includes(`/${GOOGLE_ADS_API_VERSION}/`), `expected the pinned API version in the URL, got ${capturedUrl}`);
        assert((capturedHeaders as Record<string, string>)["developer-token"] === "dev-token", "must send the developer token header");
        assert(!("login-customer-id" in (capturedHeaders as Record<string, string>)), "must not send login-customer-id when GOOGLE_ADS_LOGIN_CUSTOMER_ID is unset");
        const campaigns = result!.campaigns as { campaign: string; cost_usd: number }[];
        assert(campaigns[0].campaign === "Holiday Push", `unexpected campaign: ${JSON.stringify(campaigns[0])}`);
        assert(campaigns[0].cost_usd === 5, `expected micros converted to dollars (5), got ${campaigns[0].cost_usd}`);
      },
    );
  });
});

Deno.test("syncGoogleAds sends login-customer-id only when configured for an MCC-managed account", async () => {
  await withEnv({
    ...GOOGLE_CREDS,
    GOOGLE_ADS_CUSTOMER_ID: "1234567890",
    GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9999999999",
  }, async () => {
    let capturedHeaders: HeadersInit | undefined;
    await withStubbedFetch(
      (() => {
        let call = 0;
        return (_input: RequestInfo | URL, init?: RequestInit) => {
          call += 1;
          if (call === 1) return Promise.resolve(new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }));
          capturedHeaders = init?.headers;
          return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
        };
      })(),
      async () => {
        await syncGoogleAds();
        assert((capturedHeaders as Record<string, string>)["login-customer-id"] === "9999999999", "must send login-customer-id when configured");
      },
    );
  });
});

Deno.test("syncGoogleAds throws on a non-2xx search response", async () => {
  await withEnv({ ...GOOGLE_CREDS, GOOGLE_ADS_CUSTOMER_ID: "1234567890", GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token" }, async () => {
    await withStubbedFetch(
      tokenThenApi(() => new Response("invalid query", { status: 400 })),
      async () => {
        let threw = false;
        try {
          await syncGoogleAds();
        } catch (error) {
          threw = true;
          assert(String((error as Error).message).startsWith("google_ads_search_400"), `unexpected message: ${(error as Error).message}`);
        }
        assert(threw, "must throw on a provider error");
      },
    );
  });
});

// -- Meta Ads ---------------------------------------------------------------

Deno.test("syncMetaAds returns null when ad account id or access token is unset", async () => {
  await withEnv({}, async () => {
    const result = await syncMetaAds();
    assert(result === null, "must return null when Meta Ads isn't connected");
  });
});

Deno.test("syncMetaAds returns shaped campaign metrics on a well-formed response, using a plain GET (read-only)", async () => {
  await withEnv({ META_AD_ACCOUNT_ID: "111222333", META_MARKETING_ACCESS_TOKEN: "meta-token" }, async () => {
    let capturedMethod = "";
    await withStubbedFetch(
      (_input, init) => {
        capturedMethod = init?.method || "GET";
        return Promise.resolve(new Response(JSON.stringify({
          data: [{ campaign_name: "Fall Family Reunion", spend: "25.50", clicks: "8", impressions: "150", actions: [{ action_type: "lead", value: "3" }] }],
        }), { status: 200 }));
      },
      async () => {
        const result = await syncMetaAds();
        assert(result !== null, "expected metrics, got null");
        assert(capturedMethod === "GET", `expected a read-only GET request, got ${capturedMethod}`);
        const campaigns = result!.campaigns as { campaign: string; spend_usd: number; results: number }[];
        assert(campaigns[0].campaign === "Fall Family Reunion", `unexpected campaign: ${JSON.stringify(campaigns[0])}`);
        assert(campaigns[0].results === 3, `expected actions summed to 3, got ${campaigns[0].results}`);
      },
    );
  });
});

Deno.test("syncMetaAds throws on a non-2xx insights response", async () => {
  await withEnv({ META_AD_ACCOUNT_ID: "111222333", META_MARKETING_ACCESS_TOKEN: "meta-token" }, async () => {
    await withStubbedFetch(
      () => Promise.resolve(new Response("invalid token", { status: 401 })),
      async () => {
        let threw = false;
        try {
          await syncMetaAds();
        } catch (error) {
          threw = true;
          assert(String((error as Error).message).startsWith("meta_insights_401"), `unexpected message: ${(error as Error).message}`);
        }
        assert(threw, "must throw on a provider error");
      },
    );
  });
});

// -- Shared Google token exchange -------------------------------------------

Deno.test("getGoogleMarketingAccessToken throws when credentials are not fully configured", async () => {
  await withEnv({ GOOGLE_MARKETING_CLIENT_ID: "client-id" }, async () => {
    let threw = false;
    try {
      await getGoogleMarketingAccessToken();
    } catch (error) {
      threw = true;
      assert(String((error as Error).message) === "google_marketing_credentials_missing", `unexpected message: ${(error as Error).message}`);
    }
    assert(threw, "must throw when client secret / refresh token are missing, not silently proceed");
  });
});

Deno.test("getGoogleMarketingAccessToken throws on a failed token exchange", async () => {
  await withEnv({ ...GOOGLE_CREDS }, async () => {
    await withStubbedFetch(
      () => Promise.resolve(new Response("invalid_grant", { status: 400 })),
      async () => {
        let threw = false;
        try {
          await getGoogleMarketingAccessToken();
        } catch (error) {
          threw = true;
          assert(String((error as Error).message).startsWith("google_marketing_token_400"), `unexpected message: ${(error as Error).message}`);
        }
        assert(threw, "must throw when the refresh token exchange fails");
      },
    );
  });
});
