function logger (debug) {
  const logFunc = debug 
    ? debugLogger
    : noop

  return {
    log: logFunc
  }
}

function noop () {}

function debugLogger (label = '', value = '') {
  const stringValue = `0x${value.toString(16).padStart(4, '0').toUpperCase()}`
  
  if (!value) {
    console.log(`${label}`)
  } else if (!label) {
    console.log(stringValue)
  } else {
    console.log(`${label} ${stringValue}`)
  }
}

export default logger