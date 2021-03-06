#!/usr/bin/env node

var program = require('commander');

var exportVis = require('../index').exportVis;

program
    .version('0.1.2')
    .usage('[options] url')
    .option('-d, --dir [directory]', 'Specify the output directory [.]', '.')
    .parse(process.argv);

if (!program.args.length) {
    console.log('Please enter a url');
    program.outputHelp();
    process.exit(1);
}

var url = program.args[0];
console.log('Saving visualization in ' + program.dir);
exportVis(url, program.dir, function (err) {
    if (err) {
        console.error('Error exporting visualization:', err);
        return;
    }
    console.log('Done saving visualization');
});
