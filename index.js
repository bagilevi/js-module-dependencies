var babel = require('babel-core');
var fs = require('fs');

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

function convertSourceReference(fileRelPath) {
  return fileRelPath.substr(0, 2) == './' ? fileRelPath.substr(2) : fileRelPath;
}

function getImportsFromFile(filePath, callback) {
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
            convertSourceReference(getStringLiteralValue(node.source, 'ImportDeclaration source'))
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
            convertSourceReference(getStringLiteralValue(node.source, 'ImportDeclaration source'))
          ]
        );
      }
    });
    callback(imports);
  });
}

function getModuleDependenciesInProject(projectPath, callback) {
  var walk    = require('walk')
    , fs      = require('fs')
    , path    = require('path')
    , walker  = walk.walk(projectPath, { followLinks: false })
    ;
  var graph = {};

  function fileHandler(root, fileStat, next) {
    var filePath = root + '/' + fileStat.name
    var fileRelPath = filePath.substr(projectPath.length + 1)
    var fileRef = null;
    var ext = path.extname(fileRelPath);
    if (ext == '.js') {
      fileRef = fileRelPath.substr(0, fileRelPath.length - ext.length);
    } else throw `Expected .js extension, got: ${ext}`
    // console.log(fileRelPath);
    getImportsFromFile(filePath, function(imports) {
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
