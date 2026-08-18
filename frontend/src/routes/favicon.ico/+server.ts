export const GET = () =>
  new Response(null, {
    status: 308,
    headers: {
      location: '/favicon.svg',
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
