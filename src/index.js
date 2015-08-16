import fs from 'fs';
import https from 'https';
import mkdirp from 'mkdirp';
import path from 'path';
import request from 'request';

/**
 * Export a visualization at the given url.
 *
 * @param {String} url the visualization's url
 * @param {String} dest the directory to export the visualization into
 *
 * @example
 * exportVis('https://eric.cartodb.com/api/v2/viz/85c59718-082c-11e3-86d3-5404a6a69006/viz.json', 'my_vis');
 */
export default function exportVis(url, dest = '.') {
    mkdirp(dest, function () {
        getVisJson(url, path.join(dest, 'viz.json'), function (visJson) {
            downloadVisualizationData(visJson, dest);
        });
    });
}

export function getVisUrl(url) {
    // TODO convert from
    // https://eric.cartodb.com/viz/85c59718-082c-11e3-86d3-5404a6a69006/public_map
    // to
    // https://eric.cartodb.com/api/v2/viz/85c59718-082c-11e3-86d3-5404a6a69006/viz.json
}

/**
 * Get a visualization JSON file.
 *
 * @param {String} url the visualization's url
 * @param {String} dest the path to save the JSON to
 * @param {Function} callback optional function to call once JSON has been
 * downloaded.
 */
export function getVisJson(url, dest, callback) {
    var file = fs.createWriteStream(dest)
        .on('close', function () {
            if (callback) {
                fs.readFile(dest, function (err, data) {
                    callback(JSON.parse(data));
                });
            }
        });
    request(url).pipe(file)
}

function _downloadVisualizationData(visJson, destDir) {
    visJson.layers.forEach(function (layer, layerIndex) {
        if (layer.type !== 'layergroup') return;
        layer.options.layer_definition.layers.forEach(function (sublayer, sublayerIndex) {
            var dest = path.join(destDir, 'layers', layerIndex.toString(), 'sublayers', sublayerIndex.toString(), 'layer.geojson');
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
export function downloadVisualizationData(visJson, destDir = '.') {
    if (typeof visJson === 'string') {
        fs.readFile(visJson, function (err, data) {
            if (err) throw err;
            _downloadVisualizationData(JSON.parse(data), destDir);
        });
    }
    else {
        _downloadVisualizationData(visJson, destDir);
    }
}

function getLayerSqlUrl(layer) {
    var options = layer.options;
    return `${options.sql_api_template}${options.sql_api_endpoint}`.replace('{user}', options.user_name);
}

function getSublayerSql(sublayer) {
    var sql = sublayer.options.sql,
        geomNotNull = 'the_geom IS NOT NULL';
    if (sql.toLowerCase().indexOf('where') >= 0) {
        sql += ' AND ';
    }
    else {
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
export function downloadSublayerData(visJson, layerIndex, sublayerIndex, dest) {
    var layer = visJson.layers[layerIndex],
        sublayer = layer.options.layer_definition.layers[sublayerIndex];

    mkdirp(path.dirname(dest), function () {
        request({
            url: getLayerSqlUrl(layer),
            qs: {
                format: 'GeoJSON',
                q: getSublayerSql(sublayer)
            }
        }).pipe(fs.createWriteStream(dest));
    });
}
