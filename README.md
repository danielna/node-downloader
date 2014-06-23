node-downloader
-----

Download assets, scraped from a set of URLs, of a specific file type (in this case, .pdf).

Background
-----

A few nights ago I was watching my fiancee working on her computer and I asked her what she was doing.
She told me that she was downloading files from a teaching resource site that she needed for work, but
it was taking forever.  There were a ton of files and it was a lot of clicking into nested HTML pages
and "Save link as..."

Looking at the site myself I noticed that all the pages were static and formatted in a specific way.
For example:

    {
        chapterIndex.html: {
            chapterSubpage.html: {  // n-number of subpages
                downloadableAsset1.pdf,
                downloadableAsset2.pdf,
                downloadableAsset3.pdf
                    ...
            },
            ...
    }

In other words, there'd be a single static page with a list of links.  Those links went to static pages that
either contained another list of links (with no determinate level of nesting) or links to relevant .pdf files.
Manually iterating these pages to get to the .pdf files within was annoying and teaching is time-consuming
enough as it is.  I figured this was a problem that could be solved by programming.

This script works because the pages were simple to parse and uniform in structure.  The baseUrls array is a
list of the starting points for each chapter, which the script iterates, following links to nested pages
until it finds links to .pdf files.  It then saves those links in a fileManifest, processes the manifest,
queues each file for download and downloads each file to disk one-by-one.

Anyway, this was quick and dirty.  And it downloaded 852 pdf files successfully.

Future enhancements (that won't happen)
-----

- Make this a command-line tool: baseUrl links, fileTypes to look for.
- Delegate downloads to sub processes to parallelize file downloads.
- Significant code clean up.

