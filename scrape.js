/*
#!/usr/bin/env node
*/
var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var app = express();
var maxNumberArticles = 25;
var Firebase = require('firebase');
var FIREBASE_URL = 'https://scrap-dev-news.firebaseio.com/';
var rootRef = new Firebase(FIREBASE_URL);
var sites = {
    svpino: {
        name: 'Shifted Up',
        url: 'https://www.shiftedup.com/',
        tag: 'svp'
    },
    rmurphey: {
        name: 'Rebecca Murphey',
        url: 'http://rmurphey.com/',
        rss: 'http://rmurphey.com/feed.xml',
        tag: 'mur'
    },
    madhatted: {
        name: 'Mad Hatted',
        url: 'http://madhatted.com/',
        tag: 'mad'
    },
    alistapart: {
        name: 'A List Apart',
        url: 'http://alistapart.com/articles/',
        rss: 'http://alistapart.com/main/feed',
        tag: 'ala'
    },
    sixrevisions: {
        name: 'Six Revisions',
        url: 'http://sixrevisions.com/',
        tag: 'six'
    },
    lobsters: {
        name: 'Lobsters',
        url: 'https://lobste.rs/hottest.json',
        tag: 'lob'
    },
    hackernews: {
        name: 'Hacker News',
        url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        tag: 'hac',
        max: maxNumberArticles
    },
    r_cscareerquestions: {
        name: 'r/cscareerquestions',
        url: 'https://www.reddit.com/r/cscareerquestions.json?limit=' + maxNumberArticles,
        tag: 'rcq'
    },
    r_frontend: {
        name: 'r/frontend',
        url: 'https://www.reddit.com/r/frontend.json?limit=' + maxNumberArticles,
        tag: 'rfe'
    },
    r_javascript: {
        name: 'r/javascript',
        url: 'https://www.reddit.com/r/javascript.json?limit=' + maxNumberArticles,
        tag: 'rjs'
    },
    r_learnprogramming: {
        name: 'r/learnprogramming',
        url: 'https://www.reddit.com/r/learnprogramming.json?limit=' + maxNumberArticles,
        tag: 'rle'
    },
    r_webdev: {
        name: 'r/webdev',
        url: 'https://www.reddit.com/r/webdev.json?limit=' + maxNumberArticles,
        tag: 'rwd'
    }
};

var saveEntriesToDB = function(obj, tag) {
    rootRef.child(
        "sites/"
        + tag
        + "/"
        + obj.date.replace(/\//g, "-")
        + "&"
        + obj.title.slice(-4).replace(/[.#$/\[\]\s]+/g, "-") //firebase doesnt allow these characters in keys
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

var parseSubredditAndStoreInDB = function(error, resp, body, subreddit) {
    if (!error && resp.statusCode == 200) {
        var rawObj = JSON.parse(body);
        var articles = rawObj.data.children;
        
        rootRef.child("sites/" + subreddit.tag + "/").remove(function(err) {
            if (!err) {
                for (var i = 0; i < articles.length; i++) {
                    var obj = {
                        tag: subreddit.tag,
                        url: articles[i].data.url.trim() || "",
                        title: articles[i].data.title.trim() || "(N/A)",
                        millis: articles[i].data.created_utc * 1000 || null,
                        commenturl: "https://www.reddit.com" + articles[i].data.permalink || "",
                        commentcount: articles[i].data.num_comments || 0
                    };
                    obj.date = millisToDate(obj.millis);
                    saveEntriesToDB(obj, subreddit.tag);
                }
            }
        });
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
                    tag: sites.svpino.tag,
                    url: sites.svpino.url + objEntry.children[1].next.next.children[0].attribs.href.trim() || "",
                    date: objEntry.children[0].next.attribs.datetime.trim().replace(/-/g, "/") || "",
                    title: objEntry.children[1].next.next.children[0].children[0].data.trim() || ""
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
                    tag: sites.rmurphey.tag,
                    title: objEntry.find('title').text().trim() || "(N/A)",
                    url: objEntry.find('link')[0].next.data.trim() || ""
                };
                var start = obj.url.indexOf('/201');
                obj.date = obj.url.substr(start + 1, 10) || "";
                obj.millis = dateToMillis(obj.date) || null;
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
                    tag: sites.alistapart.tag,
                    date: item.eq(i).children().last().text().trim().slice(0, 10).replace(/-/g, "/") || "",
                    url: item.eq(i).find('guid').text().trim() || ""
                };
                //remove CDATA stuff from title
                var title = item.eq(i).find('title').html();
                var start = title.lastIndexOf('[');
                var end = title.indexOf(']');
                obj.title = title.slice(start + 1, end).trim() || "";
                obj.millis = dateToMillis(obj.date) || null;
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
                    tag: sites.madhatted.tag,
                    url: objEntry.attribs.href.trim() || "",
                    title: objEntry.children[0].data.trim() || "(N/A)"
                };
                var monthSlashPosition = obj.url.indexOf("/", 6);
                var daySlashPosition = obj.url.indexOf("/", monthSlashPosition + 1);
                obj.date = obj.url.substring(1, 5) + "/" 
                            + ("0" + obj.url.substring(6, monthSlashPosition)).slice(-2) + "/" 
                            + (0 + obj.url.substring(monthSlashPosition + 1, daySlashPosition)).slice(-2) || "";
                obj.millis = dateToMillis(obj.date) || null;
                obj.url = sites.madhatted.url + obj.url || "";
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
                    tag: sites.sixrevisions.tag,
                    url: objEntry.find('a').attr('href') || "",
                    title: objEntry.find('a').text().trim() || "(N/A)"
                };

                var articleRawDate = objEntry.next().text().trim();
                var month = articleRawDate.slice(0, 3);
                var monthnumber = months.indexOf(month) + 1;
                obj.date = articleRawDate.substr(articleRawDate.indexOf(', 20') + 2, 4)
                    + "/" + ("0" + monthnumber).slice(-2)
                    + "/" + ("0" + articleRawDate.slice(4, articleRawDate.indexOf(','))).slice(-2) || "";
                obj.millis = dateToMillis(obj.date) || null;
                saveEntriesToDB(obj, sites.sixrevisions.tag);
            }
        }
    },

    hackernews: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var articles = JSON.parse(body);
            
            rootRef.child("sites/" + sites.hackernews.tag + "/").remove(function(err) {
                if (!err) {
                    for(var i = 0 ; i < sites.hackernews.max ; i++) {
                        var url = 'https://hacker-news.firebaseio.com/v0/item/' + articles[i] + '.json';
                        request(url, function(err, res, bod) {
                            if (!error && resp.statusCode == 200) {
                                bod = JSON.parse(bod);
                                var obj = {
                                    tag: sites.hackernews.tag,
                                    url: bod.url || "",
                                    title: bod.title || "(N/A)",
                                    millis: bod.time * 1000 || null,
                                    commenturl: 'https://news.ycombinator.com/item?id=' + bod.id || "",
                                    commentcount: bod.descendants || 0
                                };
                                var date = new Date(obj.millis);
                                obj.date = date.getFullYear() + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + "/" + ("0" + date.getDate()).slice(-2);
                                saveEntriesToDB(obj, sites.hackernews.tag);
                            }
                        });
                    } //for
                } //if !err
            }); //rootRef
        } //if error
    },

    lobsters: function(error, resp, body) {
        if (!error && resp.statusCode == 200) {
            var articles = JSON.parse(body);
            
            rootRef.child("sites/" + sites.lobsters.tag + "/").remove(function(err) {
                if (!err) {
                    for (var i = 0; i < maxNumberArticles; i++) {
                        var obj = {
                            tag: sites.lobsters.tag,
                            url: articles[i].url.trim() || "",
                            title: articles[i].title.trim() || "",
                            date: articles[i].created_at.slice(0,10).replace(/-/g, "/") || "",
                            commenturl: articles[i].comments_url || "",
                            commentcount: articles[i].comment_count || 0
                        };
                        obj.millis = new Date(articles[0].created_at).getTime() || null;
                        saveEntriesToDB(obj, sites.lobsters.tag);
                    } //for
                } //if !err
            }); //rootRef
        }
    },

    r_cscareerquestions: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_cscareerquestions);
    },

    r_frontend: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_frontend);
    },

    r_javascript: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_javascript);
    },

    r_learnprogramming: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_learnprogramming);
    },

    r_webdev: function(error, resp, body) {
        parseSubredditAndStoreInDB(error, resp, body, sites.r_webdev);
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
request(sites.r_cscareerquestions.url, fetchPageData.r_cscareerquestions);
request(sites.r_frontend.url, fetchPageData.r_frontend);
request(sites.r_javascript.url, fetchPageData.r_javascript);
request(sites.r_learnprogramming.url, fetchPageData.r_learnprogramming);
request(sites.r_webdev.url, fetchPageData.r_webdev);

//other
request(sites.hackernews.url, fetchPageData.hackernews);
request(sites.lobsters.url, fetchPageData.lobsters);

rootRef.child("settings/").update({ lastupdate: Firebase.ServerValue.TIMESTAMP });
