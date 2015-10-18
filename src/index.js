import _ from 'underscore';
import fs from 'fs';
import https from 'https';
import { lexer, nodes, parser } from 'sql-parser';
import mkdirp from 'mkdirp';
import path from 'path';
import request from 'request';

import { cartocss2leaflet } from 'cartocss2leaflet';

/**
 * Export a visualization at the given url.
 *
 * @param {String} url the visualization's url
 * @param {String} dest the directory to export the visualization into
 *
 * @example
 * exportVis('https://eric.cartodb.com/api/v2/viz/85c59718-082c-11e3-86d3-5404a6a69006/viz.json', 'my_vis');
 */
export function exportVis(url, dest = '.') {
    mkdirp(dest, function () {
        getVisJson(url, path.join(dest, 'viz.json'), function (visJson) {
            downloadVisualizationData(visJson, dest);
            convertStyles(visJson, dest);
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
    request(url).pipe(file);
}

function sublayerDir(destDir, layerIndex, sublayerIndex) {
    return path.join(destDir, 'layers', layerIndex.toString(), 'sublayers', sublayerIndex.toString());
}

/**
 * Download the layer data for a visualization.
 *
 * @param {Object|String} visJson the visualization's JSON or the url where it
 * can be found
 * @param {String} destDir the base directory where the data should be saved
 */
export function downloadVisualizationData(_visJson, destDir = '.') {
    withVisJson(_visJson, (err, visJson) => {
        visJson.layers.forEach(function (layer, layerIndex) {
            if (layer.type !== 'layergroup') return;
            layer.options.layer_definition.layers.forEach(function (sublayer, sublayerIndex) {
                var dest = path.join(sublayerDir(destDir, layerIndex, sublayerIndex), 'layer.geojson');
                downloadSublayerData(visJson, layerIndex, sublayerIndex, dest);
            });
        });
    });
}

function withVisJson(visJson, callback) {
    if (typeof visJson === 'string') {
        fs.readFile(visJson, function (err, data) {
            if (err) return callback(err);
            callback(null, JSON.parse(data));
        });
    }
    else {
        callback(null, visJson);
    }
}

/**
 * Convert the styles for a visualization.
 *
 * @param {Object|String} visJson the visualization's JSON or the url where it
 * can be found
 * @param {String} destDir the base directory where the styles should be saved
 */
export function convertStyles(_visJson, destDir = '.') {
    withVisJson(_visJson, (err, visJson) => {
        visJson.layers.forEach(function (layer, layerIndex) {
            if (layer.type !== 'layergroup') return;
            layer.options.layer_definition.layers.forEach(function (sublayer, sublayerIndex) {
                var dest = path.join(sublayerDir(destDir, layerIndex, sublayerIndex), 'style.json');
                convertSublayerStyle(visJson, layerIndex, sublayerIndex, dest);
            });
        });
    });
}

function getLayerSqlUrl(layer) {
    var options = layer.options;
    return `${options.sql_api_template}${options.sql_api_endpoint}`.replace('{user}', options.user_name);
}

export function getSublayerSql(sublayer) {
    var sql = sublayer.options.sql,
        tokens = lexer.tokenize(sql),
        parsed = parser.parse(tokens),
        whereCondition = new nodes.Op('IS NOT', new nodes.LiteralValue('the_geom'), new nodes.BooleanValue('NULL'));

    // Parse the original SQL and add 'WHERE the_geom IS NOT NULL' appropriately
    if (!parsed.where) {
        parsed.where = new nodes.Where(whereCondition);
    }
    else {
        var originalConditions = _.extend({}, parsed.where.conditions);
        parsed.where.conditions = new nodes.Op('AND', originalConditions, whereCondition);
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
 */
export function convertSublayerStyle(visJson, layerIndex, sublayerIndex, dest) {
    var layer = visJson.layers[layerIndex],
        sublayer = layer.options.layer_definition.layers[sublayerIndex];

    mkdirp(path.dirname(dest), function () {
        var style = cartocss2leaflet(sublayer.options.cartocss);
        fs.writeFile(dest, JSON.stringify(style), (err) => {
            if (err) {
                console.error(err);
            }
        });
    });
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
