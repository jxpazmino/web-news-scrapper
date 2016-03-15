#!/usr/bin/env node

var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var app = express();
var maxNumberArticles = 20;
var Firebase = require('firebase');
var FIREBASE_URL = 'https://scrap-dev-news.firebaseio.com/';
var ref = new Firebase(FIREBASE_URL);
var sites = {
    svpino: {
        url: 'https://www.shiftedup.com/',
        tag: 'sv'
    },
    rmurphey: {
        url: 'http://rmurphey.com/',
        rss: 'http://rmurphey.com/feed.xml',
        tag: 'mu'
    },
    madhatted: {
        url: 'http://madhatted.com/',
        tag: 'mh'
    },
    alistapart: {
        url: 'http://alistapart.com/articles/',
        rss: 'http://alistapart.com/main/feed',
        tag: 'al'
    },
    sixrevisions: {
        url: 'http://sixrevisions.com/',
        tag: 'si'
    },
    lobsters: {
        url: 'https://lobste.rs/hottest.json',
        tag: 'lo'
    },
    hackernews: {
        url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        tag: 'hn',
        max: maxNumberArticles
    },
    r_cscareerquestions: {
        url: 'https://www.reddit.com/r/cscareerquestions.json?limit=' + maxNumberArticles,
        tag: 'rc'
    },
    r_cseducation: {
        url: 'https://www.reddit.com/r/cseducation.json?limit=' + maxNumberArticles,
        tag: 're'
    },
    r_csinterviewproblems: {
        url: 'https://www.reddit.com/r/csinterviewproblems.json?limit=' + maxNumberArticles,
        tag: 'ri'
    },
    r_firebase: {
        url: 'https://www.reddit.com/r/firebase.json?limit=' + maxNumberArticles,
        tag: 'rf'
    },
    r_frontend: {
        url: 'https://www.reddit.com/r/frontend.json?limit=' + maxNumberArticles,
        tag: 'rd'
    },
    r_javascript: {
        url: 'https://www.reddit.com/r/javascript.json?limit=' + maxNumberArticles,
        tag: 'rj'
    },
    r_learnprogramming: {
        url: 'https://www.reddit.com/r/learnprogramming.json?limit=' + maxNumberArticles,
        tag: 'rl'
    },
    r_programming: {
        url: 'https://www.reddit.com/r/programming.json?limit=' + maxNumberArticles,
        tag: 'rp'
    },
    r_webdev: {
        url: 'https://www.reddit.com/r/webdev.json?limit=' + maxNumberArticles,
        tag: 'rw'
    }
};

var saveEntriesToDB = function(obj, site) {
    ref.child(
        "sites/"
        + site
        + "/articles/"
        + obj.date.replace(/\//g, "-")
        + "&"
        + obj.title.slice(-4).replace(/[.#$/\[\]\s]/g, "-") //firebase doesnt allow these characters in keys
        + obj.title.length
    ).update(obj);
};

var millisToDate = function(millis) {
    var d = new Date(millis);
    return d.getFullYear() + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2);
}

var dateToMillis = function(date) {
    var d = new Date(date);
    return d.getTime();
}

var fullDateToMillis = function(fulldate) {
    
}

var parseSubredditAndStoreInDB = function(error, resp, body, subredditTag) {
    if (!error && resp.statusCode == 200) {
        var rawObj = JSON.parse(body);
        var articles = rawObj.data.children;
        console.log(articles[1])
        for (var i = 0; i < articles.length; i++) {
            var obj = {
                href: articles[i].data.url.trim(),
                title: articles[i].data.title.trim(),
                millis: articles[i].data.created * 1000,
                comments: "https://www.reddit.com" + articles[i].data.permalink
            };
            obj.date = millisToDate(obj.millis);
            saveEntriesToDB(obj, subredditTag);
        }
    }
}

var fetchPageData = {

    svpino: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var articlesNode = $('article');

            for (var i = 0; i < articlesNode.length; i++) {
                var objEntry = articlesNode[i].children[0].next;
                var obj = {
                    href: sites.svpino.url + objEntry.children[1].next.next.children[0].attribs.href.trim(),
                    date: objEntry.children[0].next.attribs.datetime.trim().replace(/-/g, "/"),
                    title: objEntry.children[1].next.next.children[0].children[0].data.trim()
                }
                obj.millis = dateToMillis(obj.date);
                saveEntriesToDB(obj, sites.svpino.tag);
            }
        }

    },

    rmurphey: function(error, resp, body) {
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
                saveEntriesToDB(obj, sites.rmurphey.tag);
            }
        }
    },

    alistapart: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var item = $('channel').children('item');

            for (var i = 0; i < item.length; i++) {
                var obj = {
                    date: item.eq(i).children().last().text().trim().slice(0, 10).replace(/-/g, "/"),
                    href: item.eq(i).find('guid').text().trim()
                };
                //remove CDATA stuff from title
                var title = item.eq(i).find('title').html();
                var start = title.lastIndexOf('[');
                var end = title.indexOf(']');
                obj.title = title.slice(start + 1, end).trim();
                obj.millis = dateToMillis(obj.date);
                saveEntriesToDB(obj, sites.alistapart.tag);
            }
        }
    },

    madhatted: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var $ = cheerio.load(body);
            var content = $('h1');

            for (var i = 0; i < content.length; i++) {
                var objEntry = content.get(i).children[0];
                var obj = {
                    href: objEntry.attribs.href.trim(),
                    title: objEntry.children[0].data.trim()
                };
                var monthSlashPosition = obj.href.indexOf("/", 6);
                var daySlashPosition = obj.href.indexOf("/", monthSlashPosition + 1);
                obj.date = obj.href.substring(1, 5) + "/" 
                            + ("0" + obj.href.substring(6, monthSlashPosition)).slice(-2) + "/" 
                            + (0 + obj.href.substring(monthSlashPosition + 1, daySlashPosition)).slice(-2);
                obj.millis = dateToMillis(obj.date);
                obj.href = sites.madhatted.url + obj.href;
                saveEntriesToDB(obj, sites.madhatted.tag);
            }
        }
    },

    sixrevisions: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var $ = cheerio.load(body);
            var h1 = $('.main').find('h1');
            for (var i = 0; i < h1.length; i++) {
                var objEntry = h1.eq(i);
                var obj = {
                    href: objEntry.find('a').attr('href'),
                    title: objEntry.find('a').text().trim()
                };

                var articleRawDate = objEntry.next().text().trim();
                var month = articleRawDate.slice(0, 3);
                var monthnumber = months.indexOf(month) + 1;
                obj.date = articleRawDate.substr(articleRawDate.indexOf(', 20') + 2, 4)
                    + "/" + ("0" + monthnumber).slice(-2)
                    + "/" + ("0" + articleRawDate.slice(4, articleRawDate.indexOf(','))).slice(-2);
                obj.millis = dateToMillis(obj.date);
                saveEntriesToDB(obj, sites.sixrevisions.tag);
            }
        }
    },

    hackernews: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var articles = JSON.parse(body);
            
            for(var i = 0 ; i < sites.hackernews.max ; i++) {
                var url = 'https://hacker-news.firebaseio.com/v0/item/' + articles[i] + '.json';
                request(url, function(err, res, bod) {
                    if (!error && resp.statusCode == 200) {
                        bod = JSON.parse(bod);
                        var obj = {
                            href: bod.url.trim(),
                            title: bod.title.trim(),
                            millis: bod.time * 1000,
                            comments: 'https://news.ycombinator.com/item?id=' + bod.id
                        };
                        var date = new Date(obj.millis);
                        obj.date = date.getFullYear() + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + "/" + ("0" + date.getDate()).slice(-2);
                        saveEntriesToDB(obj, sites.hackernews.tag);
                    }
                });
            }
            
            // for(var i = 0 ; i < sites.hackernews.max ; i++) {
            //     var url = 'https://hacker-news.firebaseio.com/v0/item/' + articles[i] + '.json';
            //     request(url, function(err, res, bod) {
            //         if (!error && resp.statusCode == 200) {
            //             bod = JSON.parse(bod);
            //             console.log(bod.title);
            //         }
            //     });
            // }
        }
    },

    lobsters: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var articles = JSON.parse(body);
            for (var i = 0; i < maxNumberArticles; i++) {
                var obj = {
                    href: articles[i].url.trim(),
                    title: articles[i].title.trim(),
                    date: articles[i].created_at.slice(0,10).replace(/-/g, "/"),
                    comments: articles[i].comments_url
                };
                obj.millis = new Date(articles[0].created_at).getTime();
                saveEntriesToDB(obj, sites.lobsters.tag);
            }
        }
    },

    r_cscareerquestions: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_cscareerquestions.tag);
    },

    r_cseducation: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_cseducation.tag);
    },

    r_csinterviewproblems: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_csinterviewproblems.tag);
    },

    r_firebase: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_firebase.tag);
    },

    r_frontend: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_frontend.tag);
    },

    r_javascript: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_javascript.tag);
    },

    r_learnprogramming: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_learnprogramming.tag);
    },

    r_programming: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_programming.tag);
    },

    r_webdev: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_webdev.tag);
    }
};


app.set('port', (process.env.PORT || 5000));

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});

//blogs
request(sites.svpino.url, fetchPageData.svpino);
request(sites.madhatted.url, fetchPageData.madhatted);
request(sites.rmurphey.rss, fetchPageData.rmurphey);

request(sites.alistapart.rss, fetchPageData.alistapart);
request(sites.sixrevisions.url, fetchPageData.sixrevisions);

//reddit
request(sites.r_csinterviewproblems.url, fetchPageData.r_csinterviewproblems);
request(sites.r_cseducation.url, fetchPageData.r_cseducation);
request(sites.r_cscareerquestions.url, fetchPageData.r_cscareerquestions);
request(sites.r_firebase.url, fetchPageData.r_firebase);
request(sites.r_frontend.url, fetchPageData.r_frontend);
request(sites.r_javascript.url, fetchPageData.r_javascript);
request(sites.r_learnprogramming.url, fetchPageData.r_learnprogramming);
request(sites.r_programming.url, fetchPageData.r_programming);
request(sites.r_webdev.url, fetchPageData.r_webdev);

//other
request(sites.hackernews.url, fetchPageData.hackernews);
request(sites.lobsters.url, fetchPageData.lobsters);

ref.child("settings/").update({ lastupdate: Firebase.ServerValue.TIMESTAMP });

console.log("Processing " + Object.keys(sites).length + " sites");