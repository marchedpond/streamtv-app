import ffmpeg from 'fluent-ffmpeg';

const url = 'http://espartanos.live:8080/movie/JosueMejia/PPw3tAhK4P/310344.mkv'; // or mp4

console.log('Testing FFmpeg transcoding on:', url);

const command = ffmpeg(url)
  .inputOptions([
    '-headers', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)\r\n'
  ])
  .videoCodec('copy')
  .audioCodec('aac')
  .audioChannels(2)
  .format('mp4')
  .outputOptions([
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-bsf:v', 'h264_mp4toannexb'
  ])
  .on('start', (cmd) => console.log('FFmpeg command:', cmd))
  .on('error', (err, stdout, stderr) => {
    console.error('FFmpeg Error:', err.message);
    console.error('FFmpeg Stderr:', stderr);
  })
  .on('end', () => console.log('FFmpeg finished successfully'));

// Pipe to null or process.stdout for 5 seconds then kill
setTimeout(() => {
  console.log('Test completed 5s check');
  process.exit(0);
}, 5000);
