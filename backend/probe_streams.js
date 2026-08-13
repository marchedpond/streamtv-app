import { exec } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ffmpegPath = ffmpegInstaller.path;
const url = 'http://espartanos.live:8080/series/JosueMejia/PPw3tAhK4P/271464.mkv';

console.log('Probing streams in 271464.mkv...');
const cmd = `"${ffmpegPath}" -hide_banner -i "${url}"`;

exec(cmd, (err, stdout, stderr) => {
  console.log('FFmpeg probe stderr:\n', stderr);
});
