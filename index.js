var babel = require('babel-core');
var fs = require('fs');
var path = require('path');

function getStringLiteralValue(node, context) {
  if (node.type == 'StringLiteral') {
    return node.value;
  } else {
    throw(`${context}: expected StringLiteral, got ${node.type}`);
  }
}

function getIdentifierName(node, context) {
  if (node.type == 'Identifier') {
    return node.name;
  } else {
    throw(`${context}: expected Identifier, got ${node.type}`);
  }
}

function convertSourceReference(fileRelPath, filePath, projectPath) {
  if (fileRelPath.substr(0, 2) == './' || fileRelPath.substr(0, 3) == '../') {
    var targetFullPath = path.resolve(path.dirname(filePath), fileRelPath);
    return path.relative(projectPath, targetFullPath);
  }
  else {
    return fileRelPath;
  }
}

function getImportsFromFile(filePath, projectPath, callback) {
  fs.readFile(filePath, 'utf8', function(err, contents) {
    if (err) throw err;

    var result = babel.transform(contents, { presets: ['stage-0'], plugins: ['transform-react-jsx'] });
    var imports = [];

    result.ast.program.body.forEach(function(node){
      if (node.type == 'ImportDeclaration') {
        var importedElements = [];
        node.specifiers.forEach(function(specifierNode){
          if (specifierNode.type == 'ImportDefaultSpecifier') {
            importedElements.push('*');
          } else if (specifierNode.type == 'ImportSpecifier') {
            importedElements.push(getIdentifierName(specifierNode.imported, 'ImportDeclaration specifier'));
          } else throw('Unhandled specifier type: ' + specifierNode.type);
        });
        imports.push(
          [
            importedElements,
            convertSourceReference(
              getStringLiteralValue(node.source, 'ImportDeclaration source'),
              filePath,
              projectPath
            )
          ]
        );
      }
      else if (node.type == 'ExportNamedDeclaration' && node.source !== null) {
        var importedElements = [];
          node.specifiers.forEach(function(specifierNode){
          if (specifierNode.type == 'ExportSpecifier') {
            identifierName = getIdentifierName(specifierNode.local);
            importedElements.push(identifierName == 'default' ? '*' : identifierName);
          } else throw('Unhandled specifier type: ' + specifierNode.type);
        });
        imports.push(
          [
            importedElements,
            convertSourceReference(
              getStringLiteralValue(node.source, 'ImportDeclaration source'),
              filePath,
              projectPath
            )
          ]
        );
      }
    });
    callback(imports);
  });
}

function fileExistsSync(path) {
  try {
    fs.accessSync(path, fs.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function getIgnores(path) {
  var parser = require('gitignore-parser'),
      fs     = require('fs');

  var gitignore = null;
  if (fileExistsSync(path + '/.gitignore')) {
    gitignore = parser.compile(fs.readFileSync(path + '/.gitignore', 'utf8'));
  }
  var myignore = parser.compile(`
    example
    examples
    node_modules
    doc
    docs
    site
  `.trim());
  var accepts = function(path) {
    if (gitignore && gitignore.denies(path)) return false;
    if (myignore.denies(path)) return false;
    return true;
  }
  return {
    accepts: accepts,
    denies: function(path) { return !accepts(path); }
  }
}

function getModuleDependenciesInProject(projectPath, callback) {
  var walk    = require('walk')
    , fs      = require('fs')
    , path    = require('path')
    , walker  = walk.walk(projectPath, { followLinks: false })
    ;
  var graph = {};

  var ignores = getIgnores(projectPath);

  function fileHandler(root, fileStat, next) {
    var filePath = root + '/' + fileStat.name
    var fileRelPath = filePath.substr(projectPath.length + 1)
    var fileRef = null;
    var ext = path.extname(fileRelPath);

    if (ignores.denies(fileRelPath)) {
      return next();
    }
    if (ext != '.js') return next();

    fileRef = fileRelPath.substr(0, fileRelPath.length - ext.length);

    // console.log(fileRelPath);
    getImportsFromFile(filePath, projectPath, function(imports) {
      // console.log(imports);
      // console.log();
      graph[fileRef] = imports.map((pair) => pair[1]);
      next();
    });
  }

  function errorsHandler(root, nodeStatsArray, next) {
    nodeStatsArray.forEach(function (n) {
      console.error("[ERROR] " + n.name)
      console.error(n.error.message || (n.error.code + ": " + n.error.path));
    });
    next();
  }

  function endHandler() {
    // console.log("Graph:");
    // console.log(graph);
    callback(graph);
  }

  walker.on("file", fileHandler);
  walker.on("errors", errorsHandler); // plural
  walker.on("end", endHandler);
}

module.exports.getModuleDependenciesInProject = getModuleDependenciesInProject;
