export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({ status: 'ok', version: '1.1.0', time: new Date().toISOString() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
