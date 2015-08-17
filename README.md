cartodb-export
==============

A node module for exporting visualizations from CartoDB, either as a method of
backup or to move to a static server.


Usage
-----

You can use it as a module or as a command line script. To do the latter, clone
this repo, `npm install -g` and invoke the script:

    cartodb-export -d <directory> <visualizationUrl>


Contributing
------------

All code changes should be made in `src/index.js` and compiled using Babel into
the resulting `index.js`. Run `npm run watch` while editing to continuously
compile using Babel.


License
-------

MIT.
