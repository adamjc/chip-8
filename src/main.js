import chip8 from './chip-8'

chip8.memory[0x200] = 0x00
chip8.memory[0x201] = 0xE0

chip8.cycle()

chip8.memory[0x202] = 0x50
chip8.memory[0x203] = 0x00

chip8.cycle()