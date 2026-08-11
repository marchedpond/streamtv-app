async function findSeries() {
  const server = 'http://espartanos.live:8080';
  const user = 'JosueMejia';
  const pass = 'PPw3tAhK4P';
  const query = process.argv[2] || 'metal knight';

  const res = await fetch(`${server}/player_api.php?username=${user}&password=${pass}&action=get_series`);
  const data = await res.json();
  const found = data.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  console.log('Found series matching:', query);
  found.slice(0, 10).forEach(s => console.log(` - ID: ${s.series_id} | Name: ${s.name}`));
}
findSeries().catch(console.error);
