async function check() {
  // Try fetching a VTT from the local server and search for \N patterns
  const id = '504959';
  const url = `http://localhost:3000/api_subtitles?id=${id}&type=series&action=vtt&track=4&ext=mkv`;
  console.log('Fetching VTT from:', url);
  const res = await fetch(url);
  const text = await res.text();
  
  const lines = text.split('\n');
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('\\N') || line.includes('\\n') || line.includes('\r')) {
      console.log(`Line ${i}: ${JSON.stringify(line)}`);
      found++;
      if (found > 10) break;
    }
  }
  if (found === 0) {
    console.log('No literal \\N or \\n found. First 30 subtitle lines:');
    // Print first 30 lines that have content (not timestamps or blank)
    let shown = 0;
    for (const line of lines) {
      if (line.trim() && !line.includes('-->') && line !== 'WEBVTT' && !/^\d+$/.test(line.trim())) {
        console.log(JSON.stringify(line));
        shown++;
        if (shown >= 20) break;
      }
    }
  }
  console.log('Total lines:', lines.length);
}
check().catch(console.error);
