addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // بررسی روش درخواست
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // تنظیمات upstream‌ها
  const upstreams = [
    'https://cloudflare-dns.com/dns-query', // اصلی
    'https://dns.google/dns-query'          // بک‌آپ
  ];

  let response = null;
  const url = new URL(request.url);

  // لوپ برای تست upstream‌ها
  for (const upstream of upstreams) {
    try {
      const newRequest = new Request(upstream, {
        method: request.method,
        headers: {
          'content-type': 'application/dns-json',
          'accept': 'application/dns-json',
          ...Object.fromEntries(request.headers)
        },
        body: request.body,
        redirect: 'follow'
      });

      response = await fetch(newRequest, { cf: { cacheEverything: true, cacheTtl: 3600 } });
      if (response.ok) break; // اگه جواب درست بود، لوپ رو بشکن
    } catch (e) {
      console.log(`Failed upstream ${upstream}: ${e.message}`);
      continue; // به upstream بعدی برو
    }
  }

  // اگه هیچ upstreamی جواب نداد
  if (!response || !response.ok) {
    return new Response('Upstream unavailable', { status: 503 });
  }

  // کش کردن پاسخ برای درخواست‌های بعدی
  response = new Response(response.body, response);
  response.headers.append('Cache-Control', 'public, max-age=3600');

  return response;
}
