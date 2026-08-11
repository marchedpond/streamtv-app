async function test() {
  const url = 'http://espartanos.live:8080/live/JosueMejia/PPw3tAhK4P/840.m3u8';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Body length:', text.length);
    console.log('Body content:');
    console.log(text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
