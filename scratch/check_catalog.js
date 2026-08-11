async function check() {
  const server = 'http://espartanos.live:8080';
  const user = 'JosueMejia';
  const pass = 'PPw3tAhK4P';

  const actions = ['get_live_streams', 'get_vod_streams', 'get_series'];
  for (const action of actions) {
    const url = `${server}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=${action}`;
    console.log(`Fetching action: ${action}...`);
    try {
      const start = Date.now();
      const res = await fetch(url);
      console.log(` -> Status: ${res.status}`);
      const data = await res.json();
      console.log(` -> Count: ${Array.isArray(data) ? data.length : 'Not an array'}`);
      console.log(` -> Time: ${Date.now() - start} ms`);
    } catch (e) {
      console.error(` -> Error:`, e.message);
    }
  }
}
check().catch(console.error);
