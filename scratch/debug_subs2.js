import { SubtitleParser } from 'matroska-subtitles';

const SERIES_ID = process.argv[2] || '504959';
const TRACK = parseInt(process.argv[3] || '4', 10);
const SERVER = 'http://espartanos.live:8080';
const USER = 'JosueMejia';
const PASS = 'PPw3tAhK4P';

async function debugSubtitleText() {
  const url = `${SERVER}/series/${USER}/${PASS}/${SERIES_ID}.mkv`;
  console.log(`Fetching stream for series ${SERIES_ID}, track ${TRACK}...`);

  const res = await fetch(url, { headers: { 'Range': 'bytes=0-8000000' } });
  if (!res.ok) {
    console.error('HTTP error', res.status);
    process.exit(1);
  }

  const parser = new SubtitleParser();
  let samples = [];

  parser.on('subtitle', (subtitle, trackNum) => {
    if (trackNum === TRACK && samples.length < 10) {
      const raw = subtitle.text;
      // Check for suspicious chars
      const hasBackslashN = /\\N/i.test(raw);
      const hasCRLF = /\r/.test(raw);
      const hasLF = /\n/.test(raw);
      if (hasBackslashN || (samples.length < 3)) {
        console.log(`--- Sample ${samples.length + 1} (track ${trackNum}) ---`);
        console.log('JSON:', JSON.stringify(raw));
        console.log('Has literal backslash-N:', hasBackslashN);
        console.log('Has CRLF:', hasCRLF, '  Has LF:', hasLF);
      }
      samples.push(raw);
    }
  });

  const reader = res.body.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    parser.write(Buffer.from(value));
    if (samples.length >= 10) break;
  }

  console.log(`\nRead ${total} bytes. Got ${samples.length} samples.`);
  process.exit(0);
}

debugSubtitleText().catch(e => {
  console.error(e.message);
  process.exit(1);
});
