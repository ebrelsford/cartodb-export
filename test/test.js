var cdbExp = require('../index');
var chai = require('chai');
var assert = chai.assert;

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
