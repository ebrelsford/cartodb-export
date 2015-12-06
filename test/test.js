var cdbExp = require('../index');
var chai = require('chai');
var assert = chai.assert;
var temp = require('temp');

describe('getSublayerSql()', function () {
    describe('success', function () {
        it('should add "AND"', function () {
            var sublayer = {
                options: {
                    sql: 'SELECT * FROM my_table WHERE id > 5'
                }
            };
            assert.match(cdbExp.getSublayerSql(sublayer), /AND \("the_geom" IS NOT NULL\)/);
        });

        it('should add "WHERE"', function () {
            var sublayer = {
                options: {
                    sql: 'SELECT * FROM my_table'
                }
            };
            assert.match(cdbExp.getSublayerSql(sublayer), /"the_geom" IS NOT NULL/);
        });

        it('should work with GROUP BY', function () {
            var sublayer = {
                options: {
                    sql: 'SELECT * FROM my_table GROUP BY hamster'
                }
            };
            assert.match(cdbExp.getSublayerSql(sublayer), /WHERE \("the_geom" IS NOT NULL\)/);
        });
    });
});

describe('exportVis()', function () {
    it('should call callback with valid url', function (done) {
        temp.mkdir('exportVis', function (err, dirPath) {
            if (err) return done(err);
            var url = 'https://eric.cartodb.com/api/v2/viz/4258b912-75dd-11e5-838b-0ea31932ec1d/viz.json';
            cdbExp.exportVis(url, dirPath, function (err) {
                if (err) return done(err);
                done();
            });
        });
    });
});
