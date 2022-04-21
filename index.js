#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();
var options = {escape:true,prettyPrint:true,xmlHeader:{standalone:true}};
var YoutubeMp3Downloader = require('./lib/ytDownloader');

program.version('0.0.1');

program
  .option('-i, --id <id>', 'id')
  .option('-quality, --quality <quality>', 'video/audio quality : highestaudio / lowestaudio / highestvideo / lowestvideo ')

program.parse(process.argv);



if(program._optionValues.hasOwnProperty("id")){
    if(program._optionValues.id == "" || program._optionValues.id == null ){
        process.exit(1);
    }else{
        if(program._optionValues.quality == "" || program._optionValues.quality == null ){
            var YD = new YoutubeMp3Downloader({
                "ffmpegPath": "./ffmpeg/bin/ffmpeg.exe",        // FFmpeg binary location
                "outputPath": "./",    // Output file location (default: the home directory)
                "youtubeVideoQuality": "highestaudio",  // Desired video quality (default: highestaudio)
                "queueParallelism": 2,                  // Download parallelism (default: 1)
                "progressTimeout": 2000,                // Interval in ms for the progress reports (default: 1000)
                "allowWebm": false                      // Enable download from WebM sources (default: false)
            });
        }else{
            var YD = new YoutubeMp3Downloader({
                "ffmpegPath": "./ffmpeg/bin/ffmpeg.exe",        // FFmpeg binary location
                "outputPath": "./",    // Output file location (default: the home directory)
                "youtubeVideoQuality": program._optionValues.quality,  // Desired video quality (default: highestaudio)
                "queueParallelism": 2,                  // Download parallelism (default: 1)
                "progressTimeout": 2000,                // Interval in ms for the progress reports (default: 1000)
                "allowWebm": false                      // Enable download from WebM sources (default: false)
            });
        }
        

        if(program._optionValues.id.indexOf("www.youtube.com") !=-1){
            YD.download(getIdFromUrl(program._optionValues.id));
        }else{
            YD.download(program._optionValues.id);
        }

        YD.on("finished", function(err, data) {
            console.log(JSON.stringify(data));
        });

        YD.on("error", function(error) {
            console.log(error);
        });

        YD.on("progress", function(progress) {
            console.log(JSON.stringify(progress));
        });
    }
}else{
    process.exit(1);
}


function getIdFromUrl(link) {
    var query = link.replace("https://www.youtube.com/watch?","");
    var vars = query.split('&');
    return vars[0].replace("v=","").trim();
}
