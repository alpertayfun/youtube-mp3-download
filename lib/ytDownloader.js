'use strict';
const os = require('os');
const EventEmitter = require('events').EventEmitter;
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');
const async = require('async');
const progress = require('progress-stream');
const sanitize = require('sanitize-filename');

class YoutubeMp3Downloader extends EventEmitter {

  constructor(options) {
    super();
    this.youtubeBaseUrl = 'http://www.youtube.com/watch?v=';
    this.youtubeVideoQuality = (options && options.youtubeVideoQuality ? options.youtubeVideoQuality : 'highestaudio');
    this.youtubeAudioQuality = (options && options.youtubeAudioQuality ? options.youtubeAudioQuality : 320);
    this.outputPath = options && options.outputPath ? options.outputPath : os.homedir();
    this.queueParallelism = (options && options.queueParallelism ? options.queueParallelism : 1);
    this.progressTimeout = (options && options.progressTimeout ? options.progressTimeout : 1000);
    this.requestOptions = (options && options.requestOptions ? options.requestOptions : { maxRedirects: 5 });
    this.outputOptions = (options && options.outputOptions ? options.outputOptions : []);
    this.allowWebm = (options && options.allowWebm ? options.allowWebm : false);

    if (options && options.ffmpegPath) {
      ffmpeg.setFfmpegPath(options.ffmpegPath);
    }

    this.setupQueue();
  }

  setupQueue() {
    let self = this;
    // Async download/transcode queue
    this.downloadQueue = async.queue(function (task, callback) {
      self.emit('queueSize', self.downloadQueue.running() + self.downloadQueue.length());

      self.performDownload(task, function(err, result) {
        callback(err, result);
      });
    }, self.queueParallelism);
  }

  download (videoId, fileName) {
    let self = this;
    const task = {
      videoId: videoId,
      fileName: fileName
    };

    this.downloadQueue.push(task, function (err, data) {
      self.emit('queueSize', self.downloadQueue.running() + self.downloadQueue.length());

      if (err) {
        self.emit('error', err, data);
      } else {
        self.emit('finished', err, data);
      }
    });
  };

  async performDownload(task, callback) {
    let self = this;
    let info;
    const videoUrl = this.youtubeBaseUrl+task.videoId;
    let resultObj = {
      videoId: task.videoId
    };

    try {
      info = await ytdl.getInfo(videoUrl, { quality: this.youtubeVideoQuality })
    } catch (err){
      return callback(err);
    }

    const videoTitle = sanitize(info.videoDetails.title);
    let artist = 'Unknown';
    let title = 'Unknown';
    const thumbnail = info.videoDetails.thumbnails ?
      info.videoDetails.thumbnails[0].url
      : info.videoDetails.thumbnail || null;

    if (videoTitle.indexOf('-') > -1) {
      let temp = videoTitle.split('-');
      if (temp.length >= 2) {
        artist = temp[0].trim();
        title = temp[1].trim();
      }
    } else {
      title = videoTitle;
    }
    
    // Stream setup
    const streamOptions =  {
      quality: self.youtubeVideoQuality,
      requestOptions: self.requestOptions
    };

    if (!self.allowWebm) {
      streamOptions.filter = format => format.container === 'mp4';
    }

    const stream = ytdl.downloadFromInfo(info, streamOptions);

    stream.on('error', function(err){
      callback(err, null);
    });

    stream.on('response', function(httpResponse) {
      // Setup of progress module
      const str = progress({
        length: parseInt(httpResponse.headers['content-length']),
        time: self.progressTimeout
      });

      // Add progress event listener
      str.on('progress', function(progress) {
        if (progress.percentage === 100) {
          resultObj.stats= {
            transferredBytes: progress.transferred,
            runtime: progress.runtime,
            averageSpeed: parseFloat(progress.speed.toFixed(2))
          }
        }
        self.emit('progress', {videoId: task.videoId, progress: progress})
      });
      let outputOptions = [
        '-id3v2_version', '4',
        '-metadata', 'title=' + title,
        '-metadata', 'artist=' + artist
      ];
      if (self.outputOptions) {
        outputOptions = outputOptions.concat(self.outputOptions);
      }


      //const audioBitrate = info.formats.find(format => !!format.audioBitrate).audioBitrate
      if(self.youtubeVideoQuality=="highestaudio" || self.youtubeVideoQuality=="lowestaudio"){
        const fileName = (task.fileName ? self.outputPath + '/' + sanitize(task.fileName) : self.outputPath + '/' + (videoTitle || info.videoId) + '.mp3');
        // Start encoding
        const proc = new ffmpeg({
            source: stream.pipe(str)
        })
        .audioBitrate(self.youtubeAudioQuality)
        .withAudioCodec('libmp3lame')
        .toFormat('mp3')
        .outputOptions(...outputOptions)
        .on('error', function(err) {
            return callback(err.message, null);
        })
        .on('end', function() {
            resultObj.file =  fileName;
            resultObj.youtubeUrl = videoUrl;
            resultObj.videoTitle = videoTitle;
            resultObj.artist = artist;
            resultObj.title = title;
            resultObj.thumbnail = thumbnail;
            return callback(null, resultObj);
        })
        .saveToFile(fileName);
      }else{
        const fileName = (task.fileName ? self.outputPath + '/' + sanitize(task.fileName) : self.outputPath + '/' + (videoTitle || info.videoId) + '.mp4');
        // Start encoding
        const proc = new ffmpeg({
            source: stream.pipe(str)
        })
        .audioBitrate(self.youtubeAudioQuality)
        .withAudioCodec('libmp3lame')
        .toFormat('mp4')
        .outputOptions(...outputOptions)
        .on('error', function(err) {
            return callback(err.message, null);
        })
        .on('end', function() {
            resultObj.file =  fileName;
            resultObj.youtubeUrl = videoUrl;
            resultObj.videoTitle = videoTitle;
            resultObj.artist = artist;
            resultObj.title = title;
            resultObj.thumbnail = thumbnail;
            return callback(null, resultObj);
        })
        .saveToFile(fileName);
      }
      

    });
  };
}

module.exports = YoutubeMp3Downloader;