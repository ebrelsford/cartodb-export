import _ from 'underscore';
import async from 'async';
import fs from 'fs';
import https from 'https';
import { lexer, nodes, parser } from 'sql-parser';
import mkdirp from 'mkdirp';
import path from 'path';
import ProgressBar from 'progress';
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
export function exportVis(url, dest = '.', callback) {
    mkdirp(dest, function (err) {
        if (err && callback) return callback(err);
        getVisJson(url, path.join(dest, 'viz.json'), function (visJson) {
            downloadVisualizationData(visJson, dest, callback);
        });
    });
}

/**
 * Convert a map's url into the viz.json url for that map.
 *
 * @param {String} url the map's url
 * @return {String} the viz.json url, if found
 */
export function getVisUrl(url) {
    var match = /https?:\/\/(\S+)\.cartodb\.com\/viz\/(\S+)\/(?:public_)?map/.exec(url);
    if (match) {
        var user = match[1],
            mapId = match[2];
        return `https://${user}.cartodb.com/api/v2/viz/${mapId}/viz.json`;
    }
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
    var req = request(url);
    req.pipe(file);

    // Show progress as file downloads
    req.on('response', function (res) {
        var len = parseInt(res.headers['content-length'], 10);
        var bar = new ProgressBar('  downloading [:bar] :percent :etas', {
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
    return path.join(destDir, 'layers', layerIndex.toString(), 'sublayers', sublayerIndex.toString());
}

/**
 * Download the layer data for a visualization.
 *
 * @param {Object|String} visJson the visualization's JSON or the url where it
 * can be found
 * @param {String} destDir the base directory where the data should be saved
 */
export function downloadVisualizationData(_visJson, destDir = '.', callback) {
    withVisJson(_visJson, (err, visJson) => {
        if (err && callback) return callback(err);
        async.forEachOf(visJson.layers, (layer, layerIndex, callback) => {
            if (layer.type !== 'layergroup') {
                if (callback) callback();
                return;
            }
            async.forEachOf(layer.options.layer_definition.layers, (sublayer, sublayerIndex, callback) => {
                var dest = path.join(sublayerDir(destDir, layerIndex, sublayerIndex), 'layer.geojson');
                downloadSublayerData(visJson, layerIndex, sublayerIndex, dest, callback);
            }, callback);
        }, callback);
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
 * @param {Function} callback called on success
 */
export function downloadSublayerData(visJson, layerIndex, sublayerIndex, dest, callback) {
    var layer = visJson.layers[layerIndex],
        sublayer = layer.options.layer_definition.layers[sublayerIndex];

    mkdirp(path.dirname(dest), function () {
        var dataFile = fs.createWriteStream(dest)
            .on('close', function () {
                if (callback) {
                    callback();
                }
            });

        var req = request({
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
            var bar = new ProgressBar('  downloading [:bar] :percent :etas', {
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
