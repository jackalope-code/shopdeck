const backendBaseUrl = process.env.SHOPDECK_BACKEND_URL;

const smokeIt = backendBaseUrl ? it : it.skip;

describe('feed endpoint smoke', () => {
  smokeIt('authenticates and returns feed payloads for representative endpoints', async () => {
    const loginRes = await fetch(`${backendBaseUrl}/api/auth/developer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(loginRes.ok).toBe(true);
    const auth = await loginRes.json();
    expect(typeof auth.token).toBe('string');

    const headers = { Authorization: `Bearer ${auth.token}` };

    const widgetRes = await fetch(`${backendBaseUrl}/api/feed-config/data/keycap-releases`, { headers });
    expect(widgetRes.status).toBe(200);
    const widgetJson = await widgetRes.json();
    expect(widgetJson).toHaveProperty('sources');
    expect(typeof widgetJson.sources).toBe('object');

    const dealsRes = await fetch(`${backendBaseUrl}/api/feed-config/data-aggregated/deals`, { headers });
    expect(dealsRes.status).toBe(200);
    const dealsJson = await dealsRes.json();
    expect(Array.isArray(dealsJson.items)).toBe(true);
    expect(Array.isArray(dealsJson.sources)).toBe(true);
  });
});
