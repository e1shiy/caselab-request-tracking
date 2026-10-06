import { describe, expect, it } from '@jest/globals';

import { equalizeTiming, hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('hashPassword', () => {
  it('проверяет правильный пароль и отвергает неверный', async () => {
    const hash = await hashPassword('ПарольТест123');

    expect(hash).not.toContain('ПарольТест123');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword('ПарольТест123', hash)).resolves.toBe(true);
    await expect(verifyPassword('парольтест123', hash)).resolves.toBe(false);
  });

  it('одинаковые пароли дают разные хеши (соль)', async () => {
    const [first, second] = await Promise.all([
      hashPassword('ОдинаковыйПароль1'),
      hashPassword('ОдинаковыйПароль1'),
    ]);

    expect(first).not.toBe(second);
    await expect(verifyPassword('ОдинаковыйПароль1', first)).resolves.toBe(true);
    await expect(verifyPassword('ОдинаковыйПароль1', second)).resolves.toBe(true);
  });
});

describe('verifyPassword', () => {
  it('не бросает на мусоре вместо хеша', async () => {
    await expect(verifyPassword('пароль', 'не-хеш')).resolves.toBe(false);
    await expect(verifyPassword('пароль', '')).resolves.toBe(false);
  });
});

describe('equalizeTiming', () => {
  it('возвращает false при неверном пароле', async () => {
    const hash = await hashPassword('ПравильныйПароль1');
    await expect(equalizeTiming('неправильный', hash)).resolves.toBe(false);
  });

  it('для неизвестного email сравнивает с dummy hash и тоже возвращает false', async () => {
    await expect(equalizeTiming('пароль', null)).resolves.toBe(false);
  });

  it('возвращает true для верной пары', async () => {
    const hash = await hashPassword('ПравильныйПароль1');
    await expect(equalizeTiming('ПравильныйПароль1', hash)).resolves.toBe(true);
  });
});