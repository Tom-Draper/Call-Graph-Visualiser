const fs = require('fs')


function collectImports(lines) {
  let file_imports = { importOrigin: {}, simpleImports: [], aliases: {} }
  const fromImport = /from (?<origin>.*) import (?<import>.*)/
  const aliasImport = /import (?<import>.*) as (?<alias>.*)/
  const simpleImport = /^import (?<import>.[a-z0-9_.-]+)/

  let found = null
  for (let line of lines) {
    found = line.match(fromImport)
    if (found != null) {
      let imports = found.groups.import.split(', ')
      for (let im of imports) {
        file_imports['importOrigin'][im] = found.groups.origin
      }
    }

    found = line.match(simpleImport)
    if (found != null) {
      let imports = found.groups.import.split(', ')
      for (let im of imports) {
        file_imports['simpleImports'].push(im)
      }
    }

    found = line.match(aliasImport)
    if (found != null) {
      file_imports['aliases'][found.groups.import] = found.groups.alias
    }
  }

  return file_imports
}

function lineIndent(line, indentSize) {
  let spaces = line.match(/^([\s]+)/)
  if (spaces != null) {
    indent = spaces[0].length / indentSize
  } else {
    indent = 0
  }
  return indent
}

function adjustIndentation(indent, currentIndent, stack) {
  if (indent < currentIndent) {
    let diff = currentIndent - indent
    for (let i = 0; i < diff; i++) {
      stack.pop()
      currentIndent -= 1
    }
    currentIndent += 1
  } else if (indent + 1 == currentIndent) {
    stack.pop()
  } else {
    currentIndent += 1
  }
  return currentIndent
}

function test(nodes) {
  data_py_test = {
    'data.global': 1,
    'data.global.DF.__init__': 1,
    'data.global.DF.__str__': 1,
    'data.global.DF.save_to_html': 3,
    'data.global.Fixtures.__init__': 1,
  }

  let correct = 0
  let total = 0
  for (let key in data_py_test) {
    if (nodes[key].length == data_py_test[key]) {
      correct += 1
    }
    total += 1
  }
  let accuracy = correct / total
  console.log('Accuracy:', accuracy * 100, '%')
}

function lookForDefinition(regex, line, stack, currentIndent, indentSize) {
  let found = line.match(regex)
  if (found != null) {
    let indent = lineIndent(line, indentSize)

    currentIndent = adjustIndentation(indent, currentIndent, stack)

    stack.push({
      type: 'class',
      name: found.groups.name,
    })
  }
  return currentIndent
}

function getCalledFunctions(line) {
  const calledFuncRegex = /(?<calledFunction>[A-Za-z0-9_.]*[A-Za-z_]+)\(/
  // const calledFuncRegex = /(?<calledFunction>([a-zA-Z]+\([^\)]*\)(\.[^\)]*\))?))/;
  return [...line.matchAll(calledFuncRegex)]
}

function isUpperCase(str) {
  return str === str.toUpperCase();
}

function getClass(stack) {
  let funcsClass = null

  for (let s of stack) {
    if (isUpperCase(s.name[0])) {
      funcsClass = s.name
    }
  }

  return funcsClass
}

function insertCalledFunctions(line, nodes, stack) {
  let found = getCalledFunctions(line)
  if (found.length > 0) {
    for (let i = 0; i < found.length; i++) {
      let func = ''
      for (let s of stack) {
        func += '.' + s.name
      }
      func = func.slice(1)  // Remove dot from beginning 
      if (!(func in nodes)) {
        nodes[func] = []
      }
      let funcsClass = getClass(stack)
      nodes[func].push(found[i].groups.calledFunction.replace('self', funcsClass))
    }
  }
}

function emptyParentesis(calledFunc) {
  let openIdxs = []
  let closeIdxs = []
  for (let i in calledFunc) {
    if (calledFunc[i] == '(') {
      openIdxs.push(i)
    } else if (calledFunc[i] == ')') {
      closeIdxs.push(i)
    }
  }

  let newCalledFunc = null
  if (openIdxs.length == closeIdxs.length) {
    if (openIdxs[0] != closeIdxs[0] + 1) {
      newCalledFunc =
        calledFunc.slice(0, Number(openIdxs[0]) + 1) +
        calledFunc.slice(Number(closeIdxs[closeIdxs.length - 1]))
    }
  } else {
    console.log('Error:', calledFunc)
  }
  return newCalledFunc
}

function cleanNodes(nodes) {
  for (let func in nodes) {
    for (let i in nodes[func]) {
      nodes[func][i] = emptyParentesis(nodes[func][i])
    }
  }
}

function collected(nodes) {
  let count = 0
  for (let func in nodes) {
    count += nodes[func].length
  }
  return count
}

function fileText(path) {
  let s = path.replace('.py', '').split('/')
  return s[s.length-1]
}

function runFile(path) {
  let file = fileText(path)

  const classNameRegex = /class (?<name>[A-Za-z_]+)(\(.*\))?:/
  const funcNameRegex = /def (?<name>[A-Za-z_]+)/

  let nodes = {}
  try {
    let data = fs.readFileSync(path, 'utf8')
    let lines = data.toString().split('\r\n')

    let fileImports = collectImports(lines)
    console.log(fileImports)

    let stack = [{ type: 'global', name: file }]
    let indentSize = 4 // Spaces
    let currentIndent = 0
    for (let index in lines) {
      let line = lines[index]

      // Look for class definition
      currentIndent = lookForDefinition(
        classNameRegex,
        line,
        stack,
        currentIndent,
        indentSize,
      )

      // Look for function definition
      currentIndent = lookForDefinition(
        funcNameRegex,
        line,
        stack,
        currentIndent,
        indentSize,
      )

      // Look for a called function
      insertCalledFunctions(line, nodes, stack)
    }

    cleanNodes(nodes)

    console.log('Functions collected:', collected(nodes))

    console.log(nodes)
    // test(nodes)
  } catch (e) {
    console.log('Error:', e.stack)
  }

  return nodes
}

function run() {
  let nodes = runFile('./code/data.py')
  
  var saveJson = JSON.stringify(nodes, null, 4)
  fs.writeFile('nodes.json', saveJson, 'utf8', (err)=>{
      if(err){
          console.log(err)
      }
  })
}

module.exports = {
  run
}