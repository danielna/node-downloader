/**
 * node-downloader
 *
 * Download assets, scraped from a set of baseUrls, of a specific filetype.
 * A significant amount of case-specific code here. This could likely be generalized 
 * but it'd be a significantly bigger undertaking. Ain't nobody got time for that.
 * 
 * For this use case a URL either contained links to other HTML pages with links, or
 * contained links to PDFs that should be downloaded in a specific folder name.
 * Fortunately for me this was likely the simplest possible use case.
 *
 * author: Daniel Na
 **/

var fs          = require('fs'),
    _           = require('underscore'),
    cpExec      = require('child_process').exec,
    path        = require('path'),
    url         = require('url'),
    spawn       = require('child_process').spawn;

var rawHtml = '',
    fileManifest = {},
    titleRegex = /title>(.*)<\/title/,
    linkRegex = /href="(.*.(pdf|html))"/g,
    urlBaseRegex = /(^.*\/)\w+.(html|pdf)/,
    downloadsDir = path.join(__dirname, '/downloads-' + new Date().getTime()),
    downloadQueue = [];

// An array representing each "starting" URL.
// Contents of which are recursively parsed for pdf files, which are then downloaded to a folder locally in a folder
// that matches the <title> tag of the page it's included on.
var baseUrls = [
        // URLs go here
    ];

// Parse html for the page title
function parseTitle(raw) {
    return titleRegex.exec(raw)[1];
}

// Parse html for pdf or html href values, and return them as an array
function parseLinks(raw) {
    var matches = [], match;
    while ( ( match = linkRegex.exec(raw) ) !== null ) {
        matches.push(match[1]);
    }
    return matches;
}

// Grab the HTML for the provided url, parse it for links to .html/.pdf endpoints,
// and create the fileManifest with the resulting data.
// Note to self: exec() is not synchronous!
function processUrl(url, baseUrl, parentObj) {
    if (url.indexOf('pdf') !== -1) {
        return baseUrl + url;
    }
    if (url.indexOf('://') == -1) {
        url = baseUrl + url;
    }
    console.log('Processing URL: ' + url + '...');
    cpExec('curl ' + url, function(err, stdout, stderr) {
        if (err) throw err;
        console.log("HTML successfully grabbed for " + url + ", parsing links...");
        var links = parseLinks(stdout);    
        var title = parseTitle(stdout);

        parentObj[title] = {};

        links.forEach(function(link, index, array) {
            parentObj[title][link] = processUrl(link, baseUrl, parentObj[title]);
        });
       
        // Debounced, so it only writes the manifest when it's fully parsed
        writeManifest();
    });
}

// Debounce saving the manifest to a file
// Mostly as a sniff test during dev, but also to potentially save some time if this 
// process craps out somewhere.
var writeManifest = _.debounce(function() {
    console.log('\n');
    console.log("Writing manifest to file...");
    fs.writeFileSync('fileManifest.txt', JSON.stringify(fileManifest), 'utf8');
    console.log("   fileManifest.txt written successfully!");
    console.log('\n');
    console.log('Queueing downloads...'); 
    downloadFiles(fileManifest, downloadsDir);
}, 200);

// Debounce triggering the next file download
// Only start the process once the entire downloadQueue is created.
var beginDownloads = _.debounce(function() {
    console.log('***** Beginning downloads (' + downloadQueue.length + ') *****');
    triggerNextDownload();
}, 200);

// Download files, one downloadQueue item at a time.
// Otherwise node errors out due to too many curl processes.
// Could parallelize this, or delegate it to workers if speed is important.
function triggerNextDownload() {
    var downloadItem = downloadQueue.shift();
    if (!downloadItem) {
        console.log('\n');
        console.log('***** Downloads Complete! *****');
        console.log('\n');
        process.exit(1);
    }
    var fileUrl = downloadItem[0];
    var path = downloadItem[1];
    console.log('\n');
    console.log('Triggering download:');
    console.log('   fileUrl: ' + fileUrl);
    console.log('   path: ' + path);
    download_file_curl(fileUrl, path);
}

// Recursively set up files for download
function downloadFiles(currentTree, currentPath) {
    for (var key in currentTree) {
        if (key.indexOf('pdf') === -1 && key.indexOf('html') === -1) {
           var folderPath = path.join(currentPath, '/' + key);
           fs.mkdirSync(folderPath);
           downloadFiles(currentTree[key], folderPath);
        } else if (key.indexOf('html') > -1) {
            // do nothing
        } else {
            var fileUrl = currentTree[key];
            downloadQueue.push([fileUrl, currentPath]);
            beginDownloads();
       }
    }
}

// Function to download file using curl
// Function taken from here: http://www.hacksparrow.com/using-node-js-to-download-files.html
var download_file_curl = function(fileUrl, downloadDir) {
    // extract the file name
    var fileName = url.parse(fileUrl).pathname.split('/').pop();
    // create an instance of writable stream
    var file = fs.createWriteStream(path.join(downloadDir,fileName));
    // execute curl using child_process' spawn function
    var curl = spawn('curl', [fileUrl]);
    // add a 'data' event listener for the spawn instance
    curl.stdout.on('data', function(data) { file.write(data); });
    // add an 'end' event listener to close the writeable stream
    curl.stdout.on('end', function(data) {
        file.end();
        console.log('   ' + fileName + ' downloaded to ' + downloadDir);
    });
    // when the spawn child process exits, check if there were any errors and close the writeable stream
    curl.on('exit', function(code) {
        if (code !== 0) {
            console.log('Failed: ' + code);
        }
        console.log('   Download completed!');
        triggerNextDownload();
    });
};

// Start the show
console.log('Making downloads directory...');
fs.mkdirSync(downloadsDir);
console.log('   ./downloads/ created.');

for (var i in baseUrls) {
    processUrl(baseUrls[i], urlBaseRegex.exec(baseUrls[i])[1], fileManifest);
}

