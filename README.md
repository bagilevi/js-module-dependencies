# js-module-dependencies

Find dependencies between JavaScript modules in a project.

Work-in-progress, currently supports `import`, `export ... from`.

## Installation

    npm install js-module-dependencies

## Usage

    var jsModuleDependecies = require('./index.js');

    jsModuleDependecies.getModuleDependenciesInProject(
      '/Users/lev/tmp/react-dnd/src',
      console.log
    );

Output:

    { DragDropContext:
       [ 'react',
         'dnd-core',
         'invariant',
         'utils/checkDecoratorArguments',
         'hoist-non-react-statics' ],
      DragLayer:
       [ 'react',
         'utils/shallowEqual',
         'utils/shallowEqualScalar',
         'lodash/isPlainObject',
         'invariant',
         'utils/checkDecoratorArguments',
         'hoist-non-react-statics' ],
    ...
