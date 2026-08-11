async function run() {
  const url = 'http://localhost:3000/api_subtitles?id=504959&type=series&action=vtt&track=4&ext=mkv';
  console.log('Fetching VTT and checking for \\N...');
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Includes \\N:', text.includes('\\N'));
    console.log('Includes \\n:', text.includes('\\n'));
    console.log('Sample content containing newlines:');
    const lines = text.split('\n').filter(line => line.includes('Fang') || line.includes('rehén') || line.includes('\\N') || line.includes('\\n'));
    console.log(lines.slice(0, 10));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
