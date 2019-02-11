import loggerFactory from './logger' // laugh it up, Joel

const logger = new loggerFactory(true)

// Made with a loooot of help from this excellent resource: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM

// CHIP-8 Interpreter

// It has 16 8-bit data registers. V[0xF] is the carry register.
let vRegisters = new Array(16)

// It also has a 16-bit register, usually used for addressing memory
let iRegister

// It was originally designed to work on 4k computers, so lets give ourselves 4k of memory
// 0x0 -> 0x1FF is used to store the system font (it was originally used to store the interpreter data, back when it was ran on 4k systems)
// 0x200 -> 0xFFF is used to store the program data
let memory = new Array(4096)

// There are 2 timers, a delay timer and a sound timer, both decrease to 0 at a rate of 60Hz, once at 0 they stay there.
let delayTimer

// When the sound timer hits 0, a monotone sound is played.
let soundTimer

// And of course a (16-bit) program counter, starting at... 0x200 (where the program is loaded in!)
let pc = 0x200

// A stack pointer, allows us to have function calls. Documentation says it's 16 deep, but apparently only 10 are ever used? I'll stick with 16 just in case...
let sp = new Array(16)

// It utilises a 64x32 pixel display... we will get the chip-8 to write to these values, and in our `emulator` code, we will write these
// values to a screen. Simple! (should be!).
let display = new Array(64 * 32)

// does a cpu cycle innit.
function cycle () {
  // fetching from memory takes twoooo cycles, cos it's an 8-bit bus, but each instruction is 16-bits long. Neat-o. VLIW are lame.
  const inst = (memory[pc] << 8) + memory[pc + 1]
  
  // decode & execute (i'm too lazy to have them do separately, feels like a waste? We'll see...)
  decodeAndExecute(inst)
}

// aight we got a hex value now we need to look up what that means exactly
function decodeAndExecute(inst) {
  // Many of the instructions follow the structure below, so to make my life simpler, I will calculate these values from the instruction
  // We are using bitmasking to get these values. If you don't quite get what's happening here, look up https://en.wikipedia.org/wiki/Mask_(computing)
  const nnn = inst & 0x0FFF // nnn or addr - A 12-bit value, the lowest 12 bits of the instruction
  const n = inst & 0x000F // n or nibble - A 4-bit value, the lowest 4 bits of the instruction  
  const x = inst & 0x0F00 // x - A 4-bit value, the lower 4 bits of the high byte of the instructionction
  const y = inst & 0x00F0 // y - A 4-bit value, the upper 4 bits of the low byte of the instru  
  const kk = inst & 0x00FF // kk or byte - An 8-bit value, the lowest 8 bits of the instruction

  // gonna split this into 'macro level opcodes' and 'micro level opcodes', as the instructions can be indexed by the 
  // highest byte first, and then after that we can decide what to do...
  const highByte = inst & 0xF000
  // We... could use a switch statement here, but that would be insane, right? How about a map instead?
  const opcodes = {
    0x0000: clearAndReturnOpcodes,
    0x1000: jump
  }

  logger.log('inst', inst)

  opcodes[highByte](nnn)
}

function clearAndReturnOpcodes (nnn) {
  logger.log('clearAndReturnOpcodes')
}

function jump (nnn) {
  logger.log('jump')
}

// Return from sub routine
function returnFromSub () {
  // The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack pointer.
  logger.log('returnFromSub')
}

function clearScreen () {
  logger.log('clearScreen')
}

export default {
  cycle,
  display,
  memory
}