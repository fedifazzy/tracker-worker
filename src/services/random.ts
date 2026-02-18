class Random {
  private readonly nicknames = [
    'Captain',
    'Maverick',
    'Goose',
    'Iceman',
    'Viper',
    'Jester',
    'Cougar',
    'Wolfman',
    'Slider',
    'Merlin',
    'Sundown',
    'Hollywood',
    'Stinger',
    'Chipper',
  ]

  async generateName() {
    return this.pick(this.nicknames)
  }

  pick<T>(list: Array<T>): T {
    return list[Math.floor(Math.random() * list.length)]
  }
}

export const random = new Random()
