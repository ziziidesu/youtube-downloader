"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ytdl_core_1 = __importDefault(require("ytdl-core"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var child_process_1 = require("child_process");
var BASE_URL = 'https://www.youtube.com/watch?v=';
var YOUTUBE_ID = 'bnc1NjaFDXA';
var url = "" + BASE_URL + YOUTUBE_ID;
var video = ytdl_core_1.default(url, { quality: '18' });
video.pipe(fs_1.default.createWriteStream(path_1.default.resolve(__dirname, "./tmp/" + YOUTUBE_ID + ".mp4")));
video.on('end', function () {
    console.log('end');
    var inputFilePath = path_1.default.resolve(__dirname, "./tmp/" + YOUTUBE_ID + ".mp4");
    var outputFilePath = path_1.default.resolve(__dirname, "./tmp/" + YOUTUBE_ID + ".mp3");
    child_process_1.exec("ffmpeg -y -i " + inputFilePath + " " + outputFilePath, function (error, stdout, stderr) {
        if (error) {
            console.error(error);
            return;
        }
        console.log(stdout);
        console.log(stderr);
    });
});
