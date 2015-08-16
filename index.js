'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports['default'] = exportVis;
exports.getVisUrl = getVisUrl;
exports.getVisJson = getVisJson;
exports.downloadVisualizationData = downloadVisualizationData;
exports.getSublayerSql = getSublayerSql;
exports.downloadSublayerData = downloadSublayerData;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

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

function exportVis(url) {
    var dest = arguments.length <= 1 || arguments[1] === undefined ? '.' : arguments[1];

    (0, _mkdirp2['default'])(dest, function () {
        getVisJson(url, _path2['default'].join(dest, 'viz.json'), function (visJson) {
            downloadVisualizationData(visJson, dest);
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
    (0, _request2['default'])(url).pipe(file);
}

function _downloadVisualizationData(visJson, destDir) {
    visJson.layers.forEach(function (layer, layerIndex) {
        if (layer.type !== 'layergroup') return;
        layer.options.layer_definition.layers.forEach(function (sublayer, sublayerIndex) {
            var dest = _path2['default'].join(destDir, 'layers', layerIndex.toString(), 'sublayers', sublayerIndex.toString(), 'layer.geojson');
            downloadSublayerData(visJson, layerIndex, sublayerIndex, dest);
        });
    });
}

/**
 * Download the layer data for a visualization.
 *
 * @param {Object|String} visJson the visualization's JSON or the url where it
 * can be found
 * @param {String} destDir the base directory where the data should be saved
 */

function downloadVisualizationData(visJson) {
    var destDir = arguments.length <= 1 || arguments[1] === undefined ? '.' : arguments[1];

    if (typeof visJson === 'string') {
        _fs2['default'].readFile(visJson, function (err, data) {
            if (err) throw err;
            _downloadVisualizationData(JSON.parse(data), destDir);
        });
    } else {
        _downloadVisualizationData(visJson, destDir);
    }
}

function getLayerSqlUrl(layer) {
    var options = layer.options;
    return ('' + options.sql_api_template + options.sql_api_endpoint).replace('{user}', options.user_name);
}

function getSublayerSql(sublayer) {
    var sql = sublayer.options.sql,
        geomNotNull = 'the_geom IS NOT NULL';
    if (sql.toLowerCase().indexOf('where') >= 0) {
        sql += ' AND ';
    } else {
        sql += ' WHERE ';
    }
    return sql + geomNotNull;
}

/**
 * Download the data for a single sublayer.
 *
 * @param {Object} visJson the visualization's JSON
 * @param {Number} layerIndex the index of the layer
 * @param {Number} sublayerIndex the index of the sublayer
 * @param {String} dest the directory to save the sublayer's data in
 */

function downloadSublayerData(visJson, layerIndex, sublayerIndex, dest) {
    var layer = visJson.layers[layerIndex],
        sublayer = layer.options.layer_definition.layers[sublayerIndex];

    (0, _mkdirp2['default'])(_path2['default'].dirname(dest), function () {
        (0, _request2['default'])({
            url: getLayerSqlUrl(layer),
            qs: {
                format: 'GeoJSON',
                q: getSublayerSql(sublayer)
            }
        }).pipe(_fs2['default'].createWriteStream(dest));
    });
}
