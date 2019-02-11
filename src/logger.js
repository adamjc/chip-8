function logger (debug) {
  const logFunc = debug 
    ? debugLogger
    : noop

  return {
    log: logFunc
  }
}

function noop () {}

function debugLogger (text, label = '') {
  console.log(`${label} 0x${text.toString(16).padStart(4, '0')}`)
}

export default logger