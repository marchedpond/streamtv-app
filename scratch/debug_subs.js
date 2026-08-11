import { SubtitleParser } from 'matroska-subtitles';
import { createReadStream } from 'fs';

async function debugSubtitleText() {
  const url = 'http://espartanos.live:8080/series/JosueMejia/PPw3tAhK4P/504959.mkv';
  console.log('Fetching first 5MB of stream for parsing...');

  const res = await fetch(url, {
    headers: { 'Range': 'bytes=0-5000000' }
  });

  const parser = new SubtitleParser();
  let samples = [];

  parser.on('subtitle', (subtitle, trackNum) => {
    if (trackNum === 4 && samples.length < 5) {
      console.log('RAW subtitle.text repr:');
      console.log(JSON.stringify(subtitle.text));
      console.log('Chars:');
      for (let i = 0; i < Math.min(subtitle.text.length, 100); i++) {
        const c = subtitle.text[i];
        const code = c.charCodeAt(0);
        if (code < 32 || code > 126) {
          console.log(`  [${i}] 0x${code.toString(16).padStart(4, '0')} (control char)`);
        }
      }
      samples.push(subtitle.text);
    }
  });

  const reader = res.body.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    parser.write(Buffer.from(value));
    if (samples.length >= 5) break;
  }

  console.log(`\nRead ${total} bytes. Got ${samples.length} samples.`);
  process.exit(0);
}

debugSubtitleText().catch(e => {
  console.error(e.message);
  process.exit(1);
});
