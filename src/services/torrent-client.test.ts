import {describe, expect, it} from 'vitest'
import {localeIsUtf8} from './torrent-client'

describe('localeIsUtf8', () => {
  it('rejects the slim image default, which is what broke Cyrillic names', () => {
    expect(localeIsUtf8({})).toBe(false)
    expect(localeIsUtf8({LANG: ''})).toBe(false)
    expect(localeIsUtf8({LANG: 'POSIX'})).toBe(false)
    expect(localeIsUtf8({LANG: 'C'})).toBe(false)
  })

  it('accepts the spellings a UTF-8 locale actually comes in', () => {
    expect(localeIsUtf8({LANG: 'C.UTF-8'})).toBe(true)
    expect(localeIsUtf8({LANG: 'C.utf8'})).toBe(true)
    expect(localeIsUtf8({LANG: 'en_US.UTF-8'})).toBe(true)
    expect(localeIsUtf8({LANG: 'ru_RU.utf8'})).toBe(true)
  })

  it('lets the more specific variables win, as the C library does', () => {
    expect(localeIsUtf8({LANG: 'C.UTF-8', LC_ALL: 'POSIX'})).toBe(false)
    expect(localeIsUtf8({LANG: 'POSIX', LC_CTYPE: 'C.UTF-8'})).toBe(true)
  })
})
