import axios from 'axios'
class Random {
  async generateName() {
    const {data} = await axios.get<{RandL: {items: string[]}}>('https://www.randomlists.com/data/nicknames.json')
    return this.pick(data.RandL.items)
  }

  pick<T>(list: Array<T>): T {
    return list[Math.floor(Math.random() * list.length)]
  }
}

export const random = new Random()
