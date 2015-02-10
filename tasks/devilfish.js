// Time: 10:41
// @author: xiaoxiong

/*jshint unused: false, eqnull: false, browser: true, nomen: true, indent: 4, maxlen: 80, strict: true, curly: true */
/*global define: true, $: true, youdao: true */
'use strict';

var fs = require('fs');
var path = require('path');
var glob = require("glob");
var _ = require("underscore");
var crypto = require("crypto");
var grunt = require("grunt");

module.exports = function (grunt) {
    grunt.registerTask("devilfish", "pack javascript file which is used CommonJS", function () {
        var options = this.options();
        pack({
            cwd: "./scripts",
            src: "pages/*.js",
            dest: "dist/scripts",
            preload: ["libs/jquery.js", "libs/underscore.js"],
            alias: {},
            paths: {
                components: './components',
                modules: './modules'
            }
        });
    });
}

function pack(config) {
    // 将基本路径调整到scripts这个文件夹
    var startDir = process.cwd();
    if (config.cwd) {
        process.chdir(config.cwd);
    }

    var files = glob.sync(config.src);
    files.forEach(function (fileItem) {
        var mergedContent = getCMDContent(fileItem);
        var distFileName = path.join("../" + config.dest, fileItem)
        grunt.file.write(distFileName, mergedContent);
    });
    process.chdir(startDir);

    function getCMDContent (startFileName) {
        var moduelList = {};
        var basePath = path.dirname();
        var alias = config.alias;

        moduelList[startFileName] = resoveRequire(startFileName, basePath);
        dealModuleId();
        return mergeFileContent();

        function resoveRequire(fileName, relativePath) {
            var rootPath = process.cwd();
            var content = getFileContent(fileName, config.data);
            var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
            var SLASH_RE = /\\\\/g;
            var temptCont = content;

            var _fileId;
            content.replace(SLASH_RE, '').replace(REQUIRE_RE, function (m, m1, m2) {
                if (m2) {
                    var _fileName, _fileAbsolutePath, _filePath;
                    if (alias.hasOwnProperty(m2)) {
                        _fileId = alias[m2];
                        _fileAbsolutePath = path.resolve(basePath, _fileId);
                    } else {
                        _fileName = path.resolve(relativePath, m2);
                        _fileId = path.relative(rootPath, _fileName).replace(/\\/g, '\/');
                    }

                    var relPath = path.resolve(_fileAbsolutePath || _fileName, '..');
                    if (!moduelList.hasOwnProperty(_fileId)) {
                        var subFileName = _fileAbsolutePath || _fileName;
                        var subFileExtName = path.extname(subFileName);
                        if (!!!subFileExtName) {
                            subFileName = subFileName + ".js";
                        }
                        var subContent = resoveRequire(subFileName, relPath);
                        moduelList[_fileId] = subContent;
                    }

                    var temptArray;
                    temptArray = temptCont.split(m2);
                    temptCont = temptArray.join(_fileId);
                }
            });
            return temptCont;
        };

        function dealModuleId() {
            var moduleItem;
            for (moduleItem in  moduelList) {
                if (moduelList.hasOwnProperty(moduleItem)) {
                    var extName = path.extname(moduleItem);
                    var escapeContent;
                    switch (extName) {
                    case '.html':
                        escapeContent = jsEscape(moduelList[moduleItem]);
                        escapeContent = "define('" + moduleItem + "', function () { return ' " +
                            escapeContent +
                        "';});\n";
                        moduelList[moduleItem] = escapeContent;
                        break;
                    case '':
                    case '.js':
                        moduelList[moduleItem] = addModuleId(moduelList[moduleItem],
                                                            moduleItem);
                        break;
                    default:
                        break;
                    }
                }
            }
        };

        function mergeFileContent() {
            var cmdContent = '';
            var preload = config.preload;

            preload.forEach(function (filename) {
                filename = alias[filename] || filename;
                cmdContent += fs.readFileSync(filename, 'utf-8');
            });

            _.templateSettings = {
                escape: /\/[\*-]<%-([\s\S]+?)%>[\*-]\//g,
                evaluate: /\/[\*-]<%([\s\S]+?)%>[\*-]\//g,
                interpolate: /\/[\*-]<%=([\s\S]+?)%>[\*-]\//g
            };

            var moduleCont = _.template(fs.readFileSync('./module.js', 'utf-8'))({
                entry_point: startFileName
            });

            cmdContent += moduleCont;

            var moduleItem;
            for (moduleItem in moduelList) {
                if (moduelList.hasOwnProperty(moduleItem)) {
                    cmdContent += moduelList[moduleItem];
                }
            }
            return cmdContent;
        };
    }


   function escapeFileContent(content) {
            return content.replace(/['\\]/g, '\\$1')
                .replace(/[\f]/g, '\\f')
                .replace(/[\b]/g, '\\b')
                .replace(/[\n]/g, '\\n')
                .replace(/[\t]/g, '\\t')
                .replace(/[\r]/g, '\\r')
                .replace(/[\u2028]/g, '\\u2028')
                .replace(/[\u2029]/g, '\\u2029');
    };

    function addModuleId(content, id) {
        var replaceStr = 'define("' + id + '", ';
        return content.replace(/define\s*\(/, replaceStr);
    };


    function getInterpolate(fileName) {
        var extName = (fileName.substr(fileName.lastIndexOf("."))).toLowerCase();

        var setting;
        switch (extName) {
            case ".html":
            case ".htm":
            case ".mustache":
                setting = {
                    escape: /<!-{1,2}<%-([\s\S]+?)%>-{1,2}>/g,
                    evaluate: /<!-{1,2}<%([\s\S]+?)%>-{1,2}>/g,
                    interpolate: /<!-{1,2}<%=([\s\S]+?)%>-{1,2}>/g
                };
                break;
            case ".js":
            case ".css":
            case ".sass":
                setting = {
                    escape: /\/[\*-]<%-([\s\S]+?)%>[\*-]\//g,
                    evaluate: /\/[\*-]<%([\s\S]+?)%>[\*-]\//g,
                    interpolate: /\/[\*-]<%=([\s\S]+?)%>[\*-]\//g
                };
                break;
            default:
                setting = {
                escape: /<%-([\s\S]+?)%>/g,
                evaluate: /<%([\s\S]+?)%>/g,
                interpolate: /<%=([\s\S]+?)%>/g
            };
        }
        return setting;
    };


    function getFileContent(fileName, data) {
        var content;
        if (!fileName) {
            return;
        }

        var content = fs.readFileSync(fileName, "utf-8");
        _.templateSettings = getInterpolate(fileName);
        var templ = _.template(content);
        return content;
    }

};
