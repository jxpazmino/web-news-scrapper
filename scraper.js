var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var Firebase = require('firebase');
// var path = require('path');
var app = express();
var port = 8080;
var maxEntriesPerSite = 5;
var FIREBASE_URL = 'https://scrap-dev-news.firebaseio.com/';
var ref = new Firebase(FIREBASE_URL);

var sites = {
    svpino: {
        url: 'https://www.shiftedup.com/',
        tag: 'svpi'
    },
    rmurphey: {
        url: 'http://rmurphey.com/',
        rss: 'http://rmurphey.com/feed.xml',
        tag: 'rmur'
    },
    madhatted: {
        url: 'http://madhatted.com/',
        tag: 'madh'
    },
    alistapart: {
        url: 'http://alistapart.com/articles/',
        rss: 'http://alistapart.com/main/feed',
        tag: 'alis'
    },
    sixrevisions: {
        url: 'http://sixrevisions.com/',
        tag: 'sixr'
    }
};

/*one feed*/
// var saveEntries = function (obj, site) {
//     ref.child(
//         "feed/"
//         + obj.date.replace(/\//g,"-")
//         + "@"
//         + site
//         + "&"
//         + obj.title.slice(-4).replace(/\s/g, "-")
//         + obj.title.length
//         )
//         .update(obj);
// };

/*split per site*/
var saveEntries = function (obj, site) {
    ref.child(
        site
        + "/articles/"
        + obj.date.replace(/\//g,"-")
        + "&"
        + obj.title.slice(-4).replace(/\s/g, "-")
        + obj.title.length
        )
        .update(obj);
};

var dateToMillis = function (date) {
    var d = new Date(date);
    return d.getTime();
}

var fetchPageData = {

    svpino: function (error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var articlesNode = $('article');

            for (var i = 0; i < articlesNode.length; i++) {
                var objEntry = articlesNode[i].children[0].next;
                var obj = {
                    href: sites.svpino.url + objEntry.children[1].next.next.children[0].attribs.href.trim(),
                    date: objEntry.children[0].next.attribs.datetime.trim().replace(/-/g,"/"),
                    title: objEntry.children[1].next.next.children[0].children[0].data.trim()
                }
                obj.millis = dateToMillis(obj.date);
                saveEntries(obj, sites.svpino.tag);
            }
        }

    },

    rmurphey: function (error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var item = $('channel').children('item');

            for (var i = 0; i < item.length; i++) {
                var objEntry = item.eq(i);
                var obj = {
                    title: objEntry.find('title').text().trim(),
                    href: objEntry.find('link')[0].next.data.trim(),
                };
                var start = obj.href.indexOf('/201');
                obj.date = obj.href.substr(start + 1, 10);
                obj.millis = dateToMillis(obj.date);
                saveEntries(obj, sites.rmurphey.tag);
            }
        }
    },

    alistapart: function (error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var item = $('channel').children('item');

            for (var i = 0; i < item.length; i++) {
                var obj = {
                    date: item.eq(i).children().last().text().trim().slice(0, 10).replace(/-/g,"/"),
                    href: item.eq(i).find('guid').text().trim()
                };
                //remove CDATA stuff from title
                var title = item.eq(i).find('title').html();
                var start = title.lastIndexOf('[');
                var end = title.indexOf(']');
                obj.title = title.slice(start + 1, end).trim();
                obj.millis = dateToMillis(obj.date);
                saveEntries(obj, sites.alistapart.tag);
            }
        }
    },

    madhatted: function (error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var content = $('h1');

            for (var i = 0; i < content.length; i++) {
                var objEntry = content.get(i).children[0];
                var obj = {
                    href: objEntry.attribs.href.trim(),
                    title: objEntry.children[0].data.trim()
                };
                //Fix no leading zeroes on days and months entries:
                var href = obj.href;
                var monthSlashPosition = obj.href.indexOf("/", 6);
                var daySlashPosition = href.indexOf("/", monthSlashPosition + 1);
                obj.date = href.substring(1, 5) + "/" + (0 + href.substring(6, monthSlashPosition)).slice(-2) + "/" + (0 + href.substring(monthSlashPosition + 1, daySlashPosition)).slice(-2);
                obj.millis = dateToMillis(obj.date);
                obj.href = sites.madhatted.url + obj.href;
                saveEntries(obj, sites.madhatted.tag);
            }
        }
    },

    sixrevisions: function (error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var $ = cheerio.load(body);
            var h1 = $('.main').find('h1');
            for (var i = 0; i < h1.length; i++) {
                var objEntry = h1.eq(i);
                var obj = {
                    href: objEntry.find('a').attr('href'),
                    title: objEntry.find('a').text().trim()
                };

                var articleRawDate = objEntry.next().text().trim();
                var month = articleRawDate.slice(0,3);
                var monthnumber = months.indexOf(month) + 1;
                obj.date = articleRawDate.substr(articleRawDate.indexOf(', 20') + 2, 4) 
                            + "/" + ("0" + monthnumber).slice(-2) 
                            + "/" + ("0" + articleRawDate.slice(4, articleRawDate.indexOf(','))).slice(-2);
                obj.millis = dateToMillis(obj.date);
                saveEntries(obj, sites.sixrevisions.tag);
            }
        }
    }
};
request(sites.svpino.url, fetchPageData.svpino);
request(sites.rmurphey.rss, fetchPageData.rmurphey);
request(sites.madhatted.url, fetchPageData.madhatted);
request(sites.alistapart.rss, fetchPageData.alistapart);
request(sites.sixrevisions.url, fetchPageData.sixrevisions);

app.listen(port);
console.log('server listening on port ' + port);
