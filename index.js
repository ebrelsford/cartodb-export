'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.exportVis = exportVis;
exports.getVisUrl = getVisUrl;
exports.getVisJson = getVisJson;
exports.downloadVisualizationData = downloadVisualizationData;
exports.getSublayerSql = getSublayerSql;
exports.downloadSublayerData = downloadSublayerData;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _sqlParser = require('sql-parser');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _progress = require('progress');

var _progress2 = _interopRequireDefault(_progress);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

/**
 * Export a visualization at the given url.
 *
 * @param {String} url the visualization's url
 * @param {String} dest the directory to export the visualization into
 *
 * @example
 * exportVis('https://eric.cartodb.com/api/v2/viz/85c59718-082c-11e3-86d3-5404a6a69006/viz.json', 'my_vis');
 */

function exportVis(url, dest, callback) {
    if (dest === undefined) dest = '.';

    (0, _mkdirp2['default'])(dest, function (err) {
        if (err && callback) return callback(err);
        getVisJson(url, _path2['default'].join(dest, 'viz.json'), function (visJson) {
            downloadVisualizationData(visJson, dest, callback);
        });
    });
}

function getVisUrl(url) {}
// TODO convert from
// https://eric.cartodb.com/viz/85c59718-082c-11e3-86d3-5404a6a69006/public_map
// to
// https://eric.cartodb.com/api/v2/viz/85c59718-082c-11e3-86d3-5404a6a69006/viz.json

/**
 * Get a visualization JSON file.
 *
 * @param {String} url the visualization's url
 * @param {String} dest the path to save the JSON to
 * @param {Function} callback optional function to call once JSON has been
 * downloaded.
 */

function getVisJson(url, dest, callback) {
    var file = _fs2['default'].createWriteStream(dest).on('close', function () {
        if (callback) {
            _fs2['default'].readFile(dest, function (err, data) {
                callback(JSON.parse(data));
            });
        }
    });
    var req = (0, _request2['default'])(url);
    req.pipe(file);

    // Show progress as file downloads
    req.on('response', function (res) {
        var len = parseInt(res.headers['content-length'], 10);
        var bar = new _progress2['default']('  downloading [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: len
        });

        res.on('data', function (chunk) {
            bar.tick(chunk.length);
        });

        res.on('end', function (chunk) {
            console.log('\n');
        });
    });
}

function sublayerDir(destDir, layerIndex, sublayerIndex) {
    return _path2['default'].join(destDir, 'layers', layerIndex.toString(), 'sublayers', sublayerIndex.toString());
}

/**
 * Download the layer data for a visualization.
 *
 * @param {Object|String} visJson the visualization's JSON or the url where it
 * can be found
 * @param {String} destDir the base directory where the data should be saved
 */

function downloadVisualizationData(_visJson, destDir, callback) {
    if (destDir === undefined) destDir = '.';

    withVisJson(_visJson, function (err, visJson) {
        if (err && callback) return callback(err);
        _async2['default'].forEachOf(visJson.layers, function (layer, layerIndex, callback) {
            if (layer.type !== 'layergroup') {
                if (callback) callback();
                return;
            }
            _async2['default'].forEachOf(layer.options.layer_definition.layers, function (sublayer, sublayerIndex, callback) {
                var dest = _path2['default'].join(sublayerDir(destDir, layerIndex, sublayerIndex), 'layer.geojson');
                downloadSublayerData(visJson, layerIndex, sublayerIndex, dest, callback);
            }, callback);
        }, callback);
    });
}

function withVisJson(visJson, callback) {
    if (typeof visJson === 'string') {
        _fs2['default'].readFile(visJson, function (err, data) {
            if (err) return callback(err);
            callback(null, JSON.parse(data));
        });
    } else {
        callback(null, visJson);
    }
}

function getLayerSqlUrl(layer) {
    var options = layer.options;
    return ('' + options.sql_api_template + options.sql_api_endpoint).replace('{user}', options.user_name);
}

function getSublayerSql(sublayer) {
    var sql = sublayer.options.sql,
        tokens = _sqlParser.lexer.tokenize(sql),
        parsed = _sqlParser.parser.parse(tokens),
        whereCondition = new _sqlParser.nodes.Op('IS NOT', new _sqlParser.nodes.LiteralValue('the_geom'), new _sqlParser.nodes.BooleanValue('NULL'));

    // Parse the original SQL and add 'WHERE the_geom IS NOT NULL' appropriately
    if (!parsed.where) {
        parsed.where = new _sqlParser.nodes.Where(whereCondition);
    } else {
        var originalConditions = _underscore2['default'].extend({}, parsed.where.conditions);
        parsed.where.conditions = new _sqlParser.nodes.Op('AND', originalConditions, whereCondition);
    }
    return parsed.toString().replace(/\n/g, ' ').replace(/`/g, '"');
}

/**
 * Download the data for a single sublayer.
 *
 * @param {Object} visJson the visualization's JSON
 * @param {Number} layerIndex the index of the layer
 * @param {Number} sublayerIndex the index of the sublayer
 * @param {String} dest the directory to save the sublayer's data in
 * @param {Function} callback called on success
 */

function downloadSublayerData(visJson, layerIndex, sublayerIndex, dest, callback) {
    var layer = visJson.layers[layerIndex],
        sublayer = layer.options.layer_definition.layers[sublayerIndex];

    (0, _mkdirp2['default'])(_path2['default'].dirname(dest), function () {
        var dataFile = _fs2['default'].createWriteStream(dest).on('close', function () {
            if (callback) {
                callback();
            }
        });

        var req = (0, _request2['default'])({
            url: getLayerSqlUrl(layer),
            qs: {
                format: 'GeoJSON',
                q: getSublayerSql(sublayer)
            }
        });

        req.pipe(dataFile);

        // Show progress as file downloads
        req.on('response', function (res) {
            var len = parseInt(res.headers['content-length'], 10);
            var bar = new _progress2['default']('  downloading [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: len
            });

            res.on('data', function (chunk) {
                bar.tick(chunk.length);
            });

            res.on('end', function (chunk) {
                console.log('\n');
            });
        });
    });
}
