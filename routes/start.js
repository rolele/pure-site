'use strict';

var mediaQuery = require('css-mediaquery'),
    rework     = require('rework'),
    grids      = require('rework-pure-grids'),
    hbs        = require('../lib/hbs'),
    utils      = require('../lib/utils'),
    middleware = require('../middleware');

exports.index = [middleware.exposeTemplates('start'), showStart];
//exports.index = showStart;

// -----------------------------------------------------------------------------

/*
    Routes for /start/ could be any of the following:
    * `/start/`
    * `/start/?cols=6&med=48em&lrg=60em`
    * `/start/?cols=6&sm=screen and (min-device-width: 480px)`
*/
function showStart (req, res, next) {

    var query = normalizeQuery(utils.extend({}, req.query));


    if (isBelowColLimit(query.cols) && isBelowMqLimit(query.mediaQueries)) {
        query.css = rework('').use(grids.units(query.cols, {
            mediaQueries: query.mediaQueries.reduce(function (prev, curr) {
                prev[curr.id] = curr.value;
                return prev;
            }, {})
        })).toString();

        res.expose(query, 'start.query');
        res.expose({
            isBelowColLimit: isBelowColLimit,
            isBelowMqLimit: isBelowMqLimit
        }, 'start.utils');

        res.render('start', query);
    }
    else {
        if (!res.locals.message) {
            res.locals.message = 'To protect our servers from being overloaded, our online tool can only generate up to 100 columns and 20 media queries. Try again with a lower number of columns or media queries.';
        }
        next(utils.error(400));
    }
}

// Takes in a string input for number of columns and converts it into an array.
function normalizeCols (cols) {
    //cols will always be a string, so we can convert the string to an array of 1 or more integers.
    return cols.split(',').map(function (x) {
        return parseInt(x, 10);
    });
}

function isBelowColLimit (cols) {
    if (cols) {
        return (cols <= 100);
    }
    return true;

}

function isBelowMqLimit (mq) {
    if (mq && mq.length) {
        return (mq.length <= 20);
    }
    return true;
}

/*
Checks to see if media queries are valid, by following these steps:
    Does the query param value parse as a media query?
        If yes? return true.
        If not, then assume it's a width value, so wrap it with "screen and (min-width: " + value + ")"
    Does it now parse as a media query?
        If yes, return true.
        If not, return false.
*/
function isValidMQ (mqStr) {
    //This regex splits up a string that contains a sequences of letters or numbers ("48em", "480px") into an array of grouped letters and numbers (["48", "em"], ["480", "px"])
    var RE_SEPARATE_NUM_LETTERS = /[a-zA-Z]+|[0-9]+/g,
        captures;
    try {
        mediaQuery.parse(mqStr);
    } catch (e) {
        //invalid media query, so let's check that there's some floated value in here, and if there is, we will prepend/append some strings
        captures = mqStr.match(RE_SEPARATE_NUM_LETTERS);
        if (captures.length && captures.length === 2 && parseFloat(captures[0])) {
            mqStr = 'screen and (min-width: ' + mqStr + ')';
        }

        else {
            return false;
        }
        try {
            mediaQuery.parse(mqStr);
        } catch (e) {
            //still not a valid media query
            return false;
        }
    }

    return mqStr;
}

/*
    This function takes in a `req.query` object, validates all the media queries within it, removes the incorrect media queries, and then returns a modified `req.query` object, with only valid values within in.
*/
function normalizeQuery (obj) {
    var query = obj,
        mq = utils.extend({}, query);

    delete mq.cols;
    delete mq.fonts;
    delete mq.prefix;

    query.mediaQueries = [];

    //remove the media query from `query`, and add it as an array element if it's valid.
    Object.keys(mq).forEach(function (key) {
        var mqStr = isValidMQ(mq[key]);
        if (mqStr) {
            query.mediaQueries.push({id: key, value: mqStr});
        }
        delete query[key];
    });

    if (query.cols) {
        query.cols = normalizeCols(query.cols);
    }
    return query;
}
