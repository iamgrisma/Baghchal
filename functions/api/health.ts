export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({ status: 'ok', version: '1.0.8', time: new Date().toISOString() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
