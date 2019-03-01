const keyMap = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4': 'q',
  '5': 'w',
  '6': 'e',
  '7': 'a',
  '8': 's',
  '9': 'd',
  'a': 'z',
  '0': 'x',
  'b': 'c',
  'c': '4',
  'd': 'r',
  'e': 'f',
  'f': 'v'
}

const keys = {
  '1': false,
  '2': false,
  '3': false,
  'q': false,
  'w': false,
  'e': false,
  'a': false,
  's': false,
  'd': false,
  'z': false,
  'x': false,
  'c': false,
  '4': false,
  'r': false,
  'f': false,
  'v': false
}

function set (keyPress, value) {
  keys[keyPress] = value
}

function get (hexKey) {
  return keys[keyMap[hexKey.toString(16)]]
}

function getAny () {
  return Object.values(keys).reduce((key, current, index) => {
    const vmKey = Object.keys(keyMap)[index]
    if (key) {
      return key
    } else if (current) {
      return vmKey
    }
  }, null)
}

export default {
  keyMap,
  set,
  get,
  getAny
}