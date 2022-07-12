import Express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import ytdl from 'ytdl-core';
import { exec } from 'child_process';

const app = Express();
const port = process.env.PORT || 9000;
const server = http.createServer(app);

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));

// static以下に配置したファイルは直リンクで見れるようにする
app.use(Express.static(path.resolve(__dirname, 'static')));

// tmpディレクトリを作成する
fs.mkdir(path.resolve(__dirname, './tmp/'), (err) => {
  if (err) {
    console.error(err);
  }
});

// 疎通テスト用のレスポンス
app.get('/api/health', (req, res) => {
  return res.send('I am OK!');
});

// Youtubeのダウンロード
app.get('/api/youtube/:youtubeId', (req, res) => {
  const { youtubeId } = req.params;
  if(!youtubeId.match(/^[a-z_A-Z0-9\-]{11}$/g)){
    console.error(`YouTubeID validation error : ${youtubeId}`);
    res.status(400).send('YouTubeID validation error!');
    return;
  }
  const fileType = (req.query.fileType || 'mp4') as 'mp4' | 'mp3';

  const destFilePath = path.resolve(__dirname, `./tmp/${youtubeId}`);
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

  // Get audio streams
  const audio = ytdl(url, { quality: 'highestaudio' })

  audio.on('error', (err) => {
    console.error(err);
    res.status(400).send('download error!');
    return;
  });

  audio.on('end', () => {
    console.log(`youtube file (${youtubeId}.wav) downloaded.`);
    if (fileType === 'mp4') {
      // mp4の場合はmp4をダウンロードして、wavとmp4をマージする
      videoDownload();
    }else{
      // mp3の場合はwav -> mp3変換してから返す
      console.log('transform mp4 -> mp3.');
      const mp3FilePath = path.resolve(__dirname, `./tmp/${youtubeId}.mp3`);
      exec(`ffmpeg -y -i ${destFilePath}.wav ${mp3FilePath}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          res.status(500).send('movie translation error!');
          return;
        }
        console.log(stdout);
        console.log(stderr);
        try {
          fs.unlinkSync(destFilePath + `.wav`);
        } catch (error) {
          console.log(destFilePath + `.wav` + "を削除できませんでした");
        }
        res.download(mp3FilePath);
      });
    }
  });
  
  async function videoDownload() {
    const info = await ytdl.getInfo(youtubeId);
    const video = ytdl(url, { filter: format => format.container === 'mp4', quality: 'highestvideo' })

    video.pipe(fs.createWriteStream(destFilePath + `.mp4`));
    var starttime : number;

    video.once('response', () => {
      starttime = Date.now();
    });

    video.on('progress', (chunkLength, downloaded, total) => {
      const percent = downloaded / total;
      const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
      const estimatedDownloadTime = (downloadedMinutes / percent) - downloadedMinutes;
      process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
      process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`);
      process.stdout.write(`running for: ${downloadedMinutes.toFixed(2)}minutes`);
      process.stdout.write(`, estimated time left: ${estimatedDownloadTime.toFixed(2)}minutes `);
    });

    video.on('error', (err) => {
      console.error(err);
      res.status(400).send('download error!');
    });
    
    video.on('end', () => {
      console.log(`youtube file (${youtubeId}.mp4) downloaded.`);

      // mp4とwavをマージする
      console.log('merge mp4 and wav.');
      const mergePath = destFilePath + `_merged.mp4`;

      exec(`ffmpeg -y -i ${destFilePath}.mp4 -i ${destFilePath}.wav -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 ${mergePath}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          res.status(500).send('movie translation error!');
          return;
        }
        console.log(stdout);
        console.log(stderr);
        try {
          fs.unlinkSync(destFilePath + `.wav`);
        } catch (error) {
          console.log(destFilePath + `.wav` + "を削除できませんでした");
        }
        try {
          fs.unlinkSync(destFilePath + `.mp4`);
        } catch (error) {
          console.log(destFilePath + `.mp4` + "を削除できませんでした");
        }
        res.download(mergePath);
      });
    });
  }

  audio.pipe(fs.createWriteStream(destFilePath + `.wav`));
  var starttime : number;
  audio.once('response', () => {
    starttime = Date.now();
  });
  
  audio.on('progress', (chunkLength, downloaded, total) => {
    const percent = downloaded / total;
    const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
    const estimatedDownloadTime = (downloadedMinutes / percent) - downloadedMinutes;
    process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
    process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`);
    process.stdout.write(`running for: ${downloadedMinutes.toFixed(2)}minutes`);
    process.stdout.write(`, estimated time left: ${estimatedDownloadTime.toFixed(2)}minutes `);
  });
});

async function delete_tmp(){
  setInterval(() => {
    const nowtime = new Date().getTime();
    fs.readdir(path.resolve(__dirname, './tmp/'), function(err, files){
      if (err) throw err;
      var fileList = files.filter(function(file){
        return fs.statSync(path.resolve(__dirname, './tmp/', file)).isFile() && /.*\_merged.mp4$/.test(file) && (nowtime - fs.statSync(path.resolve(__dirname, './tmp/', file)).mtime.getTime() > 300 * 1000); //絞り込み
      })
      fileList.forEach(file => {
        fs.unlinkSync(path.resolve(__dirname, './tmp/', file));
      });
    });
  }, 1000 * 60);
}


server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
delete_tmp();